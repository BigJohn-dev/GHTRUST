from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.investments.models import CustomerInvestment, InvestmentPlan
from app.modules.investments.schemas import (
    InvestRequest,
    InvestmentCalculatorRequest,
    InvestmentCalculatorResponse,
    InvestmentPlanResponse,
    InvestmentResponse,
)


class InvestmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_plans(self) -> list[InvestmentPlanResponse]:
        result = await self.db.execute(
            select(InvestmentPlan).where(InvestmentPlan.is_active.is_(True))
        )
        return [InvestmentPlanResponse.model_validate(p) for p in result.scalars().all()]

    async def list_customer_investments(self, customer_id: str) -> list[InvestmentResponse]:
        result = await self.db.execute(
            select(CustomerInvestment).where(CustomerInvestment.customer_id == customer_id)
        )
        rows = result.scalars().all()
        return [
            InvestmentResponse(
                id=r.id,
                customer_id=r.customer_id,
                plan_name="",  # join plan in implementation phase
                amount=r.amount,
                return_rate=r.return_rate,
                start_date=r.start_date,
                maturity_date=r.maturity_date,
                projected_return=r.projected_return,
                status=r.status,
            )
            for r in rows
        ]

    def calculate(payload: InvestmentCalculatorRequest) -> InvestmentCalculatorResponse:
        projected = payload.amount * (payload.annual_rate / Decimal("100")) * (
            Decimal(payload.tenure_months) / Decimal("12")
        )
        projected = projected.quantize(Decimal("0.01"))
        return InvestmentCalculatorResponse(
            amount=payload.amount,
            tenure_months=payload.tenure_months,
            projected_return=projected,
            maturity_value=payload.amount + projected,
        )

    async def invest(self, customer_id: str, payload: InvestRequest) -> InvestmentResponse:
        raise NotImplementedError("Wallet debit + plan validation in next phase")
