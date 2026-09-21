import re
import secrets
from datetime import date, datetime, timezone

import structlog
from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import OtpService, RateLimiter
from app.core.security import create_access_token
from app.integrations.dojah.client import DojahClient
from app.integrations.dojah.schemas import DojahError
from app.modules.auth.schemas import (
    AuthTokenResponse,
    BvnRegisterRequest,
    CustomerProfileResponse,
    OtpSentResponse,
    PhoneLoginRequest,
    VerifyOtpRequest,
)
from app.modules.users.models import Customer, CustomerStatus

logger = structlog.get_logger()


def _validate_bvn(bvn: str) -> str:
    bvn = bvn.strip()
    if not re.fullmatch(r"\d{11}", bvn):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="BVN must be exactly 11 digits")
    return bvn


def _parse_dob(dob_str: str | None) -> date | None:
    if not dob_str:
        return None
    try:
        return date.fromisoformat(dob_str)
    except ValueError:
        return None


def _generate_account_number() -> str:
    return f"30{secrets.randbelow(10**8):08d}"


class AuthService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis
        self.dojah = DojahClient()
        self.otp = OtpService(redis)

    async def register_with_bvn(self, bvn: str, *, ip: str) -> OtpSentResponse:
        bvn = _validate_bvn(bvn)
        limiter = RateLimiter(self.redis)
        await limiter.check_bvn_registration(ip, bvn)

        existing = await self.db.execute(select(Customer).where(Customer.bvn == bvn))
        customer = existing.scalar_one_or_none()
        if customer and customer.status == CustomerStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this BVN already exists. Please login.")
        if customer and customer.phone_verified:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account already verified. Please login with your phone number.")

        try:
            entity = await self.dojah.lookup_bvn_advanced(bvn)
        except DojahError as e:
            raise HTTPException(status_code=e.status_code, detail=e.message) from e

        phone = Customer.normalize_phone(entity.phone_number1)

        if customer is None:
            customer = Customer(
                bvn=bvn,
                account_number=_generate_account_number(),
                branch=settings.default_branch,
                status=CustomerStatus.PENDING_OTP,
                first_name=entity.first_name.title(),
                last_name=entity.last_name.title(),
                middle_name=entity.middle_name.title() if entity.middle_name else None,
                gender=entity.gender,
                date_of_birth=_parse_dob(entity.date_of_birth),
                title=entity.title,
                phone_primary=phone,
                phone_secondary=Customer.normalize_phone(entity.phone_number2) if entity.phone_number2 else None,
                email=entity.email.lower() if entity.email else None,
                residential_address=entity.residential_address or None,
                state_of_residence=entity.state_of_residence,
                lga_of_residence=entity.lga_of_residence,
                state_of_origin=entity.state_of_origin,
                lga_of_origin=entity.lga_of_origin,
                nationality=entity.nationality,
                marital_status=entity.marital_status,
                enrollment_bank=entity.enrollment_bank,
                enrollment_branch=entity.enrollment_branch,
                level_of_account=entity.level_of_account,
                name_on_card=entity.name_on_card or None,
                bvn_registration_date=entity.registration_date or None,
                watch_listed=entity.watch_listed,
                bvn_photo_base64=entity.image,
                phone_verified=False,
            )
            self.db.add(customer)
        else:
            # Refresh profile from latest BVN lookup for pending accounts
            customer.first_name = entity.first_name.title()
            customer.last_name = entity.last_name.title()
            customer.phone_primary = phone

        await self.db.flush()

        await limiter.check_otp_send(ip, phone)
        expires_in = await self.otp.send("register", bvn, phone)

        logger.info("register_bvn_success", customer_id=customer.id, bvn=bvn[:3] + "****")

        return OtpSentResponse(
            message="OTP sent to the phone number registered with your BVN.",
            phone_masked=Customer.mask_phone(phone),
            expires_in=expires_in,
            purpose="registration",
        )

    async def verify_registration_otp(self, bvn: str, otp: str, *, ip: str) -> AuthTokenResponse:
        bvn = _validate_bvn(bvn)
        await RateLimiter(self.redis).check_otp_verify(ip)
        await self.otp.verify("register", bvn, otp)

        result = await self.db.execute(select(Customer).where(Customer.bvn == bvn))
        customer = result.scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration not found. Start again with your BVN.")

        if customer.watch_listed and customer.watch_listed.upper() == "YES":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account cannot be opened at this time. Please visit a branch.")

        customer.status = CustomerStatus.ACTIVE
        customer.phone_verified = True
        customer.phone_verified_at = datetime.now(timezone.utc)
        await self.db.flush()

        from app.modules.payments.wallet_service import WalletService

        await WalletService(self.db).provision_paystack(customer)

        token = create_access_token(customer.id, customer.phone_primary)
        return AuthTokenResponse(
            access_token=token,
            token_type="bearer",
            customer=CustomerProfileResponse.from_customer(customer),
        )

    async def resend_registration_otp(self, bvn: str, *, ip: str) -> OtpSentResponse:
        bvn = _validate_bvn(bvn)
        limiter = RateLimiter(self.redis)
        result = await self.db.execute(
            select(Customer).where(Customer.bvn == bvn, Customer.status == CustomerStatus.PENDING_OTP)
        )
        customer = result.scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No pending registration found for this BVN.")

        await limiter.check_otp_send(ip, customer.phone_primary)
        expires_in = await self.otp.send("register", bvn, customer.phone_primary)
        return OtpSentResponse(
            message="OTP resent successfully.",
            phone_masked=Customer.mask_phone(customer.phone_primary),
            expires_in=expires_in,
            purpose="registration",
        )

    async def request_login_otp(self, phone: str, *, ip: str) -> OtpSentResponse:
        normalized = Customer.normalize_phone(phone)
        limiter = RateLimiter(self.redis)
        await limiter.check_login_request(ip, normalized)
        result = await self.db.execute(
            select(Customer).where(
                Customer.phone_primary == normalized,
                Customer.status == CustomerStatus.ACTIVE,
            )
        )
        customer = result.scalar_one_or_none()
        if not customer:
            logger.warning("login_otp_unknown_phone", phone=Customer.mask_phone(normalized))
            return OtpSentResponse(
                message="If an account exists, an OTP has been sent to your registered phone number.",
                phone_masked=Customer.mask_phone(normalized),
                expires_in=settings.otp_expire_seconds,
                purpose="login",
            )

        await limiter.check_otp_send(ip, normalized)
        expires_in = await self.otp.send("login", normalized, normalized)
        return OtpSentResponse(
            message="OTP sent to your registered phone number.",
            phone_masked=Customer.mask_phone(normalized),
            expires_in=expires_in,
            purpose="login",
        )

    async def verify_login_otp(self, phone: str, otp: str, *, ip: str) -> AuthTokenResponse:
        normalized = Customer.normalize_phone(phone)
        await RateLimiter(self.redis).check_otp_verify(ip)
        await self.otp.verify("login", normalized, otp)

        result = await self.db.execute(
            select(Customer).where(
                Customer.phone_primary == normalized,
                Customer.status == CustomerStatus.ACTIVE,
            )
        )
        customer = result.scalar_one_or_none()
        if not customer:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

        customer.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()

        token = create_access_token(customer.id, customer.phone_primary)
        return AuthTokenResponse(
            access_token=token,
            token_type="bearer",
            customer=CustomerProfileResponse.from_customer(customer),
        )

    async def resend_login_otp(self, phone: str, *, ip: str) -> OtpSentResponse:
        return await self.request_login_otp(phone, ip=ip)
