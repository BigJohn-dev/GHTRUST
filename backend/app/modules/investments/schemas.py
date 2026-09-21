import enum
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class InvestmentPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    min_amount: Decimal
    return_rate: Decimal
    tenure_months: int
    risk: RiskLevel
    description: str | None = None
    is_active: bool = True


class InvestRequest(BaseModel):
    plan_id: str
    amount: Decimal = Field(gt=0)


class InvestmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    plan_name: str
    amount: Decimal
    return_rate: Decimal
    start_date: date
    maturity_date: date
    projected_return: Decimal
    status: str


class InvestmentCalculatorRequest(BaseModel):
    amount: Decimal = Field(gt=0)
    tenure_months: int = Field(ge=1, le=60)
    annual_rate: Decimal = Field(default=Decimal("18"))


class InvestmentCalculatorResponse(BaseModel):
    amount: Decimal
    tenure_months: int
    projected_return: Decimal
    maturity_value: Decimal
