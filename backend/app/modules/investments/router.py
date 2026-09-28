from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentCustomer, DbSession
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


@router.post("/calculator", response_model=InvestmentCalculatorResponse)
async def investment_calculator(payload: InvestmentCalculatorRequest):
    return InvestmentService.calculate(payload)


@router.get("/me", response_model=list[InvestmentResponse])
async def list_my_investments(db: DbSession, customer: CurrentCustomer):
    return await InvestmentService(db).list_customer_investments(customer.id)


@router.post("/me", response_model=InvestmentResponse, status_code=status.HTTP_201_CREATED)
async def create_my_investment(payload: InvestRequest, db: DbSession, customer: CurrentCustomer):
    try:
        return await InvestmentService(db).invest(customer.id, payload)
    except NotImplementedError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))
