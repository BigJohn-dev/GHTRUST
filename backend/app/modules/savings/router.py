from fastapi import APIRouter, HTTPException, status

from app.core.deps import DbSession
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


@router.get("/customers/{customer_id}/summary", response_model=SavingsSummaryResponse)
async def get_savings_summary(customer_id: str, db: DbSession):
    return await SavingsService(db).get_customer_summary(customer_id)


@router.post(
    "/customers/{customer_id}/accounts",
    response_model=SavingsAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def open_savings_account(
    customer_id: str, payload: OpenSavingsAccountRequest, db: DbSession
):
    try:
        return await SavingsService(db).open_account(customer_id, payload)
    except NotImplementedError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))
