"""Mocked payment rails give each customer their own wallet account number."""

from app.integrations.payments.mock_accounts import mock_account_number
from app.modules.payments.wallet_service import WalletService
from app.modules.users.models import Customer, CustomerStatus


def test_stable_per_reference_and_distinct_across_references():
    a = mock_account_number("ghtrust_customer-a", "50")
    assert a == mock_account_number("ghtrust_customer-a", "50")
    assert len(a) == 10 and a.isdigit() and a.startswith("50")
    numbers = {mock_account_number(f"ghtrust_{i}", "50") for i in range(2000)}
    assert len(numbers) == 2000


async def test_two_customers_get_different_wallet_accounts(db_session):
    # Regression: every mocked customer used to get 5000112233, so the second
    # provisioning hit the unique constraint on the wallet account number.
    accounts = []
    for i, (bvn, phone) in enumerate([("22200000001", "08011110001"), ("22200000002", "08011110002")]):
        customer = Customer(
            bvn=bvn,
            account_number=f"300000000{i}",
            branch="Lagos Main",
            status=CustomerStatus.ACTIVE,
            first_name="Test",
            last_name=f"Customer{i}",
            phone_primary=Customer.normalize_phone(phone),
            phone_verified=True,
        )
        db_session.add(customer)
        await db_session.flush()
        await WalletService(db_session).provision_paystack(customer)
        accounts.append(customer.paystack_dva_account_number)
    await db_session.commit()

    assert all(accounts)
    assert accounts[0] != accounts[1]
