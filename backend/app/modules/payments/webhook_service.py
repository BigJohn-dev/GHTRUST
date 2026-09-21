import hashlib
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.monnify.constants import (
    DISBURSEMENT_FAILED,
    DISBURSEMENT_REVERSED,
    DISBURSEMENT_SUCCESS,
    DISBURSEMENT_WEBHOOK_EVENTS,
    PAYMENT_STATUS_PAID,
    PRODUCT_TYPE_RESERVED_ACCOUNT,
)
from app.integrations.paystack.constants import (
    TRANSACTION_STATUS_SUCCESS,
    TRANSFER_STATUS_FAILED,
    TRANSFER_STATUS_REVERSED,
    TRANSFER_STATUS_SUCCESS,
)
from app.integrations.paystack.schemas import kobo_to_naira
from app.integrations.zest.constants import WEBHOOK_EVENT_TRANSACTION
from app.integrations.zest.client import ZestClient
from app.models.base import TransactionStatus
from app.modules.loans.models import Loan, LoanApplication
from app.modules.loans.schemas import ApplicationStatus, LoanProductCode, LoanStatus
from app.modules.payments.ledger_service import LedgerError, LedgerService
from app.modules.payments.models import (
    DvaStatus,
    LoanDisbursement,
    PaymentChannel,
    PaymentDirection,
    PaymentProvider,
    PaymentTransaction,
    ProcessedWebhookEvent,
    WithdrawalRequest,
    WithdrawalStatus,
)
from app.modules.users.models import Customer

logger = structlog.get_logger()


def _active_provider() -> PaymentProvider:
    provider = settings.active_payment_provider
    if provider == "paystack":
        return PaymentProvider.PAYSTACK
    if provider == "zest":
        return PaymentProvider.ZEST
    return PaymentProvider.MONNIFY


