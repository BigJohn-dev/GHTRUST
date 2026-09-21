from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.core.security import decode_access_token
from app.modules.users.models import Customer, CustomerStatus

DbSession = Annotated[AsyncSession, Depends(get_db)]
RedisClient = Annotated[Redis, Depends(get_redis)]

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_customer(
    db: DbSession,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Customer:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    result = await db.execute(
        select(Customer).where(
            Customer.id == payload.sub,
            Customer.status == CustomerStatus.ACTIVE,
        )
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found or inactive")
    return customer


CurrentCustomer = Annotated[Customer, Depends(get_current_customer)]
