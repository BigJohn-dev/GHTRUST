import enum
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class PushStatus(str, enum.Enum):
    PENDING = "pending"  # waiting for the delivery job
    SENT = "sent"  # accepted by the push service for at least one phone
    SKIPPED = "skipped"  # no phone to send to, or too old to be worth sending
    FAILED = "failed"  # the push service rejected it for every phone


class Notification(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Something the customer should know about. Written in the same transaction as
    the event (a credit, a decision), so it exists only if the event does; the
    delivery job then pushes it to the customer's signed-in phones. The row also
    backs the in-app inbox.
    """

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_customer_created", "customer_id", "created_at"),)

    customer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("customers.id"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    # In-app route the notification opens, e.g. "/loans/<id>".
    route: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Stops the same reminder being created twice (e.g. "due:<loan>:<date>").
    dedupe_key: Mapped[str | None] = mapped_column(String(160), nullable=True, unique=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # A PushStatus value (plain string column, like other small status fields).
    push_status: Mapped[str] = mapped_column(String(20), default=PushStatus.PENDING.value, index=True)
    push_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    pushed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    push_error: Mapped[str | None] = mapped_column(String(200), nullable=True)
