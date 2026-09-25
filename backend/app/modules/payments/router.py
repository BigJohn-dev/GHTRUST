from fastapi import APIRouter, Header

from app.core.deps import CurrentCustomer, DbSession
from app.modules.payments.ledger_service import LedgerError, raise_ledger_http
from app.modules.payments.schemas import (
    UpdatePayoutAccountRequest,
    WalletFundRequest,
    WalletFundSessionResponse,
    WalletSummaryResponse,
    WithdrawalResponse,
    WithdrawRequest,
)
from app.modules.payments.wallet_service import WalletService

router = APIRouter(prefix="/wallet", tags=["Wallet"])


@router.get("", response_model=WalletSummaryResponse)
async def get_wallet(customer: CurrentCustomer, db: DbSession) -> WalletSummaryResponse:
    summary = await WalletService(db).get_wallet_summary(customer)
    return WalletSummaryResponse(**summary)


@router.post("/fund", response_model=WalletFundSessionResponse)
async def create_wallet_funding_session(
    payload: WalletFundRequest,
    customer: CurrentCustomer,
    db: DbSession,
) -> WalletFundSessionResponse:
    """Zest: generate a temporary virtual account for bank transfer (expires ~5 minutes)."""
    session = await WalletService(db).create_funding_session(customer, payload.amount)
    return WalletFundSessionResponse(**session)


@router.post("/payout-account")
async def update_payout_account(
    payload: UpdatePayoutAccountRequest,
    customer: CurrentCustomer,
    db: DbSession,
):
    updated = await WalletService(db).update_payout_account(
        customer,
        bank_code=payload.bank_code,
        account_number=payload.account_number,
        account_name=payload.account_name or customer.full_name,
        bank_name=payload.bank_name,
    )
    return {
        "message": "Payout account saved",
        "account_name": updated.payout_account_name,
        "account_number": updated.payout_account_number[-4:].rjust(len(updated.payout_account_number), "*"),
    }


@router.post(
    "/withdraw",
    response_model=WithdrawalResponse,
    description=(
        "Requires an `Idempotency-Key` header: a retried request with the same key "
        "returns the original withdrawal instead of creating a second one."
    ),
)
async def request_withdrawal(
    payload: WithdrawRequest,
    customer: CurrentCustomer,
    db: DbSession,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=8, max_length=64),
) -> WithdrawalResponse:
    try:
        withdrawal = await WalletService(db).request_withdrawal(customer, payload.amount)
    except LedgerError as exc:
        raise_ledger_http(exc)
    return WithdrawalResponse(
        id=withdrawal.id,
        amount=float(withdrawal.amount),
        status=withdrawal.status.value,
        transfer_reference=withdrawal.transfer_reference,
    )
