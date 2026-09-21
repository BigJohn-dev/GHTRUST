import enum
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class LoanProductCode(str, enum.Enum):
    BUSINESS = "business_loan"
    PAYDAY = "payday_loan"
    STUDY = "study_loan"
    ASSET = "asset_loan"
    LPO = "lpo_invoice_financing"


# Backward-compatible alias used by legacy Loan / LoanDraft rows
LoanProductType = LoanProductCode


class ApplicationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    DOCUMENTS_INCOMPLETE = "documents_incomplete"
    APPROVED = "approved"
    OFFER_SENT = "offer_sent"
    OFFER_ACCEPTED = "offer_accepted"
    PRODUCT_GATE_PENDING = "product_gate_pending"
    PROCESSING_FEE_PAID = "processing_fee_paid"
    READY_TO_DISBURSE = "ready_to_disburse"
    DISBURSED = "disbursed"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"


class ApplicationChannel(str, enum.Enum):
    WEB = "web"
    BRANCH = "branch"


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class CollateralCustody(str, enum.Enum):
    WITH_CUSTOMER = "with_customer"
    WITH_GHTRUST = "with_ghtrust"
    RELEASED = "released"


class LoanStatus(str, enum.Enum):
    ACTIVE = "active"
    OVERDUE = "overdue"
    COMPLETED = "completed"
    WRITTEN_OFF = "written_off"


