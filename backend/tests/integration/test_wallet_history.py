"""Wallet history (money in and out), the saved payout account, and withdrawal errors."""

from decimal import Decimal

from sqlalchemy import select

from app.models.base import TransactionStatus
from app.modules.payments.ledger_service import LedgerService
from app.modules.payments.models import (
    PaymentDirection,
    PaymentProvider,
    PaymentTransaction,
    WithdrawalRequest,
    WithdrawalStatus,
)
from app.modules.users.models import Customer, CustomerStatus
from tests.conftest import TEST_BVN, TEST_OTP, TEST_TXN_PIN, set_transaction_pin

_refs = iter(range(10**6))


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _customer(api_client) -> tuple[str, dict]:
    await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
    res = await api_client.post("/api/v1/auth/register/verify-otp", json={"bvn": TEST_BVN, "otp": TEST_OTP})
    assert res.status_code == 200, res.text
    body = res.json()
    headers = _auth(body["access_token"])
    await set_transaction_pin(api_client, headers)
    return body["customer"]["id"], headers


async def _fund(db_session, customer_id: str, amount: str = "10000") -> None:
    ref = f"F-HIST-{next(_refs)}"
    funding = PaymentTransaction(
        provider=PaymentProvider.MONNIFY,
        provider_reference=ref,
        direction=PaymentDirection.INBOUND,
        amount=Decimal(amount),
        status=TransactionStatus.COMPLETED,
        customer_id=customer_id,
    )
    db_session.add(funding)
    await db_session.flush()
    await LedgerService(db_session).credit_wallet_from_paystack(
        customer_id=customer_id,
        amount=Decimal(amount),
        idempotency_key=f"wf:{ref}",
        reference=ref,
        payment_transaction=funding,
    )
    await db_session.commit()


async def _save_payout(api_client, headers):
    return await api_client.post(
        "/api/v1/wallet/payout-account",
        json={
            "bank_code": "058",
            "bank_name": "GTBank",
            "account_number": "0123456789",
            "account_name": "Ada Okafor",
            "transaction_pin": TEST_TXN_PIN,
        },
        headers=headers,
    )


async def _withdraw(api_client, headers, amount: str = "1500"):
    return await api_client.post(
        "/api/v1/wallet/withdraw",
        json={"amount": amount, "transaction_pin": TEST_TXN_PIN},
        headers={**headers, "Idempotency-Key": f"withdraw-hist-{next(_refs):06d}"},
    )


class TestPayoutAccount:
    async def test_summary_shows_saved_account_masked(self, api_client):
        _, headers = await _customer(api_client)
        before = (await api_client.get("/api/v1/wallet", headers=headers)).json()
        assert before["payout_account"] is None
        assert before["withdrawals_blocked_until"] is None

        saved = await _save_payout(api_client, headers)
        assert saved.status_code == 200, saved.text
        assert saved.json()["payout_account"]["account_number_masked"] == "******6789"

        after = (await api_client.get("/api/v1/wallet", headers=headers)).json()
        assert after["payout_account"] == {
            "bank_code": "058",
            "bank_name": "GTBank",
            "account_name": saved.json()["account_name"],
            "account_number_masked": "******6789",
        }


class TestWithdrawErrors:
    async def test_needs_payout_account(self, api_client, db_session):
        customer_id, headers = await _customer(api_client)
        await _fund(db_session, customer_id)
        res = await _withdraw(api_client, headers)
        assert res.status_code == 409
        assert res.json()["code"] == "PAYOUT_ACCOUNT_REQUIRED"

    async def test_more_than_balance(self, api_client, db_session):
        customer_id, headers = await _customer(api_client)
        await _save_payout(api_client, headers)
        await _fund(db_session, customer_id, "1000")
        res = await _withdraw(api_client, headers, "5000")
        assert res.status_code == 409
        assert res.json()["code"] == "INSUFFICIENT_FUNDS"


