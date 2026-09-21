import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import StrEnum, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.investments.schemas import RiskLevel


class InvestmentPlan(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "investment_plans"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    min_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    return_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    tenure_months: Mapped[int] = mapped_column(Integer)
    risk: Mapped[RiskLevel] = mapped_column(StrEnum(RiskLevel))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)


class CustomerInvestment(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "customer_investments"

    customer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("customers.id"), index=True)
    plan_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("investment_plans.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    return_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    start_date: Mapped[date] = mapped_column(Date)
    maturity_date: Mapped[date] = mapped_column(Date)
    projected_return: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    status: Mapped[str] = mapped_column(String(20), default="active")
