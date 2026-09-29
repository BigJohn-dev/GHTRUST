"""
Customer account security.

Two PINs, never interchangeable:
  * the 6-digit **sign-in PIN** opens the app: unlocking after time away, signing back in
    on a trusted phone, approving a new phone;
  * the 4-digit **transaction PIN** approves money leaving the account. A customer who
    skipped it at sign-up is asked to create it the first time they move money.

Trusted devices: every sign-in gives the phone a random ``device_token``. With it, the
customer can sign back in on that phone with just their sign-in PIN.

New phones: when the SMS code is right but the phone is new and another phone is signed
in, the sign-in waits. The customer confirms "yes, it's me" on the signed-in phone (with
their PIN or biometrics), which then shows a 6-digit code to type on the new phone.
Without the old phone, the customer can still get in with their BVN and sign-in PIN;
every other phone is then signed out and money is held for 24 hours.
"""

import secrets
from datetime import date, datetime, timedelta, timezone

import structlog
from fastapi import status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.pins import (
    LOGIN_PIN_LENGTH,
    TRANSACTION_PIN_LENGTH,
    hash_pin,
    keyed_digest,
    verify_pin,
    weak_pin_reason,
)
from app.core.security import hash_token
from app.modules.auth.models import (
    AuthSession,
    CustomerDevice,
    DeviceApproval,
    DeviceApprovalStatus,
    SubjectType,
)
from app.modules.auth.schemas import (
    ApprovalStatusResponse,
    ApproveDeviceResponse,
    DeviceApprovalRequiredResponse,
    DeviceInfo,
    PendingApprovalResponse,
)
from app.modules.auth.session_service import RequestMeta, SessionService, as_utc
from app.modules.notifications import events as notify
from app.modules.users.models import Customer, CustomerStatus

logger = structlog.get_logger()

MAX_PIN_ATTEMPTS = 5
APPROVAL_TTL = timedelta(minutes=10)
APPROVAL_CODE_TTL = timedelta(minutes=5)
MAX_APPROVAL_ATTEMPTS = 5
LOST_PHONE_HOLD = timedelta(hours=24)
# "Forgot PIN" is only offered right after the customer proved themselves with an SMS code.
PIN_RESET_WINDOW = timedelta(minutes=15)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _birth_patterns(dob: date | None) -> tuple[str, ...]:
    if not dob:
        return ()
    return (
        dob.strftime("%d%m%y"),
        dob.strftime("%y%m%d"),
        dob.strftime("%m%d%y"),
        dob.strftime("%d%m"),
        dob.strftime("%m%d"),
        dob.strftime("%Y"),
    )


def _check_strength(customer: Customer, pin: str, length: int) -> None:
    reason = weak_pin_reason(pin, length=length, birth_patterns=_birth_patterns(customer.date_of_birth))
    if reason:
        raise AppError(status.HTTP_400_BAD_REQUEST, ErrorCode.PIN_TOO_WEAK, reason)


def _attempts_left(used: int) -> list[dict]:
    return [{"attempts_left": max(MAX_PIN_ATTEMPTS - used, 0)}]


