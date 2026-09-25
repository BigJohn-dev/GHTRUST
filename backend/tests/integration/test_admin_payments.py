"""Staff payment-transaction views and application tenure in the detail response."""

from decimal import Decimal

from app.models.base import TransactionStatus
from app.modules.payments.models import PaymentDirection, PaymentProvider, PaymentTransaction
from tests.integration.test_disbursement_lifecycle import approved_application
from tests.integration.test_payments_api import active_customer  # noqa: F401


async def _add_tx(db, customer_id, ref, direction, status, amount):
    db.add(
        PaymentTransaction(
            provider=PaymentProvider.MONNIFY,
            provider_reference=ref,
            direction=direction,
            amount=Decimal(amount),
            status=status,
            customer_id=customer_id,
        )
    )
    await db.flush()


async def test_transactions_list_filters_and_summary(api_client, db_session, admin_headers, active_customer):  # noqa: F811
    await _add_tx(db_session, active_customer.id, "IN-1", PaymentDirection.INBOUND, TransactionStatus.COMPLETED, "5000")
    await _add_tx(db_session, active_customer.id, "OUT-1", PaymentDirection.OUTBOUND, TransactionStatus.PENDING, "2000")
    await _add_tx(db_session, active_customer.id, "OUT-2", PaymentDirection.OUTBOUND, TransactionStatus.COMPLETED, "1500")
    await db_session.commit()

    page = (await api_client.get("/api/v1/admin/payments/transactions", headers=admin_headers)).json()
    assert page["total"] == 3
    assert page["items"][0]["customer_name"] == "ADAEZE OKAFOR"

    pending = (
        await api_client.get("/api/v1/admin/payments/transactions", params={"status": "pending"}, headers=admin_headers)
    ).json()
    assert [t["provider_reference"] for t in pending["items"]] == ["OUT-1"]

    summary = (await api_client.get("/api/v1/admin/payments/transactions/summary", headers=admin_headers)).json()
    assert summary["total"] == 3
    assert summary["by_status"] == {"completed": 2, "pending": 1}
    assert Decimal(summary["completed_inbound_amount"]) == Decimal("5000")
    assert Decimal(summary["completed_outbound_amount"]) == Decimal("1500")


async def test_transactions_require_permission(api_client):
    res = await api_client.get("/api/v1/admin/payments/transactions")
    assert res.status_code == 401


async def test_payment_permission_in_catalog(api_client, admin_headers):
    groups = (await api_client.get("/api/v1/admin/permissions", headers=admin_headers)).json()["groups"]
    assert {"label": "Payments", "permissions": ["payment:read"]} in groups


async def test_application_detail_reports_tenure(api_client, db_session, admin_headers):
    app_id = await approved_application(api_client, db_session, admin_headers)
    detail = (await api_client.get(f"/api/v1/admin/loans/applications/{app_id}", headers=admin_headers)).json()
    assert detail["tenure_months"] == 6
    assert detail["approved_tenure_months"] is None

    await api_client.patch(
        f"/api/v1/admin/loans/applications/{app_id}/status", json={"tenure_months": 4}, headers=admin_headers
    )
    detail = (await api_client.get(f"/api/v1/admin/loans/applications/{app_id}", headers=admin_headers)).json()
    assert detail["tenure_months"] == 4
    assert detail["approved_tenure_months"] == 4


async def test_dashboard_money_comes_from_loan_book(api_client, db_session, admin_headers):
    """Regression: total disbursed read ₦0 when disbursed at the requested amount
    (approved_amount null), and 'loan book' ignored repayments."""
    from tests.integration.test_disbursement_lifecycle import booked_loan

    loan = await booked_loan(api_client, db_session, admin_headers)  # 500,000 requested, no approved_amount
    d = (await api_client.get("/api/v1/admin/dashboard", headers=admin_headers)).json()
    assert d["total_disbursed_amount"] == 500000
    assert d["loan_book_amount"] == 500000

    # 50,000 → 40,000 interest + 10,000 principal (installment 1, interest first)
    await api_client.post(
        f"/api/v1/admin/loans/loans/{loan.id}/repayments",
        json={"amount": "50000.00", "channel": "cash", "reference": "DASH-1"},
        headers=admin_headers,
    )
    d = (await api_client.get("/api/v1/admin/dashboard", headers=admin_headers)).json()
    assert d["total_disbursed_amount"] == 500000
    assert d["loan_book_amount"] == 490000  # principal still outstanding
