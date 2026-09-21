from decimal import Decimal
from uuid import uuid4

import structlog
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.payments.factory import get_payment_client
from app.integrations.payments.schemas import PaymentRailError
from app.models.base import TransactionStatus
from app.modules.admin.models import Staff
from app.modules.loans.models import LoanApplication
from app.modules.loans.schemas import ApplicationStatus
from app.modules.loans.workflow_models import AuditEventType
from app.modules.loans.audit_service import ApplicationAuditService
from app.modules.payments.models import (
    LoanDisbursement,
    PaymentChannel,
    PaymentDirection,
    PaymentProvider,
    PaymentTransaction,
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


class DisbursementService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.rail = get_payment_client()
        self.provider = _active_provider()
        self.audit = ApplicationAuditService(db)

    async def initiate_loan_disbursement(
        self,
        application: LoanApplication,
        staff: Staff,
        *,
        note: str | None = None,
        ip: str | None = None,
    ) -> LoanApplication:
        if application.status != ApplicationStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only approved applications can be disbursed",
            )

        amount = application.approved_amount or application.requested_amount
        if not amount or amount <= 0:
            raise HTTPException(status_code=409, detail="Approved amount is required for disbursement")

        form = application.universal_form or {}
        bank_code = form.get("bank_code") or form.get("payout_bank_code")
        account_number = form.get("bank_account_number") or form.get("payout_account_number")
        account_name = form.get("bank_account_name") or form.get("payout_account_name")
        if not bank_code or not account_number:
            raise HTTPException(status_code=409, detail="Applicant bank details are required for disbursement")

        existing = await self.db.execute(
            select(LoanDisbursement).where(LoanDisbursement.application_id == application.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Disbursement already initiated for this application")

        customer = await self.db.get(Customer, application.customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if not account_name:
            try:
                resolved = await self.rail.validate_bank_account(str(account_number), str(bank_code))
                account_name = resolved.account_name
            except PaymentRailError:
                account_name = customer.full_name

        reference = f"ghtrust_loan_{application.id[:8]}_{uuid4().hex[:12]}"
        recipient_code: str | None = None

        try:
            if settings.active_payment_provider == "paystack":
                from app.integrations.paystack.schemas import (
                    CreateTransferRecipientRequest,
                    InitiateTransferRequest,
                    naira_to_kobo,
                )

                recipient = await self.rail.create_transfer_recipient(
                    CreateTransferRecipientRequest(
                        name=account_name,
                        account_number=str(account_number),
                        bank_code=str(bank_code),
                    )
                )
                recipient_code = recipient.recipient_code
                transfer = await self.rail.initiate_transfer(
                    InitiateTransferRequest(
                        amount=naira_to_kobo(amount),
                        recipient=recipient.recipient_code,
                        reason=f"GH Trust loan disbursement {application.id[:8]}",
                        reference=reference,
                    )
                )
                transfer_code = transfer.transfer_code
                provider_tx_id = str(transfer.id)
                raw_payload = {"transfer_code": transfer.transfer_code, "status": transfer.status}
            else:
                result = await self.rail.initiate_disbursement(
                    amount=Decimal(str(amount)),
                    reference=reference,
                    bank_code=str(bank_code),
                    account_number=str(account_number),
                    account_name=str(account_name),
                    narration=f"GH Trust loan disbursement {application.id[:8]}",
                )
                transfer_code = result.transaction_id
                provider_tx_id = result.transaction_id or reference
                raw_payload = {"status": result.status, "reference": result.reference}
        except PaymentRailError as exc:
            raise HTTPException(status_code=502, detail="Disbursement could not be initiated") from exc

        payment_tx = PaymentTransaction(
            provider=self.provider,
            provider_reference=reference,
            provider_transaction_id=provider_tx_id,
            direction=PaymentDirection.OUTBOUND,
            channel=PaymentChannel.TRANSFER,
            amount=Decimal(str(amount)),
            currency="NGN",
            status=TransactionStatus.PENDING,
            customer_id=customer.id,
            application_id=application.id,
            raw_payload=raw_payload,
        )
        self.db.add(payment_tx)
        await self.db.flush()

        disbursement = LoanDisbursement(
            application_id=application.id,
            customer_id=customer.id,
            amount=Decimal(str(amount)),
            transfer_reference=reference,
            transfer_code=transfer_code,
            recipient_code=recipient_code,
            status=TransactionStatus.PENDING,
            payment_transaction_id=payment_tx.id,
        )
        self.db.add(disbursement)

        application.status = ApplicationStatus.READY_TO_DISBURSE
        provider_label = self.provider.value.title()
        await self.audit.log_staff(
            application.id,
            AuditEventType.DISBURSED,
            staff,
            message=note or f"Loan disbursement initiated via {provider_label}",
            metadata={
                "transfer_reference": reference,
                "amount": float(amount),
                "recipient_code": recipient_code,
                "provider": self.provider.value,
            },
            ip_address=ip,
        )
        await self.db.flush()
        logger.info(
            "loan_disbursement_initiated",
            application_id=application.id,
            reference=reference,
            amount=float(amount),
            provider=self.provider.value,
        )
        return application