class RepaymentCadence(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    SALARY_DATE = "salary_date"


class UniversalFormData(BaseModel):
    """Maps to the paper GH Trust loan form."""

    full_name: str | None = Field(None, max_length=200)
    residential_address: str | None = None
    residential_landmark: str | None = Field(None, max_length=200)
    office_shop_address: str | None = None
    phone: str | None = Field(None, max_length=20)
    gender: str | None = Field(None, max_length=20)
    date_of_birth: date | None = None
    state_of_origin: str | None = Field(None, max_length=100)
    email: EmailStr | None = None
    id_type: str | None = Field(None, max_length=50)
    id_number: str | None = Field(None, max_length=50)
    marital_status: str | None = Field(None, max_length=30)
    nature_of_business: str | None = Field(None, max_length=200)
    bvn: str | None = Field(None, min_length=11, max_length=11)
    place_of_work: str | None = Field(None, max_length=200)
    spouse_name: str | None = Field(None, max_length=200)
    spouse_phone: str | None = Field(None, max_length=20)
    spouse_address: str | None = None
    bank_name: str | None = Field(None, max_length=100)
    bank_account_name: str | None = Field(None, max_length=200)
    bank_account_number: str | None = Field(None, max_length=20)
    next_of_kin_name: str | None = Field(None, max_length=200)
    next_of_kin_address: str | None = None
    next_of_kin_phone: str | None = Field(None, max_length=20)
    next_of_kin_email: EmailStr | None = None
    next_of_kin_relationship: str | None = Field(None, max_length=50)
    requested_amount: Decimal | None = Field(None, gt=0)
    purpose: str | None = Field(None, max_length=500)
    monthly_income: Decimal | None = Field(None, ge=0)
    proposed_monthly_repayment: Decimal | None = Field(None, ge=0)
    repayment_period: str | None = Field(None, max_length=100)
    source_of_repayment: str | None = Field(None, max_length=200)
    presigned_cheque_details: str | None = None
    group_leader_name: str | None = Field(None, max_length=200)


class GuarantorInput(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    phone: str | None = Field(None, max_length=20)
    bvn: str | None = Field(None, min_length=11, max_length=11)
    id_type: str | None = Field(None, max_length=50)
    id_number: str | None = Field(None, max_length=50)
    relationship: str | None = Field(None, max_length=100)
    address: str | None = None


class CollateralInput(BaseModel):
    collateral_type: str = Field(..., max_length=50)
    description: str = Field(..., min_length=3)
    estimated_value: Decimal | None = Field(None, ge=0)
    affidavit_reference: str | None = Field(None, max_length=100)


class BusinessProductData(BaseModel):
    business_name: str | None = None
    years_in_operation: int | None = Field(None, ge=0)
    trade_type: str | None = None
    shop_address: str | None = None
    monthly_cash_flow: Decimal | None = Field(None, ge=0)
    inventory_type: str | None = None


class PaydayProductData(BaseModel):
    employer_name: str | None = None
    employer_type: str | None = None
    staff_id_number: str | None = None
    salary_account_bank: str | None = None
    salary_account_number: str | None = None
    monthly_salary: Decimal | None = Field(None, ge=0)
    salary_pay_day: int | None = Field(None, ge=1, le=31)


class StudyProductData(BaseModel):
    student_full_name: str | None = None
    student_admission_ref: str | None = None
    school_name: str | None = None
    school_bank_name: str | None = None
    school_account_number: str | None = None
    tuition_total: Decimal | None = Field(None, ge=0)
    applicant_contribution_pct: int = Field(default=30, ge=0, le=100)
    relationship_to_student: str | None = None
    guardian_years_employed: int | None = Field(None, ge=0)
    guardian_age: int | None = Field(None, ge=18, le=100)
    guardian_employer_type: str | None = None


class AssetProductData(BaseModel):
    asset_description: str | None = None
    asset_value: Decimal | None = Field(None, ge=0)
    vendor_name: str | None = None
    vendor_bank_name: str | None = None
    vendor_account_number: str | None = None
    income_source: str | None = None


class CreateApplicationRequest(BaseModel):
    product_code: LoanProductCode
    channel: ApplicationChannel = ApplicationChannel.WEB


class UpdateApplicationStepRequest(BaseModel):
    step: int = Field(..., ge=1)
    total_steps: int = Field(..., ge=1)
    universal_form: UniversalFormData | None = None
    product_data: dict | None = None
    guarantors: list[GuarantorInput] | None = None
    collaterals: list[CollateralInput] | None = None


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    note: str | None = Field(None, max_length=500)
    approved_amount: Decimal | None = Field(None, gt=0)
    repayment_cadence: RepaymentCadence | None = None


class LoanProductToggleRequest(BaseModel):
    is_active: bool


class LoanProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    description: str | None
    is_active: bool
    processing_fee_pct: Decimal
    interest_rate_pct_monthly: Decimal
    max_tenure_days: int | None
    default_penalty_pct_daily: Decimal | None
    repayment_cadence_options: list[str]
    required_document_types: list[str]
    workflow_steps: list[str]
    eligibility_rules: dict


class DocumentChecklistItem(BaseModel):
    document_type: str
    label: str
    required: bool
    uploaded: bool
    status: DocumentStatus | None = None
    document_id: str | None = None


class ApplicationDocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_type: str
    file_name: str
    mime_type: str
    size_bytes: int
    status: DocumentStatus
    uploaded_by: str
    rejection_note: str | None = None
    created_at: datetime


class GuarantorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    full_name: str
    phone: str | None
    bvn: str | None
    id_type: str | None
    id_number: str | None
    relationship: str | None = Field(None, validation_alias="relationship_to_borrower")
    address: str | None


class CollateralResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    collateral_type: str
    description: str
    estimated_value: Decimal | None
    custody_status: CollateralCustody
    affidavit_reference: str | None


class LoanApplicationDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    product_code: str
    product_name: str
    status: ApplicationStatus
    channel: ApplicationChannel
    step: int
    total_steps: int
    branch: str
    requested_amount: Decimal | None
    approved_amount: Decimal | None
    repayment_cadence: str | None
    universal_form: dict
    product_data: dict
    submitted_at: datetime | None
    assigned_officer_id: str | None
    rejection_reason: str | None
    guarantors: list[GuarantorResponse]
    collaterals: list[CollateralResponse]
    documents: list[ApplicationDocumentResponse]
    document_checklist: list[DocumentChecklistItem]


class PipelineStageBrief(BaseModel):
    name: str
    status: str  # completed | current | upcoming | rejected


class LoanApplicationSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    applicant_name: str | None = None
    product_code: str
    product_name: str
    status: ApplicationStatus
    channel: ApplicationChannel | None = None
    branch: str | None = None
    account_number: str | None = None
    current_stage_name: str | None = None
    stage_progress_pct: int | None = None
    approver_role_name: str | None = None
    pipeline_stages: list[PipelineStageBrief] = Field(default_factory=list)
    requested_amount: Decimal | None
    approved_amount: Decimal | None
    submitted_at: datetime | None
    created_at: datetime


class LoanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_id: str
    product_type: LoanProductCode
    principal: Decimal
    outstanding: Decimal
    interest_rate: Decimal
    monthly_payment: Decimal
    status: LoanStatus
    next_due_date: date | None = None


class RepaymentScheduleItem(BaseModel):
    installment: int
    due_date: date
    amount: Decimal
    principal: Decimal
    interest: Decimal
    status: str


# Legacy draft compatibility
class LoanDraftUpdate(BaseModel):
    step: int = Field(ge=1, le=20)
    total_steps: int = Field(ge=1, le=20)
    data: dict


class VerifyDocumentRequest(BaseModel):
    status: DocumentStatus

    @field_validator("status")
    @classmethod
    def must_be_reviewed(cls, v: DocumentStatus) -> DocumentStatus:
        if v == DocumentStatus.PENDING:
            raise ValueError("Use verified or rejected")
        return v

    rejection_note: str | None = Field(None, max_length=500)
