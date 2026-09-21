from fastapi import APIRouter, Depends, Request

from app.core.deps import CurrentCustomer, DbSession, RedisClient
from app.core.rate_limit import RateLimiter, get_client_ip
from app.modules.auth.schemas import (
    AuthTokenResponse,
    BvnRegisterRequest,
    CustomerProfileResponse,
    OtpSentResponse,
    PhoneLoginRequest,
    ResendRegistrationOtpRequest,
    VerifyLoginOtpRequest,
    VerifyRegistrationOtpRequest,
)
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _auth_service(db: DbSession, redis: RedisClient) -> AuthService:
    return AuthService(db, redis)


@router.post(
    "/register/bvn",
    response_model=OtpSentResponse,
    summary="Register with BVN",
    description=(
        "Submit BVN only. We verify via Dojah BVN Advanced, create your profile "
        "from registry data, and send OTP to the phone linked to your BVN."
    ),
)
async def register_with_bvn(
    payload: BvnRegisterRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    ip = get_client_ip(request)
    return await _auth_service(db, redis).register_with_bvn(payload.bvn, ip=ip)


@router.post(
    "/register/verify-otp",
    response_model=AuthTokenResponse,
    summary="Verify registration OTP",
)
async def verify_registration_otp(
    payload: VerifyRegistrationOtpRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    ip = get_client_ip(request)
    return await _auth_service(db, redis).verify_registration_otp(payload.bvn, payload.otp, ip=ip)


@router.post(
    "/register/resend-otp",
    response_model=OtpSentResponse,
    summary="Resend registration OTP",
)
async def resend_registration_otp(
    payload: ResendRegistrationOtpRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    ip = get_client_ip(request)
    return await _auth_service(db, redis).resend_registration_otp(payload.bvn, ip=ip)


@router.post(
    "/login/request-otp",
    response_model=OtpSentResponse,
    summary="Request login OTP",
)
async def request_login_otp(
    payload: PhoneLoginRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    ip = get_client_ip(request)
    return await _auth_service(db, redis).request_login_otp(payload.phone, ip=ip)


@router.post(
    "/login/verify-otp",
    response_model=AuthTokenResponse,
    summary="Verify login OTP",
)
async def verify_login_otp(
    payload: VerifyLoginOtpRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    ip = get_client_ip(request)
    return await _auth_service(db, redis).verify_login_otp(payload.phone, payload.otp, ip=ip)


@router.post(
    "/login/resend-otp",
    response_model=OtpSentResponse,
    summary="Resend login OTP",
)
async def resend_login_otp(
    payload: PhoneLoginRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    ip = get_client_ip(request)
    return await _auth_service(db, redis).resend_login_otp(payload.phone, ip=ip)


@router.get("/me", response_model=CustomerProfileResponse, summary="Current customer profile")
async def get_current_profile(customer: CurrentCustomer):
    return CustomerProfileResponse.from_customer(customer)
