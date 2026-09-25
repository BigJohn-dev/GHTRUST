import enum
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class FoodBasketPlanType(str, enum.Enum):
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class FoodBasketPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    plan_type: FoodBasketPlanType
    monthly_price: Decimal
    description: str | None = None
    items_included: list[str] = []
    is_active: bool = True


class SubscribeRequest(BaseModel):
    plan_id: str = Field(..., max_length=36)
    delivery_address: str = Field(min_length=10, max_length=500)
    pickup_branch: str | None = Field(None, max_length=100)


class FoodBasketSubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    plan_name: str
    monthly_price: Decimal
    status: SubscriptionStatus
    next_delivery_date: date | None = None
    delivery_address: str


class DeliveryScheduleResponse(BaseModel):
    subscription_id: str
    scheduled_date: date
    status: str
    items: list[str]
