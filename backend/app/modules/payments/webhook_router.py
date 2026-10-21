"""
Payment-rail webhooks.

Two rules apply to every provider:

1. Authenticity. Outside development/test, a provider whose signing secret is
   not configured is refused (503) rather than trusted, and a missing or
   invalid signature is always rejected (401). Previously Monnify and Zest
   accepted unsigned requests whenever their secret was empty — anyone could
   have credited a wallet or completed a disbursement.

2. Failure semantics. A handler that raises rolls back and returns 500 so the
   provider retries. The processed-event dedupe row rolls back with it, so the
   retry is processed cleanly. Previously these paths returned 200, which told
   the provider "delivered" and silently dropped the credit. Events we can
   never process (unknown customer, unsupported type) still return 200 from
   inside the handler.
"""

import hmac
import json
from collections.abc import Awaitable, Callable
from typing import Any

import structlog
from fastapi.responses import JSONResponse
from fastapi import APIRouter, HTTPException, Request, status

from app.core.rate_limit import get_client_ip
from app.core.config import get_settings
from app.core.deps import DbSession
from app.integrations.monnify.client import MonnifyClient
from app.integrations.monnify.constants import DISBURSEMENT_WEBHOOK_EVENTS, MONNIFY_WEBHOOK_IP
from app.integrations.paystack.client import PaystackClient
from app.integrations.paystack.constants import SUPPORTED_WEBHOOK_EVENTS
from app.integrations.stanbic.client import StanbicClient
from app.integrations.stanbic.constants import (
    SUPPORTED_WEBHOOK_EVENTS as STANBIC_WEBHOOK_EVENTS,
)
from app.integrations.stanbic.constants import (
    WEBHOOK_SIGNATURE_HEADER as STANBIC_SIGNATURE_HEADER,
)
from app.integrations.zest.client import ZestClient
from app.integrations.zest.constants import WEBHOOK_EVENT_TRANSACTION
from app.modules.payments.schemas import WebhookAckResponse
from app.modules.payments.webhook_service import WebhookService

logger = structlog.get_logger()

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

_LENIENT_ENVS = ("development", "test")


def _verify(
    provider: str,
    *,
    raw_body: bytes,
    signature: str | None,
    secret: str,
    verifier: Callable[[bytes, str | None], bool],
) -> None:
    """Enforce webhook authenticity (see module docstring, rule 1)."""
    lenient = get_settings().app_env in _LENIENT_ENVS
    if not secret:
        if lenient:
            return  # local development: allow unsigned test payloads
        logger.error("webhook_secret_missing", provider=provider)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{provider.title()} webhook secret not configured",
        )
    if not signature:
        if lenient:
            return
        logger.warning("webhook_missing_signature", provider=provider)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature")
    if not verifier(raw_body, signature):
        logger.warning("webhook_invalid_signature", provider=provider)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")


def _parse(raw_body: bytes) -> dict[str, Any]:
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    return payload


async def _dispatch(
    provider: str,
    event_type: str | None,
    db: DbSession,
    handler: Callable[[], Awaitable[None]],
) -> WebhookAckResponse:
    """Run a handler with rule 2 failure semantics."""
    try:
        await handler()
    except Exception as exc:
        await db.rollback()
        logger.exception("webhook_handler_error", provider=provider, webhook_event_type=event_type)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed; please retry",
        ) from exc
    return WebhookAckResponse()


@router.post("/monnify", response_model=WebhookAckResponse)
async def monnify_webhook(request: Request, db: DbSession) -> WebhookAckResponse:
    """Monnify webhook — HMAC-SHA512 over the raw body."""
    settings = get_settings()
    raw_body = await request.body()

    if settings.monnify_webhook_ip_check and settings.app_env not in _LENIENT_ENVS:
        # The real sender behind Railway's proxy (TRUSTED_PROXY_COUNT), not the proxy itself.
        client_ip = get_client_ip(request)
        if client_ip != MONNIFY_WEBHOOK_IP:
            logger.warning("monnify_webhook_untrusted_ip", client_ip=client_ip)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Untrusted origin")

    _verify(
        "monnify",
        raw_body=raw_body,
        signature=request.headers.get("monnify-signature"),
        secret=settings.monnify_secret_key,
        verifier=MonnifyClient.verify_webhook_signature,
    )
    payload = _parse(raw_body)

    event_type = payload.get("eventType")
    supported = {"SUCCESSFUL_TRANSACTION", *DISBURSEMENT_WEBHOOK_EVENTS}
    if event_type not in supported and not payload.get("paymentStatus"):
        logger.info("monnify_webhook_unsupported", webhook_event_type=event_type)
        return WebhookAckResponse()

    return await _dispatch(
        "monnify", event_type, db, lambda: WebhookService(db).handle_monnify_payload(payload, raw_body)
    )


