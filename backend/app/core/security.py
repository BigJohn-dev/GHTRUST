"""
Token primitives.

Access tokens are short-lived HS256 JWTs carrying:
    sub  subject id (customer or staff id)
    typ  "customer" | "staff" — a token for one audience is rejected by the other
    sid  auth session id — checked against auth_sessions on every request, so
         logout / revocation / staff deactivation take effect immediately
    jti, iat, exp

Refresh tokens are opaque 384-bit random strings, stored only as SHA-256 hashes
and rotated on every use (see app/modules/auth/session_service.py).
"""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import get_settings

TOKEN_TYPE_CUSTOMER = "customer"
TOKEN_TYPE_STAFF = "staff"

_REQUIRED_CLAIMS = ["exp", "iat", "sub", "typ", "sid"]


class TokenError(ValueError):
    """Raised for any invalid, expired or wrong-audience token."""


@dataclass(frozen=True)
class AccessTokenClaims:
    sub: str
    typ: str
    sid: str
    phone: str | None
    is_super_admin: bool
    exp: datetime


def create_access_token(
    subject_id: str,
    *,
    typ: str,
    session_id: str,
    phone: str | None = None,
    is_super_admin: bool = False,
    expires_minutes: int | None = None,
) -> tuple[str, int]:
    """Return (token, expires_in_seconds)."""
    settings = get_settings()
    if expires_minutes is None:
        expires_minutes = (
            settings.staff_access_token_minutes
            if typ == TOKEN_TYPE_STAFF
            else settings.customer_access_token_minutes
        )
    now = datetime.now(timezone.utc)
    payload: dict = {
        "sub": subject_id,
        "typ": typ,
        "sid": session_id,
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    if phone:
        payload["phone"] = phone
    if typ == TOKEN_TYPE_STAFF:
        payload["is_super_admin"] = is_super_admin
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_minutes * 60


def decode_access_token(token: str, *, expected_typ: str) -> AccessTokenClaims:
    settings = get_settings()
    try:
        data = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": _REQUIRED_CLAIMS},
        )
    except jwt.PyJWTError as exc:
        raise TokenError("Invalid or expired token") from exc
    if data.get("typ") != expected_typ:
        raise TokenError("Invalid or expired token")
    return AccessTokenClaims(
        sub=str(data["sub"]),
        typ=data["typ"],
        sid=str(data["sid"]),
        phone=data.get("phone"),
        is_super_admin=bool(data.get("is_super_admin", False)),
        exp=datetime.fromtimestamp(data["exp"], tz=timezone.utc),
    )


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    # A 384-bit random token can't be brute-forced, so a fast unsalted hash is
    # sufficient; it only has to make a leaked DB row useless as a credential.
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
