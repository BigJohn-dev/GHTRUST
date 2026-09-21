import enum
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import DateTime, Enum, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class UUIDPrimaryKeyMixin:
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )


class AccountStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    MATURED = "matured"
    CLOSED = "closed"


class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"


class MoneyColumn:
    """Reusable money column type — NGN amounts in kobo precision optional; using 2dp here."""

    @staticmethod
    def column(name: str = "amount") -> Mapped[Decimal]:
        return mapped_column(name, Numeric(18, 2), nullable=False, default=Decimal("0"))


def StrEnum(enum_class: type[enum.Enum], **kwargs) -> Enum:
    """PostgreSQL enum column using str Enum values (lowercase), not member names."""
    return Enum(
        enum_class,
        values_callable=lambda members: [member.value for member in members],
        **kwargs,
    )
