"""
Sign-up never depends on the payment provider answering, and never leaves an orphaned or
duplicate provider account: the customer is saved first, the provider is asked second, an
account the provider already made is adopted, and the retry job finishes what's left.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select

from app.integrations.payments.schemas import PaymentRailError, ReservedAccountResult
from app.modules.payments.models import CustomerWallet, DvaStatus
from app.modules.users.models import Customer, CustomerStatus
from tests.conftest import TEST_BVN, refresh_settings
from tests.integration.test_device_security import _register

CREATE = "app.integrations.monnify.client.MonnifyClient.create_reserved_account"
LOOKUP = "app.integrations.monnify.client.MonnifyClient.get_reserved_account"


def _account(ref: str = "ghtrust_x", number: str = "5012345678") -> ReservedAccountResult:
    return ReservedAccountResult(
        account_reference=ref, account_number=number, account_name="GH Trust / Test", bank_name="Wema Bank"
    )


@pytest.fixture
def live_rail(monkeypatch):
    """Monnify 'live' (not mock), so provider failures matter; the calls themselves are patched."""
    monkeypatch.setenv("MONNIFY_MOCK", "false")
    refresh_settings()


async def _customer_and_wallet(db_session) -> tuple[Customer, CustomerWallet | None]:
    db_session.expire_all()
    customer = (await db_session.execute(select(Customer).where(Customer.bvn == TEST_BVN))).scalar_one()
    wallet = (
        await db_session.execute(select(CustomerWallet).where(CustomerWallet.customer_id == customer.id))
    ).scalar_one_or_none()
    return customer, wallet


async def _run_retry_job(db_session, monkeypatch):
    from app.modules.payments import worker_service

    class _SessionCtx:
        async def __aenter__(self):
            return db_session

        async def __aexit__(self, *exc):
            return False

    monkeypatch.setattr(worker_service, "worker_session", lambda: _SessionCtx())
    return await worker_service.run_retry_wallet_accounts()


async def _age_signup(db_session, customer: Customer) -> None:
    """The job leaves sign-ups younger than 5 minutes alone."""
    customer.phone_verified_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    await db_session.commit()


async def test_provider_down_does_not_block_signup(api_client, db_session, live_rail, monkeypatch):
    down = AsyncMock(side_effect=PaymentRailError("Monnify unavailable", status_code=502))
    with patch(CREATE, down), patch(LOOKUP, AsyncMock(side_effect=PaymentRailError("not found", status_code=404))):
        tokens = await _register(api_client)
    assert tokens["access_token"]

    customer, wallet = await _customer_and_wallet(db_session)
    assert customer.status == CustomerStatus.ACTIVE
    assert customer.paystack_dva_account_number is None
    assert wallet is not None and wallet.dva_status == DvaStatus.FAILED

    # The provider is back: the retry job gives the customer their account number.
    await _age_signup(db_session, customer)
    with patch(CREATE, AsyncMock(return_value=_account(f"ghtrust_{customer.id}"))):
        result = await _run_retry_job(db_session, monkeypatch)
    assert result["fixed"] == 1
    customer, wallet = await _customer_and_wallet(db_session)
    assert customer.paystack_dva_account_number == "5012345678"
    assert wallet.dva_status == DvaStatus.ACTIVE


async def test_crash_mid_provider_call_keeps_the_account(api_client, db_session, live_rail, monkeypatch):
    """Anything unexpected while talking to the provider: the customer is still saved and signed in."""
    with patch(CREATE, AsyncMock(side_effect=RuntimeError("connection reset"))):
        tokens = await _register(api_client)
    assert tokens["access_token"]
    customer, wallet = await _customer_and_wallet(db_session)
    assert customer.status == CustomerStatus.ACTIVE
    assert wallet is not None  # saved before the provider was called

    # The provider had in fact made the account before the crash: it's adopted, not duplicated.
    await _age_signup(db_session, customer)
    exists = AsyncMock(side_effect=PaymentRailError("An account with that reference already exists", status_code=422))
    with patch(CREATE, exists), patch(LOOKUP, AsyncMock(return_value=_account(f"ghtrust_{customer.id}", "5099990000"))):
        await _run_retry_job(db_session, monkeypatch)
    customer, wallet = await _customer_and_wallet(db_session)
    assert customer.paystack_dva_account_number == "5099990000"
    assert wallet.dva_status == DvaStatus.ACTIVE


async def test_existing_provider_account_is_adopted_at_signup(api_client, db_session, live_rail):
    exists = AsyncMock(side_effect=PaymentRailError("An account with that reference already exists", status_code=422))
    with patch(CREATE, exists), patch(LOOKUP, AsyncMock(return_value=_account(number="5011112222"))):
        await _register(api_client)
    customer, wallet = await _customer_and_wallet(db_session)
    assert customer.paystack_dva_account_number == "5011112222"
    assert wallet.dva_status == DvaStatus.ACTIVE


async def test_retry_job_leaves_fresh_signups_and_working_accounts_alone(api_client, db_session, monkeypatch):
    await _register(api_client)  # mock rail: account number given at once
    customer, _ = await _customer_and_wallet(db_session)
    assert customer.paystack_dva_account_number
    create = AsyncMock(side_effect=AssertionError("must not be called"))
    with patch(CREATE, create):
        result = await _run_retry_job(db_session, monkeypatch)
    assert result["checked"] == 0
