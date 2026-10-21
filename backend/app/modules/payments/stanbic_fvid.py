"""
Stanbic "Fundable Virtual ID": wallet top-ups by bank transfer when Stanbic is the rail.

How the product works (specs/fvid-*.json, nuban-generator_3.0.0.json):
- Stanbic gives GH Trust a 4-digit prefix (STANBIC_FVID_PREFIX). A customer's account number
  is prefix + a 5-digit serial we allocate + the check digit from Stanbic's NUBAN generator.
  There is no "create account" call: any transfer to a number with our prefix lands in GH
  Trust's pooled wallet account at Stanbic, tagged with that number.
- Payments are listed by Stanbic's transaction history by prefix (transfers from other banks
  and from Stanbic accounts are separate lists). Every record carries a checksum; Stanbic's
  checksum validator confirms it is genuine before we credit anything.

Stanbic also calls two endpoints of ours (its "Fundable Wallet API Specification" v1.0.4):
- Name Enquiry: the name (and BVN) behind one of our numbers, so a sender's bank can show it.
- Transaction Notification: a list of payments, each answered Successful or with a reason.

Wallets are credited from notifications (instant) and by polling (credit_new_payments, every
2 minutes: the safety net for a missed notification). Either way Stanbic's checksum validator
confirms the payment first, and each payment is credited once: its sessionId is the
PaymentTransaction reference and the ledger idempotency key.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.integrations.payments.schemas import PaymentRailError, ReservedAccountResult
from app.integrations.stanbic import portal_sandbox as stanbic
from app.models.base import TransactionStatus
from app.modules.payments.ledger_service import LedgerService
from app.modules.payments.models import (
    PaymentChannel,
    PaymentDirection,
    PaymentProvider,
    PaymentTransaction,
    StanbicVirtualAccount,
)
from app.modules.users.models import Customer, CustomerStatus

logger = structlog.get_logger()

BANK_NAME = "Stanbic IBTC Bank"
BANK_CODE = "221"
MAX_SERIAL = 99_999

# Reasons sent back to Stanbic per notified payment (wording from its spec).
SUCCESSFUL = "Successful"
DUPLICATE = "Duplicate Transaction"
INVALID_CHECKSUM = "Invalid Checksum"
INVALID_AMOUNT = "Invalid Amount"
INVALID_ACCOUNT = "Invalid Account Number"
INVALID_REQUEST = "Invalid Request"
TRY_AGAIN = "System malfunction"

# Customers whose number can't receive money any more (name enquiry answers "Invalid Account").
_CLOSED = (CustomerStatus.DELETED, CustomerStatus.INACTIVE)


def enabled() -> bool:
    """Stanbic is the rail, live (not mock, keys set), and Stanbic gave us a prefix."""
    s = get_settings()
    prefix = s.stanbic_fvid_prefix.strip()
    return s.active_payment_provider == "stanbic" and s.stanbic_enabled and prefix.isdigit() and len(prefix) == 4


class StanbicVirtualAccounts:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Account numbers ─────────────────────────────────────────────────────

    async def assign(self, customer: Customer) -> ReservedAccountResult:
        """The customer's account number, allocating one the first time. Safe to repeat."""
        prefix = get_settings().stanbic_fvid_prefix.strip()
        existing = await self.db.scalar(
            select(StanbicVirtualAccount).where(StanbicVirtualAccount.customer_id == customer.id)
        )
        if existing is None:
            existing = await self._allocate(customer, prefix)
        return ReservedAccountResult(
            account_reference=f"fvid_{existing.account_number}",
            account_number=existing.account_number,
            account_name=account_name(customer),
            bank_name=BANK_NAME,
            bank_code=BANK_CODE,
        )

    async def _allocate(self, customer: Customer, prefix: str) -> StanbicVirtualAccount:
        for _ in range(5):  # two sign-ups can pick the same serial; the unique index decides
            serial = (
                await self.db.scalar(
                    select(func.max(StanbicVirtualAccount.serial)).where(StanbicVirtualAccount.prefix == prefix)
                )
                or 0
            ) + 1
            if serial > MAX_SERIAL:
                raise PaymentRailError(
                    f"Stanbic prefix {prefix} has no account numbers left: ask Stanbic for another prefix",
                    status_code=503,
                )
            base9 = f"{prefix}{serial:05d}"
            # Stanbic's generator is the authority on the check digit (bank code 221).
            number = await stanbic.nuban_check_digit(base9, request_id=f"G{serial:05d}{customer.id[:4]}")
            row = StanbicVirtualAccount(customer_id=customer.id, prefix=prefix, serial=serial, account_number=number)
            try:
                async with self.db.begin_nested():
                    self.db.add(row)
                    await self.db.flush()
                return row
            except IntegrityError:
                taken = await self.db.scalar(
                    select(StanbicVirtualAccount).where(StanbicVirtualAccount.customer_id == customer.id)
                )
                if taken is not None:
                    return taken  # the same customer was given one concurrently
        raise PaymentRailError("Couldn't allocate a Stanbic account number; will retry", status_code=503)

    async def owner(self, account_number: str) -> Customer | None:
        """The customer an account number belongs to, if it can still receive money."""
        customer = await self.db.scalar(
            select(Customer)
            .join(StanbicVirtualAccount, StanbicVirtualAccount.customer_id == Customer.id)
            .where(StanbicVirtualAccount.account_number == account_number.strip())
        )
        if customer is None or customer.status in _CLOSED:
            return None
        return customer

    # ── Incoming payments ───────────────────────────────────────────────────

    async def credit_new_payments(self, now: datetime | None = None) -> dict[str, int]:
        """Credit wallets for payments Stanbic lists today and yesterday that we haven't seen."""
        prefix = get_settings().stanbic_fvid_prefix.strip()
        now = now or datetime.now(timezone.utc)
        start = stanbic.portal_history_date(now - timedelta(days=1))
        end = stanbic.portal_history_date(now)
        records: list[dict[str, Any]] = []
        for internal in (False, True):
            records += await stanbic.history_by_prefix(prefix, start, end, stanbic_to_stanbic=internal)

        counts = {"seen": len(records), "credited": 0, "already": 0, "rejected": 0, "unmatched": 0, "deferred": 0}
        for record in records:
            outcome, _ = await self._credit(record)
            counts[outcome] += 1
        if counts["credited"] or counts["rejected"] or counts["unmatched"]:
            logger.info("stanbic_fvid_poll", **counts)
        return counts

    async def credit_notification(self, item: dict[str, Any]) -> tuple[str, str]:
        """
        One payment from Stanbic's Transaction Notification. Credited only if Stanbic's checksum
        validator confirms it for the same account and amount, so a forged notification credits
        nothing. Returns (outcome, the reason to send back to Stanbic).
        """
        record = {
            "sessionId": item.get("sessionId"),
            "checksum": item.get("checkSum"),
            "customerAcct": item.get("customerAccountNumber"),
            "amount": item.get("amount"),
            "clientNotificationReqId": item.get("transactionReferenceId"),
            "accountName": item.get("accountName"),
            "sourceAcctName": item.get("srcAcctName"),
            "sourceAcctNumber": item.get("srcAcct"),
            "sourceBankCode": item.get("srcAcctBankCode"),
            "tranDate": item.get("tranDate"),
            "tranTime": item.get("tranTime"),
            # Stanbic's charges on the payment, kept for reconciliation (the wallet gets `amount`).
            "bankCharge": item.get("bankCharge"),
            "adminFee": item.get("adminFee"),
            "vatOnNetCharges": item.get("vatOnNetCharges"),
            "amountNetChargesAndVat": item.get("amountNetChargesAndVat"),
            "via": "notification",
        }
        return await self._credit({k: v for k, v in record.items() if v is not None})

    async def _credit(self, record: dict[str, Any]) -> tuple[str, str]:
        """Credit one payment record once Stanbic confirms it: (outcome, reason for Stanbic)."""
        session_id = str(record.get("sessionId") or "").strip()
        account = str(record.get("customerAcct") or "").strip()
        checksum = str(record.get("checksum") or "").strip()
        amount = _money(record.get("amount"))
        if not session_id or not account or not checksum:
            logger.warning("stanbic_fvid_record_incomplete", session_id=session_id, account=account)
            return "rejected", INVALID_REQUEST
        if amount is None or amount <= 0:
            logger.warning("stanbic_fvid_record_bad_amount", session_id=session_id, account=account)
            return "rejected", INVALID_AMOUNT

        seen = await self.db.scalar(
            select(PaymentTransaction.id).where(
                PaymentTransaction.provider == PaymentProvider.STANBIC,
                PaymentTransaction.provider_reference == session_id,
            )
        )
        if seen:
            return "already", DUPLICATE

        # Stanbic must confirm the record before any money is credited.
        try:
            details = await stanbic.validate_checksum(checksum, session_id)
        except PaymentRailError as exc:
            if exc.provider_code == "99":  # Stanbic says the checksum is invalid
                logger.warning("stanbic_fvid_checksum_invalid", session_id=session_id, account=account)
                return "rejected", INVALID_CHECKSUM
            logger.info("stanbic_fvid_checksum_unavailable", session_id=session_id, error=exc.message)
            return "deferred", TRY_AGAIN  # Stanbic resends / the next poll tries again
        if str(details.get("isValid") or "").lower() != "true":
            logger.warning("stanbic_fvid_checksum_not_valid", session_id=session_id, account=account)
            return "rejected", INVALID_CHECKSUM
        if str(details.get("customerAcct") or "").strip() != account:
            logger.warning("stanbic_fvid_checksum_account_mismatch", session_id=session_id, account=account)
            return "rejected", INVALID_ACCOUNT
        if _money(details.get("amount")) != amount:
            logger.warning("stanbic_fvid_checksum_amount_mismatch", session_id=session_id, account=account)
            return "rejected", INVALID_AMOUNT

        if not account.startswith(get_settings().stanbic_fvid_prefix.strip()):
            logger.warning("stanbic_fvid_foreign_prefix", session_id=session_id)
            return "unmatched", INVALID_ACCOUNT  # another Stanbic client's payment; never ours
        va = await self.db.scalar(select(StanbicVirtualAccount).where(StanbicVirtualAccount.account_number == account))
        if va is None:
            logger.error("stanbic_fvid_unknown_account", session_id=session_id, account=account, amount=str(amount))
            return "unmatched", INVALID_ACCOUNT

        ledger = LedgerService(self.db)
        wallet = await ledger.get_or_create_wallet(va.customer_id)
        try:
            async with self.db.begin_nested():
                tx = PaymentTransaction(
                    provider=PaymentProvider.STANBIC,
                    provider_reference=session_id,
                    provider_transaction_id=str(record.get("clientNotificationReqId") or "") or None,
                    direction=PaymentDirection.INBOUND,
                    channel=PaymentChannel.DVA,
                    amount=amount,
                    currency="NGN",
                    status=TransactionStatus.COMPLETED,
                    customer_id=va.customer_id,
                    wallet_id=wallet.id,
                    raw_payload={k: v for k, v in record.items() if k != "checksum"},
                )
                self.db.add(tx)
                await self.db.flush()
                await ledger.credit_wallet_from_paystack(
                    customer_id=va.customer_id,
                    amount=amount,
                    idempotency_key=f"wallet_funding:{session_id}",
                    reference=session_id,
                    payment_transaction=tx,
                    description="Wallet funded by bank transfer (Stanbic)",
                )
        except IntegrityError:
            return "already", DUPLICATE  # credited concurrently
        logger.info("stanbic_fvid_credited", session_id=session_id, customer_id=va.customer_id, amount=str(amount))
        return "credited", SUCCESSFUL


def account_name(customer: Customer) -> str:
    """The name shown for a customer's number (in the app, and to senders via name enquiry)."""
    return f"GH Trust / {customer.full_name}"[:100]


def _money(value: Any) -> Decimal | None:
    try:
        return Decimal(str(value).replace(",", "")).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None