@router.post("/zest", response_model=WebhookAckResponse)
async def zest_webhook(request: Request, db: DbSession) -> WebhookAckResponse:
    """Zest webhook — HMAC-SHA256 over the raw body."""
    settings = get_settings()
    raw_body = await request.body()
    _verify(
        "zest",
        raw_body=raw_body,
        signature=request.headers.get("zest-signature") or request.headers.get("x-zest-signature"),
        secret=settings.zest_secret_key,
        verifier=ZestClient.verify_webhook_signature,
    )
    payload = _parse(raw_body)

    event_type = payload.get("event_type") or payload.get("eventType")
    if event_type and event_type not in {WEBHOOK_EVENT_TRANSACTION, "transaction", "transfer"}:
        if not ZestClient.is_payment_success(
            str(payload.get("event_status") or payload.get("status") or "")
        ):
            logger.info("zest_webhook_unsupported", webhook_event_type=event_type)
            return WebhookAckResponse()

    return await _dispatch(
        "zest", event_type, db, lambda: WebhookService(db).handle_zest_payload(payload, raw_body)
    )


@router.post("/paystack", response_model=WebhookAckResponse)
async def paystack_webhook(request: Request, db: DbSession) -> WebhookAckResponse:
    """Paystack webhook — HMAC-SHA512 (x-paystack-signature) over the raw body."""
    settings = get_settings()
    raw_body = await request.body()
    _verify(
        "paystack",
        raw_body=raw_body,
        signature=request.headers.get("x-paystack-signature"),
        secret=settings.paystack_secret_key,
        verifier=PaystackClient.verify_webhook_signature,
    )
    payload = _parse(raw_body)

    event_type = payload.get("event")
    data = payload.get("data") or {}
    if event_type not in SUPPORTED_WEBHOOK_EVENTS:
        logger.info("paystack_webhook_unsupported", webhook_event_type=event_type)
        return WebhookAckResponse()

    return await _dispatch(
        "paystack", event_type, db, lambda: WebhookService(db).handle_event(event_type, data, raw_body)
    )


# ── Stanbic Fundable Virtual ID: endpoints Stanbic calls ─────────────────────
# Formats from Stanbic's "Fundable Wallet API Specification" v1.0.4. Stanbic authenticates with
# headers provider_id / provider_secret (values we choose: STANBIC_FVID_PROVIDER_ID / _SECRET).

_MAX_NOTIFIED = 500  # payments in one notification


def _stanbic_fvid_refusal(request: Request) -> JSONResponse | None:
    """Why this Stanbic call can't be served (not configured, wrong credentials), or None."""
    from app.modules.payments import stanbic_fvid

    settings = get_settings()
    want_id, want_secret = settings.stanbic_fvid_provider_id, settings.stanbic_fvid_provider_secret
    if not stanbic_fvid.enabled() or not want_id or not want_secret:
        return JSONResponse(
            status_code=503, content={"responseCode": "96", "responseDescription": "System malfunction"}
        )
    # Some proxies rename underscores in header names to dashes; accept either spelling.
    got_id = request.headers.get("provider_id") or request.headers.get("provider-id") or ""
    got_secret = request.headers.get("provider_secret") or request.headers.get("provider-secret") or ""
    id_ok = hmac.compare_digest(got_id.encode(), want_id.encode())
    secret_ok = hmac.compare_digest(got_secret.encode(), want_secret.encode())
    if not (id_ok and secret_ok):
        logger.warning("stanbic_fvid_unauthorised", ip=get_client_ip(request), path=request.url.path)
        return JSONResponse(status_code=401, content={"responseCode": "99", "responseDescription": "Unauthorized"})
    return None


