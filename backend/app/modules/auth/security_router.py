"""PINs, biometrics, PIN sign-in on a trusted phone, and new-phone approval."""

from fastapi import APIRouter, Request, Response, status

from app.core.deps import CurrentCustomer, DbSession, RedisClient, request_meta
from app.modules.auth.schemas import (
    ApprovalFallbackRequest,
    ApprovalSecretRequest,
    ApprovalStatusResponse,
    ApproveDeviceRequest,
    ApproveDeviceResponse,
    AuthTokenResponse,
    BiometricRequest,
    ChangeLoginPinRequest,
    ChangeTransactionPinRequest,
    CompleteApprovalRequest,
    CustomerProfileResponse,
    PendingApprovalResponse,
    PinSignInRequest,
    ResetLoginPinRequest,
    ResetTransactionPinRequest,
    SetLoginPinRequest,
    SetTransactionPinRequest,
    VerifyLoginPinRequest,
)
from app.modules.auth.security_service import SecurityService
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Account security"])

NO_CONTENT = {"status_code": status.HTTP_204_NO_CONTENT, "response_class": Response}


# ── Sign-in PIN ──────────────────────────────────────────────────────────────


@router.post("/pin", response_model=CustomerProfileResponse, summary="Create sign-in PIN")
async def set_login_pin(payload: SetLoginPinRequest, customer: CurrentCustomer, db: DbSession):
    """The 6-digit PIN that opens the app. Separate from the 4-digit transaction PIN."""
    await SecurityService(db).set_login_pin(customer, payload.pin)
    return CustomerProfileResponse.from_customer(customer)


@router.post("/pin/change", **NO_CONTENT, summary="Change sign-in PIN")
async def change_login_pin(
    payload: ChangeLoginPinRequest, request: Request, customer: CurrentCustomer, db: DbSession
):
    await SecurityService(db).change_login_pin(
        customer, request.state.session_id, payload.current_pin, payload.new_pin
    )


@router.post(
    "/pin/verify",
    **NO_CONTENT,
    summary="Unlock with sign-in PIN",
    description="Checks the PIN when the app is opened after time away. Five wrong in a row "
    "signs this phone out (`PIN_ATTEMPTS_EXCEEDED`).",
)
async def verify_login_pin(
    payload: VerifyLoginPinRequest, request: Request, customer: CurrentCustomer, db: DbSession
):
    await SecurityService(db).verify_login_pin(customer, payload.pin, session_id=request.state.session_id)


@router.post(
    "/pin/reset",
    response_model=CustomerProfileResponse,
    summary="Forgot sign-in PIN",
    description="Within 15 minutes of signing in with an SMS code, set a new PIN with the BVN.",
)
async def reset_login_pin(
    payload: ResetLoginPinRequest, request: Request, customer: CurrentCustomer, db: DbSession
):
    await SecurityService(db).reset_login_pin(customer, request.state.session_id, payload.bvn, payload.new_pin)
    return CustomerProfileResponse.from_customer(customer)


@router.post(
    "/login/pin",
    response_model=AuthTokenResponse,
    summary="Sign in with PIN on a trusted phone",
    description="For a phone that signed in before (it holds a `device_token`): the sign-in PIN "
    "replaces the SMS code.",
)
async def pin_sign_in(payload: PinSignInRequest, request: Request, db: DbSession, redis: RedisClient):
    return await AuthService(db, redis).pin_sign_in(
        payload.device_id, payload.device_token, payload.pin, meta=request_meta(request), device=payload.device
    )


# ── Transaction PIN ──────────────────────────────────────────────────────────


@router.post("/transaction-pin", response_model=CustomerProfileResponse, summary="Create transaction PIN")
async def set_transaction_pin(payload: SetTransactionPinRequest, customer: CurrentCustomer, db: DbSession):
    """The 4-digit PIN that approves money leaving the account. Required before the first transfer."""
    await SecurityService(db).set_transaction_pin(customer, payload.pin)
    return CustomerProfileResponse.from_customer(customer)


