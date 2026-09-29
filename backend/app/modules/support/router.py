"""
Help & support: FAQs for the app, customer problem reports, and the staff side that
answers them. A staff reply notifies the customer.
"""

import secrets
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.core.deps import CurrentCustomer, DbSession, RedisClient
from app.core.errors import AppError
from app.core.rate_limit import RateLimiter
from app.modules.admin.deps import require_permission
from app.modules.admin.models import Staff
from app.modules.admin.permissions import SUPPORT_READ, SUPPORT_RESPOND
from app.modules.auth.models import AuthSession
from app.modules.notifications.service import NotificationService
from app.modules.support.faqs import FAQS, TOPICS
from app.modules.support.models import SupportTicket, TicketCategory, TicketStatus
from app.modules.users.models import Customer

router = APIRouter(tags=["Support"])

TICKETS_PER_DAY = 10
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O, 1/I: read out over the phone

Category = Literal["payments", "loans", "account", "app", "data", "other"]
Related = Literal["transaction", "loan", "application"]
Status = Literal["open", "in_progress", "resolved"]


class FaqResponse(BaseModel):
    id: str
    topic: str
    question: str
    answer: str


class FaqsResponse(BaseModel):
    topics: list[str]
    items: list[FaqResponse]


class CreateTicketRequest(BaseModel):
    category: Category
    message: str = Field(..., min_length=10, max_length=2000)
    related_type: Related | None = None
    related_id: str | None = Field(default=None, max_length=64)


class TicketResponse(BaseModel):
    id: str
    reference: str
    category: str
    message: str
    related_type: str | None
    related_id: str | None
    status: str
    reply: str | None
    replied_at: datetime | None
    created_at: datetime


class AdminTicketResponse(TicketResponse):
    customer_id: str
    customer_name: str
    customer_phone: str
    app_version: str | None
    platform: str | None
    device_name: str | None
    resolved_at: datetime | None


class AdminTicketPage(BaseModel):
    items: list[AdminTicketResponse]
    total: int
    open: int


class UpdateTicketRequest(BaseModel):
    status: Status | None = None
    reply: str | None = Field(default=None, min_length=2, max_length=2000)


def _ticket(t: SupportTicket) -> TicketResponse:
    return TicketResponse(
        id=t.id,
        reference=t.reference,
        category=t.category,
        message=t.message,
        related_type=t.related_type,
        related_id=t.related_id,
        status=t.status,
        reply=t.reply,
        replied_at=t.replied_at,
        created_at=t.created_at,
    )


def _reference() -> str:
    return "GHT-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))


# ── Customer ─────────────────────────────────────────────────────────────────


@router.get("/support/faqs", response_model=FaqsResponse, summary="Help centre questions")
async def list_faqs() -> FaqsResponse:
    return FaqsResponse(
        topics=list(TOPICS),
        items=[FaqResponse(id=f.id, topic=f.topic, question=f.question, answer=f.answer) for f in FAQS],
    )


@router.post(
    "/support/tickets",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report a problem or send a request",
)
async def create_ticket(
    payload: CreateTicketRequest, request: Request, customer: CurrentCustomer, db: DbSession, redis: RedisClient
) -> TicketResponse:
    await RateLimiter(redis).hit(f"support-ticket:day:{customer.id}", TICKETS_PER_DAY, 86400)
    session = await db.get(AuthSession, getattr(request.state, "session_id", None) or "")
    ticket = SupportTicket(
        reference=_reference(),
        customer_id=customer.id,
        category=TicketCategory(payload.category).value,
        message=payload.message.strip(),
        related_type=payload.related_type if payload.related_id else None,
        related_id=payload.related_id,
        status=TicketStatus.OPEN.value,
        app_version=session.app_version if session else None,
        platform=session.platform if session else None,
        device_name=session.device_name if session else None,
    )
    db.add(ticket)
    await db.flush()
    await db.refresh(ticket)
    return _ticket(ticket)


@router.get("/support/tickets", response_model=list[TicketResponse], summary="My requests")
async def my_tickets(customer: CurrentCustomer, db: DbSession) -> list[TicketResponse]:
    rows = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.customer_id == customer.id)
        .order_by(SupportTicket.created_at.desc())
        .limit(50)
    )
    return [_ticket(t) for t in rows.scalars()]


@router.get("/support/tickets/{ticket_id}", response_model=TicketResponse, summary="One of my requests")
async def my_ticket(ticket_id: str, customer: CurrentCustomer, db: DbSession) -> TicketResponse:
    ticket = await db.scalar(
        select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.customer_id == customer.id)
    )
    if ticket is None:
        raise AppError(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Request not found")
    return _ticket(ticket)


# ── Staff ────────────────────────────────────────────────────────────────────


async def _admin_ticket(db, t: SupportTicket, customer: Customer | None = None) -> AdminTicketResponse:
    customer = customer or await db.get(Customer, t.customer_id)
    return AdminTicketResponse(
        **_ticket(t).model_dump(),
        customer_id=t.customer_id,
        customer_name=customer.full_name if customer else "",
        customer_phone=customer.phone_primary if customer else "",
        app_version=t.app_version,
        platform=t.platform,
        device_name=t.device_name,
        resolved_at=t.resolved_at,
    )


@router.get("/admin/support/tickets", response_model=AdminTicketPage, summary="Customer support requests")
async def admin_tickets(
    db: DbSession,
    _: Staff = Depends(require_permission(SUPPORT_READ)),
    status_filter: Status | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> AdminTicketPage:
    query = select(SupportTicket, Customer).join(Customer, Customer.id == SupportTicket.customer_id)
    count = select(func.count()).select_from(SupportTicket)
    if status_filter:
        query = query.where(SupportTicket.status == status_filter)
        count = count.where(SupportTicket.status == status_filter)
    rows = await db.execute(query.order_by(SupportTicket.created_at.desc()).limit(limit).offset(offset))
    items = [await _admin_ticket(db, t, c) for t, c in rows.all()]
    open_count = await db.scalar(
        select(func.count()).select_from(SupportTicket).where(SupportTicket.status != TicketStatus.RESOLVED.value)
    )
    return AdminTicketPage(items=items, total=await db.scalar(count) or 0, open=open_count or 0)


@router.patch("/admin/support/tickets/{ticket_id}", response_model=AdminTicketResponse, summary="Reply or update")
async def update_ticket(
    ticket_id: str,
    payload: UpdateTicketRequest,
    db: DbSession,
    staff: Staff = Depends(require_permission(SUPPORT_RESPOND)),
) -> AdminTicketResponse:
    ticket = await db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise AppError(status.HTTP_404_NOT_FOUND, "NOT_FOUND", "Request not found")
    if payload.status is None and payload.reply is None:
        raise AppError(status.HTTP_422_UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "Nothing to update.")
    now = datetime.now(timezone.utc)
    if payload.reply:
        ticket.reply = payload.reply.strip()
        ticket.replied_at = now
        ticket.replied_by = staff.id
        if ticket.status == TicketStatus.OPEN.value and payload.status is None:
            ticket.status = TicketStatus.IN_PROGRESS.value
        await NotificationService(db).notify(
            ticket.customer_id,
            "support_reply",
            "We've replied to your request",
            f"About {ticket.reference}: {ticket.reply[:120]}{'…' if len(ticket.reply) > 120 else ''}",
            route=f"/support/{ticket.id}",
        )
    if payload.status:
        ticket.status = payload.status
        ticket.resolved_at = now if payload.status == TicketStatus.RESOLVED.value else None
    await db.flush()
    await db.refresh(ticket)
    return await _admin_ticket(db, ticket)
