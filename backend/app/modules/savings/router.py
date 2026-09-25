from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentCustomer, DbSession
from app.modules.savings.schemas import (
    OpenSavingsAccountRequest,
    SavingsAccountResponse,
    SavingsProductResponse,
    SavingsSummaryResponse,
)
from app.modules.savings.service import SavingsService

router = APIRouter(prefix="/savings", tags=["Savings"])


@router.get("/products", response_model=list[SavingsProductResponse])
async def list_savings_products(db: DbSession):
    return await SavingsService(db).list_products()


@router.get("/me", response_model=SavingsSummaryResponse)
async def get_my_savings(db: DbSession, customer: CurrentCustomer):
    return await SavingsService(db).get_customer_summary(customer.id)


@router.post(
    "/me/accounts",
    response_model=SavingsAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def open_my_savings_account(
    payload: OpenSavingsAccountRequest, db: DbSession, customer: CurrentCustomer
):
    try:
        return await SavingsService(db).open_account(customer.id, payload)
    except NotImplementedError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))
