from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import DbSession, bearer_scheme
from app.core.security import decode_staff_access_token
from app.modules.admin.models import Staff, StaffStatus


async def get_current_staff(
    db: DbSession,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Staff:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_staff_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    result = await db.execute(
        select(Staff)
        .options(selectinload(Staff.role))
        .where(Staff.id == payload.sub, Staff.status == StaffStatus.ACTIVE)
    )
    staff = result.scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Staff account not found or inactive")
    return staff


CurrentStaff = Annotated[Staff, Depends(get_current_staff)]


def require_permission(permission: str) -> Callable:
    async def _checker(staff: CurrentStaff) -> Staff:
        if not staff.has_permission(permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return staff

    return _checker
