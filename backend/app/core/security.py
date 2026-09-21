from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import get_settings


class TokenPayload(BaseModel):
    sub: str  # customer_id
    phone: str
    exp: datetime | None = None


class StaffTokenPayload(BaseModel):
    sub: str  # staff_id
    phone: str
    is_super_admin: bool = False
    exp: datetime | None = None


def create_access_token(customer_id: str, phone: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {
        "sub": customer_id,
        "phone": phone,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_staff_access_token(staff_id: str, phone: str, *, is_super_admin: bool) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    payload = {
        "sub": staff_id,
        "phone": phone,
        "typ": "staff",
        "is_super_admin": is_super_admin,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> TokenPayload:
    settings = get_settings()
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return TokenPayload(sub=data["sub"], phone=data["phone"])
    except JWTError as e:
        raise ValueError("Invalid or expired token") from e


def decode_staff_access_token(token: str) -> StaffTokenPayload:
    settings = get_settings()
    try:
        data = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        if data.get("typ") != "staff":
            raise ValueError("Invalid or expired token")
        return StaffTokenPayload(
            sub=data["sub"],
            phone=data["phone"],
            is_super_admin=bool(data.get("is_super_admin", False)),
        )
    except JWTError as e:
        raise ValueError("Invalid or expired token") from e
