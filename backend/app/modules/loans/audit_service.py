"""Per-application audit trail."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.models import Staff
from app.modules.loans.workflow_models import ApplicationAuditLog, AuditActorType, AuditEventType
from app.modules.users.models import Customer


class ApplicationAuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        application_id: str,
        event_type: AuditEventType,
        *,
        actor_type: AuditActorType,
        actor_id: str | None = None,
        actor_label: str | None = None,
        message: str | None = None,
        metadata: dict | None = None,
        ip_address: str | None = None,
    ) -> ApplicationAuditLog:
        entry = ApplicationAuditLog(
            application_id=application_id,
            event_type=event_type,
            actor_type=actor_type,
            actor_id=actor_id,
            actor_label=actor_label,
            message=message,
            event_metadata=metadata or {},
            ip_address=ip_address,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(entry)
        await self.db.flush()
        return entry

    async def log_customer(
        self,
        application_id: str,
        event_type: AuditEventType,
        customer: Customer,
        *,
        message: str | None = None,
        metadata: dict | None = None,
    ) -> ApplicationAuditLog:
        return await self.log(
            application_id,
            event_type,
            actor_type=AuditActorType.CUSTOMER,
            actor_id=customer.id,
            actor_label=customer.full_name,
            message=message,
            metadata=metadata,
        )

    async def log_staff(
        self,
        application_id: str,
        event_type: AuditEventType,
        staff: Staff,
        *,
        message: str | None = None,
        metadata: dict | None = None,
        ip_address: str | None = None,
    ) -> ApplicationAuditLog:
        return await self.log(
            application_id,
            event_type,
            actor_type=AuditActorType.STAFF,
            actor_id=staff.id,
            actor_label=staff.full_name,
            message=message,
            metadata=metadata,
            ip_address=ip_address,
        )

    async def log_system(
        self,
        application_id: str,
        event_type: AuditEventType,
        *,
        message: str | None = None,
        metadata: dict | None = None,
    ) -> ApplicationAuditLog:
        return await self.log(
            application_id,
            event_type,
            actor_type=AuditActorType.SYSTEM,
            actor_label="System",
            message=message,
            metadata=metadata,
        )

    async def list_for_application(self, application_id: str) -> list[ApplicationAuditLog]:
        result = await self.db.execute(
            select(ApplicationAuditLog)
            .where(ApplicationAuditLog.application_id == application_id)
            .order_by(ApplicationAuditLog.created_at.desc())
        )
        return list(result.scalars().all())
