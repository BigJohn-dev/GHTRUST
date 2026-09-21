from pydantic import BaseModel, ConfigDict, Field, field_validator


class BvnRegisterRequest(BaseModel):
    bvn: str = Field(..., min_length=11, max_length=11, description="11-digit Bank Verification Number")

    @field_validator("bvn")
    @classmethod
    def digits_only(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("BVN must contain digits only")
        return v


class PhoneLoginRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15, description="Phone number linked to BVN account")


class VerifyOtpRequest(BaseModel):
    otp: str = Field(..., min_length=4, max_length=8)

    @field_validator("otp")
    @classmethod
    def digits_only(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("OTP must contain digits only")
        return v


class VerifyRegistrationOtpRequest(VerifyOtpRequest):
    bvn: str = Field(..., min_length=11, max_length=11)


class VerifyLoginOtpRequest(VerifyOtpRequest):
    phone: str = Field(..., min_length=10, max_length=15)


class ResendRegistrationOtpRequest(BaseModel):
    bvn: str = Field(..., min_length=11, max_length=11)


class OtpSentResponse(BaseModel):
    message: str
    phone_masked: str
    expires_in: int
    purpose: str  # registration | login


class CustomerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_number: str
    bvn_masked: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    full_name: str
    gender: str | None = None
    date_of_birth: str | None = None
    phone: str
    email: str | None = None
    residential_address: str | None = None
    state_of_residence: str | None = None
    state_of_origin: str | None = None
    nationality: str | None = None
    enrollment_bank: str | None = None
    level_of_account: str | None = None
    branch: str
    status: str

    @classmethod
    def from_customer(cls, customer) -> "CustomerProfileResponse":
        from app.modules.users.models import Customer

        return cls(
            id=customer.id,
            account_number=customer.account_number,
            bvn_masked=CustomerMask.mask_bvn(customer.bvn),
            first_name=customer.first_name,
            last_name=customer.last_name,
            middle_name=customer.middle_name,
            full_name=customer.full_name,
            gender=customer.gender,
            date_of_birth=customer.date_of_birth.isoformat() if customer.date_of_birth else None,
            phone=Customer.mask_phone(customer.phone_primary),
            email=customer.email,
            residential_address=customer.residential_address,
            state_of_residence=customer.state_of_residence,
            state_of_origin=customer.state_of_origin,
            nationality=customer.nationality,
            enrollment_bank=customer.enrollment_bank,
            level_of_account=customer.level_of_account,
            branch=customer.branch,
            status=customer.status.value if hasattr(customer.status, "value") else customer.status,
        )


class CustomerMask:
    @staticmethod
    def mask_bvn(bvn: str) -> str:
        if len(bvn) >= 6:
            return f"{bvn[:3]}****{bvn[-3:]}"
        return "****"


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    customer: CustomerProfileResponse
