import re

from fastapi import APIRouter, File, Header, Query, UploadFile, status

from app.core.deps import CurrentCustomer, DbSession
from app.core.errors import AppError
from app.modules.loans.schemas import (
    ApplicationStatus,
    CreateApplicationRequest,
    CustomerRepayRequest,
    LoanDetailResponse,
    LoanRepaymentResponse,
    LoanStatus,
    Page,
    RepaymentChannel,
    LoanApplicationDetailResponse,
    LoanApplicationSummaryResponse,
    LoanProductResponse,
    LoanResponse,
    UpdateApplicationStepRequest,
)
from app.modules.loans.service import LoanService
from app.modules.loans.servicing import (
    LoanServicingService,
    list_loans,
    loan_detail,
    loan_responses,
)

router = APIRouter(prefix="/loans", tags=["Loans"])


@router.get("/products", response_model=list[LoanProductResponse])
async def list_loan_products(db: DbSession):
    return await LoanService(db).list_products()


@router.get("/me/applications", response_model=Page[LoanApplicationSummaryResponse])
async def list_my_applications(
    db: DbSession,
    customer: CurrentCustomer,
    status_filter: ApplicationStatus | None = Query(default=None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    items, total = await LoanService(db).list_applications_page(
        customer_id=customer.id, status=status_filter, limit=limit, offset=offset
    )
    return Page[LoanApplicationSummaryResponse](items=items, total=total, limit=limit, offset=offset)


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


@router.get("/me/loans", response_model=Page[LoanResponse])
async def list_my_loans(
    db: DbSession,
    customer: CurrentCustomer,
    status_filter: LoanStatus | None = Query(default=None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    rows, total = await list_loans(
        db, customer_id=customer.id, status_filter=status_filter, limit=limit, offset=offset
    )
    return Page[LoanResponse](
        items=await loan_responses(db, rows), total=total, limit=limit, offset=offset
    )


@router.get("/me/loans/{loan_id}", response_model=LoanDetailResponse)
async def get_my_loan(loan_id: str, db: DbSession, customer: CurrentCustomer):
    """Loan with its full repayment schedule and payment history."""
    return await loan_detail(db, loan_id, customer_id=customer.id)


_IDEMPOTENCY_KEY = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


@router.post(
    "/me/loans/{loan_id}/repayments",
    response_model=LoanRepaymentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Repay from wallet",
    description=(
        "Debit the customer's wallet and apply it to the loan (oldest installment "
        "first, interest before principal). Requires an `Idempotency-Key` header: "
        "retrying with the same key never charges twice."
    ),
)
async def repay_my_loan(
    loan_id: str,
    payload: CustomerRepayRequest,
    db: DbSession,
    customer: CurrentCustomer,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
):
    if not _IDEMPOTENCY_KEY.match(idempotency_key):
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            "IDEMPOTENCY_KEY_INVALID",
            "Idempotency-Key must be 8-64 characters: letters, digits, '-' or '_'.",
        )
    repayment = await LoanServicingService(db).record_repayment(
        loan_id,
        amount=payload.amount,
        channel=RepaymentChannel.WALLET,
        reference=f"app_{customer.id}_{idempotency_key}",
        customer_id=customer.id,
    )
    return LoanRepaymentResponse.model_validate(repayment)
