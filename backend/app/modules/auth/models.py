import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint
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
    # The owner turned on Face ID / fingerprint on this device, so a biometric check there
    # can stand in for the sign-in PIN (e.g. approving a new device).
    biometric_enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    # Expo push token of the app signed in with this session. Only active sessions are
    # pushed to, so a signed-out phone stops receiving the customer's notifications.
    push_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)


class CustomerDevice(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    A phone the customer has signed in on and trusts.

    The device keeps a random ``device_token`` (only its hash is stored here). With it
    plus the 6-digit PIN the customer can sign back in on that phone without an SMS code,
    and a trusted phone that is signed in approves sign-ins on new ones.
    """

    __tablename__ = "customer_devices"
    __table_args__ = (UniqueConstraint("customer_id", "device_id", name="uq_customer_devices_device"),)

    customer_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    device_id: Mapped[str] = mapped_column(String(128))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    device_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    platform: Mapped[str | None] = mapped_column(String(20), nullable=True)
    trusted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DeviceApprovalStatus(str, enum.Enum):
    PENDING = "pending"  # waiting for the customer on a signed-in phone
    APPROVED = "approved"  # confirmed there; the code it shows is being typed on the new phone
    DENIED = "denied"  # "No, this wasn't me"
    COMPLETED = "completed"  # new phone signed in
    EXPIRED = "expired"
    FAILED = "failed"  # too many wrong codes


class DeviceApproval(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    A sign-in on a new phone, held until the customer confirms it on a phone that's
    already signed in. That phone then shows a 6-digit code to type on the new one.
    """

    __tablename__ = "device_approvals"

    customer_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(20), default=DeviceApprovalStatus.PENDING.value)
    # Proves the caller is the phone that started this sign-in (hash of a random secret).
    secret_hash: Mapped[str] = mapped_column(String(64), unique=True)

    device_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    device_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    platform: Mapped[str | None] = mapped_column(String(20), nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by_session_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    code_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    code_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    code_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class SelfieOutcome(str, enum.Enum):
    PASSED = "passed"
    NO_MATCH = "no_match"  # live face, but didn't match the BVN photo
    NOT_LIVE = "not_live"  # liveness check failed (photo of a photo, no face, several faces)
    UNREADABLE = "unreadable"  # Dojah couldn't read the image
    PROVIDER_ERROR = "provider_error"  # Dojah unavailable


class SelfieAttempt(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    One row per face check at sign-up, passed or failed.

    Pilot data for tuning DOJAH_SELFIE_THRESHOLD and the liveness minimum: pass
    rates, and what they would be at other thresholds. Scores only, never images.
    """

    __tablename__ = "selfie_attempts"
    __table_args__ = (Index("ix_selfie_attempts_created_at", "created_at"),)

    customer_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("customers.id", ondelete="CASCADE"), index=True
    )
    outcome: Mapped[str] = mapped_column(String(20))
    attempt_number: Mapped[int] = mapped_column(Integer)
    # Settings in force for this attempt, so later threshold changes don't blur history.
    threshold: Mapped[int] = mapped_column(Integer)
    liveness_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    match_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    liveness_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    liveness_reason: Mapped[str | None] = mapped_column(String(40), nullable=True)
