from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class WalletSummaryResponse(BaseModel):
    available_balance: float
    locked_balance: float
    currency: str
    dva_status: str
    dva_account_number: str | None = None
    dva_bank_name: str | None = None
    paystack_customer_code: str | None = None
    payment_provider: str | None = None
    funding_mode: str | None = None  # permanent_dva | on_demand_dynamic


class WalletFundRequest(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)


class WalletFundSessionResponse(BaseModel):
    transaction_ref: str
    account_number: str
    account_name: str
    bank_name: str
    amount: float
    currency: str
    expires_in_minutes: int
    message: str = "Transfer to this account within the expiry window"


class UpdatePayoutAccountRequest(BaseModel):
    bank_code: str = Field(min_length=3, max_length=10)
    account_number: str = Field(min_length=10, max_length=10)
    account_name: str | None = Field(default=None, max_length=200)
    bank_name: str | None = None

    @field_validator("account_number")
    @classmethod
    def validate_account(cls, value: str) -> str:
        digits = value.strip()
        if not digits.isdigit() or len(digits) != 10:
            raise ValueError("Account number must be 10 digits")
        return digits


class WithdrawRequest(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Decimal) -> Decimal:
        if value.as_tuple().exponent < -2:
            raise ValueError("Amount supports at most 2 decimal places")
        return value


class WithdrawalResponse(BaseModel):
    id: str
    amount: float
    status: str
    transfer_reference: str
    message: str = "Withdrawal queued for processing"

    model_config = {"from_attributes": True}


class WebhookAckResponse(BaseModel):
    received: bool = True
