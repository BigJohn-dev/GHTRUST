"""Integration tests for configurable loan workflows and audit trail."""

import io

from sqlalchemy import select

from app.modules.admin.models import Role, Staff, StaffStatus
from app.modules.loans.workflow_models import AuditEventType
from app.modules.loans.workflow_seed import seed_default_workflows
from tests.conftest import TEST_BVN, TEST_OTP


async def _customer_token(api_client) -> str:
    await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
    res = await api_client.post(
        "/api/v1/auth/register/verify-otp",
        json={"bvn": TEST_BVN, "otp": TEST_OTP},
    )
    return res.json()["access_token"]


async def _seed(db_session):
    from app.modules.loans.service import seed_loan_products

    await seed_loan_products(db_session)
    await seed_default_workflows(db_session)
    await db_session.commit()


async def _submit_business_application(api_client, db_session) -> str:
    await _seed(db_session)
    token = await _customer_token(api_client)
    headers = {"Authorization": f"Bearer {token}"}

    created = await api_client.post(
        "/api/v1/loans/me/applications",
        json={"product_code": "business_loan"},
        headers=headers,
    )
    app_id = created.json()["id"]

    await api_client.patch(
        f"/api/v1/loans/me/applications/{app_id}",
        json={
            "step": 6,
            "total_steps": 6,
            "universal_form": {
                "residential_address": "52 Ijaye Road",
                "bank_name": "GTBank",
                "bank_account_name": "Adaeze Okafor",
                "bank_account_number": "0123456789",
                "next_of_kin_name": "John Okafor",
                "next_of_kin_phone": "08030000000",
                "next_of_kin_relationship": "Brother",
                "requested_amount": "500000",
                "purpose": "Stock",
                "monthly_income": "300000",
                "repayment_period": "6 months",
                "source_of_repayment": "Sales",
            },
            "product_data": {"years_in_operation": 5, "trade_type": "provisions"},
            "guarantors": [{"full_name": "Jane Guarantor", "phone": "08021112222", "relationship": "Friend"}],
        },
        headers=headers,
    )

    for doc_type in (
        "valid_id",
        "bvn",
        "passport_photo",
        "passport_photo_2",
        "shop_rent_receipt",
        "cash_flow_proof",
        "guarantor_id",
        "guarantor_photo",
        "collateral_original",
    ):
        file = io.BytesIO(b"fake pdf content")
        await api_client.post(
            f"/api/v1/loans/me/applications/{app_id}/documents/{doc_type}",
            headers=headers,
            files={"file": ("doc.pdf", file, "application/pdf")},
        )

    submitted = await api_client.post(
        f"/api/v1/loans/me/applications/{app_id}/submit",
        headers=headers,
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "under_review"
    return app_id


class TestLoanWorkflows:
    async def test_active_workflow_seeded(self, api_client, db_session, admin_headers):
        await _seed(db_session)
        res = await api_client.get(
            "/api/v1/admin/loans/products/business_loan/workflow/active",
            headers=admin_headers,
        )
        assert res.status_code == 200
        body = res.json()
        assert body is not None
        assert len(body["stages"]) == 4
        assert body["is_published"] is True

    async def test_submit_assigns_workflow_and_audit(self, api_client, db_session, admin_headers):
        app_id = await _submit_business_application(api_client, db_session)

        wf = await api_client.get(
            f"/api/v1/admin/loans/applications/{app_id}/workflow",
            headers=admin_headers,
        )
        assert wf.status_code == 200
        assert wf.json()["current_stage"]["name"] == "Document verification"

        audit = await api_client.get(
            f"/api/v1/admin/loans/applications/{app_id}/audit-log",
            headers=admin_headers,
        )
        assert audit.status_code == 200
        events = {e["event_type"] for e in audit.json()}
        assert "application_submitted" in events
        assert "workflow_assigned" in events

    async def test_stage_approval_records_timing(self, api_client, db_session, admin_headers):
        app_id = await _submit_business_application(api_client, db_session)

        view = await api_client.get(
            f"/api/v1/admin/loans/applications/{app_id}",
            headers=admin_headers,
        )
        assert view.status_code == 200
        audit_after_view = await api_client.get(
            f"/api/v1/admin/loans/applications/{app_id}/audit-log",
            headers=admin_headers,
        )
        event_types = [e["event_type"] for e in audit_after_view.json()]
        assert "application_viewed" in event_types
        assert "bvn_viewed" in event_types

        # Super admin can approve any stage
        approved = await api_client.post(
            f"/api/v1/admin/loans/applications/{app_id}/stage-action",
            json={"action": "approved", "note": "Docs look good"},
            headers=admin_headers,
        )
        assert approved.status_code == 200

        wf = await api_client.get(
            f"/api/v1/admin/loans/applications/{app_id}/workflow",
            headers=admin_headers,
        )
        body = wf.json()
        assert body["current_stage"]["name"] == "Credit assessment"
        assert len(body["stage_decisions"]) == 1
        assert body["stage_decisions"][0]["duration_seconds"] >= 0

    async def test_reject_records_rejected_at(self, api_client, db_session, admin_headers):
        app_id = await _submit_business_application(api_client, db_session)

        rejected = await api_client.post(
            f"/api/v1/admin/loans/applications/{app_id}/stage-action",
            json={"action": "rejected", "note": "Incomplete docs"},
            headers=admin_headers,
        )
        assert rejected.status_code == 200
        assert rejected.json()["status"] == "rejected"

        wf = await api_client.get(
            f"/api/v1/admin/loans/applications/{app_id}/workflow",
            headers=admin_headers,
        )
        assert wf.json()["rejected_at"] is not None
        assert wf.json()["processing_duration_seconds"] is not None

    async def test_custom_workflow_draft_and_publish(self, api_client, db_session, admin_headers):
        await _seed(db_session)
        role_res = await db_session.execute(select(Role).where(Role.name == "Loan Officer"))
        loan_officer_role = role_res.scalar_one()

        created = await api_client.post(
            "/api/v1/admin/loans/products/payday_loan/workflows",
            json={
                "stages": [
                    {
                        "name": "Quick review",
                        "approver_role_id": loan_officer_role.id,
                    }
                ]
            },
            headers=admin_headers,
        )
        assert created.status_code == 201
        workflow_id = created.json()["id"]
        assert created.json()["is_published"] is False

        published = await api_client.post(
            f"/api/v1/admin/loans/workflows/{workflow_id}/publish",
            headers=admin_headers,
        )
        assert published.status_code == 200
        assert published.json()["is_published"] is True
