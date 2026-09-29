
from pydantic import BaseModel

from app.integrations.retry import TransientError


class DojahBvnEntity(BaseModel):
    """Dojah BVN Advanced response entity."""

    bvn: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    gender: str | None = None
    date_of_birth: str | None = None  # YYYY-MM-DD
    # Some BVN records have no phone; registration then can't send a code.
    phone_number1: str | None = None
    phone_number2: str | None = None
    image: str | None = None
    email: str | None = None
    enrollment_bank: str | None = None
    enrollment_branch: str | None = None
    level_of_account: str | None = None
    lga_of_origin: str | None = None
    lga_of_residence: str | None = None
    marital_status: str | None = None
    name_on_card: str | None = None
    nationality: str | None = None
    registration_date: str | None = None
    residential_address: str | None = None
    state_of_origin: str | None = None
    state_of_residence: str | None = None
    title: str | None = None
    watch_listed: str | None = None


class DojahBvnResponse(BaseModel):
    entity: DojahBvnEntity


class DojahSelfieVerification(BaseModel):
    confidence_value: float = 0.0
    match: bool = False


class DojahSelfieEntity(BaseModel):
    """Response entity of POST /api/v1/kyc/bvn/verify (only what we use)."""

    first_name: str | None = None
    last_name: str | None = None
    selfie_verification: DojahSelfieVerification = DojahSelfieVerification()


class DojahSelfieResponse(BaseModel):
    entity: DojahSelfieEntity


class DojahError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class TransientDojahError(DojahError, TransientError):
    """Transport failure or Dojah 5xx — retried."""