class TestHistory:
    async def test_new_customer_has_none(self, api_client):
        _, headers = await _customer(api_client)
        res = await api_client.get("/api/v1/wallet/transactions", headers=headers)
        assert res.status_code == 200, res.text
        assert res.json() == {"items": [], "next_cursor": None}

    async def test_money_in_and_out_with_filters_and_receipt(self, api_client, db_session):
        customer_id, headers = await _customer(api_client)
        await _save_payout(api_client, headers)
        await _fund(db_session, customer_id, "10000")
        withdrawn = await _withdraw(api_client, headers, "1500")
        assert withdrawn.status_code == 200, withdrawn.text

        items = (await api_client.get("/api/v1/wallet/transactions", headers=headers)).json()["items"]
        kinds = {i["kind"]: i for i in items}
        assert set(kinds) == {"funding", "withdrawal"}
        funding, withdrawal = kinds["funding"], kinds["withdrawal"]
        assert funding["direction"] == "in" and funding["amount"] == 10000 and funding["status"] == "completed"
        assert withdrawal["direction"] == "out" and withdrawal["amount"] == 1500
        assert withdrawal["status"] == "pending"
        assert withdrawal["detail"] == "GTBank · ******6789"
        # The hold on the withdrawn money isn't a separate row.
        assert len(items) == 2

        only_in = (await api_client.get("/api/v1/wallet/transactions?direction=in", headers=headers)).json()
        assert [i["kind"] for i in only_in["items"]] == ["funding"]
        only_out = (await api_client.get("/api/v1/wallet/transactions?direction=out", headers=headers)).json()
        assert [i["kind"] for i in only_out["items"]] == ["withdrawal"]

        for item in items:
            receipt = await api_client.get(f"/api/v1/wallet/transactions/{item['id']}", headers=headers)
            assert receipt.status_code == 200, receipt.text
            assert receipt.json() == item

    async def test_failed_withdrawal_explains_money_is_back(self, api_client, db_session):
        customer_id, headers = await _customer(api_client)
        await _save_payout(api_client, headers)
        await _fund(db_session, customer_id)
        await _withdraw(api_client, headers)
        withdrawal = (await db_session.execute(select(WithdrawalRequest))).scalar_one()
        withdrawal.status = WithdrawalStatus.FAILED
        await db_session.commit()

        out = (await api_client.get("/api/v1/wallet/transactions?direction=out", headers=headers)).json()["items"]
        assert out[0]["status"] == "failed"
        assert "back in your wallet" in out[0]["note"]

    async def test_pages_follow_the_cursor_without_repeats(self, api_client, db_session):
        customer_id, headers = await _customer(api_client)
        await _save_payout(api_client, headers)
        for _ in range(4):
            await _fund(db_session, customer_id, "2000")
        await _withdraw(api_client, headers, "500")
        await _withdraw(api_client, headers, "700")

        seen: list[str] = []
        cursor = None
        for _ in range(10):
            url = "/api/v1/wallet/transactions?limit=2" + (f"&cursor={cursor}" if cursor else "")
            page = (await api_client.get(url, headers=headers)).json()
            assert len(page["items"]) <= 2
            seen += [i["id"] for i in page["items"]]
            cursor = page["next_cursor"]
            if not cursor:
                break
        assert len(seen) == 6
        assert len(set(seen)) == 6

    async def test_bad_cursor_is_rejected(self, api_client):
        _, headers = await _customer(api_client)
        res = await api_client.get("/api/v1/wallet/transactions?cursor=bm9wZQ", headers=headers)
        assert res.status_code == 422

    async def test_other_customers_transactions_are_hidden(self, api_client, db_session):
        _, headers = await _customer(api_client)
        other = Customer(
            bvn="55555555555",
            account_number="3099999999",
            branch="Lagos Main",
            status=CustomerStatus.ACTIVE,
            first_name="OTHER",
            last_name="PERSON",
            phone_primary="+2348000000001",
            phone_verified=True,
        )
        db_session.add(other)
        await db_session.flush()
        await _fund(db_session, other.id)
        journal_id = (
            await api_client.get("/api/v1/wallet/transactions", headers=headers)
        ).json()["items"]
        assert journal_id == []

        from app.modules.payments.models import LedgerJournal

        theirs = (await db_session.execute(select(LedgerJournal.id))).scalars().first()
        res = await api_client.get(f"/api/v1/wallet/transactions/j_{theirs}", headers=headers)
        assert res.status_code == 404
        assert res.json()["code"] == "NOT_FOUND"
