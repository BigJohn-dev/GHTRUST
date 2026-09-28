from datetime import date
from decimal import Decimal

from sqlalchemy import JSON, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import StrEnum, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.food_basket.schemas import FoodBasketPlanType, SubscriptionStatus


class FoodBasketPlan(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "food_basket_plans"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    plan_type: Mapped[FoodBasketPlanType] = mapped_column(StrEnum(FoodBasketPlanType))
    monthly_price: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    description: Mapped[str | None] = mapped_column(Text)
    # JSON variant lets the SQLite test schema build; Postgres DDL is unchanged.
    items_included: Mapped[list[str]] = mapped_column(
        ARRAY(String).with_variant(JSON(), "sqlite"), default=list
    )
    is_active: Mapped[bool] = mapped_column(default=True)


class FoodBasketSubscription(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "food_basket_subscriptions"

    customer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("customers.id"), index=True)
    plan_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("food_basket_plans.id"))
    monthly_price: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    status: Mapped[SubscriptionStatus] = mapped_column(StrEnum(SubscriptionStatus), default=SubscriptionStatus.ACTIVE)
    delivery_address: Mapped[str] = mapped_column(Text)
    pickup_branch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    next_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class FoodBasketDelivery(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "food_basket_deliveries"

    subscription_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("food_basket_subscriptions.id"), index=True
    )
    scheduled_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    fulfillment_partner: Mapped[str | None] = mapped_column(String(100), nullable=True)
