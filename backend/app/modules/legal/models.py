from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class LegalAcceptance(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Evidence that a customer accepted a document: which one, which version, when, and
    from where. Loan agreements also record the application and a hash of the exact
    terms shown. Rows are never updated or deleted.
    """

    __tablename__ = "legal_acceptances"

    customer_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("customers.id"), index=True)
    document: Mapped[str] = mapped_column(String(30))  # terms | privacy | loan_agreement
    version: Mapped[str] = mapped_column(String(20))
    application_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("loan_applications.id"), nullable=True, index=True
    )
    terms_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
