import enum
from datetime import datetime

from sqlalchemy import DateTime, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import StrEnum, TimestampMixin, UUIDPrimaryKeyMixin


class SubjectType(str, enum.Enum):
    CUSTOMER = "customer"
    STAFF = "staff"


class AuthSession(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    One row per signed-in device.

    The refresh token rotates in place on every use: ``refresh_token_hash`` is
    the only token currently valid, ``previous_refresh_token_hash`` is kept so
    a replayed (stolen) token can be recognised and the session killed.
    """

    __tablename__ = "auth_sessions"
    __table_args__ = (Index("ix_auth_sessions_subject", "subject_type", "subject_id"),)

    subject_type: Mapped[SubjectType] = mapped_column(StrEnum(SubjectType))
    # Polymorphic (customers.id or staff.id), so no FK.
    subject_id: Mapped[str] = mapped_column(UUID(as_uuid=False))

    refresh_token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    previous_refresh_token_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    device_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    platform: Mapped[str | None] = mapped_column(String(20), nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(String(40), nullable=True)
