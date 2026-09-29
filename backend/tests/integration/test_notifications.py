"""Notifications: inbox, push tokens, delivery through the push service, and the events that queue them."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.integrations.push import PushError, PushMessage, PushTicket
from app.modules.auth.models import AuthSession
from app.modules.notifications.events import send_repayment_reminders
from app.modules.notifications.models import Notification, PushStatus
from app.modules.notifications.service import NotificationService
from tests.integration.test_device_security import PHONE_A, PHONE_B, _auth, _otp_login, _register, _set_pin
from tests.integration.test_wallet_history import _fund

TOKEN_A = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]"
TOKEN_B = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]"


class FakeSender:
    def __init__(self, errors: dict[str, str] | None = None, down: bool = False):
        self.sent: list[PushMessage] = []
        self.errors = errors or {}
        self.down = down

    async def send(self, messages: list[PushMessage]) -> list[PushTicket]:
        if self.down:
            raise PushError("unreachable")
        self.sent += messages
        return [
            PushTicket(token=m.to, ok=m.to not in self.errors, error=self.errors.get(m.to)) for m in messages
        ]


async def _put_token(api_client, tokens, token):
    return await api_client.put("/api/v1/notifications/push-token", json={"token": token}, headers=_auth(tokens))


class TestPushTokens:
    async def test_rejects_non_expo_tokens(self, api_client):
        tokens = await _register(api_client)
        res = await _put_token(api_client, tokens, "not-a-push-token-at-all")
        assert res.status_code == 422

    async def test_token_follows_the_phone_not_the_old_session(self, api_client, db_session):
        first = await _register(api_client)
        assert (await _put_token(api_client, first, TOKEN_A)).status_code == 204
        # Same phone signs in again (new session): the old session must stop getting its pushes.
        await _set_pin(api_client, first)
        again = await _otp_login(api_client, PHONE_A)
        assert (await _put_token(api_client, again, TOKEN_A)).status_code == 204
        holders = (await db_session.execute(select(AuthSession.id).where(AuthSession.push_token == TOKEN_A))).all()
        assert len(holders) == 1

        removed = await api_client.delete("/api/v1/notifications/push-token", headers=_auth(again))
        assert removed.status_code == 204
        assert await db_session.scalar(select(AuthSession.id).where(AuthSession.push_token == TOKEN_A)) is None


class TestInbox:
    async def test_money_in_shows_up_and_can_be_read(self, api_client, db_session):
        tokens = await _register(api_client)
        customer_id = tokens["customer"]["id"]
        await _fund(db_session, customer_id, "12500")
        await _fund(db_session, customer_id, "300")

        page = (await api_client.get("/api/v1/notifications", headers=_auth(tokens))).json()
        assert page["total"] == 2 and page["unread_count"] == 2
        latest = page["items"][0]
        assert latest["kind"] == "wallet_funded" and latest["read"] is False
        assert latest["route"].startswith("/transactions/j_")
        assert {i["body"] for i in page["items"]} == {
            "₦12,500 has been added to your wallet.",
            "₦300 has been added to your wallet.",
        }

        one = await api_client.post(
            "/api/v1/notifications/read", json={"ids": [latest["id"]]}, headers=_auth(tokens)
        )
        assert one.json() == {"unread_count": 1}
        everything = await api_client.post("/api/v1/notifications/read", json={}, headers=_auth(tokens))
        assert everything.json() == {"unread_count": 0}
        count = await api_client.get("/api/v1/notifications/unread-count", headers=_auth(tokens))
        assert count.json() == {"unread_count": 0}

    async def test_sign_in_on_a_new_phone_alerts_the_trusted_one(self, api_client, db_session):
        first = await _register(api_client, PHONE_A)
        await _set_pin(api_client, first)
        started = await _otp_login(api_client, PHONE_B)
        assert started["status"] == "approval_required"
        note = (await db_session.execute(select(Notification))).scalar_one()
        assert note.kind == "sign_in_request"
        assert note.route == f"/approve-device/{started['approval_id']}"
        assert PHONE_B["device_name"] in note.body


class TestDelivery:
    async def test_pushes_to_every_signed_in_phone_once(self, api_client, db_session):
        tokens = await _register(api_client)
        await _put_token(api_client, tokens, TOKEN_A)
        await _fund(db_session, tokens["customer"]["id"])

        sender = FakeSender()
        counts = await NotificationService(db_session).deliver_pending(sender)
        await db_session.commit()
        assert counts == {"sent": 1, "skipped": 0, "failed": 0}
        assert [m.to for m in sender.sent] == [TOKEN_A]
        assert sender.sent[0].title == "Money received"
        assert sender.sent[0].data["url"].startswith("/transactions/j_")

        # Nothing left to send on the next run.
        assert await NotificationService(db_session).deliver_pending(FakeSender()) == {
            "sent": 0,
            "skipped": 0,
            "failed": 0,
        }

    async def test_no_phone_means_inbox_only(self, api_client, db_session):
        tokens = await _register(api_client)
        await _fund(db_session, tokens["customer"]["id"])
        counts = await NotificationService(db_session).deliver_pending(FakeSender())
        assert counts["skipped"] == 1
        note = (await db_session.execute(select(Notification))).scalar_one()
        assert note.push_status == PushStatus.SKIPPED.value and note.push_error == "no_device"

    async def test_signed_out_phone_gets_nothing(self, api_client, db_session):
        tokens = await _register(api_client)
        await _put_token(api_client, tokens, TOKEN_A)
        session = (await db_session.execute(select(AuthSession))).scalar_one()
        session.revoked_at = datetime.now(timezone.utc)
        await db_session.commit()
        await _fund(db_session, tokens["customer"]["id"])
        sender = FakeSender()
        await NotificationService(db_session).deliver_pending(sender)
        assert sender.sent == []

    async def test_uninstalled_app_token_is_forgotten(self, api_client, db_session):
        tokens = await _register(api_client)
        await _put_token(api_client, tokens, TOKEN_A)
        await _fund(db_session, tokens["customer"]["id"])
        counts = await NotificationService(db_session).deliver_pending(
            FakeSender(errors={TOKEN_A: "DeviceNotRegistered"})
        )
        await db_session.commit()
        assert counts["failed"] == 1
        assert await db_session.scalar(select(AuthSession.push_token)) is None

    async def test_outage_retries_then_gives_up(self, api_client, db_session):
        tokens = await _register(api_client)
        await _put_token(api_client, tokens, TOKEN_A)
        await _fund(db_session, tokens["customer"]["id"])
        service = NotificationService(db_session)
        for _ in range(4):
            await service.deliver_pending(FakeSender(down=True))
        note = (await db_session.execute(select(Notification))).scalar_one()
        assert note.push_status == PushStatus.PENDING.value and note.push_attempts == 4
        await service.deliver_pending(FakeSender(down=True))
        assert note.push_status == PushStatus.FAILED.value

    async def test_stale_notifications_are_not_pushed(self, api_client, db_session):
        tokens = await _register(api_client)
        await _put_token(api_client, tokens, TOKEN_A)
        await _fund(db_session, tokens["customer"]["id"])
        note = (await db_session.execute(select(Notification))).scalar_one()
        note.created_at = datetime.now(timezone.utc) - timedelta(days=2)
        await db_session.commit()
        sender = FakeSender()
        await NotificationService(db_session).deliver_pending(sender)
        assert sender.sent == [] and note.push_error == "expired"


@pytest.fixture
async def loan(api_client, db_session, admin_headers):
    from tests.integration.test_disbursement_lifecycle import booked_loan

    return await booked_loan(api_client, db_session, admin_headers)


class TestLoanNotifications:
    async def test_payout_is_announced(self, db_session, loan):
        note = (
            await db_session.execute(select(Notification).where(Notification.kind == "loan_disbursed"))
        ).scalar_one()
        assert note.customer_id == loan.customer_id and note.route == f"/loans/{loan.id}"

    async def test_reminders_before_on_and_after_the_due_date(self, db_session, loan):
        await db_session.refresh(loan, ["schedule"])
        first = min(loan.schedule, key=lambda line: line.installment)
        due = first.due_date

        async def kinds_after(day):
            await send_repayment_reminders(db_session, day)
            await db_session.flush()
            rows = await db_session.execute(
                select(Notification.kind, Notification.title).where(Notification.kind.like("repayment_%"))
            )
            return rows.all()

        assert await kinds_after(due - timedelta(days=4)) == []
        assert await kinds_after(due - timedelta(days=3)) == [("repayment_due", "Repayment due in 3 days")]
        # Running again the same day doesn't repeat it.
        assert len(await kinds_after(due - timedelta(days=3))) == 1
        assert ("repayment_due", "Repayment due today") in await kinds_after(due)
        assert ("repayment_overdue", "Repayment overdue") in await kinds_after(due + timedelta(days=1))
        # Day 2 overdue is quiet; day 3 reminds again.
        assert len(await kinds_after(due + timedelta(days=2))) == 3
        assert len(await kinds_after(due + timedelta(days=3))) == 4

    async def test_repayment_recorded_by_staff_is_confirmed(self, api_client, db_session, admin_headers, loan):
        res = await api_client.post(
            f"/api/v1/admin/loans/loans/{loan.id}/repayments",
            json={"amount": "50000.00", "channel": "cash", "reference": "NOTIFY-1"},
            headers=admin_headers,
        )
        assert res.status_code == 201, res.text
        note = (
            await db_session.execute(select(Notification).where(Notification.kind == "repayment_received"))
        ).scalar_one()
        assert note.body.startswith("₦50,000 was applied to your")

    async def test_amounts_keep_kobo(self):
        from app.modules.notifications.events import naira

        assert naira(Decimal("1500")) == "₦1,500"
        assert naira(Decimal("1500.5")) == "₦1,500.50"