class WebhookService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.ledger = LedgerService(db)

    @staticmethod
    def _event_key(provider: str, event_type: str, data: dict[str, Any]) -> str:
        event_id = (
            data.get("id")
            or data.get("reference")
            or data.get("transfer_code")
            or data.get("transactionReference")
            or data.get("paymentReference")
        )
        return f"{provider}:{event_type}:{event_id}"

    @staticmethod
    def _payload_hash(payload: bytes) -> str:
        return hashlib.sha256(payload).hexdigest()

    async def _claim_event(
        self, provider: str, event_type: str, data: dict[str, Any], payload: bytes
    ) -> bool:
        key = self._event_key(provider, event_type, data)
        existing = await self.db.execute(
            select(ProcessedWebhookEvent).where(ProcessedWebhookEvent.event_key == key)
        )
        if existing.scalar_one_or_none():
            return False
        self.db.add(
            ProcessedWebhookEvent(
                event_key=key,
                event_type=event_type,
                payload_hash=self._payload_hash(payload),
                processed_at=datetime.now(timezone.utc),
            )
        )
        await self.db.flush()
        return True

    async def handle_event(self, event_type: str, data: dict[str, Any], raw_payload: bytes) -> None:
        claimed = await self._claim_event("paystack", event_type, data, raw_payload)
        if not claimed:
            logger.info("paystack_webhook_duplicate", webhook_event_type=event_type)
            return

        if event_type == "charge.success":
            await self._handle_charge_success(data)
        elif event_type == "dedicatedaccount.assign.success":
            await self._handle_dva_assigned(data)
        elif event_type == "dedicatedaccount.assign.failed":
            await self._handle_dva_failed(data)
        elif event_type == "transfer.success":
            await self._handle_transfer_success(data)
        elif event_type == "transfer.failed":
            await self._handle_transfer_failed(data)
        elif event_type == "transfer.reversed":
            await self._handle_transfer_reversed(data)
        else:
            logger.info("paystack_webhook_ignored", webhook_event_type=event_type)

    async def handle_monnify_payload(self, payload: dict[str, Any], raw_payload: bytes) -> None:
        event_type = payload.get("eventType")
        if event_type == "SUCCESSFUL_TRANSACTION":
            data = payload.get("eventData") or {}
            await self._handle_monnify_inbound(data, raw_payload, event_type)
        elif event_type in DISBURSEMENT_WEBHOOK_EVENTS:
            data = payload.get("eventData") or {}
            await self._handle_monnify_disbursement(event_type, data, raw_payload)
        elif payload.get("paymentStatus"):
            await self._handle_monnify_inbound(payload, raw_payload, "SUCCESSFUL_TRANSACTION")
        else:
            logger.info("monnify_webhook_ignored", webhook_event_type=event_type)

    async def handle_zest_payload(self, payload: dict[str, Any], raw_payload: bytes) -> None:
        event_type = str(payload.get("event_type") or payload.get("eventType") or WEBHOOK_EVENT_TRANSACTION)
        status = str(payload.get("event_status") or payload.get("status") or payload.get("trans_status") or "")
        if not ZestClient.is_payment_success(status):
            logger.info("zest_webhook_ignored_status", status=status, event_type=event_type)
            return
        await self._handle_zest_inbound(payload, raw_payload, event_type)

    async def _handle_zest_inbound(
        self, data: dict[str, Any], raw_payload: bytes, event_type: str
    ) -> None:
        amount_raw = data.get("AmountPaid") or data.get("amountPaid") or data.get("amount") or 0
        amount = Decimal(str(amount_raw))
        if amount <= 0:
            logger.warning("zest_inbound_zero_amount", reference=data.get("Reference"))
            return

        reference = str(
            data.get("Reference")
            or data.get("reference")
            or data.get("TrackingRef")
            or data.get("transactionRef")
            or data.get("TrackingID")
        )
        account_number = str(data.get("AccountNo") or data.get("accountNumber") or "")
        account_reference = str(data.get("AccountRef") or data.get("accountReference") or "")

        claimed = await self._claim_event("zest", event_type, data, raw_payload)
        if not claimed:
            logger.info("zest_webhook_duplicate", webhook_event_type=event_type)
            return

        customer = await self._find_customer_by_account_reference(account_reference)
        if not customer and account_number:
            customer = await self._find_customer_by_dva(account_number)
        if not customer:
            logger.error(
                "zest_inbound_customer_not_found",
                reference=reference,
                account_reference=account_reference,
                account_number=account_number[-4:] if account_number else None,
            )
            return

        provider = PaymentProvider.ZEST
        existing_tx = await self.db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.provider == provider,
                PaymentTransaction.provider_reference == reference,
            )
        )
        if existing_tx.scalar_one_or_none():
            return

        wallet = await self.ledger.get_or_create_wallet(customer.id)
        payment_tx = PaymentTransaction(
            provider=provider,
            provider_reference=reference,
            provider_transaction_id=reference,
            direction=PaymentDirection.INBOUND,
            channel=PaymentChannel.DVA,
            amount=amount,
            currency=data.get("currency") or "NGN",
            status=TransactionStatus.COMPLETED,
            customer_id=customer.id,
            wallet_id=wallet.id,
            webhook_event=event_type,
            raw_payload=data,
        )
        self.db.add(payment_tx)
        await self.db.flush()

        try:
            await self.ledger.credit_wallet_from_paystack(
                customer_id=customer.id,
                amount=amount,
                idempotency_key=f"wallet_funding:{reference}",
                reference=reference,
                payment_transaction=payment_tx,
            )
        except LedgerError as exc:
            logger.error("zest_inbound_ledger_failed", reference=reference, error=exc.message)
            payment_tx.status = TransactionStatus.FAILED
            payment_tx.failure_reason = exc.message

    async def _handle_monnify_inbound(
        self, data: dict[str, Any], raw_payload: bytes, event_type: str
    ) -> None:
        if data.get("paymentStatus") != PAYMENT_STATUS_PAID:
            return

        product = data.get("product") or {}
        if product.get("type") != PRODUCT_TYPE_RESERVED_ACCOUNT:
            logger.info("monnify_inbound_ignored_product", product_type=product.get("type"))
            return

        amount = Decimal(str(data.get("amountPaid") or 0))
        if amount <= 0:
            logger.warning("monnify_inbound_zero_amount", reference=data.get("paymentReference"))
            return

        reference = str(
            data.get("transactionReference") or data.get("paymentReference") or data.get("reference")
        )
        account_reference = str(product.get("reference") or "")
        account_number = (data.get("destinationAccountInformation") or {}).get("accountNumber")

        claimed = await self._claim_event("monnify", event_type, data, raw_payload)
        if not claimed:
            logger.info("monnify_webhook_duplicate", webhook_event_type=event_type)
            return

        customer = await self._find_customer_by_account_reference(account_reference)
        if not customer and account_number:
            customer = await self._find_customer_by_dva(account_number)
        if not customer:
            logger.error(
                "monnify_inbound_customer_not_found",
                reference=reference,
                account_reference=account_reference,
            )
            return

        provider = _active_provider()
        existing_tx = await self.db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.provider == provider,
                PaymentTransaction.provider_reference == reference,
            )
        )
        if existing_tx.scalar_one_or_none():
            return

        wallet = await self.ledger.get_or_create_wallet(customer.id)
        payment_method = str(data.get("paymentMethod") or "").upper()
        channel = PaymentChannel.DVA
        if "CARD" in payment_method:
            channel = PaymentChannel.CARD

        payment_tx = PaymentTransaction(
            provider=provider,
            provider_reference=reference,
            provider_transaction_id=reference,
            direction=PaymentDirection.INBOUND,
            channel=channel,
            amount=amount,
            currency=data.get("currency") or "NGN",
            status=TransactionStatus.COMPLETED,
            customer_id=customer.id,
            wallet_id=wallet.id,
            webhook_event=event_type,
            raw_payload=data,
        )
        self.db.add(payment_tx)
        await self.db.flush()

        try:
            await self.ledger.credit_wallet_from_paystack(
                customer_id=customer.id,
                amount=amount,
                idempotency_key=f"wallet_funding:{reference}",
                reference=reference,
                payment_transaction=payment_tx,
            )
        except LedgerError as exc:
            logger.error("monnify_inbound_ledger_failed", reference=reference, error=exc.message)
            payment_tx.status = TransactionStatus.FAILED
            payment_tx.failure_reason = exc.message

    async def _handle_monnify_disbursement(
        self, event_type: str, data: dict[str, Any], raw_payload: bytes
    ) -> None:
        claimed = await self._claim_event("monnify", event_type, data, raw_payload)
        if not claimed:
            logger.info("monnify_webhook_duplicate", webhook_event_type=event_type)
            return

        reference = str(data.get("reference") or "")
        if not reference:
            return

        if event_type == DISBURSEMENT_SUCCESS:
            await self._handle_transfer_success(data)
        elif event_type == DISBURSEMENT_FAILED:
            reason = data.get("transactionDescription") or data.get("status") or "Disbursement failed"
            await self._handle_transfer_failed({**data, "reason": reason})
        elif event_type == DISBURSEMENT_REVERSED:
            await self._handle_transfer_reversed(data)

    async def _find_customer_by_account_reference(self, account_reference: str | None) -> Customer | None:
        if not account_reference:
            return None
        result = await self.db.execute(
            select(Customer).where(Customer.paystack_customer_code == account_reference)
        )
        return result.scalar_one_or_none()

    async def _find_customer_by_dva(self, account_number: str | None) -> Customer | None:
        if not account_number:
            return None
        result = await self.db.execute(
            select(Customer).where(Customer.paystack_dva_account_number == account_number)
        )
        return result.scalar_one_or_none()

    async def _handle_charge_success(self, data: dict[str, Any]) -> None:
        if data.get("status") != TRANSACTION_STATUS_SUCCESS:
            return

        amount = kobo_to_naira(int(data.get("amount") or 0))
        if amount <= 0:
            logger.warning("paystack_charge_zero_amount", reference=data.get("reference"))
            return

        reference = str(data.get("reference") or data.get("id"))
        authorization = data.get("authorization") or {}
        account_number = authorization.get("receiver_bank_account_number")

        customer = await self._find_customer_by_dva(account_number)
        if not customer:
            customer_code = (data.get("customer") or {}).get("customer_code")
            if customer_code:
                result = await self.db.execute(
                    select(Customer).where(Customer.paystack_customer_code == customer_code)
                )
                customer = result.scalar_one_or_none()
        if not customer:
            logger.error("paystack_charge_customer_not_found", reference=reference, dva=account_number)
            return

        existing_tx = await self.db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.provider == PaymentProvider.PAYSTACK,
                PaymentTransaction.provider_reference == reference,
            )
        )
        if existing_tx.scalar_one_or_none():
            return

        wallet = await self.ledger.get_or_create_wallet(customer.id)
        channel = PaymentChannel.DVA
        if authorization.get("channel") == "card":
            channel = PaymentChannel.CARD

        payment_tx = PaymentTransaction(
            provider=PaymentProvider.PAYSTACK,
            provider_reference=reference,
            provider_transaction_id=str(data.get("id") or ""),
            direction=PaymentDirection.INBOUND,
            channel=channel,
            amount=Decimal(str(amount)),
            currency=data.get("currency") or "NGN",
            status=TransactionStatus.COMPLETED,
            customer_id=customer.id,
            wallet_id=wallet.id,
            webhook_event="charge.success",
            raw_payload=data,
        )
        self.db.add(payment_tx)
        await self.db.flush()

        try:
            await self.ledger.credit_wallet_from_paystack(
                customer_id=customer.id,
                amount=Decimal(str(amount)),
                idempotency_key=f"wallet_funding:{reference}",
                reference=reference,
                payment_transaction=payment_tx,
            )
        except LedgerError as exc:
            logger.error("paystack_charge_ledger_failed", reference=reference, error=exc.message)
            payment_tx.status = TransactionStatus.FAILED
            payment_tx.failure_reason = exc.message

    async def _handle_dva_assigned(self, data: dict[str, Any]) -> None:
        account_number = data.get("account_number")
        customer_data = data.get("customer") or {}
        customer_code = customer_data.get("customer_code")
        if not customer_code:
            return

        result = await self.db.execute(
            select(Customer).where(Customer.paystack_customer_code == customer_code)
        )
        customer = result.scalar_one_or_none()
        if not customer:
            return

        customer.paystack_dva_account_number = account_number
        bank = data.get("bank") or {}
        customer.paystack_dva_bank_name = bank.get("name")
        customer.paystack_dva_bank_slug = bank.get("slug")

        wallet = await self.ledger.get_or_create_wallet(customer.id)
        wallet.dva_status = DvaStatus.ACTIVE
        await self.db.flush()

    async def _handle_dva_failed(self, data: dict[str, Any]) -> None:
        customer_data = data.get("customer") or {}
        customer_code = customer_data.get("customer_code")
        if not customer_code:
            return
        result = await self.db.execute(
            select(Customer).where(Customer.paystack_customer_code == customer_code)
        )
        customer = result.scalar_one_or_none()
        if not customer:
            return
        wallet = await self.ledger.get_or_create_wallet(customer.id)
        wallet.dva_status = DvaStatus.FAILED
        await self.db.flush()

    async def _get_outbound_payment(self, reference: str) -> PaymentTransaction | None:
        result = await self.db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.provider_reference == reference,
                PaymentTransaction.direction == PaymentDirection.OUTBOUND,
            )
        )
        return result.scalar_one_or_none()

    async def _handle_transfer_success(self, data: dict[str, Any]) -> None:
        reference = str(data.get("reference") or "")
        if not reference:
            return

        payment_tx = await self._get_outbound_payment(reference)
        if not payment_tx:
            await self._complete_loan_disbursement(reference, data)
            return

        if payment_tx.status == TransactionStatus.COMPLETED:
            return

        payment_tx.status = TransactionStatus.COMPLETED
        payment_tx.webhook_event = "transfer.success"
        payment_tx.raw_payload = data

        withdrawal = await self.db.get(WithdrawalRequest, payment_tx.withdrawal_id)
        if withdrawal:
            try:
                await self.ledger.settle_withdrawal_hold(
                    customer_id=withdrawal.customer_id,
                    amount=withdrawal.amount,
                    idempotency_key=f"withdrawal_settle:{reference}",
                    reference=reference,
                    payment_transaction_id=payment_tx.id,
                )
                withdrawal.status = WithdrawalStatus.COMPLETED
                withdrawal.processed_at = datetime.now(timezone.utc)
            except LedgerError as exc:
                logger.error("withdrawal_settle_failed", reference=reference, error=exc.message)
                payment_tx.failure_reason = exc.message

    async def _handle_transfer_failed(self, data: dict[str, Any]) -> None:
        reference = str(data.get("reference") or "")
        reason = data.get("reason") or data.get("gateway_response") or "Transfer failed"
        payment_tx = await self._get_outbound_payment(reference)
        if not payment_tx:
            await self._fail_loan_disbursement(reference, reason)
            return

        if payment_tx.status in (TransactionStatus.FAILED, TransactionStatus.REVERSED):
            return

        payment_tx.status = TransactionStatus.FAILED
        payment_tx.failure_reason = reason
        payment_tx.webhook_event = "transfer.failed"

        withdrawal = await self.db.get(WithdrawalRequest, payment_tx.withdrawal_id)
        if withdrawal:
            try:
                await self.ledger.release_withdrawal_hold(
                    customer_id=withdrawal.customer_id,
                    amount=withdrawal.amount,
                    idempotency_key=f"withdrawal_release:{reference}",
                    reference=reference,
                )
            except LedgerError as exc:
                logger.error("withdrawal_release_failed", reference=reference, error=exc.message)
            withdrawal.status = WithdrawalStatus.FAILED
            withdrawal.failure_reason = reason
            withdrawal.processed_at = datetime.now(timezone.utc)

    async def _handle_transfer_reversed(self, data: dict[str, Any]) -> None:
        reference = str(data.get("reference") or "")
        payment_tx = await self._get_outbound_payment(reference)
        if not payment_tx:
            return
        payment_tx.status = TransactionStatus.REVERSED
        payment_tx.webhook_event = "transfer.reversed"
        await self._handle_transfer_failed(data)

    async def _complete_loan_disbursement(self, reference: str, data: dict[str, Any]) -> None:
        result = await self.db.execute(
            select(LoanDisbursement).where(LoanDisbursement.transfer_reference == reference)
        )
        disbursement = result.scalar_one_or_none()
        if not disbursement or disbursement.status == TransactionStatus.COMPLETED:
            return

        disbursement.status = TransactionStatus.COMPLETED
        disbursement.transfer_code = data.get("transfer_code")
        disbursement.completed_at = datetime.now(timezone.utc)

        application = await self.db.get(LoanApplication, disbursement.application_id)
        if not application:
            return

        if disbursement.payment_transaction_id:
            payment_tx = await self.db.get(PaymentTransaction, disbursement.payment_transaction_id)
            if payment_tx:
                payment_tx.status = TransactionStatus.COMPLETED
                payment_tx.webhook_event = "transfer.success"
                payment_tx.raw_payload = data

        try:
            await self.ledger.post_loan_disbursement(
                customer_id=disbursement.customer_id,
                amount=disbursement.amount,
                idempotency_key=f"loan_disburse:{reference}",
                reference=reference,
                payment_transaction_id=disbursement.payment_transaction_id,
            )
        except LedgerError as exc:
            logger.error("loan_disburse_ledger_failed", reference=reference, error=exc.message)

        application.status = ApplicationStatus.DISBURSED
        application.disbursed_at = datetime.now(timezone.utc)

        existing_loan = await self.db.execute(
            select(Loan).where(Loan.application_id == application.id)
        )
        if not existing_loan.scalar_one_or_none():
            product = application.product
            principal = disbursement.amount
            tenure_months = max(int(application.product_data.get("tenure_months") or 12), 1)
            monthly_rate = (product.interest_rate_pct_monthly or Decimal("8")) / Decimal("100")
            monthly_payment = (principal * (Decimal("1") + monthly_rate)).quantize(Decimal("0.01"))
            loan = Loan(
                customer_id=application.customer_id,
                application_id=application.id,
                product_type=LoanProductCode(product.code),
                principal=principal,
                disbursed_amount=principal,
                outstanding=principal,
                interest_rate=product.interest_rate_pct_monthly,
                tenure_months=tenure_months,
                monthly_payment=monthly_payment,
                status=LoanStatus.ACTIVE,
                disbursement_date=datetime.now(timezone.utc).date(),
                branch=application.branch,
            )
            self.db.add(loan)

    async def _fail_loan_disbursement(self, reference: str, reason: str) -> None:
        result = await self.db.execute(
            select(LoanDisbursement).where(LoanDisbursement.transfer_reference == reference)
        )
        disbursement = result.scalar_one_or_none()
        if not disbursement:
            return
        disbursement.status = TransactionStatus.FAILED
        disbursement.failure_reason = reason
        application = await self.db.get(LoanApplication, disbursement.application_id)
        if application and application.status == ApplicationStatus.READY_TO_DISBURSE:
            application.status = ApplicationStatus.APPROVED
