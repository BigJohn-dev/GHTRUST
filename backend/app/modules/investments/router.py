from fastapi import APIRouter, HTTPException, status

from app.core.deps import DbSession
from app.modules.investments.schemas import (
    InvestRequest,
    InvestmentCalculatorRequest,
    InvestmentCalculatorResponse,
    InvestmentPlanResponse,
    InvestmentResponse,
)
from app.modules.investments.service import InvestmentService

router = APIRouter(prefix="/investments", tags=["Investments"])


@router.get("/plans", response_model=list[InvestmentPlanResponse])
async def list_investment_plans(db: DbSession):
    return await InvestmentService(db).list_plans()


@router.get("/customers/{customer_id}", response_model=list[InvestmentResponse])
async def list_customer_investments(customer_id: str, db: DbSession):
    return await InvestmentService(db).list_customer_investments(customer_id)


@router.post("/calculator", response_model=InvestmentCalculatorResponse)
async def investment_calculator(payload: InvestmentCalculatorRequest):
    return InvestmentService.calculate(payload)


@router.post(
    "/customers/{customer_id}/invest",
    response_model=InvestmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_investment(customer_id: str, payload: InvestRequest, db: DbSession):
    try:
        return await InvestmentService(db).invest(customer_id, payload)
    except NotImplementedError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))
