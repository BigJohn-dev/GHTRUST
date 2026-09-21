import json

import structlog
from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.core.deps import DbSession
from app.integrations.monnify.client import MonnifyClient
from app.integrations.monnify.constants import DISBURSEMENT_WEBHOOK_EVENTS, MONNIFY_WEBHOOK_IP
from app.integrations.zest.client import ZestClient
from app.integrations.zest.constants import WEBHOOK_EVENT_TRANSACTION
from app.integrations.paystack.client import PaystackClient
from app.integrations.paystack.constants import SUPPORTED_WEBHOOK_EVENTS
from app.modules.payments.schemas import WebhookAckResponse
from app.modules.payments.webhook_service import WebhookService

logger = structlog.get_logger()

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/monnify", response_model=WebhookAckResponse)
async def monnify_webhook(request: Request, db: DbSession) -> WebhookAckResponse:
    """
    Monnify webhook endpoint.
    Verifies HMAC-SHA512 signature on raw body before processing.
    """
    raw_body = await request.body()
    signature = request.headers.get("monnify-signature")

    if settings.monnify_webhook_ip_check and settings.app_env not in ("development", "test"):
        client_ip = request.client.host if request.client else None
        if client_ip != MONNIFY_WEBHOOK_IP:
            logger.warning("monnify_webhook_untrusted_ip", client_ip=client_ip)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Untrusted origin")

    if settings.monnify_secret_key and signature:
        if not MonnifyClient.verify_webhook_signature(raw_body, signature):
            logger.warning("monnify_webhook_invalid_signature")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    elif settings.monnify_secret_key and settings.app_env not in ("development", "test"):
        logger.warning("monnify_webhook_missing_signature")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    event_type = payload.get("eventType")
    supported = {"SUCCESSFUL_TRANSACTION", *DISBURSEMENT_WEBHOOK_EVENTS}
    if event_type not in supported and not payload.get("paymentStatus"):
        logger.info("monnify_webhook_unsupported", webhook_event_type=event_type)
        return WebhookAckResponse()

    try:
        await WebhookService(db).handle_monnify_payload(payload, raw_body)
    except Exception:
        logger.exception("monnify_webhook_handler_error", webhook_event_type=event_type)
        return WebhookAckResponse()

    return WebhookAckResponse()


@router.post("/zest", response_model=WebhookAckResponse)
async def zest_webhook(request: Request, db: DbSession) -> WebhookAckResponse:
    """
    Zest webhook endpoint for virtual account transfer notifications.
    Verifies HMAC-SHA256 signature when configured.
    """
    raw_body = await request.body()
    signature = request.headers.get("zest-signature") or request.headers.get("x-zest-signature")

    if settings.zest_secret_key and signature:
        if not ZestClient.verify_webhook_signature(raw_body, signature):
            logger.warning("zest_webhook_invalid_signature")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    elif settings.zest_secret_key and settings.app_env not in ("development", "test"):
        logger.warning("zest_webhook_missing_signature")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    event_type = payload.get("event_type") or payload.get("eventType")
    if event_type and event_type not in {WEBHOOK_EVENT_TRANSACTION, "transaction", "transfer"}:
        if not ZestClient.is_payment_success(str(payload.get("event_status") or payload.get("status") or "")):
            logger.info("zest_webhook_unsupported", webhook_event_type=event_type)
            return WebhookAckResponse()

    try:
        await WebhookService(db).handle_zest_payload(payload, raw_body)
    except Exception:
        logger.exception("zest_webhook_handler_error", webhook_event_type=event_type)
        return WebhookAckResponse()

    return WebhookAckResponse()


@router.post("/paystack", response_model=WebhookAckResponse)
async def paystack_webhook(request: Request, db: DbSession) -> WebhookAckResponse:
    """
    Paystack webhook endpoint.
    Verifies HMAC signature on raw body before processing.
    """
    raw_body = await request.body()
    signature = request.headers.get("x-paystack-signature")

    if settings.paystack_secret_key:
        if not PaystackClient.verify_webhook_signature(raw_body, signature):
            logger.warning("paystack_webhook_invalid_signature")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    elif settings.app_env not in ("development", "test"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Paystack webhook secret not configured",
        )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    event_type = payload.get("event")
    data = payload.get("data") or {}

    if event_type not in SUPPORTED_WEBHOOK_EVENTS:
        logger.info("paystack_webhook_unsupported", webhook_event_type=event_type)
        return WebhookAckResponse()

    try:
        await WebhookService(db).handle_event(event_type, data, raw_body)
    except Exception:
        logger.exception("paystack_webhook_handler_error", webhook_event_type=event_type)
        # Return 200 to avoid endless retries; reconciliation task will repair.
        return WebhookAckResponse()

    return WebhookAckResponse()
