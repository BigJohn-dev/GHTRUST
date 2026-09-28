from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.modules.admin.models import Role, Staff, StaffStatus
from app.modules.auth.schemas import DeviceInfo, TokenPair
from app.modules.loans.schemas import LoanApplicationSummaryResponse
from app.modules.users.models import Customer


class StaffLoginRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)


class VerifyStaffOtpRequest(StaffLoginRequest):
    otp: str = Field(..., min_length=4, max_length=8)
    device: DeviceInfo | None = None

    @field_validator("otp")
    @classmethod
    def digits_only(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("OTP must contain digits only")
        return v


class OtpSentResponse(BaseModel):
    message: str
    phone_masked: str
    expires_in: int
    purpose: str = "staff_login"


class RoleCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = Field(None, max_length=255)
    permissions: list[str] = Field(default_factory=list, max_length=50)


class RoleUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    description: str | None = Field(None, max_length=255)
    permissions: list[str] | None = Field(None, max_length=50)


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None = None
    permissions: list[str]
    is_system: bool

    @classmethod
    def from_role(cls, role: Role) -> "RoleResponse":
        return cls(
            id=role.id,
            name=role.name,
            description=role.description,
            permissions=list(role.permissions or []),
            is_system=role.is_system,
        )


class StaffCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=15)
    role_id: str | None = Field(None, max_length=36)


class StaffUpdateRequest(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(None, min_length=10, max_length=15)
    role_id: str | None = Field(None, max_length=36)


class StaffResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    phone: str
    status: str
    is_super_admin: bool
    role: RoleResponse | None = None
    permissions: list[str]

    @classmethod
    def from_staff(cls, staff: Staff) -> "StaffResponse":
        return cls(
            id=staff.id,
            full_name=staff.full_name,
            email=staff.email,
            phone=Customer.mask_phone(staff.phone),
            status=staff.status.value if isinstance(staff.status, StaffStatus) else staff.status,
            is_super_admin=staff.is_super_admin,
            role=RoleResponse.from_role(staff.role) if staff.role else None,
            permissions=sorted(staff.effective_permissions),
        )


class StaffTokenPair(TokenPair):
    refresh_token: str | None = Field(  # type: ignore[assignment]
        None,
        description="Omitted when the client asked for cookie transport (X-Token-Transport: cookie); "
        "the token is then set as an httpOnly cookie instead.",
    )


class StaffAuthTokenResponse(StaffTokenPair):
    staff: StaffResponse


class PermissionGroupResponse(BaseModel):
    label: str
    permissions: list[str]


class PermissionCatalogResponse(BaseModel):
    groups: list[PermissionGroupResponse]


class DashboardStatusCount(BaseModel):
    status: str
    count: int


class DashboardDailySubmission(BaseModel):
    date: str
    count: int


class DashboardProductMix(BaseModel):
    product_code: str
    product_name: str
    count: int
    percentage: float


class DemographicBucket(BaseModel):
    label: str
    count: int
    percentage: float


class DashboardDemographics(BaseModel):
    total_applicants: int
    gender: list[DemographicBucket]
    age_buckets: list[DemographicBucket]
    state_of_residence: list[DemographicBucket]
    state_of_origin: list[DemographicBucket]


class AdminDashboardResponse(BaseModel):
    total_applications: int
    status_counts: list[DashboardStatusCount]
    pending_review_count: int
    total_disbursed_amount: float
    loan_book_amount: float
    recent_applications: list[LoanApplicationSummaryResponse]
    pending_queue: list[LoanApplicationSummaryResponse]
    daily_submissions: list[DashboardDailySubmission]
    product_mix: list[DashboardProductMix]
    demographics: DashboardDemographics
