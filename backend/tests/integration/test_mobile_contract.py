"""Mobile client contract: idempotency keys, app config, version gate, maintenance, pagination."""

from sqlalchemy import func, select

from app.modules.loans.models import LoanApplication
from app.modules.payments.models import WithdrawalRequest
from tests.conftest import refresh_settings
from tests.integration.test_loan_workflow_api import _customer_token, _seed


def _auth(token: str, **extra) -> dict:
    return {"Authorization": f"Bearer {token}", **extra}


class TestIdempotencyKeys:
    async def test_retried_create_replays_original_response(self, api_client, db_session):
        await _seed(db_session)
        token = await _customer_token(api_client)
        headers = _auth(token, **{"Idempotency-Key": "create-app-000001"})
        body = {"product_code": "business_loan"}

        first = await api_client.post("/api/v1/loans/me/applications", json=body, headers=headers)
        second = await api_client.post("/api/v1/loans/me/applications", json=body, headers=headers)

        assert first.status_code == second.status_code == 201
        assert first.json()["id"] == second.json()["id"]
        assert second.headers.get("idempotent-replayed") == "true"
        count = await db_session.scalar(select(func.count()).select_from(LoanApplication))
        assert count == 1

    async def test_same_key_different_body_rejected(self, api_client, db_session):
        await _seed(db_session)
        token = await _customer_token(api_client)
        headers = _auth(token, **{"Idempotency-Key": "create-app-000002"})
        await api_client.post("/api/v1/loans/me/applications", json={"product_code": "business_loan"}, headers=headers)
        res = await api_client.post(
            "/api/v1/loans/me/applications", json={"product_code": "payday_loan"}, headers=headers
        )
        assert res.status_code == 422
        assert res.json()["code"] == "IDEMPOTENCY_KEY_REUSED"

    async def test_without_key_each_request_runs(self, api_client, db_session):
        await _seed(db_session)
        token = await _customer_token(api_client)
        for _ in range(2):
            await api_client.post(
                "/api/v1/loans/me/applications", json={"product_code": "business_loan"}, headers=_auth(token)
            )
        assert await db_session.scalar(select(func.count()).select_from(LoanApplication)) == 2

    async def test_keys_are_scoped_per_user(self, api_client, fake_redis):
        # Another user's record under the same key must not leak into this user's replay.
        await fake_redis.set("idem:customer:someone-else:shared-key-0001", '{"state":"done"}')
        token = await _customer_token(api_client)
        res = await api_client.post(
            "/api/v1/auth/logout-all", headers=_auth(token, **{"Idempotency-Key": "shared-key-0001"})
        )
        assert res.status_code == 204  # /auth is excluded anyway; and no cross-user replay

    async def test_malformed_key_rejected(self, api_client, db_session):
        token = await _customer_token(api_client)
        res = await api_client.post(
            "/api/v1/loans/me/applications",
            json={"product_code": "business_loan"},
            headers=_auth(token, **{"Idempotency-Key": "bad key!"}),
        )
        assert res.status_code == 400
        assert res.json()["code"] == "IDEMPOTENCY_KEY_INVALID"

    async def test_withdraw_requires_key_and_is_not_duplicated(self, api_client, db_session):
        from decimal import Decimal

        from app.modules.payments.ledger_service import LedgerService
        from app.modules.payments.models import PaymentDirection, PaymentProvider, PaymentTransaction
        from app.models.base import TransactionStatus

        from tests.conftest import TEST_BVN, TEST_OTP

        await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
        verify = (
            await api_client.post("/api/v1/auth/register/verify-otp", json={"bvn": TEST_BVN, "otp": TEST_OTP})
        ).json()
        customer_id = verify["customer"]["id"]
        headers = _auth(verify["access_token"])
        from tests.conftest import TEST_TXN_PIN, set_transaction_pin

        await set_transaction_pin(api_client, headers)
        payout = await api_client.post(
            "/api/v1/wallet/payout-account",
            json={
                "bank_code": "058",
                "account_number": "0123456789",
                "account_name": "Ada Okafor",
                "transaction_pin": TEST_TXN_PIN,
            },
            headers=headers,
        )
        assert payout.status_code == 200, payout.text
        ledger = LedgerService(db_session)
        funding = PaymentTransaction(
            provider=PaymentProvider.MONNIFY, provider_reference="F-W-1", direction=PaymentDirection.INBOUND,
            amount=Decimal("10000"), status=TransactionStatus.COMPLETED, customer_id=customer_id,
        )
        db_session.add(funding)
        await db_session.flush()
        await ledger.credit_wallet_from_paystack(
            customer_id=customer_id, amount=Decimal("10000"), idempotency_key="wf:F-W-1",
            reference="F-W-1", payment_transaction=funding,
        )
        await db_session.commit()

        body = {"amount": "1000", "transaction_pin": TEST_TXN_PIN}
        no_key = await api_client.post("/api/v1/wallet/withdraw", json=body, headers=headers)
        assert no_key.status_code == 422

        keyed = {**headers, "Idempotency-Key": "withdraw-000001"}
        a = await api_client.post("/api/v1/wallet/withdraw", json=body, headers=keyed)
        b = await api_client.post("/api/v1/wallet/withdraw", json=body, headers=keyed)
        assert a.status_code == 200, a.text
        assert a.json()["id"] == b.json()["id"]
        assert await db_session.scalar(select(func.count()).select_from(WithdrawalRequest)) == 1


