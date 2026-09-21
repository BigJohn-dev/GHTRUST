import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import StrEnum, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.contributions.schemas import GroupStatus


class ContributionGroup(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Group Thrift / Ajo / Esusu — matches frontend Group Thrift module."""

    __tablename__ = "contribution_groups"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    leader_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("customers.id"))
    member_count: Mapped[int] = mapped_column(Integer, default=0)
    max_members: Mapped[int] = mapped_column(Integer, default=12)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    collected_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    cycle: Mapped[int] = mapped_column(Integer, default=1)
    branch: Mapped[str] = mapped_column(String(100))
    next_meeting: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[GroupStatus] = mapped_column(StrEnum(GroupStatus), default=GroupStatus.ACTIVE)
    service_fee_percent: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("2"))


class GroupMember(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "group_members"

    group_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("contribution_groups.id"), index=True)
    customer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("customers.id"), index=True)
    is_active: Mapped[bool] = mapped_column(default=True)


class GroupContribution(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "group_contributions"

    group_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("contribution_groups.id"), index=True)
    member_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("customers.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    cycle: Mapped[int] = mapped_column(Integer)
    contributed_at: Mapped[date] = mapped_column(Date)