class SecurityService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.sessions = SessionService(db)

    # ── Sign-in PIN ─────────────────────────────────────────────────────────

    async def set_login_pin(self, customer: Customer, pin: str) -> None:
        if customer.login_pin_hash:
            raise AppError(
                status.HTTP_409_CONFLICT, ErrorCode.PIN_ALREADY_SET, "You already have a sign-in PIN. Change it instead."
            )
        self._store_login_pin(customer, pin)

    async def change_login_pin(self, customer: Customer, session_id: str, current: str, new: str) -> None:
        await self.verify_login_pin(customer, current, session_id=session_id)
        if current == new:
            raise AppError(status.HTTP_400_BAD_REQUEST, ErrorCode.PIN_TOO_WEAK, "Choose a different PIN.")
        self._store_login_pin(customer, new)

    async def reset_login_pin(self, customer: Customer, session_id: str, bvn: str, new: str) -> None:
        """Forgot PIN: allowed only in a session that just started with an SMS code, plus the BVN."""
        session = await self.db.get(AuthSession, session_id)
        if session is None or _now() - as_utc(session.created_at) > PIN_RESET_WINDOW:
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                ErrorCode.REAUTH_REQUIRED,
                "For your security, sign in again with an SMS code, then reset your PIN.",
            )
        if bvn != customer.bvn:
            raise AppError(status.HTTP_400_BAD_REQUEST, ErrorCode.BVN_MISMATCH, "That BVN doesn't match your account.")
        self._store_login_pin(customer, new)

    def _store_login_pin(self, customer: Customer, pin: str) -> None:
        _check_strength(customer, pin, LOGIN_PIN_LENGTH)
        customer.login_pin_hash = hash_pin(pin)
        customer.login_pin_set_at = _now()
        customer.login_pin_failed_attempts = 0

    async def verify_login_pin(self, customer: Customer, pin: str, *, session_id: str | None = None) -> None:
        """
        Check the sign-in PIN. Five wrong in a row signs this phone out and forgets it, so
        the customer has to sign in with an SMS code again.
        """
        if not customer.login_pin_hash:
            raise AppError(status.HTTP_403_FORBIDDEN, ErrorCode.LOGIN_PIN_NOT_SET, "Create your sign-in PIN first.")
        if verify_pin(pin, customer.login_pin_hash):
            customer.login_pin_failed_attempts = 0
            return

        customer.login_pin_failed_attempts = (customer.login_pin_failed_attempts or 0) + 1
        used = customer.login_pin_failed_attempts
        if used >= MAX_PIN_ATTEMPTS:
            customer.login_pin_failed_attempts = 0
            if session_id:
                session = await self.db.get(AuthSession, session_id)
                if session is not None:
                    await self.sessions.revoke(session, reason="pin_attempts_exceeded")
                    if session.device_id:
                        await self.forget_device(customer.id, session.device_id)
            # Persist before raising: the error path rolls the request back.
            await self.db.commit()
            logger.warning("login_pin_attempts_exceeded", customer_id=customer.id)
            raise AppError(
                status.HTTP_401_UNAUTHORIZED,
                ErrorCode.PIN_ATTEMPTS_EXCEEDED,
                "Too many wrong PINs. For your security, sign in again with an SMS code.",
            )
        await self.db.commit()
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.PIN_INVALID,
            f"Wrong PIN. {MAX_PIN_ATTEMPTS - used} attempt(s) left.",
            errors=_attempts_left(used),
        )

    # ── Transaction PIN ─────────────────────────────────────────────────────

    async def set_transaction_pin(self, customer: Customer, pin: str) -> None:
        if customer.transaction_pin_hash:
            raise AppError(
                status.HTTP_409_CONFLICT,
                ErrorCode.PIN_ALREADY_SET,
                "You already have a transaction PIN. Change it instead.",
            )
        self._store_transaction_pin(customer, pin)

    async def change_transaction_pin(self, customer: Customer, current: str, new: str) -> None:
        await self.authorize_transaction(customer, current, check_hold=False)
        if current == new:
            raise AppError(status.HTTP_400_BAD_REQUEST, ErrorCode.PIN_TOO_WEAK, "Choose a different PIN.")
        self._store_transaction_pin(customer, new)

    async def reset_transaction_pin(self, customer: Customer, session_id: str, login_pin: str, new: str) -> None:
        """Forgot (or locked) transaction PIN: the sign-in PIN proves it's the owner."""
        await self.verify_login_pin(customer, login_pin, session_id=session_id)
        self._store_transaction_pin(customer, new)

    def _store_transaction_pin(self, customer: Customer, pin: str) -> None:
        _check_strength(customer, pin, TRANSACTION_PIN_LENGTH)
        customer.transaction_pin_hash = hash_pin(pin)
        customer.transaction_pin_set_at = _now()
        customer.transaction_pin_failed_attempts = 0

    async def authorize_transaction(self, customer: Customer, pin: str | None, *, check_hold: bool = True) -> None:
        """
        Gate for anything that moves money out of the account. Call it before doing any
        other work in the request: a wrong PIN commits its attempt count.
        """
        if not customer.transaction_pin_hash:
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                ErrorCode.TRANSACTION_PIN_NOT_SET,
                "Create your 4-digit transaction PIN to move money.",
            )
        hold = customer.transfers_blocked_until
        if check_hold and hold and as_utc(hold) > _now():
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                ErrorCode.TRANSFERS_ON_HOLD,
                "For your security, money can't leave your account for 24 hours after signing in "
                "without your old phone.",
                errors=[{"until": as_utc(hold).isoformat()}],
            )
        if (customer.transaction_pin_failed_attempts or 0) >= MAX_PIN_ATTEMPTS:
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                ErrorCode.TRANSACTION_PIN_LOCKED,
                "Your transaction PIN is locked after too many wrong tries. Reset it with your sign-in PIN.",
            )
        if pin and verify_pin(pin, customer.transaction_pin_hash):
            customer.transaction_pin_failed_attempts = 0
            return

        customer.transaction_pin_failed_attempts = (customer.transaction_pin_failed_attempts or 0) + 1
        used = customer.transaction_pin_failed_attempts
        await self.db.commit()
        if used >= MAX_PIN_ATTEMPTS:
            logger.warning("transaction_pin_locked", customer_id=customer.id)
            raise AppError(
                status.HTTP_403_FORBIDDEN,
                ErrorCode.TRANSACTION_PIN_LOCKED,
                "Your transaction PIN is locked after too many wrong tries. Reset it with your sign-in PIN.",
            )
        raise AppError(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.TRANSACTION_PIN_INVALID,
            f"Wrong transaction PIN. {MAX_PIN_ATTEMPTS - used} attempt(s) left.",
            errors=_attempts_left(used),
        )

    # ── Biometrics ──────────────────────────────────────────────────────────

    async def set_biometric(self, customer: Customer, session_id: str, *, enabled: bool, pin: str | None) -> None:
        session = await self.sessions.get_owned(session_id, subject_type=SubjectType.CUSTOMER, subject_id=customer.id)
        if enabled:
            await self.verify_login_pin(customer, pin or "", session_id=session_id)
        session.biometric_enabled = enabled

    # ── Trusted devices ─────────────────────────────────────────────────────

    async def trust_device(self, customer: Customer, device: DeviceInfo | None) -> str | None:
        """Remember this phone; returns its new device token (None without a device id)."""
        if not device or not device.device_id:
            return None
        token = secrets.token_urlsafe(32)
        now = _now()
        row = (
            await self.db.execute(
                select(CustomerDevice).where(
                    CustomerDevice.customer_id == customer.id, CustomerDevice.device_id == device.device_id
                )
            )
        ).scalar_one_or_none()
        if row is None:
            row = CustomerDevice(customer_id=customer.id, device_id=device.device_id, trusted_at=now)
            self.db.add(row)
        elif row.revoked_at is not None:
            row.trusted_at = now
        row.token_hash = hash_token(token)
        row.device_name = device.device_name
        row.platform = device.platform
        row.last_seen_at = now
        row.revoked_at = None
        await self.db.flush()
        return token

    async def trusted_device(self, device_id: str | None, token: str | None) -> CustomerDevice | None:
        if not device_id or not token:
            return None
        row = (
            await self.db.execute(
                select(CustomerDevice).where(
                    CustomerDevice.token_hash == hash_token(token),
                    CustomerDevice.device_id == device_id,
                    CustomerDevice.revoked_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        return row

    async def forget_device(self, customer_id: str, device_id: str) -> None:
        await self.db.execute(
            update(CustomerDevice)
            .where(
                CustomerDevice.customer_id == customer_id,
                CustomerDevice.device_id == device_id,
                CustomerDevice.revoked_at.is_(None),
            )
            .values(revoked_at=_now())
        )

    async def forget_other_devices(self, customer_id: str, keep_device_id: str | None) -> None:
        stmt = (
            update(CustomerDevice)
            .where(CustomerDevice.customer_id == customer_id, CustomerDevice.revoked_at.is_(None))
            .values(revoked_at=_now())
        )
        if keep_device_id:
            stmt = stmt.where(CustomerDevice.device_id != keep_device_id)
        await self.db.execute(stmt)

    async def pin_sign_in(self, device_id: str, device_token: str, pin: str) -> Customer:
        """Sign back in on a trusted phone with the sign-in PIN (no SMS code)."""
        row = await self.trusted_device(device_id, device_token)
        customer = await self.db.get(Customer, row.customer_id) if row else None
        if row is None or customer is None or customer.status != CustomerStatus.ACTIVE:
            raise AppError(
                status.HTTP_401_UNAUTHORIZED,
                ErrorCode.DEVICE_NOT_TRUSTED,
                "Sign in with your phone number and an SMS code on this phone.",
            )
        try:
            await self.verify_login_pin(customer, pin)
        except AppError as exc:
            if exc.code == ErrorCode.PIN_ATTEMPTS_EXCEEDED:
                await self.forget_device(customer.id, device_id)
                await self.db.commit()
            raise
        customer.last_login_at = _now()
        return customer

    # ── New-device approval ─────────────────────────────────────────────────

    async def approver_sessions(self, customer: Customer, device: DeviceInfo | None) -> list[AuthSession]:
        """
        Signed-in phones that must approve this sign-in. None when this phone is already
        trusted (it proved so with its device token) or no other phone is signed in.
        """
        if device and await self.trusted_device(device.device_id, device.device_token):
            return []
        active = await self.sessions.list_active(subject_type=SubjectType.CUSTOMER, subject_id=customer.id)
        requester = device.device_id if device else None
        return [s for s in active if s.device_id and s.device_id != requester]

    async def start_approval(
        self, customer: Customer, approvers: list[AuthSession], device: DeviceInfo | None, meta: RequestMeta
    ) -> DeviceApprovalRequiredResponse:
        now = _now()
        # One live request per new phone: a retry replaces the previous one.
        if device and device.device_id:
            await self.db.execute(
                update(DeviceApproval)
                .where(
                    DeviceApproval.customer_id == customer.id,
                    DeviceApproval.device_id == device.device_id,
                    DeviceApproval.status.in_(
                        [DeviceApprovalStatus.PENDING.value, DeviceApprovalStatus.APPROVED.value]
                    ),
                )
                .values(status=DeviceApprovalStatus.EXPIRED.value, decided_at=now)
            )
        secret = secrets.token_urlsafe(32)
        approval = DeviceApproval(
            customer_id=customer.id,
            status=DeviceApprovalStatus.PENDING.value,
            secret_hash=hash_token(secret),
            device_id=device.device_id if device else None,
            device_name=device.device_name if device else None,
            platform=device.platform if device else None,
            app_version=device.app_version if device else None,
            ip_address=meta.ip,
            user_agent=(meta.user_agent or "")[:255] or None,
            expires_at=now + APPROVAL_TTL,
        )
        self.db.add(approval)
        await self.db.flush()
        logger.info("device_approval_requested", customer_id=customer.id, approval_id=approval.id)
        await notify.sign_in_approval_requested(self.db, approval)
        names = list(dict.fromkeys(s.device_name or "your other phone" for s in approvers))
        return DeviceApprovalRequiredResponse(
            approval_id=approval.id,
            approval_secret=secret,
            expires_in=int(APPROVAL_TTL.total_seconds()),
            approver_devices=names,
            fallback_needs_pin=bool(customer.login_pin_hash),
        )

    def _expire_if_due(self, approval: DeviceApproval) -> None:
        live = (DeviceApprovalStatus.PENDING.value, DeviceApprovalStatus.APPROVED.value)
        if approval.status in live and as_utc(approval.expires_at) <= _now():
            approval.status = DeviceApprovalStatus.EXPIRED.value

    async def _for_requester(self, approval_id: str, secret: str) -> DeviceApproval:
        approval = await self.db.get(DeviceApproval, approval_id, with_for_update=True)
        if approval is None or approval.secret_hash != hash_token(secret):
            raise AppError(status.HTTP_404_NOT_FOUND, ErrorCode.APPROVAL_NOT_FOUND, "This sign-in request wasn't found.")
        self._expire_if_due(approval)
        return approval

    def _status(self, approval: DeviceApproval) -> ApprovalStatusResponse:
        left = int((as_utc(approval.expires_at) - _now()).total_seconds())
        return ApprovalStatusResponse(status=approval.status, expires_in=max(left, 0))

    async def requester_status(self, approval_id: str, secret: str) -> ApprovalStatusResponse:
        return self._status(await self._for_requester(approval_id, secret))

    def _require_status(self, approval: DeviceApproval, wanted: DeviceApprovalStatus) -> None:
        if approval.status == wanted.value:
            return
        messages = {
            DeviceApprovalStatus.DENIED.value: "This sign-in was declined on your other phone.",
            DeviceApprovalStatus.EXPIRED.value: "This sign-in request expired. Start again.",
            DeviceApprovalStatus.FAILED.value: "Too many wrong tries. Start again.",
            DeviceApprovalStatus.COMPLETED.value: "This sign-in is already complete.",
            DeviceApprovalStatus.PENDING.value: "Approve the sign-in on your other phone first.",
            DeviceApprovalStatus.APPROVED.value: "Enter the code shown on your other phone.",
        }
        raise AppError(
            status.HTTP_409_CONFLICT,
            ErrorCode.APPROVAL_NOT_ACTIVE,
            messages.get(approval.status, "This sign-in request can't be used."),
            errors=[{"status": approval.status}],
        )

    async def _count_failure(self, approval: DeviceApproval, code: str, message: str) -> None:
        approval.code_attempts = (approval.code_attempts or 0) + 1
        left = MAX_APPROVAL_ATTEMPTS - approval.code_attempts
        if left <= 0:
            approval.status = DeviceApprovalStatus.FAILED.value
        await self.db.commit()
        if left <= 0:
            raise AppError(status.HTTP_409_CONFLICT, ErrorCode.APPROVAL_NOT_ACTIVE, "Too many wrong tries. Start again.")
        raise AppError(
            status.HTTP_400_BAD_REQUEST, code, f"{message} {left} attempt(s) left.", errors=[{"attempts_left": left}]
        )

    async def complete_approval(self, approval_id: str, secret: str, code: str) -> tuple[Customer, DeviceApproval]:
        """The new phone types the code shown on the approving phone."""
        approval = await self._for_requester(approval_id, secret)
        self._require_status(approval, DeviceApprovalStatus.APPROVED)
        if approval.code_expires_at is None or as_utc(approval.code_expires_at) <= _now():
            approval.status = DeviceApprovalStatus.EXPIRED.value
            await self.db.commit()
            self._require_status(approval, DeviceApprovalStatus.APPROVED)
        if keyed_digest(f"{approval.id}:{code}") != approval.code_hash:
            await self._count_failure(approval, ErrorCode.APPROVAL_CODE_INVALID, "That code isn't right.")
        approval.status = DeviceApprovalStatus.COMPLETED.value
        customer = await self.db.get(Customer, approval.customer_id)
        if customer is None or customer.status != CustomerStatus.ACTIVE:
            raise AppError(status.HTTP_401_UNAUTHORIZED, ErrorCode.ACCOUNT_INACTIVE, "Account not found or inactive")
        customer.last_login_at = _now()
        logger.info("device_approval_completed", customer_id=customer.id, approval_id=approval.id)
        return customer, approval

    async def lost_phone_sign_in(
        self, approval_id: str, secret: str, bvn: str, pin: str | None
    ) -> tuple[Customer, DeviceApproval]:
        """
        No access to the signed-in phone: BVN (and sign-in PIN, if set) instead. Every other
        phone is signed out and forgotten, and money is held for 24 hours.
        """
        approval = await self._for_requester(approval_id, secret)
        self._require_status(approval, DeviceApprovalStatus.PENDING)
        customer = await self.db.get(Customer, approval.customer_id)
        if customer is None or customer.status != CustomerStatus.ACTIVE:
            raise AppError(status.HTTP_401_UNAUTHORIZED, ErrorCode.ACCOUNT_INACTIVE, "Account not found or inactive")
        if bvn != customer.bvn:
            await self._count_failure(approval, ErrorCode.BVN_MISMATCH, "That BVN doesn't match this account.")
        if customer.login_pin_hash and not (pin and verify_pin(pin, customer.login_pin_hash)):
            await self._count_failure(approval, ErrorCode.PIN_INVALID, "Wrong PIN.")

        now = _now()
        await self.sessions.revoke_all(subject_type=SubjectType.CUSTOMER, subject_id=customer.id, reason="lost_phone")
        await self.forget_other_devices(customer.id, keep_device_id=None)
        customer.transfers_blocked_until = now + LOST_PHONE_HOLD
        customer.last_login_at = now
        approval.status = DeviceApprovalStatus.COMPLETED.value
        approval.decided_at = now
        logger.warning("lost_phone_sign_in", customer_id=customer.id, approval_id=approval.id)
        return customer, approval

    # Approving phone ────────────────────────────────────────────────────────

    async def pending_for(self, customer: Customer, session_id: str) -> list[PendingApprovalResponse]:
        session = await self.db.get(AuthSession, session_id)
        rows = (
            await self.db.execute(
                select(DeviceApproval)
                .where(
                    DeviceApproval.customer_id == customer.id,
                    DeviceApproval.status == DeviceApprovalStatus.PENDING.value,
                    DeviceApproval.expires_at > _now(),
                )
                .order_by(DeviceApproval.created_at.desc())
            )
        ).scalars()
        mine = session.device_id if session else None
        return [
            PendingApprovalResponse(
                id=a.id,
                device_name=a.device_name,
                platform=a.platform,
                ip_address=a.ip_address,
                requested_at=a.created_at,
                expires_in=int((as_utc(a.expires_at) - _now()).total_seconds()),
            )
            for a in rows
            if not (mine and a.device_id == mine)
        ]

    async def _for_approver(self, customer: Customer, approval_id: str) -> DeviceApproval:
        approval = await self.db.get(DeviceApproval, approval_id, with_for_update=True)
        if approval is None or approval.customer_id != customer.id:
            raise AppError(status.HTTP_404_NOT_FOUND, ErrorCode.APPROVAL_NOT_FOUND, "This sign-in request wasn't found.")
        self._expire_if_due(approval)
        self._require_status(approval, DeviceApprovalStatus.PENDING)
        return approval

    async def approve(
        self, customer: Customer, session_id: str, approval_id: str, *, pin: str | None, biometric: bool
    ) -> ApproveDeviceResponse:
        """'Yes, it's me' on a signed-in phone, proven with the sign-in PIN or biometrics."""
        approval = await self._for_approver(customer, approval_id)
        session = await self.db.get(AuthSession, session_id)
        if session is not None and session.device_id and session.device_id == approval.device_id:
            raise AppError(status.HTTP_403_FORBIDDEN, ErrorCode.PERMISSION_DENIED, "Approve from your other phone.")
        if pin:
            await self.verify_login_pin(customer, pin, session_id=session_id)
        elif not (biometric and session is not None and session.biometric_enabled):
            raise AppError(
                status.HTTP_403_FORBIDDEN, ErrorCode.REAUTH_REQUIRED, "Confirm it's you with your sign-in PIN."
            )

        code = f"{secrets.randbelow(10**6):06d}"
        now = _now()
        approval.status = DeviceApprovalStatus.APPROVED.value
        approval.decided_at = now
        approval.decided_by_session_id = session_id
        approval.code_hash = keyed_digest(f"{approval.id}:{code}")
        approval.code_expires_at = now + APPROVAL_CODE_TTL
        approval.expires_at = approval.code_expires_at
        logger.info("device_approval_approved", customer_id=customer.id, approval_id=approval.id)
        return ApproveDeviceResponse(code=code, expires_in=int(APPROVAL_CODE_TTL.total_seconds()))

    async def deny(self, customer: Customer, session_id: str, approval_id: str) -> None:
        approval = await self._for_approver(customer, approval_id)
        approval.status = DeviceApprovalStatus.DENIED.value
        approval.decided_at = _now()
        approval.decided_by_session_id = session_id
        logger.warning("device_approval_denied", customer_id=customer.id, approval_id=approval.id)
