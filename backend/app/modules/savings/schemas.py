import enum
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class SavingsProductType(str, enum.Enum):
    YEARLY_THRIFT = "yearly_thrift"
    REGULAR = "regular_savings"
    FIXED = "fixed_savings"
    SAVE_TO_INVEST = "save_to_invest"


class SavingsProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    product_type: SavingsProductType
    interest_rate: Decimal
    min_deposit: Decimal
    description: str | None = None
    is_active: bool = True


class OpenSavingsAccountRequest(BaseModel):
    product_type: SavingsProductType
    initial_deposit: Decimal = Field(gt=0, description="Amount in NGN")
    tenure_months: int | None = Field(default=None, ge=1, le=36)


class SavingsAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    product_type: SavingsProductType
    account_number: str
    balance: Decimal
    interest_rate: Decimal
    opened_date: date
    maturity_date: date | None = None
    status: str


class SavingsDepositRequest(BaseModel):
    amount: Decimal = Field(gt=0)


class SavingsSummaryResponse(BaseModel):
    total_balance: Decimal
    active_accounts: int
    accounts: list[SavingsAccountResponse]
