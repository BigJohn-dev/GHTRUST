"""
Stanbic developer-portal sandbox APIs (testapi.stanbicibtc.com).

OpenAPI sources live under ``specs/``: NPS name enquiry + single transfer,
transaction history, credit check. Auth is ``Client-Id`` / ``Client-Secret`` on
each product base URL (same subscription keys as Account Opening).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
import structlog

from app.core.config import settings
from app.integrations.payments.schemas import PaymentRailError, TransientRailError
from app.integrations.retry import transient_retry
from app.integrations.stanbic.constants import (
    ACCOUNT_OPENING_SUCCESS_CODES,
    FAILED_RESPONSE_CODES,
    PENDING_RESPONSE_CODES,
    PATH_NPS_NAME_ENQUIRY,
    PATH_NPS_SINGLE_TRANSFER,
    PATH_NPS_TRANSFER_STATUS,
    PATH_TRANSACTION_HISTORY,
    TRANSFER_STATUS_FAILED,
    TRANSFER_STATUS_PENDING,
    TRANSFER_STATUS_SUCCESS,
)

logger = structlog.get_logger()


class StanbicPortalRetryable(TransientRailError):
    pass


def portal_tran_date(dt: datetime | None = None) -> str:
    """NPS status queries use DD-MON-YY (e.g. 05-OCT-26)."""
    when = dt or datetime.now(timezone.utc)
    return when.strftime("%d-%b-%y").upper()


def _portal_headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Client-Id": settings.stanbic_client_id,
        "Client-Secret": settings.stanbic_client_secret,
    }


def _check_response_code(payload: dict[str, Any]) -> None:
    code = str(
        payload.get("responseCode") or payload.get("responsecode") or payload.get("rbxResponseCode") or ""
    ).strip()
    message = str(payload.get("responseMsg") or payload.get("responseDesc") or "").upper()
    # Pending (55/56) is not a failure, and nor is "duplicate": Stanbic doesn't reprocess a
    # clientRefId it has seen, so the original may have gone through. The status check decides.
    if code in PENDING_RESPONSE_CODES or "DUPLICATE" in message:
        return
    if code and code not in ACCOUNT_OPENING_SUCCESS_CODES:
        raise PaymentRailError(
            str(payload.get("responseMsg") or payload.get("responseDesc") or "Stanbic request failed"),
            status_code=502,
            provider_code=code,
        )


async def _portal_request_once(
    method: str,
    url: str,
    *,
    json: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    bearer: str | None = None,
) -> dict[str, Any]:
    headers = _portal_headers()
    if bearer:  # Fundable Virtual ID 3.0 wants the OAuth token AND the client keys
        headers["Authorization"] = f"Bearer {bearer}"
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.request(method, url, headers=headers, json=json, params=params)
    except httpx.HTTPError as exc:
        logger.warning("stanbic_portal_transport_error", url=url, error=str(exc))
        raise StanbicPortalRetryable("Stanbic portal API unreachable", status_code=502) from exc

    if response.status_code >= 500:
        raise StanbicPortalRetryable("Stanbic portal API unavailable", status_code=502)

    try:
        payload = response.json()
    except ValueError as exc:
        raise PaymentRailError("Invalid Stanbic portal response", status_code=502) from exc

    # The API gateway's own refusals carry the reason in moreInformation, e.g. 401 "Invalid
    # client id or secret", 403 "Not registered to plan" (the app isn't subscribed to the product).
    detail = payload.get("moreInformation") if isinstance(payload, dict) else None
    if response.status_code == 401:
        raise PaymentRailError(f"Stanbic rejected our keys: {detail or 'unauthorized'}", status_code=502)

    if response.status_code >= 400:
        _check_response_code(payload if isinstance(payload, dict) else {})
        message = (payload or {}).get("responseMsg") if isinstance(payload, dict) else None
        raise PaymentRailError(
            f"Stanbic refused the request ({response.status_code}): {message or detail or 'no reason given'}",
            status_code=502,
            provider_code=str(response.status_code),
        )

    if isinstance(payload, dict):
        _check_response_code(payload)
    return payload if isinstance(payload, dict) else {"raw": payload}


# Reads and status checks are retried on network errors. Sending a transfer is NOT: if the
# first attempt went through before the connection dropped, a retry with the same
# clientRefId is refused as a duplicate, which would look like a failure and refund money
# that already left. A failed send is "outcome unknown"; the status check settles it.
_portal_request = transient_retry()(_portal_request_once)


def map_nps_transfer_status(payload: dict[str, Any]) -> str:
    code = str(payload.get("responseCode") or "").strip()
    msg = str(payload.get("responseMsg") or "").upper()
    credited = str(payload.get("destAcctCredited") or "").upper()
    if not code or code in PENDING_RESPONSE_CODES or "DUPLICATE" in msg:
        # No verdict yet: never treat as failed, or the customer is refunded for money that left.
        return TRANSFER_STATUS_PENDING
    if code in FAILED_RESPONSE_CODES:
        return TRANSFER_STATUS_FAILED
    if code != "00":
        logger.warning("stanbic_unknown_transfer_code", code=code, message=msg[:120])
        return TRANSFER_STATUS_PENDING  # unknown code: wait for the status check, don't refund
    if "PROCESS" in msg or credited in ("N", "NO", "FALSE"):
        return TRANSFER_STATUS_PENDING
    if credited in ("Y", "YES", "TRUE") or "SUCCESS" in msg:
        return TRANSFER_STATUS_SUCCESS
    return TRANSFER_STATUS_PENDING


async def name_enquiry(account_number: str, bank_code: str) -> dict[str, Any]:
    base = settings.stanbic_name_enquiry_base_url.rstrip("/")
    url = f"{base}{PATH_NPS_NAME_ENQUIRY}"
    return await _portal_request(
        "POST",
        url,
        json={"accountNumber": account_number, "bankCode": bank_code},
    )


async def single_transfer(payload: dict[str, Any]) -> dict[str, Any]:
    base = settings.stanbic_nps_base_url.rstrip("/")
    url = f"{base}{PATH_NPS_SINGLE_TRANSFER}"
    return await _portal_request_once("POST", url, json=payload)  # never auto-retried


async def transfer_status(payload: dict[str, Any]) -> dict[str, Any]:
    base = settings.stanbic_nps_base_url.rstrip("/")
    url = f"{base}{PATH_NPS_TRANSFER_STATUS}"
    return await _portal_request("POST", url, json=payload)


async def transaction_history(
    *,
    account_number: str,
    start_date: str,
    end_date: str,
) -> dict[str, Any]:
    base = settings.stanbic_transaction_history_base_url.rstrip("/")
    url = f"{base}{PATH_TRANSACTION_HISTORY}"
    return await _portal_request(
        "POST",
        url,
        json={"accountNumber": account_number, "startDate": start_date, "endDate": end_date},
    )


# ── Fundable Virtual ID (wallet top-ups); specs/fvid-*.json, nuban-generator_3.0.0.json ──

_token: tuple[str, float] | None = None


async def _oauth_token() -> str:
    """Client-credentials bearer token (the Nuban Generator v3 requires OAuth)."""
    global _token
    import time

    if _token and time.monotonic() < _token[1]:
        return _token[0]
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                settings.stanbic_oauth_token_url,
                data={
                    "grant_type": "client_credentials",
                    "scope": "access",
                    "client_id": settings.stanbic_client_id,
                    "client_secret": settings.stanbic_client_secret,
                },
            )
    except httpx.HTTPError as exc:
        raise StanbicPortalRetryable("Stanbic sign-in unreachable", status_code=502) from exc
    body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    token = body.get("access_token")
    if response.status_code != 200 or not token:
        raise PaymentRailError(
            f"Stanbic sign-in failed ({response.status_code}): {body.get('moreInformation') or 'no token'}",
            status_code=502,
        )
    _token = (token, time.monotonic() + max(int(body.get("expires_in") or 3600) - 60, 60))
    return token


async def nuban_check_digit(base9: str, request_id: str) -> str:
    """Stanbic's 10-digit NUBAN for a 9-digit base (bank code 221)."""
    token = await _oauth_token()
    url = f"{settings.stanbic_fvid_base_url.rstrip('/')}/generate"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                headers={**_portal_headers(), "Authorization": f"Bearer {token}"},
                json={"reqId": request_id[:10], "accountNo": base9, "bankCode": "221"},
            )
    except httpx.HTTPError as exc:
        raise StanbicPortalRetryable("Stanbic NUBAN generator unreachable", status_code=502) from exc
    body = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
    number = str(((body.get("transactionDetails") or {}).get("nubanGeneratedAccntNo")) or "")
    if response.status_code != 200 or len(number) != 10 or not number.startswith(base9):
        reason = body.get("responseMsg") or body.get("moreInformation") or body.get("httpMessage") or "no number"
        raise PaymentRailError(f"Stanbic NUBAN generator failed ({response.status_code}): {reason}", status_code=502)
    return number


