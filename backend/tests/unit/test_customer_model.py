import pytest
from pydantic import ValidationError

from app.modules.auth.schemas import (
    BvnRegisterRequest,
    PhoneLoginRequest,
    VerifyLoginOtpRequest,
    VerifyRegistrationOtpRequest,
)
from app.modules.users.models import Customer


class TestCustomerModel:
    def test_normalize_phone_from_local_format(self):
        assert Customer.normalize_phone("08035794364") == "+2348035794364"

    def test_normalize_phone_from_e164(self):
        assert Customer.normalize_phone("+2348035794364") == "+2348035794364"

    def test_normalize_phone_from_234_prefix(self):
        assert Customer.normalize_phone("2348035794364") == "+2348035794364"

    def test_mask_phone(self):
        masked = Customer.mask_phone("+2348035794364")
        assert "****" in masked
        assert masked.startswith("+234")

    def test_full_name_with_middle(self):
        c = Customer(
            bvn="22222222222",
            account_number="3012345678",
            branch="Lagos Main",
            first_name="Adaeze",
            last_name="Okafor",
            middle_name="Chinwe",
            phone_primary="+2348035794364",
        )
        assert c.full_name == "Adaeze Chinwe Okafor"

    def test_full_name_without_middle(self):
        c = Customer(
            bvn="22222222222",
            account_number="3012345678",
            branch="Lagos Main",
            first_name="Adaeze",
            last_name="Okafor",
            phone_primary="+2348035794364",
        )
        assert c.full_name == "Adaeze Okafor"


class TestAuthSchemas:
    def test_bvn_must_be_11_digits(self):
        with pytest.raises(ValidationError):
            BvnRegisterRequest(bvn="123")

    def test_bvn_rejects_letters(self):
        with pytest.raises(ValidationError):
            BvnRegisterRequest(bvn="2222222222a")

    def test_valid_bvn(self):
        req = BvnRegisterRequest(bvn="22222222222")
        assert req.bvn == "22222222222"

    def test_otp_must_be_digits(self):
        with pytest.raises(ValidationError):
            VerifyRegistrationOtpRequest(bvn="22222222222", otp="12ab56")

    def test_login_phone_min_length(self):
        with pytest.raises(ValidationError):
            PhoneLoginRequest(phone="123")

    def test_valid_login_verify(self):
        req = VerifyLoginOtpRequest(phone="08035794364", otp="123456")
        assert req.otp == "123456"