async def _json_body(request: Request) -> Any:
    try:
        return json.loads(await request.body() or b"null")
    except ValueError:
        return None


@router.post("/stanbic/virtual-id/name-enquiry", summary="Stanbic: name behind a customer's virtual account")
async def stanbic_name_enquiry(request: Request, db: DbSession) -> JSONResponse:
    """The name (and BVN) for one of our account numbers, so the sender's bank can show it."""
    from app.modules.payments import stanbic_fvid

    refused = _stanbic_fvid_refusal(request)
    if refused is not None:
        return refused
    body = await _json_body(request)
    number = str(body.get("accountNumber") or "").strip() if isinstance(body, dict) else ""
    customer = await stanbic_fvid.StanbicVirtualAccounts(db).owner(number) if number.isdigit() else None
    if customer is None:
        return JSONResponse(
            content={
                "accountNumber": "",
                "accountName": "",
                "bvn": "",
                "responseCode": "07",
                "responseDescription": "Invalid Account",
            }
        )
    return JSONResponse(
        content={
            "accountNumber": number,
            "accountName": stanbic_fvid.account_name(customer),
            "bvn": customer.bvn,
            "responseCode": "00",
            "responseDescription": "Operation Successful",
        }
    )


@router.post(
    "/stanbic/virtual-id/transaction/notification", summary="Stanbic: payments into customers' virtual accounts"
)
async def stanbic_virtual_account_notification(request: Request, db: DbSession) -> JSONResponse:
    """
    Stanbic's Transaction Notification: a list of payments. Each is confirmed with Stanbic's
    checksum validator before anything is credited (a forged one credits nothing) and credited
    once per sessionId; each gets its own answer. A payment answered unsuccessful because Stanbic
    couldn't confirm it right now is also picked up by the 2-minute history poll.
    """
    from app.modules.payments import stanbic_fvid

    refused = _stanbic_fvid_refusal(request)
    if refused is not None:
        return refused
    payload = await _json_body(request)
    if isinstance(payload, dict):
        payload = [payload]
    if not isinstance(payload, list) or not payload or len(payload) > _MAX_NOTIFIED:
        return JSONResponse(
            status_code=400,
            content={"responseDetails": [], "responseCode": "12", "responseDescription": "Invalid transaction"},
        )

    service = stanbic_fvid.StanbicVirtualAccounts(db)
    details = []
    for item in payload:
        item = item if isinstance(item, dict) else {}
        outcome, message = await service.credit_notification(item)
        details.append(
            {
                "requestId": str(item.get("transactionReferenceId") or ""),
                "accountNumber": str(item.get("customerAccountNumber") or ""),
                "responseMessage": message,
                "isSuccessful": outcome == "credited",
            }
        )
    succeeded = sum(d["isSuccessful"] for d in details)
    if succeeded == len(details):
        code, description = "00", "Approved or completed successfully"
    elif succeeded:
        code, description = "02", "Partial Successful"
    else:
        code, description = "99", "Unable to process notification"
    return JSONResponse(content={"responseDetails": details, "responseCode": code, "responseDescription": description})


@router.post("/stanbic", response_model=WebhookAckResponse)
async def stanbic_webhook(request: Request, db: DbSession) -> WebhookAckResponse:
    """Stanbic IBTC bank-partner webhook (inbound credits, account provisioning, transfers)."""
    settings = get_settings()
    raw_body = await request.body()
    _verify(
        "stanbic",
        raw_body=raw_body,
        signature=request.headers.get(STANBIC_SIGNATURE_HEADER),
        secret=settings.stanbic_webhook_secret,
        verifier=StanbicClient.verify_webhook_signature,
    )
    payload = _parse(raw_body)

    event_type = str(
        payload.get("event_type") or payload.get("eventType") or payload.get("event") or ""
    ).lower()
    if event_type and event_type not in STANBIC_WEBHOOK_EVENTS:
        logger.info("stanbic_webhook_unsupported", webhook_event_type=event_type)
        return WebhookAckResponse()

    return await _dispatch(
        "stanbic", event_type, db, lambda: WebhookService(db).handle_stanbic_payload(payload, raw_body)
    )
