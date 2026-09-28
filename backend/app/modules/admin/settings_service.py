from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.admin.settings_schemas import (
    AdminSettingsResponse,
    BranchSummaryResponse,
    GlobalAuditLogResponse,
)
from app.modules.loans.workflow_models import ApplicationAuditLog, AuditActorType, AuditEventType
from app.modules.users.models import Customer
from app.modules.users.search import like_pattern


class AdminSettingsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def get_settings() -> AdminSettingsResponse:
        return AdminSettingsResponse(
            app_name=settings.app_name,
            app_env=settings.app_env,
            debug=settings.debug,
            default_branch=settings.default_branch,
            dojah_enabled=settings.dojah_enabled,
            dojah_mock=settings.dojah_mock,
            sms_mock=settings.sms_mock,
            rate_limits_active=settings.rate_limits_active,
            otp_expire_seconds=settings.otp_expire_seconds,
            max_upload_size_mb=settings.max_upload_size_mb,
        )

    async def list_branches(self) -> list[BranchSummaryResponse]:
        rows = await self.db.execute(
            select(Customer.branch, func.count())
            .group_by(Customer.branch)
            .order_by(func.count().desc(), Customer.branch)
        )
        branches = [
            BranchSummaryResponse(name=name, customer_count=count)
            for name, count in rows.all()
            if name
        ]
        if settings.default_branch and not any(b.name == settings.default_branch for b in branches):
            branches.insert(
                0,
                BranchSummaryResponse(name=settings.default_branch, customer_count=0),
            )
        return branches

    async def list_audit_logs(
        self,
        *,
        actor_type: AuditActorType | None = AuditActorType.STAFF,
        event_type: AuditEventType | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[GlobalAuditLogResponse], int]:
        conditions = []
        if actor_type:
            conditions.append(ApplicationAuditLog.actor_type == actor_type)
        if event_type:
            conditions.append(ApplicationAuditLog.event_type == event_type)
        if search and search.strip():
            term = like_pattern(search.strip())
            conditions.append(
                or_(
                    ApplicationAuditLog.message.ilike(term, escape="\\"),
                    ApplicationAuditLog.actor_label.ilike(term, escape="\\"),
                    ApplicationAuditLog.ip_address.ilike(term, escape="\\"),
                )
            )
        total = await self.db.scalar(select(func.count()).select_from(ApplicationAuditLog).where(*conditions))
        query = (
            select(ApplicationAuditLog)
            .where(*conditions)
            .order_by(ApplicationAuditLog.created_at.desc())
            .limit(min(limit, 100))
            .offset(max(offset, 0))
        )
        result = await self.db.execute(query)
        return [
            GlobalAuditLogResponse(
                id=log.id,
                event_type=log.event_type,
                actor_type=log.actor_type,
                actor_id=log.actor_id,
                actor_label=log.actor_label,
                message=log.message,
                event_metadata=log.event_metadata or {},
                ip_address=log.ip_address,
                created_at=log.created_at,
                application_id=log.application_id,
            )
            for log in result.scalars().all()
        ], int(total or 0)
