from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PaymentRailError(Exception):
    def __init__(self, message: str, status_code: int = 502, provider_code: str | None = None):
        self.message = message
        self.status_code = status_code
        self.provider_code = provider_code
        super().__init__(message)


class ReservedAccountResult(BaseModel):
    account_reference: str
    account_number: str
    account_name: str
    bank_name: str
    bank_code: str | None = None
    currency: str = "NGN"
    reservation_reference: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class ResolvedAccount(BaseModel):
    account_number: str
    account_name: str
    bank_code: str


class DisbursementResult(BaseModel):
    reference: str
    status: str
    amount: Decimal
    currency: str = "NGN"
    transaction_id: str | None = None
    narration: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class TransactionVerification(BaseModel):
    model_config = ConfigDict(extra="allow")

    transaction_reference: str
    payment_reference: str | None = None
    amount: Decimal
    currency: str = "NGN"
    status: str
    payment_method: str | None = None
    account_reference: str | None = None
    raw: dict[str, Any] = Field(default_factory=dict)


class WalletBalanceResult(BaseModel):
    available_balance: Decimal
    ledger_balance: Decimal | None = None
    currency: str = "NGN"
