"""
Stanbic Fundable Virtual ID: customer account numbers from our prefix, and wallet top-ups
credited from Stanbic's payment history only after Stanbic confirms each record's checksum.
"""

from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.integrations.payments.schemas import PaymentRailError
from app.modules.payments.models import CustomerWallet, DvaStatus, PaymentTransaction, StanbicVirtualAccount
from app.modules.payments.stanbic_fvid import StanbicVirtualAccounts
from app.modules.users.models import Customer
from tests.conftest import TEST_BVN, refresh_settings
from tests.integration.test_device_security import _register

PORTAL = "app.integrations.stanbic.portal_sandbox"


def _nuban(base9: str, request_id: str) -> str:
    return base9 + "7"  # stand-in for Stanbic's check digit


@pytest.fixture
def stanbic_rail(monkeypatch):
    monkeypatch.setenv("PAYMENT_PROVIDER", "stanbic")
    monkeypatch.setenv("STANBIC_MOCK", "false")
    monkeypatch.setenv("STANBIC_CLIENT_ID", "id")
    monkeypatch.setenv("STANBIC_CLIENT_SECRET", "secret")
    monkeypatch.setenv("STANBIC_WEBHOOK_SECRET", "whsec")
    monkeypatch.setenv("STANBIC_FVID_PREFIX", "5151")
    refresh_settings()


async def _customer(db_session) -> Customer:
    db_session.expire_all()
    return (await db_session.execute(select(Customer).where(Customer.bvn == TEST_BVN))).scalar_one()


async def _balance(db_session, customer_id: str) -> Decimal:
    wallet = (
        await db_session.execute(select(CustomerWallet).where(CustomerWallet.customer_id == customer_id))
    ).scalar_one()
    await db_session.refresh(wallet)
    return wallet.available_balance


def _record(account: str, amount="5000.00", session="000000000311151102464310031429", checksum="CS1"):
    return {
        "id": 1,
        "tranDate": "15-OCT-2026",
        "amount": amount,
        "customerAcct": account,
        "sourceAcctName": "ADA OBI",
        "sourceAcctNumber": "0123456789",
        "sourceBankCode": "000015",
        "clientNotificationReqId": "5232-27938",
        "clientNotificationStatus": "PENDING",
        "checksum": checksum,
        "sessionId": session,
    }


def _history(*records):
    """Records from other banks; none Stanbic-to-Stanbic."""

    async def history(prefix, start, end, *, stanbic_to_stanbic):
        assert prefix == "5151"
        return [] if stanbic_to_stanbic else list(records)

    return history


def _valid(account, amount="5000.00"):
    return AsyncMock(return_value={"isValid": "True", "customerAcct": account, "amount": amount})


async def test_signup_gives_a_stanbic_account_number(api_client, db_session, stanbic_rail):
    with patch(f"{PORTAL}.nuban_check_digit", AsyncMock(side_effect=_nuban)):
        await _register(api_client)
    customer = await _customer(db_session)
    assert customer.paystack_dva_account_number == "5151000017"
    assert customer.paystack_dva_bank_name == "Stanbic IBTC Bank"
    va = (await db_session.execute(select(StanbicVirtualAccount))).scalar_one()
    assert (va.prefix, va.serial, va.customer_id) == ("5151", 1, customer.id)
    wallet = (await db_session.execute(select(CustomerWallet))).scalar_one()
    assert wallet.dva_status == DvaStatus.ACTIVE


async def test_numbers_are_sequential_and_reused(db_session, stanbic_rail):
    from types import SimpleNamespace
    from uuid import uuid4

    service = StanbicVirtualAccounts(db_session)
    first = SimpleNamespace(id=str(uuid4()), full_name="Ada Obi")
    second = SimpleNamespace(id=str(uuid4()), full_name="Bola Ade")
    generator = AsyncMock(side_effect=_nuban)
    with patch(f"{PORTAL}.nuban_check_digit", generator):
        a = await service.assign(first)
        b = await service.assign(second)
        again = await service.assign(first)
    assert (a.account_number, b.account_number) == ("5151000017", "5151000027")
    assert again.account_number == a.account_number
    assert generator.await_count == 2  # the repeat didn't ask Stanbic again


