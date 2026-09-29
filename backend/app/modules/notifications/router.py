from datetime import datetime

from fastapi import APIRouter, Query, Request, status
from pydantic import BaseModel, Field

from app.core.deps import CurrentCustomer, DbSession
from app.core.errors import AppError
from app.integrations.push import is_expo_token
from app.modules.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    id: str
    kind: str
    title: str
    body: str
    route: str | None = None
    read: bool
    created_at: datetime


class NotificationPage(BaseModel):
    items: list[NotificationResponse]
    total: int
    limit: int
    offset: int
    unread_count: int


class UnreadCount(BaseModel):
    unread_count: int


class MarkReadRequest(BaseModel):
    # Omit to mark everything read.
    ids: list[str] | None = Field(default=None, max_length=200)


class PushTokenRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=255, description="Expo push token from the app")


@router.get("", response_model=NotificationPage)
async def list_notifications(
    customer: CurrentCustomer,
    db: DbSession,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> NotificationPage:
    """The customer's notifications, newest first."""
    items, total, unread = await NotificationService(db).page(customer.id, limit=limit, offset=offset)
    return NotificationPage(
        items=[
            NotificationResponse(
                id=n.id,
                kind=n.kind,
                title=n.title,
                body=n.body,
                route=n.route,
                read=n.read_at is not None,
                created_at=n.created_at,
            )
            for n in items
        ],
        total=total,
        limit=limit,
        offset=offset,
        unread_count=unread,
    )


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(customer: CurrentCustomer, db: DbSession) -> UnreadCount:
    return UnreadCount(unread_count=await NotificationService(db).unread_count(customer.id))


@router.post("/read", response_model=UnreadCount)
async def mark_read(payload: MarkReadRequest, customer: CurrentCustomer, db: DbSession) -> UnreadCount:
    left = await NotificationService(db).mark_read(customer.id, payload.ids)
    return UnreadCount(unread_count=left)


@router.put("/push-token", status_code=status.HTTP_204_NO_CONTENT)
async def register_push_token(payload: PushTokenRequest, request: Request, _customer: CurrentCustomer, db: DbSession):
    """Send this signed-in app's push notifications to the given Expo push token."""
    token = payload.token.strip()
    if not is_expo_token(token):
        raise AppError(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "Not an Expo push token")
    await NotificationService(db).set_push_token(request.state.session_id, token)


@router.delete("/push-token", status_code=status.HTTP_204_NO_CONTENT)
async def remove_push_token(request: Request, _customer: CurrentCustomer, db: DbSession):
    """Stop push notifications to this signed-in app (the inbox still fills)."""
    await NotificationService(db).set_push_token(request.state.session_id, None)
