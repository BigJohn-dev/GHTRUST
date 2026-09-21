from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.modules.loans.schemas import LoanApplicationSummaryResponse
from app.modules.users.models import Customer


class CustomerSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_number: str
    full_name: str
    bvn_masked: str
    phone: str
    email: str | None
    gender: str | None
    state_of_residence: str | None
    branch: str
    status: str
    application_count: int
    created_at: datetime

    @classmethod
    def from_customer(cls, customer: Customer, *, application_count: int = 0) -> "CustomerSummaryResponse":
        return cls(
            id=customer.id,
            account_number=customer.account_number,
            full_name=customer.full_name,
            bvn_masked=Customer.mask_bvn(customer.bvn),
            phone=Customer.mask_phone(customer.phone_primary),
            email=customer.email,
            gender=customer.gender,
            state_of_residence=customer.state_of_residence,
            branch=customer.branch,
            status=customer.status.value if hasattr(customer.status, "value") else str(customer.status),
            application_count=application_count,
            created_at=customer.created_at,
        )


class CustomerStatsResponse(BaseModel):
    total_applications: int
    active_applications: int
    disbursed_count: int
    total_disbursed_amount: float


class CustomerDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_number: str
    bvn_masked: str
    first_name: str
    last_name: str
    middle_name: str | None
    full_name: str
    gender: str | None
    date_of_birth: str | None
    title: str | None
    phone: str
    phone_secondary: str | None
    email: str | None
    residential_address: str | None
    state_of_residence: str | None
    lga_of_residence: str | None
    state_of_origin: str | None
    lga_of_origin: str | None
    nationality: str | None
    marital_status: str | None
    enrollment_bank: str | None
    enrollment_branch: str | None
    level_of_account: str | None
    name_on_card: str | None
    branch: str
    status: str
    phone_verified: bool
    last_login_at: datetime | None
    created_at: datetime
    stats: CustomerStatsResponse
    loan_applications: list[LoanApplicationSummaryResponse]

    @classmethod
    def from_customer(
        cls,
        customer: Customer,
        *,
        stats: CustomerStatsResponse,
        loan_applications: list[LoanApplicationSummaryResponse],
    ) -> "CustomerDetailResponse":
        return cls(
            id=customer.id,
            account_number=customer.account_number,
            bvn_masked=Customer.mask_bvn(customer.bvn),
            first_name=customer.first_name,
            last_name=customer.last_name,
            middle_name=customer.middle_name,
            full_name=customer.full_name,
            gender=customer.gender,
            date_of_birth=customer.date_of_birth.isoformat() if customer.date_of_birth else None,
            title=customer.title,
            phone=Customer.mask_phone(customer.phone_primary),
            phone_secondary=Customer.mask_phone(customer.phone_secondary)
            if customer.phone_secondary
            else None,
            email=customer.email,
            residential_address=customer.residential_address,
            state_of_residence=customer.state_of_residence,
            lga_of_residence=customer.lga_of_residence,
            state_of_origin=customer.state_of_origin,
            lga_of_origin=customer.lga_of_origin,
            nationality=customer.nationality,
            marital_status=customer.marital_status,
            enrollment_bank=customer.enrollment_bank,
            enrollment_branch=customer.enrollment_branch,
            level_of_account=customer.level_of_account,
            name_on_card=customer.name_on_card,
            branch=customer.branch,
            status=customer.status.value if hasattr(customer.status, "value") else str(customer.status),
            phone_verified=customer.phone_verified,
            last_login_at=customer.last_login_at,
            created_at=customer.created_at,
            stats=stats,
            loan_applications=loan_applications,
        )