@router.post("/transaction-pin/change", **NO_CONTENT, summary="Change transaction PIN")
async def change_transaction_pin(payload: ChangeTransactionPinRequest, customer: CurrentCustomer, db: DbSession):
    await SecurityService(db).change_transaction_pin(customer, payload.current_pin, payload.new_pin)


@router.post(
    "/transaction-pin/reset",
    **NO_CONTENT,
    summary="Forgot transaction PIN",
    description="Set a new transaction PIN by confirming the sign-in PIN. Also unlocks a locked one.",
)
async def reset_transaction_pin(
    payload: ResetTransactionPinRequest, request: Request, customer: CurrentCustomer, db: DbSession
):
    await SecurityService(db).reset_transaction_pin(
        customer, request.state.session_id, payload.login_pin, payload.new_pin
    )


# ── Biometrics ───────────────────────────────────────────────────────────────


@router.post(
    "/biometrics",
    **NO_CONTENT,
    summary="Turn Face ID / fingerprint on or off for this phone",
    description="The check itself happens on the phone. Turning it on needs the sign-in PIN, and "
    "lets a biometric check on this phone stand in for the PIN when approving a new phone.",
)
async def set_biometrics(payload: BiometricRequest, request: Request, customer: CurrentCustomer, db: DbSession):
    await SecurityService(db).set_biometric(
        customer, request.state.session_id, enabled=payload.enabled, pin=payload.pin
    )


# ── New-phone approval: the signed-in phone ─────────────────────────────────


@router.get(
    "/device-approvals/pending",
    response_model=list[PendingApprovalResponse],
    summary="Sign-ins waiting for approval",
    description="Poll while the app is open; show a prompt for each.",
)
async def pending_approvals(request: Request, customer: CurrentCustomer, db: DbSession):
    return await SecurityService(db).pending_for(customer, request.state.session_id)


@router.post(
    "/device-approvals/{approval_id}/approve",
    response_model=ApproveDeviceResponse,
    summary="Yes, it's me: approve a new phone",
    description="Returns a 6-digit code to show here; the customer types it on the new phone.",
)
async def approve_device(
    approval_id: str,
    payload: ApproveDeviceRequest,
    request: Request,
    customer: CurrentCustomer,
    db: DbSession,
):
    return await SecurityService(db).approve(
        customer, request.state.session_id, approval_id, pin=payload.pin, biometric=payload.biometric
    )


@router.post("/device-approvals/{approval_id}/deny", **NO_CONTENT, summary="No, that wasn't me")
async def deny_device(approval_id: str, request: Request, customer: CurrentCustomer, db: DbSession):
    await SecurityService(db).deny(customer, request.state.session_id, approval_id)


# ── New-phone approval: the new phone ───────────────────────────────────────


@router.post(
    "/device-approvals/{approval_id}/status",
    response_model=ApprovalStatusResponse,
    summary="Has my other phone approved this sign-in?",
)
async def approval_status(approval_id: str, payload: ApprovalSecretRequest, db: DbSession):
    return await SecurityService(db).requester_status(approval_id, payload.approval_secret)


@router.post(
    "/device-approvals/{approval_id}/complete",
    response_model=AuthTokenResponse,
    summary="Finish signing in with the code from the other phone",
)
async def complete_approval(
    approval_id: str, payload: CompleteApprovalRequest, request: Request, db: DbSession, redis: RedisClient
):
    return await AuthService(db, redis).complete_device_approval(
        approval_id, payload.approval_secret, payload.code, meta=request_meta(request), device=payload.device
    )


@router.post(
    "/device-approvals/{approval_id}/lost-phone",
    response_model=AuthTokenResponse,
    summary="Sign in without the other phone",
    description="BVN plus sign-in PIN (if set). Signs every other phone out, and holds money "
    "leaving the account for 24 hours.",
)
async def lost_phone(
    approval_id: str, payload: ApprovalFallbackRequest, request: Request, db: DbSession, redis: RedisClient
):
    return await AuthService(db, redis).lost_phone_sign_in(
        approval_id,
        payload.approval_secret,
        payload.bvn,
        payload.pin,
        meta=request_meta(request),
        device=payload.device,
    )
