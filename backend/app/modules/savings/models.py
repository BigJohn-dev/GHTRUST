import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import StrEnum, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.savings.schemas import SavingsProductType


class SavingsProduct(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "savings_products"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    product_type: Mapped[SavingsProductType] = mapped_column(StrEnum(SavingsProductType), unique=True)
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    min_deposit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(default=True)


class SavingsAccountStatus(str, enum.Enum):
    ACTIVE = "active"
    MATURED = "matured"
    CLOSED = "closed"


class SavingsAccount(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "savings_accounts"

    customer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("customers.id"), index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("savings_products.id"))
    account_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    opened_date: Mapped[date] = mapped_column(Date)
    maturity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[SavingsAccountStatus] = mapped_column(StrEnum(SavingsAccountStatus), default=SavingsAccountStatus.ACTIVE)

    product: Mapped["SavingsProduct"] = relationship("SavingsProduct")
