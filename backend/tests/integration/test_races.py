"""
Check-then-insert races on idempotency keys.

Simulated deterministically: the "does it exist?" pre-check is forced to miss a
row that another request has already committed, which is exactly what happens
when two requests interleave. Both paths must resolve to the existing row
rather than blowing up the transaction.
"""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select

from app.modules.payments.ledger_service import LedgerService
from app.modules.payments.models import (
    JournalType,
    LedgerAccountCode,
    LedgerDirection,
    LedgerEntry,
    LedgerJournal,
    ProcessedWebhookEvent,
)
from app.modules.payments.webhook_service import WebhookService

ENTRIES = [
    (LedgerAccountCode.PAYSTACK_SETTLEMENT, LedgerDirection.DEBIT, Decimal("100")),
    (LedgerAccountCode.CUSTOMER_WALLET, LedgerDirection.CREDIT, Decimal("100")),
]


async def test_concurrent_journal_with_same_key_returns_winner(db_session, monkeypatch):
    ledger = LedgerService(db_session)
    winner, created = await ledger.post_journal(
        idempotency_key="race-key", journal_type=JournalType.WALLET_FUNDING, entries=ENTRIES
    )
    assert created
    await db_session.commit()

    calls = {"n": 0}
    real_lookup = LedgerService._get_journal_by_idempotency

    async def stale_first_lookup(self, key):
        calls["n"] += 1
        if calls["n"] == 1:
            return None  # the losing request's check ran before the winner committed
        return await real_lookup(self, key)

    monkeypatch.setattr(LedgerService, "_get_journal_by_idempotency", stale_first_lookup)
    journal, created = await ledger.post_journal(
        idempotency_key="race-key", journal_type=JournalType.WALLET_FUNDING, entries=ENTRIES
    )
    assert created is False
    assert journal.id == winner.id
    # The session is still usable and nothing was double-posted.
    assert await db_session.scalar(select(func.count()).select_from(LedgerJournal)) == 1
    assert await db_session.scalar(select(func.count()).select_from(LedgerEntry)) == 2


async def test_concurrent_webhook_claim_is_treated_as_duplicate(db_session, monkeypatch):
    data = {"reference": "EVT-RACE-1"}
    db_session.add(
        ProcessedWebhookEvent(
            event_key="monnify:SUCCESSFUL_TRANSACTION:EVT-RACE-1",
            event_type="SUCCESSFUL_TRANSACTION",
            provider="monnify",
            processed_at=datetime.now(timezone.utc),
        )
    )
    await db_session.commit()

    service = WebhookService(db_session)
    real_execute = db_session.execute
    calls = {"n": 0}

    async def execute_missing_first_check(stmt, *args, **kwargs):
        result = await real_execute(stmt, *args, **kwargs)
        if calls["n"] == 0 and "processed_webhook_events" in str(stmt):
            calls["n"] += 1

            class _Empty:
                def scalar_one_or_none(self):
                    return None

            return _Empty()
        return result

    monkeypatch.setattr(db_session, "execute", execute_missing_first_check)
    claimed = await service._claim_event("monnify", "SUCCESSFUL_TRANSACTION", data, b"{}")
    assert claimed is False
    monkeypatch.undo()
    assert await db_session.scalar(select(func.count()).select_from(ProcessedWebhookEvent)) == 1


async def test_claim_records_actual_provider(db_session):
    await WebhookService(db_session)._claim_event("stanbic", "payment.success", {"reference": "S-1"}, b"{}")
    event = (await db_session.execute(select(ProcessedWebhookEvent))).scalar_one()
    assert event.provider == "stanbic"  # previously always "paystack"
