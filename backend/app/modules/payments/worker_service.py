"""Async payment worker helpers invoked from Celery tasks."""

import structlog
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.integrations.monnify.client import MonnifyClient
from app.integrations.zest.client import ZestClient
from app.integrations.monnify.constants import PAYMENT_STATUS_PAID
from app.integrations.paystack.constants import TRANSACTION_STATUS_SUCCESS, TRANSFER_STATUS_SUCCESS
from app.integrations.paystack.schemas import kobo_to_naira
from app.integrations.payments.factory import get_payment_client
from app.models.base import TransactionStatus
from app.modules.payments.ledger_service import LedgerService
from app.modules.payments.models import (
    PaymentDirection,
    PaymentProvider,
    PaymentTransaction,
    WithdrawalRequest,
    WithdrawalStatus,
)
from app.modules.payments.wallet_service import WalletService

logger = structlog.get_logger()


def _active_provider() -> PaymentProvider:
    provider = settings.active_payment_provider
    if provider == "paystack":
        return PaymentProvider.PAYSTACK
    if provider == "zest":
        return PaymentProvider.ZEST
    return PaymentProvider.MONNIFY


async def run_process_pending_withdrawals(limit: int = 50) -> dict:
    processed = 0
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WithdrawalRequest)
            .where(WithdrawalRequest.status == WithdrawalStatus.PENDING)
            .order_by(WithdrawalRequest.created_at.asc())
            .limit(limit)
        )
        withdrawals = result.scalars().all()
        wallet_svc = WalletService(db)
        for withdrawal in withdrawals:
            await wallet_svc.process_withdrawal(withdrawal)
            processed += 1
        await db.commit()
    return {"status": "ok", "processed": processed}


async def run_reconcile_payments(limit: int = 100) -> dict:
    matched = 0
    rail = get_payment_client()
    provider = _active_provider()
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PaymentTransaction)
            .where(
                PaymentTransaction.provider == provider,
                PaymentTransaction.status == TransactionStatus.PENDING,
            )
            .order_by(PaymentTransaction.created_at.asc())
            .limit(limit)
        )
        transactions = result.scalars().all()
        ledger = LedgerService(db)

        for tx in transactions:
            try:
                if tx.direction == PaymentDirection.OUTBOUND:
                    if settings.active_payment_provider == "paystack":
                        transfer = await rail.verify_transfer(tx.provider_reference)
                        success = transfer.status == TRANSFER_STATUS_SUCCESS
                        failed = transfer.status in ("failed", "reversed")
                    elif settings.active_payment_provider == "zest":
                        continue
                    else:
                        transfer = await rail.verify_disbursement(tx.provider_reference)
                        success = MonnifyClient.is_disbursement_success(transfer.status)
                        failed = MonnifyClient.is_disbursement_failed(transfer.status)

                    if success:
                        tx.status = TransactionStatus.COMPLETED
                        matched += 1
                        if tx.withdrawal_id:
                            withdrawal = await db.get(WithdrawalRequest, tx.withdrawal_id)
                            if withdrawal and withdrawal.status != WithdrawalStatus.COMPLETED:
                                await ledger.settle_withdrawal_hold(
                                    customer_id=withdrawal.customer_id,
                                    amount=withdrawal.amount,
                                    idempotency_key=f"withdrawal_settle:{tx.provider_reference}",
                                    reference=tx.provider_reference,
                                    payment_transaction_id=tx.id,
                                )
                                withdrawal.status = WithdrawalStatus.COMPLETED
                                withdrawal.processed_at = datetime.now(timezone.utc)
                    elif failed:
                        tx.status = TransactionStatus.FAILED
                        matched += 1
                else:
                    if settings.active_payment_provider == "zest":
                        verified = await rail.verify_transaction(tx.provider_reference)
                        is_paid = ZestClient.is_payment_success(verified.status)
                        amount = Decimal(str(verified.amount))
                    elif settings.active_payment_provider == "paystack":
                        verified = await rail.verify_transaction(tx.provider_reference)
                        is_paid = verified.status == TRANSACTION_STATUS_SUCCESS
                        amount = Decimal(str(kobo_to_naira(verified.amount)))
                    else:
                        verified = await rail.verify_transaction(tx.provider_reference)
                        is_paid = verified.status == PAYMENT_STATUS_PAID
                        amount = Decimal(str(verified.amount))

                    if is_paid:
                        tx.status = TransactionStatus.COMPLETED
                        if tx.customer_id:
                            await ledger.credit_wallet_from_paystack(
                                customer_id=tx.customer_id,
                                amount=amount,
                                idempotency_key=f"wallet_funding:{tx.provider_reference}",
                                reference=tx.provider_reference,
                                payment_transaction=tx,
                            )
                        matched += 1
            except Exception:
                logger.exception("reconcile_payment_failed", reference=tx.provider_reference)

        await db.commit()
    return {"status": "ok", "matched": matched}
