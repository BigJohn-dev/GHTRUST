"""Integration tests for loan application phase 1."""

import io

from tests.conftest import TEST_BVN, TEST_OTP


async def _customer_token(api_client) -> str:
    await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
    res = await api_client.post(
        "/api/v1/auth/register/verify-otp",
        json={"bvn": TEST_BVN, "otp": TEST_OTP},
    )
    return res.json()["access_token"]


async def _seed_products(db_session):
    from app.modules.loans.service import seed_loan_products

    await seed_loan_products(db_session)
    await db_session.commit()


class TestLoanProducts:
    async def test_list_loan_products(self, api_client, db_session):
        await _seed_products(db_session)
        res = await api_client.get("/api/v1/loans/products")
        assert res.status_code == 200
        codes = {p["code"] for p in res.json()}
        assert "business_loan" in codes
        assert "payday_loan" in codes
        assert "study_loan" in codes
        assert "asset_loan" in codes


class TestLoanApplicationFlow:
    async def test_create_and_update_business_application(self, api_client, db_session):
        await _seed_products(db_session)
        token = await _customer_token(api_client)
        headers = {"Authorization": f"Bearer {token}"}

        created = await api_client.post(
            "/api/v1/loans/me/applications",
            json={"product_code": "business_loan"},
            headers=headers,
        )
        assert created.status_code == 201
        app_id = created.json()["id"]
        assert created.json()["status"] == "draft"
        assert created.json()["universal_form"]["bvn"] == TEST_BVN

        updated = await api_client.patch(
            f"/api/v1/loans/me/applications/{app_id}",
            json={
                "step": 3,
                "total_steps": 6,
                "universal_form": {
                    "residential_address": "52 Ijaye Road, Ogba",
                    "bank_name": "GTBank",
                    "bank_account_name": "Adaeze Okafor",
                    "bank_account_number": "0123456789",
                    "next_of_kin_name": "John Okafor",
                    "next_of_kin_phone": "08030000000",
                    "next_of_kin_relationship": "Brother",
                    "requested_amount": "500000",
                    "purpose": "Stock purchase",
                    "monthly_income": "300000",
                    "repayment_period": "6 months",
                    "source_of_repayment": "Daily sales",
                },
                "product_data": {
                    "years_in_operation": 5,
                    "trade_type": "provisions",
                    "monthly_cash_flow": 800000,
                },
                "guarantors": [
                    {
                        "full_name": "Jane Guarantor",
                        "phone": "08021112222",
                        "relationship": "Friend",
                    }
                ],
            },
            headers=headers,
        )
        assert updated.status_code == 200
        assert updated.json()["product_data"]["trade_type"] == "provisions"
        assert len(updated.json()["guarantors"]) == 1

    async def test_submit_requires_documents(self, api_client, db_session):
        await _seed_products(db_session)
        token = await _customer_token(api_client)
        headers = {"Authorization": f"Bearer {token}"}

        created = await api_client.post(
            "/api/v1/loans/me/applications",
            json={"product_code": "payday_loan"},
            headers=headers,
        )
        app_id = created.json()["id"]

        await api_client.patch(
            f"/api/v1/loans/me/applications/{app_id}",
            json={
                "step": 5,
                "total_steps": 6,
                "universal_form": {
                    "residential_address": "Lagos",
                    "bank_name": "Access",
                    "bank_account_name": "Adaeze Okafor",
                    "bank_account_number": "0123456789",
                    "next_of_kin_name": "Kin",
                    "next_of_kin_phone": "08030000000",
                    "next_of_kin_relationship": "Sister",
                    "requested_amount": "100000",
                    "purpose": "Emergency",
                    "monthly_income": "250000",
                    "repayment_period": "3 months",
                    "source_of_repayment": "Salary",
                },
                "product_data": {
                    "employer_name": "Lagos State",
                    "salary_pay_day": 25,
                },
                "guarantors": [{"full_name": "Guarantor One"}],
            },
            headers=headers,
        )

        submit = await api_client.post(
            f"/api/v1/loans/me/applications/{app_id}/submit",
            headers=headers,
        )
        assert submit.status_code == 422
        body = submit.json()
        assert body["code"] == "APPLICATION_INCOMPLETE"
        assert any("Missing document" in e for e in body["errors"])

    async def test_upload_document(self, api_client, db_session, tmp_path, monkeypatch):
        monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
        from app.core.config import get_settings

        get_settings.cache_clear()

        await _seed_products(db_session)
        token = await _customer_token(api_client)
        headers = {"Authorization": f"Bearer {token}"}

        created = await api_client.post(
            "/api/v1/loans/me/applications",
            json={"product_code": "asset_loan"},
            headers=headers,
        )
        app_id = created.json()["id"]

        file_content = io.BytesIO(b"%PDF-1.4 test")
        res = await api_client.post(
            f"/api/v1/loans/me/applications/{app_id}/documents/valid_id",
            headers=headers,
            files={"file": ("id.pdf", file_content, "application/pdf")},
        )
        assert res.status_code == 200
        checklist = res.json()["document_checklist"]
        uploaded = [c for c in checklist if c["document_type"] == "valid_id"][0]
        assert uploaded["uploaded"] is True
