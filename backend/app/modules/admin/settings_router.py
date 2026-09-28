from fastapi import APIRouter, Depends, Query, Response

from app.core.deps import DbSession
from app.modules.admin.deps import require_permission
from app.modules.admin.models import Staff
from app.modules.admin.permissions import LOAN_READ
from app.modules.admin.settings_schemas import (
    AdminSettingsResponse,
    BranchSummaryResponse,
    GlobalAuditLogResponse,
)
from app.modules.admin.settings_service import AdminSettingsService
from app.modules.loans.workflow_models import AuditActorType, AuditEventType

router = APIRouter(prefix="/admin/settings", tags=["Admin — Settings"])


@router.get("", response_model=AdminSettingsResponse, summary="Operational settings snapshot")
async def get_settings(_: Staff = Depends(require_permission(LOAN_READ))):
    return AdminSettingsService.get_settings()


@router.get("/branches", response_model=list[BranchSummaryResponse], summary="Branch directory")
async def list_branches(
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    return await AdminSettingsService(db).list_branches()


@router.get(
    "/audit-logs",
    response_model=list[GlobalAuditLogResponse],
    summary="Global audit log feed",
    description="Newest first. Total count is returned in the `X-Total-Count` header.",
)
async def list_audit_logs(
    response: Response,
    db: DbSession,
    actor_type: AuditActorType | None = Query(default=AuditActorType.STAFF),
    event_type: AuditEventType | None = Query(default=None),
    search: str | None = Query(default=None, max_length=100, description="Message, actor name or IP address"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    items, total = await AdminSettingsService(db).list_audit_logs(
        actor_type=actor_type,
        event_type=event_type,
        search=search,
        limit=limit,
        offset=offset,
    )
    response.headers["X-Total-Count"] = str(total)
    return items
