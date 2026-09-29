"""
Customer notifications: written alongside the event that causes them, then pushed
to the customer's signed-in phones by the delivery job (``deliver_pending``).

Writing first and sending later means a notification exists only if its event was
committed (a rolled-back credit never pings anyone), and a push-service outage
only delays notifications instead of failing payments.
"""

from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.push import PushError, PushMessage, PushSender, get_push_sender
from app.modules.auth.models import AuthSession, SubjectType
from app.modules.notifications.models import Notification, PushStatus

logger = structlog.get_logger()

# A push that couldn't go out within this window is no longer news; it stays in the inbox.
PUSH_WINDOW = timedelta(hours=24)
MAX_PUSH_ATTEMPTS = 5
DELIVERY_BATCH = 200


def _utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def notify(
        self,
        customer_id: str,
        kind: str,
        title: str,
        body: str,
        *,
        route: str | None = None,
        dedupe_key: str | None = None,
        data: dict | None = None,
    ) -> Notification | None:
        """Queue a notification. Returns None if one with the same ``dedupe_key`` exists."""
        if dedupe_key:
            exists = await self.db.scalar(select(Notification.id).where(Notification.dedupe_key == dedupe_key))
            if exists:
                return None
        notification = Notification(
            customer_id=customer_id,
            kind=kind,
            title=title,
            body=body,
            route=route,
            dedupe_key=dedupe_key,
            data=data or {},
            push_status=PushStatus.PENDING.value,
        )
        self.db.add(notification)
        return notification

    # ── Inbox ────────────────────────────────────────────────────────────────

    async def page(self, customer_id: str, *, limit: int, offset: int) -> tuple[list[Notification], int, int]:
        """(items newest first, total, unread)."""
        base = select(Notification).where(Notification.customer_id == customer_id)
        items = list(
            (
                await self.db.execute(
                    base.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).offset(offset)
                )
            ).scalars()
        )
        total = await self.db.scalar(
            select(func.count()).select_from(Notification).where(Notification.customer_id == customer_id)
        )
        return items, total or 0, await self.unread_count(customer_id)

    async def unread_count(self, customer_id: str) -> int:
        return (
            await self.db.scalar(
                select(func.count())
                .select_from(Notification)
                .where(Notification.customer_id == customer_id, Notification.read_at.is_(None))
            )
            or 0
        )

    async def mark_read(self, customer_id: str, ids: list[str] | None = None) -> int:
        """Mark the given notifications (or all of them) read. Returns the unread count left."""
        query = update(Notification).where(Notification.customer_id == customer_id, Notification.read_at.is_(None))
        if ids is not None:
            query = query.where(Notification.id.in_(ids))
        await self.db.execute(query.values(read_at=datetime.now(timezone.utc)))
        return await self.unread_count(customer_id)

    # ── Push tokens ──────────────────────────────────────────────────────────

    async def set_push_token(self, session_id: str, token: str | None) -> None:
        """Attach (or with None, detach) a push token to the app signed in with this session."""
        if token:
            # A phone has one token. If it was signed in to another session or account
            # before, that one must stop receiving pushes on this phone.
            await self.db.execute(
                update(AuthSession)
                .where(AuthSession.push_token == token, AuthSession.id != session_id)
                .values(push_token=None)
            )
        await self.db.execute(update(AuthSession).where(AuthSession.id == session_id).values(push_token=token))

    async def _tokens_for(self, customer_ids: set[str]) -> dict[str, set[str]]:
        now = datetime.now(timezone.utc)
        rows = await self.db.execute(
            select(AuthSession.subject_id, AuthSession.push_token).where(
                AuthSession.subject_type == SubjectType.CUSTOMER,
                AuthSession.subject_id.in_(customer_ids),
                AuthSession.push_token.is_not(None),
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > now,
            )
        )
        tokens: dict[str, set[str]] = {}
        for customer_id, token in rows.all():
            tokens.setdefault(customer_id, set()).add(token)
        return tokens

    # ── Delivery ─────────────────────────────────────────────────────────────

    async def deliver_pending(self, sender: PushSender | None = None, limit: int = DELIVERY_BATCH) -> dict:
        """Push queued notifications to each customer's signed-in phones. The caller commits."""
        pending = list(
            (
                await self.db.execute(
                    select(Notification)
                    .where(Notification.push_status == PushStatus.PENDING.value)
                    .order_by(Notification.created_at)
                    .limit(limit)
                )
            ).scalars()
        )
        if not pending:
            return {"sent": 0, "skipped": 0, "failed": 0}

        now = datetime.now(timezone.utc)
        counts = {"sent": 0, "skipped": 0, "failed": 0}
        fresh: list[Notification] = []
        for n in pending:
            if now - _utc(n.created_at) > PUSH_WINDOW:
                self._finish(n, PushStatus.SKIPPED, "expired")
                counts["skipped"] += 1
            else:
                fresh.append(n)

        tokens = await self._tokens_for({n.customer_id for n in fresh})
        messages: list[PushMessage] = []
        owners: list[Notification] = []
        for n in fresh:
            phones = tokens.get(n.customer_id)
            if not phones:
                self._finish(n, PushStatus.SKIPPED, "no_device")
                counts["skipped"] += 1
                continue
            data = {"notification_id": n.id, "kind": n.kind, **({"url": n.route} if n.route else {})}
            for token in sorted(phones):
                messages.append(PushMessage(to=token, title=n.title, body=n.body, data=data))
                owners.append(n)

        if not messages:
            return counts

        try:
            tickets = await (sender or get_push_sender()).send(messages)
        except PushError as exc:
            logger.warning("push_delivery_failed", error=str(exc), notifications=len(fresh))
            for n in {id(o): o for o in owners}.values():
                n.push_attempts += 1
                if n.push_attempts >= MAX_PUSH_ATTEMPTS:
                    self._finish(n, PushStatus.FAILED, str(exc)[:200])
                    counts["failed"] += 1
            return counts

        ok: dict[str, bool] = {}
        errors: dict[str, str] = {}
        invalid: set[str] = set()
        for owner, ticket in zip(owners, tickets, strict=False):
            ok[owner.id] = ok.get(owner.id, False) or ticket.ok
            if not ticket.ok and ticket.error:
                errors.setdefault(owner.id, ticket.error)
            if ticket.token_invalid:
                invalid.add(ticket.token)

        for n in {o.id: o for o in owners}.values():
            n.push_attempts += 1
            if ok.get(n.id):
                self._finish(n, PushStatus.SENT)
                counts["sent"] += 1
            else:
                self._finish(n, PushStatus.FAILED, errors.get(n.id, "rejected")[:200])
                counts["failed"] += 1

        if invalid:
            # Uninstalled apps / stale tokens: stop sending to them.
            await self.db.execute(
                update(AuthSession).where(AuthSession.push_token.in_(invalid)).values(push_token=None)
            )
        logger.info("push_delivery", **counts, invalid_tokens=len(invalid))
        return counts

    @staticmethod
    def _finish(n: Notification, status: PushStatus, error: str | None = None) -> None:
        n.push_status = status.value
        n.push_error = error
        if status == PushStatus.SENT:
            n.pushed_at = datetime.now(timezone.utc)
