from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.integrations.payments.schemas import PaymentRailError
from app.integrations.retry import TransientError


class PaystackError(PaymentRailError):
    """
    Paystack failure. Subclasses PaymentRailError — previously it derived from
    Exception, so no ``except PaymentRailError`` handler caught Paystack errors.
    """

    def __init__(self, message: str, status_code: int = 400, paystack_message: str | None = None):
        super().__init__(message, status_code=status_code, provider_code=paystack_message)
        self.paystack_message = paystack_message


class TransientPaystackError(PaystackError, TransientError):
    """Transport failure or Paystack 5xx — retried, and outcome unknown."""


class PaystackEnvelope(BaseModel):
    model_config = ConfigDict(extra="allow")

    status: bool
    message: str
    data: Any = None


class PaystackCustomer(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: int
    customer_code: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    risk_action: str | None = None


class CreateCustomerRequest(BaseModel):
    email: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    metadata: dict[str, Any] | None = None


class ValidateCustomerRequest(BaseModel):
    country: str = "NG"
    type: str = "bank_account"
    account_number: str
    bvn: str
    bank_code: str
    first_name: str
    last_name: str
    middle_name: str | None = None


class PaystackBank(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str
    slug: str
    code: str
    active: bool = True
    country: str | None = None
    currency: str | None = None
    type: str | None = None


class ResolvedAccount(BaseModel):
    model_config = ConfigDict(extra="allow")

    account_number: str
    account_name: str
    bank_id: int | None = None


class PaystackDedicatedAccount(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: int
    account_name: str
    account_number: str
    assigned: bool
    currency: str
    active: bool
    customer: PaystackCustomer | None = None
    bank: PaystackBank | None = None


class AssignDedicatedAccountRequest(BaseModel):
    email: str
    first_name: str
    last_name: str
    phone: str
    preferred_bank: str
    country: str = "NG"
    account_number: str
    bvn: str
    bank_code: str
    middle_name: str | None = None


class CreateDedicatedAccountRequest(BaseModel):
    customer: str
    preferred_bank: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None


class PaystackTransaction(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: int
    reference: str
    amount: int
    currency: str
    status: str
    channel: str | None = None
    paid_at: datetime | None = None
    customer: PaystackCustomer | dict[str, Any] | None = None
    authorization: dict[str, Any] | None = None
    metadata: dict[str, Any] | None = None


class InitializeTransactionRequest(BaseModel):
    email: str
    amount: int
    reference: str | None = None
    currency: str = "NGN"
    callback_url: str | None = None
    metadata: dict[str, Any] | None = None
    channels: list[str] | None = None


class InitializeTransactionResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    authorization_url: str
    access_code: str
    reference: str


class PaystackTransferRecipient(BaseModel):
    model_config = ConfigDict(extra="allow")

    recipient_code: str
    name: str
    type: str
    details: dict[str, Any] | None = None
    currency: str | None = None


class CreateTransferRecipientRequest(BaseModel):
    type: str = "nuban"
    name: str
    account_number: str
    bank_code: str
    currency: str = "NGN"
    description: str | None = None
    metadata: dict[str, Any] | None = None


class InitiateTransferRequest(BaseModel):
    source: str = "balance"
    amount: int
    recipient: str
    reason: str | None = None
    currency: str = "NGN"
    reference: str | None = None


class PaystackTransfer(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: int
    reference: str
    transfer_code: str
    amount: int
    currency: str
    status: str
    reason: str | None = None
    recipient: int | dict[str, Any] | None = None


class FinalizeTransferRequest(BaseModel):
    transfer_code: str
    otp: str


class PaystackBalance(BaseModel):
    model_config = ConfigDict(extra="allow")

    currency: str
    balance: int


class PaystackWebhookEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    event: str
    data: dict[str, Any]


def naira_to_kobo(amount: float | int) -> int:
    """Convert NGN amount to Paystack minor units (kobo)."""
    return int(round(float(amount) * 100))


def kobo_to_naira(amount: int) -> float:
    return round(amount / 100, 2)
