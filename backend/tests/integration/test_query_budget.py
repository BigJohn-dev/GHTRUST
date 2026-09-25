"""N+1 guard: list endpoints must run a constant number of SQL queries.

Each test measures an endpoint with one row, adds more rows, and measures again.
If a per-row lazy load or lookup creeps in, the second count grows and this fails.
"""

from decimal import Decimal

from sqlalchemy import event

from app.models.base import TransactionStatus
from app.modules.payments.models import PaymentDirection, PaymentProvider, PaymentTransaction
from app.modules.users.models import Customer, CustomerStatus
from tests.integration.test_loan_workflow_api import _customer_token, _seed


class QueryCounter:
    def __init__(self, engine):
        self.engine = engine.sync_engine
        self.count = 0

    def _hit(self, *_args, **_kwargs):
        self.count += 1

    async def measure(self, coro):
        self.count = 0
        event.listen(self.engine, "before_cursor_execute", self._hit)
        try:
            result = await coro
        finally:
            event.remove(self.engine, "before_cursor_execute", self._hit)
        return self.count, result


def _customer(i: int) -> Customer:
    return Customer(
        bvn=f"7{i:010d}",
        account_number=f"30{i:08d}",
        branch="Lagos Main",
        status=CustomerStatus.ACTIVE,
        first_name=f"FIRST{i}",
        last_name=f"LAST{i}",
        phone_primary=f"+23480{i:08d}",
        email=f"c{i}@example.com",
        phone_verified=True,
    )


async def test_customer_list_is_constant_queries(api_client, db_session, db_engine, admin_headers):
    counter = QueryCounter(db_engine)
    db_session.add(_customer(1))
    await db_session.commit()
    one, res = await counter.measure(api_client.get("/api/v1/admin/customers", headers=admin_headers))
    assert res.status_code == 200 and len(res.json()) == 1

    db_session.add_all([_customer(i) for i in range(2, 9)])
    await db_session.commit()
    many, res = await counter.measure(api_client.get("/api/v1/admin/customers", headers=admin_headers))
    assert len(res.json()) == 8
    assert many == one, f"{one} queries for 1 customer but {many} for 8 — N+1"


async def test_application_list_is_constant_queries(api_client, db_session, db_engine, admin_headers):
    await _seed(db_session)
    customer = {"Authorization": f"Bearer {await _customer_token(api_client)}"}
    products = ["business_loan", "payday_loan", "asset_loan", "study_loan"]
    counter = QueryCounter(db_engine)

    await api_client.post("/api/v1/loans/me/applications", json={"product_code": products[0]}, headers=customer)
    one, res = await counter.measure(api_client.get("/api/v1/admin/loans/applications", headers=admin_headers))
    assert len(res.json()) == 1

    for code in products[1:]:
        created = await api_client.post("/api/v1/loans/me/applications", json={"product_code": code}, headers=customer)
        assert created.status_code in (200, 201), created.text
    many, res = await counter.measure(api_client.get("/api/v1/admin/loans/applications", headers=admin_headers))
    assert len(res.json()) == len(products)
    assert many == one, f"{one} queries for 1 application but {many} for {len(products)} — N+1"


async def test_transactions_list_is_constant_queries(api_client, db_session, db_engine, admin_headers):
    customer = _customer(1)
    db_session.add(customer)
    await db_session.flush()

    def tx(i: int) -> PaymentTransaction:
        return PaymentTransaction(
            provider=PaymentProvider.MONNIFY,
            provider_reference=f"REF-{i}",
            direction=PaymentDirection.INBOUND,
            amount=Decimal("1000"),
            status=TransactionStatus.COMPLETED,
            customer_id=customer.id,
        )

    db_session.add(tx(0))
    await db_session.commit()
    counter = QueryCounter(db_engine)
    one, _ = await counter.measure(api_client.get("/api/v1/admin/payments/transactions", headers=admin_headers))

    db_session.add_all([tx(i) for i in range(1, 10)])
    await db_session.commit()
    many, res = await counter.measure(api_client.get("/api/v1/admin/payments/transactions", headers=admin_headers))
    assert res.json()["total"] == 10
    assert many == one, f"{one} queries for 1 transaction but {many} for 10 — N+1"