def portal_history_date(dt: datetime) -> str:
    """Fundable Virtual ID history dates: DD-MON-YY (e.g. 21-MAR-23)."""
    return dt.strftime("%d-%b-%y").upper()


async def history_by_prefix(prefix: str, start: str, end: str, *, stanbic_to_stanbic: bool) -> list[dict[str, Any]]:
    """
    Payments into our virtual accounts in the date range (all pages). Fundable Virtual ID 3.0:
    GET {base}/history (from other banks) and {base}/stanbic-to-stanbic, token + client keys.

    Records are filtered to OUR prefix here: Stanbic's sandbox was seen (Oct 2026) returning other
    clients' payments regardless of prefixId on its VA history, so its filter isn't trusted.
    """
    path = "stanbic-to-stanbic" if stanbic_to_stanbic else "history"
    url = f"{settings.stanbic_fvid_base_url.rstrip('/')}/{path}"
    token = await _oauth_token()
    records: list[dict[str, Any]] = []
    page = 1
    while page <= 50:
        body = await _portal_request(
            "GET",
            url,
            params={"prefixId": prefix, "startDate": start, "endDate": end, "page": page, "size": 100},
            bearer=token,
        )
        details = body.get("responseDetails") or {}
        records.extend(
            r
            for r in details.get("content") or []
            if isinstance(r, dict) and str(r.get("customerAcct") or "").startswith(prefix)
        )
        total_pages = int(details.get("totalPages") or 0)
        if page >= total_pages:
            break
        page += 1
    return records


async def validate_checksum(checksum: str, session_id: str) -> dict[str, Any]:
    """Stanbic confirms a payment record is genuine; returns its details (with isValid)."""
    url = f"{settings.stanbic_fvid_base_url.rstrip('/')}/validator"  # Fundable Virtual ID 3.0
    body = await _portal_request(
        "POST", url, json={"checkSum": checksum, "sessionId": session_id}, bearer=await _oauth_token()
    )
    return body.get("responseDetails") or {}
