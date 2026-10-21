"""
Check a server's Stanbic setup end to end, without moving money. See docs/staging-stanbic.md.

    python scripts/stanbic_check.py
    python scripts/stanbic_check.py --api https://<staging>.up.railway.app --account 5960000018

Part 1 (always) uses this machine's settings (backend/.env, or the server's variables when run
there) and calls Stanbic: settings, OAuth token, Bank List, name enquiry on the settlement
account, the NUBAN generator, payment history for our prefix, and the checksum validator (a
made-up payment must be refused).

Part 2 (with --api) calls the two endpoints Stanbic will call on that server, with the
provider_id / provider_secret from these settings: name enquiry (an unknown number must answer
07; --account, one of our customers' numbers, must answer 00), a made-up payment notification
(must be refused, nothing credited) and a call without credentials (must be refused).

Exits non-zero if any check fails.
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# Checking Stanbic from a laptop whose backend/.env says monnify: assume Stanbic. A server's
# own PAYMENT_PROVIDER variable still wins (it's in the environment, unlike .env lines).
os.environ.setdefault("PAYMENT_PROVIDER", "stanbic")

import httpx  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.integrations.payments.schemas import PaymentRailError  # noqa: E402
from app.integrations.stanbic import portal_sandbox as stanbic  # noqa: E402
from app.integrations.stanbic.bank_codes import get_bank_directory  # noqa: E402

STANBIC_CBN_CODE = "221"
results: list[bool] = []


def report(ok: bool, name: str, detail: str = "") -> None:
    results.append(ok)
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f": {detail}" if detail else ""))


async def check(name: str, call) -> object:
    """Run one Stanbic call; a raised error is a failed check."""
    try:
        return await call()
    except PaymentRailError as exc:
        report(False, name, f"{exc.message} (code {exc.provider_code})")
    except httpx.HTTPError as exc:
        report(False, name, f"network error: {exc}")
    return None


def check_settings() -> bool:
    s = get_settings()
    print(f"Settings (APP_ENV={s.app_env})")
    prefix = s.stanbic_fvid_prefix.strip()
    report(s.active_payment_provider == "stanbic", "PAYMENT_PROVIDER=stanbic", s.active_payment_provider)
    report(s.stanbic_enabled, "STANBIC_MOCK=false with STANBIC_CLIENT_ID / _SECRET set")
    report(prefix.isdigit() and len(prefix) == 4, "STANBIC_FVID_PREFIX is 4 digits", prefix or "empty")
    report(bool(s.stanbic_settlement_account_number), "STANBIC_SETTLEMENT_ACCOUNT_NUMBER set")
    report(
        bool(s.stanbic_fvid_provider_id) and len(s.stanbic_fvid_provider_secret) >= 32,
        "STANBIC_FVID_PROVIDER_ID / _SECRET set (secret 32+ characters)",
    )
    if s.is_production:
        report(not s.stanbic_portal_sandbox, "not on the Stanbic sandbox in production")
    return s.stanbic_enabled


async def check_stanbic() -> None:
    s = get_settings()
    prefix = s.stanbic_fvid_prefix.strip()
    print("\nStanbic")
    if await check("OAuth token", stanbic._oauth_token):
        report(True, "OAuth token")

    directory = await check("Bank List", get_bank_directory)
    stanbic_code = None
    if directory is not None:
        report(len(directory.entries) > 100, "Bank List", f"{len(directory.entries)} banks")
        try:
            stanbic_code = directory.to_institution_code(STANBIC_CBN_CODE)
        except PaymentRailError as exc:
            report(False, "Stanbic's own bank code in the Bank List", exc.message)

    account = s.stanbic_settlement_account_number
    if account and stanbic_code:
        found = await check("Name enquiry (settlement account)", lambda: stanbic.name_enquiry(account, stanbic_code))
        if found is not None:
            details = found.get("responseDetails") if isinstance(found.get("responseDetails"), dict) else found
            name = details.get("accountName") or details.get("account_name") or ""
            report(bool(name), "Name enquiry (settlement account)", f"{account} -> {name or 'no name returned'}")

    if prefix:
        base9 = f"{prefix}00001"
        number = await check("NUBAN generator", lambda: stanbic.nuban_check_digit(base9, request_id="CHECK00001"))
        if number:
            report(str(number).startswith(base9) and len(str(number)) == 10, "NUBAN generator", f"{base9} -> {number}")

        now = datetime.now(timezone.utc)
        start, end = stanbic.portal_history_date(now - timedelta(days=7)), stanbic.portal_history_date(now)
        for internal, label in ((False, "from other banks"), (True, "Stanbic-to-Stanbic")):
            records = await check(
                f"Payment history ({label})",
                lambda internal=internal: stanbic.history_by_prefix(prefix, start, end, stanbic_to_stanbic=internal),
            )
            if records is not None:
                report(True, f"Payment history ({label}), last 7 days", f"{len(records)} payments to {prefix}")

    try:
        await stanbic.validate_checksum("NOT-A-REAL-CHECKSUM", "CHECK-NO-SUCH-SESSION")
        report(False, "Checksum validator refuses a made-up payment", "Stanbic accepted it")
    except PaymentRailError as exc:
        report(exc.provider_code == "99", "Checksum validator refuses a made-up payment", exc.message)
    except httpx.HTTPError as exc:
        report(False, "Checksum validator refuses a made-up payment", f"network error: {exc}")


async def check_endpoints(api: str, account: str | None) -> None:
    s = get_settings()
    base = api.rstrip("/") + s.api_v1_prefix + "/webhooks/stanbic/virtual-id"
    creds = {"provider_id": s.stanbic_fvid_provider_id, "provider_secret": s.stanbic_fvid_provider_secret}
    prefix = s.stanbic_fvid_prefix.strip() or "0000"
    print(f"\nEndpoints Stanbic calls on {api}")
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            ready = await client.get(api.rstrip("/") + s.api_v1_prefix + "/health/ready")
            report(ready.status_code == 200, "Server is up", f"HTTP {ready.status_code}")
        except httpx.HTTPError as exc:
            report(False, "Server is up", str(exc))
            return

        res = await client.post(
            f"{base}/name-enquiry", json={"requestId": "CHECK-1", "accountNumber": f"{prefix}999990"}, headers=creds
        )
        body = _json(res)
        report(
            res.status_code == 200 and body.get("responseCode") == "07",
            "Name enquiry: unknown number answers 07",
            _why(res, body),
        )
        if account:
            res = await client.post(
                f"{base}/name-enquiry", json={"requestId": "CHECK-2", "accountNumber": account}, headers=creds
            )
            body = _json(res)
            report(
                body.get("responseCode") == "00",
                f"Name enquiry: {account} answers 00",
                body.get("accountName") or _why(res, body),
            )

        fake = {
            "transactionReferenceId": f"{prefix}-CHECK",
            "customerAccountNumber": account or f"{prefix}999990",
            "amount": "1.00",
            "checkSum": "NOT-A-REAL-CHECKSUM",
            "checkSumId": "CHECK",
            "sessionId": "CHECK-NO-SUCH-SESSION",
        }
        res = await client.post(f"{base}/transaction/notification", json=[fake], headers=creds)
        body = _json(res)
        details = body.get("responseDetails") or [{}]
        report(
            res.status_code == 200 and body.get("responseCode") == "99" and details[0].get("isSuccessful") is False,
            "Notification: a made-up payment is refused",
            details[0].get("responseMessage") or _why(res, body),
        )

        res = await client.post(f"{base}/transaction/notification", json=[fake])
        report(res.status_code == 401, "Notification without credentials is refused", f"HTTP {res.status_code}")


def _json(res: httpx.Response) -> dict:
    try:
        body = res.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _why(res: httpx.Response, body: dict) -> str:
    if res.status_code == 503:
        return "HTTP 503: Stanbic isn't switched on there (see docs/staging-stanbic.md)"
    if res.status_code == 401:
        return "HTTP 401: provider_id / provider_secret differ from the server's"
    return f"HTTP {res.status_code} {body.get('responseCode', '')} {body.get('responseDescription', '')}".strip()


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", help="server to check the Stanbic endpoints on, e.g. https://<staging>.up.railway.app")
    parser.add_argument("--account", help="one of our customers' 10-digit Stanbic numbers on that server")
    args = parser.parse_args()

    if check_settings():
        await check_stanbic()
    else:
        print("\nStanbic: skipped (switch Stanbic on first)")
    if args.api:
        await check_endpoints(args.api, args.account)

    failed = results.count(False)
    print(f"\n{len(results) - failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
