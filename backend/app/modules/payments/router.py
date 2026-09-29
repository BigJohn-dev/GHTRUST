from typing import Literal

from fastapi import APIRouter, Header, Query, status

from app.core.deps import CurrentCustomer, DbSession
from app.core.errors import AppError
from app.modules.auth.security_service import SecurityService
from app.modules.payments.ledger_service import LedgerError, raise_ledger_http
from app.modules.payments.schemas import (
    PayoutAccountSavedResponse,
    UpdatePayoutAccountRequest,
    WalletFundRequest,
    WalletFundSessionResponse,
    WalletSummaryResponse,
    WalletTransactionPage,
    WalletTransactionResponse,
    WithdrawalResponse,
    WithdrawRequest,
)
from app.modules.payments.transactions import MAX_PAGE, InvalidCursor, WalletTransactionService
from app.modules.payments.wallet_service import WalletService, mask_account_number, payout_account_summary

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


@router.get("/transactions", response_model=WalletTransactionPage)
async def list_wallet_transactions(
    customer: CurrentCustomer,
    db: DbSession,
    direction: Literal["in", "out"] | None = Query(None, description="Only money in, or only money out"),
    limit: int = Query(20, ge=1, le=MAX_PAGE),
    cursor: str | None = Query(None, max_length=200, description="`next_cursor` from the previous page"),
) -> WalletTransactionPage:
    """Money in and out of the wallet, newest first."""
    try:
        items, next_cursor = await WalletTransactionService(db).page(
            customer.id, direction=direction, limit=limit, cursor=cursor
        )
    except InvalidCursor as exc:
        raise AppError(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "Invalid cursor") from exc
    return WalletTransactionPage(items=items, next_cursor=next_cursor)


@router.get("/transactions/{transaction_id}", response_model=WalletTransactionResponse)
async def get_wallet_transaction(
    transaction_id: str, customer: CurrentCustomer, db: DbSession
) -> WalletTransactionResponse:
    """One transaction, for its receipt."""
    item = await WalletTransactionService(db).get(customer.id, transaction_id)
    if item is None:
        raise AppError(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Transaction not found")
    return WalletTransactionResponse(**item)


@router.post("/payout-account", response_model=PayoutAccountSavedResponse)
async def update_payout_account(
    payload: UpdatePayoutAccountRequest,
    customer: CurrentCustomer,
    db: DbSession,
):
    # Changing where withdrawals go is as sensitive as a withdrawal.
    await SecurityService(db).authorize_transaction(customer, payload.transaction_pin)
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
        "account_number": mask_account_number(updated.payout_account_number),
        "payout_account": payout_account_summary(updated),
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
    await SecurityService(db).authorize_transaction(customer, payload.transaction_pin)
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
