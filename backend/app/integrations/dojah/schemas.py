
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
    phone_number1: str
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


class DojahError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class TransientDojahError(DojahError, TransientError):
    """Transport failure or Dojah 5xx — retried."""