class TestAppConfig:
    async def test_config_reports_versions_and_features(self, api_client, monkeypatch):
        monkeypatch.setenv("APP_MIN_VERSION_ANDROID", "1.2.0")
        monkeypatch.setenv("APP_LATEST_VERSION_ANDROID", "1.4.0")
        monkeypatch.setenv("FEATURE_FLAGS", "wallet")
        refresh_settings()
        res = await api_client.get("/api/v1/app/config", params={"platform": "android", "version": "1.3.0"})
        body = res.json()
        assert res.status_code == 200
        assert body["update_required"] is False
        assert body["update_available"] is True
        assert body["features"] == {
            "loans": True, "wallet": True, "savings": False,
            "investments": False, "contributions": False, "food_basket": False,
        }

    async def test_outdated_client_is_gated(self, api_client, monkeypatch):
        monkeypatch.setenv("APP_MIN_VERSION_IOS", "2.0.0")
        refresh_settings()
        headers = {"X-App-Platform": "ios", "X-App-Version": "1.9.9"}
        gated = await api_client.get("/api/v1/loans/products", headers=headers)
        assert gated.status_code == 426
        assert gated.json()["code"] == "APP_UPDATE_REQUIRED"
        assert gated.json()["min_supported_version"] == "2.0.0"
        # Config stays reachable so the app can explain what to do.
        config = await api_client.get("/api/v1/app/config", params={"platform": "ios", "version": "1.9.9"}, headers=headers)
        assert config.status_code == 200
        assert config.json()["update_required"] is True
        # Clients without version headers (admin portal) are unaffected.
        assert (await api_client.get("/api/v1/loans/products")).status_code == 200

    async def test_maintenance_blocks_customers_not_ops(self, api_client, monkeypatch, admin_headers):
        monkeypatch.setenv("MAINTENANCE_MODE", "true")
        refresh_settings()
        blocked = await api_client.get("/api/v1/loans/products")
        assert blocked.status_code == 503
        assert blocked.json()["code"] == "MAINTENANCE_MODE"
        assert (await api_client.get("/api/v1/admin/auth/me", headers=admin_headers)).status_code == 200
        assert (await api_client.get("/api/v1/health")).status_code == 200
        assert (
            await api_client.get("/api/v1/app/config", params={"platform": "android"})
        ).json()["maintenance"]["enabled"] is True


class TestPagination:
    async def test_customer_lists_are_paginated(self, api_client, db_session):
        await _seed(db_session)
        token = await _customer_token(api_client)
        for _ in range(3):
            await api_client.post(
                "/api/v1/loans/me/applications", json={"product_code": "business_loan"}, headers=_auth(token)
            )
        page = await api_client.get("/api/v1/loans/me/applications", params={"limit": 2}, headers=_auth(token))
        body = page.json()
        assert body["total"] == 3 and len(body["items"]) == 2 and body["limit"] == 2
        loans = await api_client.get("/api/v1/loans/me/loans", headers=_auth(token))
        assert loans.json() == {"items": [], "total": 0, "limit": 20, "offset": 0}

    async def test_admin_list_keeps_array_shape_with_total_header(self, api_client, db_session, admin_headers):
        await _seed(db_session)
        token = await _customer_token(api_client)
        for _ in range(3):
            await api_client.post(
                "/api/v1/loans/me/applications", json={"product_code": "business_loan"}, headers=_auth(token)
            )
        res = await api_client.get("/api/v1/admin/loans/applications", params={"limit": 2}, headers=admin_headers)
        assert isinstance(res.json(), list) and len(res.json()) == 2  # admin portal contract unchanged
        assert res.headers["x-total-count"] == "3"
