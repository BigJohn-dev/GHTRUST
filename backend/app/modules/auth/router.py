import structlog
from fastapi import APIRouter, Query, Request, Response, status

from app.core.deps import CurrentCustomer, DbSession, RedisClient, request_meta
from app.core.rate_limit import get_client_ip
from app.modules.auth.schemas import (
    UpdateContactRequest,
    AuthTokenResponse,
    BvnRegisterRequest,
    CustomerProfileResponse,
    DeviceApprovalRequiredResponse,
    OtpSentResponse,
    PhoneLoginRequest,
    RefreshTokenRequest,
    RegistrationSelfieRequest,
    SelfieRequiredResponse,
    ResendRegistrationOtpRequest,
    SessionResponse,
    TokenPair,
    VerifyLoginOtpRequest,
    VerifyRegistrationOtpRequest,
)
from app.modules.auth.service import AuthService

logger = structlog.get_logger()
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
    response_model=AuthTokenResponse | SelfieRequiredResponse,
    summary="Verify registration OTP",
    description=(
        "With selfie checks on (the default) returns `status: selfie_required` and a "
        "`registration_token` for `/auth/register/selfie`; otherwise opens the account and signs "
        "the device in. Send `device` from mobile clients."
    ),
)
async def verify_registration_otp(
    payload: VerifyRegistrationOtpRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    return await _auth_service(db, redis).verify_registration_otp(
        payload.bvn, payload.otp, meta=request_meta(request), device=payload.device
    )


@router.post(
    "/register/selfie",
    response_model=AuthTokenResponse,
    summary="Check a live face capture and match it to the BVN photo, then open the account",
    description=(
        "The app sends frames from its live camera. Dojah first checks the main frame is a live "
        "person (`LIVENESS_FAILED` otherwise), then compares it with the BVN photo. A match opens "
        "the account and signs the device in; `LIVENESS_FAILED` and `SELFIE_NO_MATCH` include "
        "`attempts_left`. After the last attempt the BVN "
        "cools down (`SELFIE_COOLDOWN`, 429 with `Retry-After` and `retry_after` seconds): "
        "sign-up can start again once it ends."
    ),
)
async def verify_registration_selfie(
    payload: RegistrationSelfieRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    return await _auth_service(db, redis).verify_registration_selfie(
        payload.registration_token,
        payload.selfie_image,
        meta=request_meta(request),
        device=payload.device,
        liveness_frames=payload.liveness_frames,
    )


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
    response_model=AuthTokenResponse | DeviceApprovalRequiredResponse,
    summary="Verify login OTP",
    description=(
        "Signs the phone in (`status: signed_in`), unless it's a new phone and another one is "
        "signed in: then `status: approval_required` and the sign-in waits for the customer to "
        "approve it on the other phone (see `/auth/device-approvals`)."
    ),
)
async def verify_login_otp(
    payload: VerifyLoginOtpRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    return await _auth_service(db, redis).verify_login_otp(
        payload.phone, payload.otp, meta=request_meta(request), device=payload.device
    )


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


@router.post(
    "/token/refresh",
    response_model=TokenPair,
    summary="Refresh access token",
    description=(
        "Exchange a refresh token for a new access + refresh pair. The refresh "
        "token rotates: store the new one and discard the old. Presenting an "
        "old refresh token again signs the session out (`REFRESH_TOKEN_REUSED`). "
        "Clients should run at most one refresh at a time."
    ),
)
async def refresh_token(
    payload: RefreshTokenRequest,
    request: Request,
    db: DbSession,
    redis: RedisClient,
):
    return await _auth_service(db, redis).refresh(payload.refresh_token, meta=request_meta(request))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out this device")
async def logout(
    request: Request,
    customer: CurrentCustomer,
    db: DbSession,
    redis: RedisClient,
    forget_device: bool = Query(
        False, description="Also stop trusting this phone (\"Not you?\"): next time needs an SMS code."
    ),
):
    await _auth_service(db, redis).logout(customer, request.state.session_id, forget_device=forget_device)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/logout-all", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out every device"
)
async def logout_all(request: Request, customer: CurrentCustomer, db: DbSession, redis: RedisClient):
    await _auth_service(db, redis).logout(customer, request.state.session_id, everywhere=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions", response_model=list[SessionResponse], summary="Signed-in devices")
async def list_sessions(request: Request, customer: CurrentCustomer, db: DbSession, redis: RedisClient):
    return await _auth_service(db, redis).list_sessions(customer, request.state.session_id)


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out a specific device",
)
async def revoke_session(
    session_id: str, request: Request, customer: CurrentCustomer, db: DbSession, redis: RedisClient
):
    await _auth_service(db, redis).revoke_session(customer, session_id, request.state.session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=CustomerProfileResponse, summary="Current customer profile")
async def get_current_profile(customer: CurrentCustomer):
    return CustomerProfileResponse.from_customer(customer)


@router.patch("/me", response_model=CustomerProfileResponse, summary="Update contact details")
async def update_contact_details(payload: UpdateContactRequest, customer: CurrentCustomer, db: DbSession):
    """Change email and/or home address. Only the fields sent are changed."""
    changed = []
    if "email" in payload.model_fields_set and payload.email is not None:
        customer.email = str(payload.email).lower()
        changed.append("email")
    if "residential_address" in payload.model_fields_set and payload.residential_address is not None:
        customer.residential_address = payload.residential_address
        changed.append("residential_address")
    await db.flush()
    logger.info("customer_contact_updated", customer_id=customer.id, fields=changed)
    return CustomerProfileResponse.from_customer(customer)
