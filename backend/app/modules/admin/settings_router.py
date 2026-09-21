from fastapi import APIRouter, Depends, Query

from app.core.deps import DbSession
from app.modules.admin.deps import require_permission
from app.modules.admin.models import Staff
from app.modules.admin.permissions import LOAN_CONFIGURE_WORKFLOW, LOAN_READ
from app.modules.admin.settings_schemas import (
    AdminSettingsResponse,
    BranchSummaryResponse,
    GlobalAuditLogResponse,
)
from app.modules.admin.settings_service import AdminSettingsService
from app.modules.loans.workflow_models import AuditActorType

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


@router.get("/audit-logs", response_model=list[GlobalAuditLogResponse], summary="Global audit log feed")
async def list_audit_logs(
    db: DbSession,
    actor_type: AuditActorType | None = Query(default=AuditActorType.STAFF),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    return await AdminSettingsService(db).list_audit_logs(
        actor_type=actor_type,
        limit=limit,
        offset=offset,
    )
