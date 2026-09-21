from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from app.core.deps import DbSession, RedisClient
from app.core.rate_limit import get_client_ip
from app.modules.admin.deps import CurrentStaff, require_permission
from app.modules.admin.models import Staff
from app.modules.admin.permissions import (
    ALL_PERMISSIONS,
    LOAN_READ,
    ROLE_CREATE,
    ROLE_DELETE,
    ROLE_READ,
    ROLE_UPDATE,
    STAFF_ACTIVATE,
    STAFF_CREATE,
    STAFF_READ,
    STAFF_UPDATE,
)
from app.modules.admin.schemas import (
    AdminDashboardResponse,
    OtpSentResponse,
    PermissionCatalogResponse,
    PermissionGroupResponse,
    RoleCreateRequest,
    RoleResponse,
    RoleUpdateRequest,
    StaffAuthTokenResponse,
    StaffCreateRequest,
    StaffLoginRequest,
    StaffResponse,
    StaffUpdateRequest,
    VerifyStaffOtpRequest,
)
from app.modules.admin.service import AdminAuthService, RoleService, StaffService
from app.modules.loans.service import LoanService

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post(
    "/auth/login/request-otp",
    response_model=OtpSentResponse,
    summary="Staff login — request OTP",
)
async def staff_request_login_otp(
    payload: StaffLoginRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    ip = get_client_ip(request)
    return await AdminAuthService(db, redis).request_login_otp(payload.phone, ip=ip)


@router.post(
    "/auth/login/verify-otp",
    response_model=StaffAuthTokenResponse,
    summary="Staff login — verify OTP",
)
async def staff_verify_login_otp(
    payload: VerifyStaffOtpRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    ip = get_client_ip(request)
    return await AdminAuthService(db, redis).verify_login_otp(payload.phone, payload.otp, ip=ip)


@router.post(
    "/auth/login/resend-otp",
    response_model=OtpSentResponse,
    summary="Staff login — resend OTP",
)
async def staff_resend_login_otp(
    payload: StaffLoginRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    ip = get_client_ip(request)
    return await AdminAuthService(db, redis).resend_login_otp(payload.phone, ip=ip)


@router.get("/auth/me", response_model=StaffResponse, summary="Current staff profile")
async def staff_me(staff: CurrentStaff):
    return StaffResponse.from_staff(staff)


@router.get("/dashboard", response_model=AdminDashboardResponse, summary="Admin dashboard aggregates")
async def admin_dashboard(
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    return await LoanService(db).get_dashboard()


@router.get("/dashboard/demographics/export", summary="Export demographics report as CSV")
async def export_demographics(
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    demo = await LoanService(db).get_demographics()
    csv_body = LoanService.demographics_to_csv(demo)
    return Response(
        content=csv_body,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="gh-trust-demographics.csv"'},
    )


PERMISSION_GROUPS: list[tuple[str, tuple[str, ...]]] = [
    ("Staff management", ("staff:read", "staff:create", "staff:update", "staff:activate")),
    ("Role management", ("role:read", "role:create", "role:update", "role:delete")),
    (
        "Loan operations",
        ("loan:read", "loan:review", "loan:verify_documents", "loan:disburse", "loan:configure_workflow"),
    ),
]


@router.get("/permissions", response_model=PermissionCatalogResponse, summary="Permission catalog")
async def list_permissions(_: Staff = Depends(require_permission(ROLE_READ))):
    grouped_keys = {key for group in PERMISSION_GROUPS for key in group[1]}
    other = [p for p in ALL_PERMISSIONS if p not in grouped_keys]
    groups = [
        PermissionGroupResponse(label=label, permissions=list(keys))
        for label, keys in PERMISSION_GROUPS
    ]
    if other:
        groups.append(PermissionGroupResponse(label="Other", permissions=other))
    return PermissionCatalogResponse(groups=groups)


@router.get("/roles", response_model=list[RoleResponse], summary="List roles")
async def list_roles(
    db: DbSession,
    _: Staff = Depends(require_permission(ROLE_READ)),
):
    return await RoleService(db).list_roles()


@router.post("/roles", response_model=RoleResponse, summary="Create role", status_code=201)
async def create_role(
    payload: RoleCreateRequest,
    db: DbSession,
    _: Staff = Depends(require_permission(ROLE_CREATE)),
):
    return await RoleService(db).create_role(payload)


@router.patch("/roles/{role_id}", response_model=RoleResponse, summary="Update role")
async def update_role(
    role_id: str,
    payload: RoleUpdateRequest,
    db: DbSession,
    _: Staff = Depends(require_permission(ROLE_UPDATE)),
):
    return await RoleService(db).update_role(role_id, payload)


@router.delete("/roles/{role_id}", status_code=204, summary="Delete role")
async def delete_role(
    role_id: str,
    db: DbSession,
    _: Staff = Depends(require_permission(ROLE_DELETE)),
):
    await RoleService(db).delete_role(role_id)


@router.get("/staff", response_model=list[StaffResponse], summary="List staff")
async def list_staff(
    db: DbSession,
    _: Staff = Depends(require_permission(STAFF_READ)),
):
    return await StaffService(db).list_staff()


@router.post("/staff", response_model=StaffResponse, summary="Create staff", status_code=201)
async def create_staff(
    payload: StaffCreateRequest,
    db: DbSession,
    _: Staff = Depends(require_permission(STAFF_CREATE)),
):
    return await StaffService(db).create_staff(payload)


@router.get("/staff/{staff_id}", response_model=StaffResponse, summary="Get staff member")
async def get_staff(
    staff_id: str,
    db: DbSession,
    _: Staff = Depends(require_permission(STAFF_READ)),
):
    return await StaffService(db).get_staff(staff_id)


@router.patch("/staff/{staff_id}", response_model=StaffResponse, summary="Update staff member")
async def update_staff(
    staff_id: str,
    payload: StaffUpdateRequest,
    db: DbSession,
    _: Staff = Depends(require_permission(STAFF_UPDATE)),
):
    return await StaffService(db).update_staff(staff_id, payload)


@router.post("/staff/{staff_id}/activate", response_model=StaffResponse, summary="Activate staff")
async def activate_staff(
    staff_id: str,
    db: DbSession,
    _: Staff = Depends(require_permission(STAFF_ACTIVATE)),
):
    return await StaffService(db).activate_staff(staff_id)


@router.post("/staff/{staff_id}/deactivate", response_model=StaffResponse, summary="Deactivate staff")
async def deactivate_staff(
    staff_id: str,
    db: DbSession,
    actor: CurrentStaff,
    _: Staff = Depends(require_permission(STAFF_ACTIVATE)),
):
    return await StaffService(db).deactivate_staff(staff_id, actor=actor)