async def test_payment_is_credited_once_after_stanbic_confirms_it(api_client, db_session, stanbic_rail):
    with patch(f"{PORTAL}.nuban_check_digit", AsyncMock(side_effect=_nuban)):
        await _register(api_client)
    customer = await _customer(db_session)
    account = customer.paystack_dva_account_number
    service = StanbicVirtualAccounts(db_session)

    with patch(f"{PORTAL}.history_by_prefix", _history(_record(account))), patch(
        f"{PORTAL}.validate_checksum", _valid(account)
    ):
        first = await service.credit_new_payments()
        again = await service.credit_new_payments()
    await db_session.commit()
    assert first["credited"] == 1 and again["already"] == 1
    assert await _balance(db_session, customer.id) == Decimal("5000.00")
    tx = (await db_session.execute(select(PaymentTransaction))).scalar_one()
    assert tx.provider_reference == "000000000311151102464310031429" and "checksum" not in tx.raw_payload


@pytest.mark.parametrize(
    ("validator", "outcome"),
    [
        (AsyncMock(side_effect=PaymentRailError("Checksum invalid", status_code=502, provider_code="99")), "rejected"),
        ("wrong_amount", "rejected"),
        ("not_valid", "rejected"),
        (AsyncMock(side_effect=PaymentRailError("Stanbic unavailable", status_code=502)), "deferred"),
    ],
)
async def test_unconfirmed_payments_are_not_credited(api_client, db_session, stanbic_rail, validator, outcome):
    with patch(f"{PORTAL}.nuban_check_digit", AsyncMock(side_effect=_nuban)):
        await _register(api_client)
    customer = await _customer(db_session)
    account = customer.paystack_dva_account_number
    if validator == "wrong_amount":
        validator = _valid(account, amount="50000.00")  # a forged record claiming 5,000
    elif validator == "not_valid":
        validator = AsyncMock(return_value={"isValid": "False", "customerAcct": account, "amount": "5000.00"})

    with patch(f"{PORTAL}.history_by_prefix", _history(_record(account))), patch(
        f"{PORTAL}.validate_checksum", validator
    ):
        counts = await StanbicVirtualAccounts(db_session).credit_new_payments()
    await db_session.commit()
    assert counts[outcome] == 1 and counts["credited"] == 0
    assert await _balance(db_session, customer.id) == Decimal("0")

    if outcome == "deferred":  # Stanbic is back: the next poll credits it
        with patch(f"{PORTAL}.history_by_prefix", _history(_record(account))), patch(
            f"{PORTAL}.validate_checksum", _valid(account)
        ):
            assert (await StanbicVirtualAccounts(db_session).credit_new_payments())["credited"] == 1
        await db_session.commit()
        assert await _balance(db_session, customer.id) == Decimal("5000.00")


async def test_payment_to_an_unknown_number_is_not_credited(api_client, db_session, stanbic_rail):
    with patch(f"{PORTAL}.history_by_prefix", _history(_record("5151999997"))), patch(
        f"{PORTAL}.validate_checksum", _valid("5151999997")
    ):
        counts = await StanbicVirtualAccounts(db_session).credit_new_payments()
    assert counts["unmatched"] == 1
    assert (await db_session.execute(select(PaymentTransaction))).scalar_one_or_none() is None


async def test_off_unless_stanbic_is_live_with_a_prefix(monkeypatch):
    from app.modules.payments import stanbic_fvid

    monkeypatch.setenv("PAYMENT_PROVIDER", "stanbic")
    monkeypatch.setenv("STANBIC_MOCK", "true")
    monkeypatch.setenv("STANBIC_FVID_PREFIX", "5151")
    refresh_settings()
    assert not stanbic_fvid.enabled()  # mock mode
    monkeypatch.setenv("STANBIC_MOCK", "false")
    monkeypatch.setenv("STANBIC_CLIENT_ID", "id")
    monkeypatch.setenv("STANBIC_CLIENT_SECRET", "secret")
    monkeypatch.setenv("STANBIC_FVID_PREFIX", "")
    refresh_settings()
    assert not stanbic_fvid.enabled()  # no prefix
    monkeypatch.setenv("STANBIC_FVID_PREFIX", "5151")
    refresh_settings()
    assert stanbic_fvid.enabled()
