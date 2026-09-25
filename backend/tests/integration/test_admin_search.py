"""Server-side search, totals and audit-noise control on staff list endpoints."""

import pytest

from app.modules.users.models import Customer, CustomerStatus
from tests.integration.test_disbursement_lifecycle import approved_application, booked_loan
from tests.integration.test_payments_api import active_customer  # noqa: F401


@pytest.fixture
async def other_customer(db_session) -> Customer:
    customer = Customer(
        bvn="55555555555",
        account_number="3099999999",
        branch="Akure Central",
        status=CustomerStatus.ACTIVE,
        first_name="TUNDE",
        last_name="BAKARE",
        phone_primary="+2348091112222",
        email="tunde@email.com",
        phone_verified=True,
    )
    db_session.add(customer)
    await db_session.flush()
    return customer


async def _names(api_client, admin_headers, **params):
    res = await api_client.get("/api/v1/admin/customers", params=params, headers=admin_headers)
    assert res.status_code == 200, res.text
    return [c["full_name"] for c in res.json()], res.headers.get("x-total-count")


async def test_customer_search_matches_full_name_phone_formats_and_exact_bvn(
    api_client, db_session, admin_headers, active_customer, other_customer  # noqa: F811
):
    await db_session.commit()

    names, total = await _names(api_client, admin_headers)
    assert total == "2" and len(names) == 2

    # Words matched across first/last name.
    assert (await _names(api_client, admin_headers, search="adaeze okafor"))[0] == ["ADAEZE OKAFOR"]
    # Phone typed locally, internationally or with spaces.
    for q in ("08035794364", "2348035794364", "+234 803 579 4364", "0803 579"):
        assert (await _names(api_client, admin_headers, search=q))[0] == ["ADAEZE OKAFOR"], q
    # Account number.
    assert (await _names(api_client, admin_headers, search="3099999"))[0] == ["TUNDE BAKARE"]
    # BVN: exact match only — no substring probing.
    assert (await _names(api_client, admin_headers, search="55555555555"))[0] == ["TUNDE BAKARE"]
    assert (await _names(api_client, admin_headers, search="5555555"))[0] == []
    # Wildcards are literal.
    assert (await _names(api_client, admin_headers, search="%"))[0] == []
    # Total follows the filter.
    assert (await _names(api_client, admin_headers, search="tunde"))[1] == "1"


async def test_application_and_loan_search(api_client, db_session, admin_headers):
    loan = await booked_loan(api_client, db_session, admin_headers)  # borrower from the mock BVN lookup

    hit = await api_client.get("/api/v1/admin/loans/applications", params={"search": "okafor"}, headers=admin_headers)
    miss = await api_client.get("/api/v1/admin/loans/applications", params={"search": "nobody"}, headers=admin_headers)
    assert hit.headers["x-total-count"] == "1" and len(hit.json()) == 1
    assert miss.headers["x-total-count"] == "0" and miss.json() == []

    loans = (await api_client.get("/api/v1/admin/loans/loans", params={"search": "okafor"}, headers=admin_headers)).json()
    assert loans["total"] == 1 and loans["items"][0]["id"] == loan.id
    none = (await api_client.get("/api/v1/admin/loans/loans", params={"search": "nobody"}, headers=admin_headers)).json()
    assert none["total"] == 0


async def test_repeat_views_are_logged_once_per_window(api_client, db_session, admin_headers):
    app_id = await approved_application(api_client, db_session, admin_headers)

    for _ in range(3):
        await api_client.get(f"/api/v1/admin/loans/applications/{app_id}", headers=admin_headers)

    logs = (await api_client.get(f"/api/v1/admin/loans/applications/{app_id}/audit-log", headers=admin_headers)).json()
    events = [e["event_type"] for e in logs]
    assert events.count("application_viewed") == 1
    assert events.count("bvn_viewed") <= 1


async def test_audit_log_filters_and_total(api_client, db_session, admin_headers):
    app_id = await approved_application(api_client, db_session, admin_headers)
    await api_client.get(f"/api/v1/admin/loans/applications/{app_id}", headers=admin_headers)

    everything = await api_client.get("/api/v1/admin/settings/audit-logs", headers=admin_headers)
    assert int(everything.headers["x-total-count"]) >= len(everything.json()) > 0

    approvals = await api_client.get(
        "/api/v1/admin/settings/audit-logs", params={"event_type": "stage_approved"}, headers=admin_headers
    )
    assert approvals.json() and {e["event_type"] for e in approvals.json()} == {"stage_approved"}
    assert approvals.headers["x-total-count"] == str(len(approvals.json()))

    found = await api_client.get("/api/v1/admin/settings/audit-logs", params={"search": "opened application"}, headers=admin_headers)
    assert [e["message"] for e in found.json()] == ["Staff opened application"]

    bad = await api_client.get("/api/v1/admin/settings/audit-logs", params={"event_type": "nope"}, headers=admin_headers)
    assert bad.status_code == 422
