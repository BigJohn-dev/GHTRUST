from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status

from app.core.deps import CurrentCustomer, DbSession
from app.modules.loans.schemas import (
    ApplicationStatus,
    CreateApplicationRequest,
    LoanApplicationDetailResponse,
    LoanApplicationSummaryResponse,
    LoanProductResponse,
    LoanResponse,
    UpdateApplicationStepRequest,
)
from app.modules.loans.service import LoanService

router = APIRouter(prefix="/loans", tags=["Loans"])


@router.get("/products", response_model=list[LoanProductResponse])
async def list_loan_products(db: DbSession):
    return await LoanService(db).list_products()


@router.get("/me/applications", response_model=list[LoanApplicationSummaryResponse])
async def list_my_applications(
    db: DbSession,
    customer: CurrentCustomer,
    status: ApplicationStatus | None = Query(default=None),
):
    return await LoanService(db).list_applications(customer_id=customer.id, status=status)


@router.post(
    "/me/applications",
    response_model=LoanApplicationDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_my_application(
    payload: CreateApplicationRequest,
    db: DbSession,
    customer: CurrentCustomer,
):
    return await LoanService(db).create_application(customer, payload)


@router.get("/me/applications/{application_id}", response_model=LoanApplicationDetailResponse)
async def get_my_application(
    application_id: str,
    db: DbSession,
    customer: CurrentCustomer,
):
    return await LoanService(db).get_application(application_id, customer_id=customer.id)


@router.patch("/me/applications/{application_id}", response_model=LoanApplicationDetailResponse)
async def update_my_application_step(
    application_id: str,
    payload: UpdateApplicationStepRequest,
    db: DbSession,
    customer: CurrentCustomer,
):
    return await LoanService(db).update_application_step(application_id, customer.id, payload)


@router.post(
    "/me/applications/{application_id}/documents/{document_type}",
    response_model=LoanApplicationDetailResponse,
)
async def upload_my_application_document(
    application_id: str,
    document_type: str,
    db: DbSession,
    customer: CurrentCustomer,
    file: UploadFile = File(...),
):
    return await LoanService(db).upload_document(application_id, customer.id, document_type, file)


@router.post(
    "/me/applications/{application_id}/submit",
    response_model=LoanApplicationDetailResponse,
)
async def submit_my_application(
    application_id: str,
    db: DbSession,
    customer: CurrentCustomer,
):
    return await LoanService(db).submit_application(application_id, customer.id)


@router.get("/me/loans", response_model=list[LoanResponse])
async def list_my_loans(db: DbSession, customer: CurrentCustomer):
    return await LoanService(db).list_customer_loans(customer.id)


# Legacy admin-style listing (will move fully to /admin/loans in next pass)
@router.get("/applications", response_model=list[LoanApplicationSummaryResponse])
async def list_loan_applications(
    db: DbSession,
    status: ApplicationStatus | None = Query(default=None),
    product_code: str | None = Query(default=None),
):
    return await LoanService(db).list_applications(status=status, product_code=product_code)
