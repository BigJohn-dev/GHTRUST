"""Staff-created loan products: validation, switching on, and customers applying for them."""

from sqlalchemy import select

from app.modules.admin.models import Role
from tests.integration.test_loan_workflow_api import _customer_token, _seed

NEW_PRODUCT = {
    "code": "agric_loan",
    "name": "Agric Loan",
    "description": "Seasonal finance for farmers.",
    "interest_rate_pct_monthly": "5.00",
    "processing_fee_pct": "2.00",
    "max_tenure_days": 180,
    "repayment_cadence_options": ["monthly"],
    "required_document_types": ["valid_id", "bvn", "guarantor_id"],
    "workflow_steps": ["product_selection", "universal_form", "guarantor_collateral", "documents", "review_submit"],
}


async def _publish_workflow(api_client, db_session, admin_headers, code: str) -> None:
    role = (await db_session.execute(select(Role).where(Role.name == "Loan Officer"))).scalar_one()
    created = await api_client.post(
        f"/api/v1/admin/loans/products/{code}/workflows",
        json={"stages": [{"name": "Review", "approver_role_id": role.id}]},
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    published = await api_client.post(
        f"/api/v1/admin/loans/workflows/{created.json()['id']}/publish", headers=admin_headers
    )
    assert published.status_code == 200, published.text


class TestCreateLoanProduct:
    async def test_created_switched_off(self, api_client, db_session, admin_headers):
        await _seed(db_session)
        res = await api_client.post("/api/v1/admin/loans/products", json=NEW_PRODUCT, headers=admin_headers)
        assert res.status_code == 201, res.text
        body = res.json()
        assert body["code"] == "agric_loan"
        assert body["is_active"] is False
        assert body["workflow_steps"] == NEW_PRODUCT["workflow_steps"]

        listed = await api_client.get("/api/v1/admin/loans/products", headers=admin_headers)
        assert "agric_loan" in {p["code"] for p in listed.json()}

    async def test_duplicate_code_conflicts(self, api_client, db_session, admin_headers):
        await _seed(db_session)
        await api_client.post("/api/v1/admin/loans/products", json=NEW_PRODUCT, headers=admin_headers)
        again = await api_client.post("/api/v1/admin/loans/products", json=NEW_PRODUCT, headers=admin_headers)
        assert again.status_code == 409
        assert again.json()["code"] == "PRODUCT_EXISTS"

    async def test_rejects_what_the_apps_cannot_handle(self, api_client, db_session, admin_headers):
        await _seed(db_session)
        cases = [
            {"code": "Agric Loan"},  # not a slug
            {"required_document_types": ["valid_id", "selfie_video"]},
            {"workflow_steps": ["universal_form", "review_submit", "documents"]},  # review not last
            {"workflow_steps": ["universal_form", "documents", "review_submit", "spaceship_details"]},
            {"repayment_cadence_options": []},
            {"interest_rate_pct_monthly": "0"},
        ]
        for override in cases:
            res = await api_client.post(
                "/api/v1/admin/loans/products", json={**NEW_PRODUCT, **override}, headers=admin_headers
            )
            assert res.status_code == 422, (override, res.text)

    async def test_needs_configure_permission(self, api_client, db_session):
        await _seed(db_session)
        token = await _customer_token(api_client)
        res = await api_client.post(
            "/api/v1/admin/loans/products", json=NEW_PRODUCT, headers={"Authorization": f"Bearer {token}"}
        )
        assert res.status_code in (401, 403)


class TestSwitchingOn:
    async def test_requires_published_workflow(self, api_client, db_session, admin_headers):
        await _seed(db_session)
        await api_client.post("/api/v1/admin/loans/products", json=NEW_PRODUCT, headers=admin_headers)

        blocked = await api_client.patch(
            "/api/v1/admin/loans/products/agric_loan", json={"is_active": True}, headers=admin_headers
        )
        assert blocked.status_code == 409
        assert blocked.json()["code"] == "WORKFLOW_REQUIRED"

        await _publish_workflow(api_client, db_session, admin_headers, "agric_loan")
        on = await api_client.patch(
            "/api/v1/admin/loans/products/agric_loan", json={"is_active": True}, headers=admin_headers
        )
        assert on.status_code == 200
        assert on.json()["is_active"] is True

    async def test_customers_can_apply_once_live(self, api_client, db_session, admin_headers):
        await _seed(db_session)
        await api_client.post("/api/v1/admin/loans/products", json=NEW_PRODUCT, headers=admin_headers)
        customer = {"Authorization": f"Bearer {await _customer_token(api_client)}"}

        # Hidden and not applicable while switched off.
        catalogue = await api_client.get("/api/v1/loans/products", headers=customer)
        assert "agric_loan" not in {p["code"] for p in catalogue.json()}
        early = await api_client.post(
            "/api/v1/loans/me/applications", json={"product_code": "agric_loan"}, headers=customer
        )
        assert early.status_code in (400, 404, 409)

        await _publish_workflow(api_client, db_session, admin_headers, "agric_loan")
        await api_client.patch(
            "/api/v1/admin/loans/products/agric_loan", json={"is_active": True}, headers=admin_headers
        )
        catalogue = await api_client.get("/api/v1/loans/products", headers=customer)
        assert "agric_loan" in {p["code"] for p in catalogue.json()}
        app = await api_client.post(
            "/api/v1/loans/me/applications", json={"product_code": "agric_loan"}, headers=customer
        )
        assert app.status_code == 201, app.text
        assert app.json()["product_code"] == "agric_loan"

    async def test_switching_off_is_always_allowed(self, api_client, db_session, admin_headers):
        await _seed(db_session)
        off = await api_client.patch(
            "/api/v1/admin/loans/products/payday_loan", json={"is_active": False}, headers=admin_headers
        )
        assert off.status_code == 200
        assert off.json()["is_active"] is False
