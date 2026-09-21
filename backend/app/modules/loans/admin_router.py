from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse

from app.core.deps import DbSession
from app.core.rate_limit import get_client_ip
from app.modules.admin.deps import CurrentStaff, require_permission
from app.modules.admin.models import Staff
from app.modules.admin.permissions import (
    LOAN_CONFIGURE_WORKFLOW,
    LOAN_DISBURSE,
    LOAN_READ,
    LOAN_REVIEW,
    LOAN_VERIFY_DOCS,
)
from app.modules.loans.audit_service import ApplicationAuditService
from app.modules.loans.schemas import (
    ApplicationStatus,
    ApplicationStatusUpdate,
    LoanApplicationDetailResponse,
    LoanApplicationSummaryResponse,
    LoanProductResponse,
    LoanProductToggleRequest,
    VerifyDocumentRequest,
)
from app.modules.loans.service import LoanService
from app.modules.loans.workflow_schemas import (
    ApplicationWorkflowStateResponse,
    AuditLogResponse,
    CreateWorkflowRequest,
    DisburseApplicationRequest,
    StageActionRequest,
    UpdateWorkflowStagesRequest,
    WorkflowResponse,
    WorkflowStageResponse,
)
from app.modules.loans.workflow_service import WorkflowService

router = APIRouter(prefix="/admin/loans", tags=["Admin — Loans"])


@router.get("/products", response_model=list[LoanProductResponse])
async def admin_list_products(
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    return await LoanService(db).list_products(active_only=False)


@router.patch("/products/{product_code}", response_model=LoanProductResponse, summary="Toggle loan product")
async def admin_toggle_product(
    product_code: str,
    payload: LoanProductToggleRequest,
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_CONFIGURE_WORKFLOW)),
):
    return await LoanService(db).set_product_active(product_code, is_active=payload.is_active)


@router.get("/applications", response_model=list[LoanApplicationSummaryResponse])
async def admin_list_applications(
    db: DbSession,
    status: ApplicationStatus | None = Query(default=None),
    product_code: str | None = Query(default=None),
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    return await LoanService(db).list_applications(status=status, product_code=product_code)


@router.get("/applications/{application_id}", response_model=LoanApplicationDetailResponse)
async def admin_get_application(
    application_id: str,
    request: Request,
    db: DbSession,
    staff: CurrentStaff,
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    ip = get_client_ip(request)
    return await LoanService(db).get_application_for_admin(application_id, staff=staff, ip=ip)


@router.get("/applications/{application_id}/workflow", response_model=ApplicationWorkflowStateResponse)
async def admin_get_application_workflow(
    application_id: str,
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    return await LoanService(db).get_application_workflow_state(application_id)


@router.get("/applications/{application_id}/audit-log", response_model=list[AuditLogResponse])
async def admin_get_application_audit_log(
    application_id: str,
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    logs = await LoanService(db).list_audit_log(application_id)
    return [AuditLogResponse.model_validate(log) for log in logs]


@router.post("/applications/{application_id}/stage-action", response_model=LoanApplicationDetailResponse)
async def admin_stage_action(
    application_id: str,
    payload: StageActionRequest,
    request: Request,
    db: DbSession,
    staff: CurrentStaff,
    _: Staff = Depends(require_permission(LOAN_REVIEW)),
):
    ip = get_client_ip(request)
    return await LoanService(db).act_on_stage(application_id, staff, payload, ip=ip)


@router.post("/applications/{application_id}/disburse", response_model=LoanApplicationDetailResponse)
async def admin_disburse_application(
    application_id: str,
    payload: DisburseApplicationRequest,
    request: Request,
    db: DbSession,
    staff: CurrentStaff,
    _: Staff = Depends(require_permission(LOAN_DISBURSE)),
):
    ip = get_client_ip(request)
    return await LoanService(db).disburse_application(application_id, staff, payload, ip=ip)


@router.patch("/applications/{application_id}/status", response_model=LoanApplicationDetailResponse)
async def admin_update_application_status(
    application_id: str,
    payload: ApplicationStatusUpdate,
    db: DbSession,
    staff: CurrentStaff,
    __: Staff = Depends(require_permission(LOAN_REVIEW)),
):
    return await LoanService(db).update_application_status(application_id, payload, staff_id=staff.id)


@router.patch(
    "/applications/{application_id}/documents/{document_id}/verify",
    response_model=LoanApplicationDetailResponse,
)
async def admin_verify_document(
    application_id: str,
    document_id: str,
    payload: VerifyDocumentRequest,
    request: Request,
    db: DbSession,
    staff: CurrentStaff,
    __: Staff = Depends(require_permission(LOAN_VERIFY_DOCS)),
):
    ip = get_client_ip(request)
    return await LoanService(db).verify_document(
        application_id, document_id, payload, staff_id=staff.id, staff=staff, ip=ip
    )


@router.get("/applications/{application_id}/documents/{document_id}/download")
async def admin_download_document(
    application_id: str,
    document_id: str,
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    path, file_name, mime_type = await LoanService(db).get_document_for_download(
        application_id, document_id
    )
    return FileResponse(path, media_type=mime_type, filename=file_name)


# ── Workflow configuration ──


@router.get("/products/{product_code}/workflows", response_model=list[WorkflowResponse])
async def list_product_workflows(
    product_code: str,
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_CONFIGURE_WORKFLOW)),
):
    return await LoanService(db).list_product_workflows(product_code)


@router.get("/products/{product_code}/workflow/active", response_model=WorkflowResponse | None)
async def get_active_product_workflow(
    product_code: str,
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_READ)),
):
    workflow = await LoanService(db).get_active_product_workflow(product_code)
    return workflow


@router.post("/products/{product_code}/workflows", response_model=WorkflowResponse, status_code=201)
async def create_product_workflow(
    product_code: str,
    payload: CreateWorkflowRequest,
    db: DbSession,
    staff: CurrentStaff,
    _: Staff = Depends(require_permission(LOAN_CONFIGURE_WORKFLOW)),
):
    workflow = await LoanService(db).create_product_workflow(
        product_code, payload.stages, staff_id=staff.id
    )
    return workflow


@router.put("/workflows/{workflow_id}/stages", response_model=WorkflowResponse)
async def update_workflow_stages(
    workflow_id: str,
    payload: UpdateWorkflowStagesRequest,
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_CONFIGURE_WORKFLOW)),
):
    workflow = await LoanService(db).update_workflow_stages(workflow_id, payload.stages)
    return workflow


@router.post("/workflows/{workflow_id}/publish", response_model=WorkflowResponse)
async def publish_workflow(
    workflow_id: str,
    db: DbSession,
    _: Staff = Depends(require_permission(LOAN_CONFIGURE_WORKFLOW)),
):
    workflow = await LoanService(db).publish_workflow(workflow_id)
    return workflow
