from typing import Annotated

from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.errors import AppError, ErrorCode
from app.core.rate_limit import get_client_ip
from app.core.redis import get_redis
from app.core.security import TOKEN_TYPE_CUSTOMER, TokenError, decode_access_token
from app.modules.auth.models import SubjectType
from app.modules.auth.session_service import RequestMeta, SessionService
from app.modules.users.models import Customer, CustomerStatus

DbSession = Annotated[AsyncSession, Depends(get_db)]
RedisClient = Annotated[Redis, Depends(get_redis)]

bearer_scheme = HTTPBearer(auto_error=False)

_UNAUTHENTICATED = {"WWW-Authenticate": "Bearer"}


def request_meta(request: Request) -> RequestMeta:
    return RequestMeta(ip=get_client_ip(request), user_agent=request.headers.get("user-agent"))


def unauthenticated(code: str = "UNAUTHENTICATED", message: str = "Not authenticated") -> AppError:
    return AppError(status.HTTP_401_UNAUTHORIZED, code, message, headers=_UNAUTHENTICATED)


async def get_current_customer(
    request: Request,
    db: DbSession,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Customer:
    if not credentials:
        raise unauthenticated()
    try:
        claims = decode_access_token(credentials.credentials, expected_typ=TOKEN_TYPE_CUSTOMER)
    except TokenError:
        raise unauthenticated(ErrorCode.TOKEN_INVALID, "Invalid or expired token")

    if not await SessionService(db).is_active(
        claims.sid, subject_type=SubjectType.CUSTOMER, subject_id=claims.sub
    ):
        raise unauthenticated(ErrorCode.SESSION_REVOKED, "Session ended. Please sign in again.")

    result = await db.execute(
        select(Customer).where(Customer.id == claims.sub, Customer.status == CustomerStatus.ACTIVE)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise unauthenticated(ErrorCode.ACCOUNT_INACTIVE, "Account not found or inactive")

    request.state.session_id = claims.sid
    return customer


CurrentCustomer = Annotated[Customer, Depends(get_current_customer)]
