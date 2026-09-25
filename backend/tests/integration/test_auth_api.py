"""Integration tests for auth API endpoints — full registration and login flows."""

from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.modules.auth.service import AuthService
from app.modules.auth.session_service import RequestMeta
from app.modules.users.models import Customer, CustomerStatus
from tests.conftest import TEST_BVN, TEST_BVN_2, TEST_OTP, make_dojah_entity, refresh_settings


class TestRegistrationFlow:
    async def test_register_bvn_success(self, api_client):
        res = await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
        assert res.status_code == 200
        data = res.json()
        assert data["purpose"] == "registration"
        assert "****" in data["phone_masked"]
        assert data["expires_in"] == 600
        assert "OTP sent" in data["message"]

    async def test_register_invalid_bvn(self, api_client):
        res = await api_client.post("/api/v1/auth/register/bvn", json={"bvn": "12345"})
        assert res.status_code == 422

    async def test_register_and_verify_full_flow(self, api_client):
        reg = await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
        assert reg.status_code == 200

        verify = await api_client.post(
            "/api/v1/auth/register/verify-otp",
            json={"bvn": TEST_BVN, "otp": TEST_OTP},
        )
        assert verify.status_code == 200
        data = verify.json()
        assert data["token_type"] == "bearer"
        assert "access_token" in data
        assert data["customer"]["first_name"] == "Adaeze"
        assert data["customer"]["status"] == "active"
        assert "****" in data["customer"]["bvn_masked"]

    async def test_verify_wrong_otp(self, api_client):
        await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
        res = await api_client.post(
            "/api/v1/auth/register/verify-otp",
            json={"bvn": TEST_BVN, "otp": "000000"},
        )
        assert res.status_code == 400

    async def test_register_active_bvn_conflict(self, api_client, registered_customer):
        res = await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
        assert res.status_code == 409

    async def test_resend_registration_otp(self, api_client):
        await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
        res = await api_client.post(
            "/api/v1/auth/register/resend-otp",
            json={"bvn": TEST_BVN},
        )
        assert res.status_code == 200
        assert res.json()["purpose"] == "registration"

    async def test_resend_unknown_bvn(self, api_client):
        res = await api_client.post(
            "/api/v1/auth/register/resend-otp",
            json={"bvn": "99999999999"},
        )
        assert res.status_code == 404

    async def test_watch_listed_bvn_blocked(self, api_client, fixed_otp):
        watchlisted = make_dojah_entity(watch_listed="YES")
        with patch(
            "app.integrations.dojah.client.DojahClient.lookup_bvn_advanced",
            new_callable=AsyncMock,
            return_value=watchlisted,
        ):
            reg = await api_client.post(
                "/api/v1/auth/register/bvn", json={"bvn": TEST_BVN_2}
            )
        assert reg.status_code == 200

        verify = await api_client.post(
            "/api/v1/auth/register/verify-otp",
            json={"bvn": TEST_BVN_2, "otp": TEST_OTP},
        )
        assert verify.status_code == 403
        assert "branch" in verify.json()["detail"].lower()


class TestLoginFlow:
    async def test_login_full_flow(self, api_client, registered_customer):
        req = await api_client.post(
            "/api/v1/auth/login/request-otp",
            json={"phone": "08035794364"},
        )
        assert req.status_code == 200
        assert req.json()["purpose"] == "login"

        verify = await api_client.post(
            "/api/v1/auth/login/verify-otp",
            json={"phone": "08035794364", "otp": TEST_OTP},
        )
        assert verify.status_code == 200
        assert "access_token" in verify.json()

    async def test_login_unknown_phone_same_shape(self, api_client):
        """Must not reveal whether phone exists."""
        res = await api_client.post(
            "/api/v1/auth/login/request-otp",
            json={"phone": "09099998888"},
        )
        assert res.status_code == 200
        assert "If an account exists" in res.json()["message"]

    async def test_login_wrong_otp(self, api_client, registered_customer):
        await api_client.post(
            "/api/v1/auth/login/request-otp",
            json={"phone": "08035794364"},
        )
        res = await api_client.post(
            "/api/v1/auth/login/verify-otp",
            json={"phone": "08035794364", "otp": "000000"},
        )
        assert res.status_code == 400

    async def test_login_before_registration_fails_verify(self, api_client):
        await api_client.post(
            "/api/v1/auth/login/request-otp",
            json={"phone": "08035794364"},
        )
        res = await api_client.post(
            "/api/v1/auth/login/verify-otp",
            json={"phone": "08035794364", "otp": TEST_OTP},
        )
        assert res.status_code == 400  # OTP not found since none was sent


class TestAuthMe:
    async def test_me_requires_auth(self, api_client):
        res = await api_client.get("/api/v1/auth/me")
        assert res.status_code == 401

    async def test_me_returns_profile(self, api_client, registered_customer):
        token = registered_customer["access_token"]
        res = await api_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        profile = res.json()
        assert profile["account_number"]
        assert profile["status"] == "active"


class TestRateLimitAPI:
    async def test_bvn_rate_limit_by_ip(self, api_client, monkeypatch):
        monkeypatch.setenv("RATE_LIMIT_BVN_PER_IP_HOUR", "2")
        refresh_settings()

        phones = {
            TEST_BVN: "08011111111",
            TEST_BVN_2: "08022222222",
            "44444444444": "08033333333",
        }

        async def lookup_bvn(bvn: str):
            return make_dojah_entity(bvn=bvn, phone_number1=phones[bvn])

        with patch(
            "app.integrations.dojah.client.DojahClient.lookup_bvn_advanced",
            side_effect=lookup_bvn,
        ):
            await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
            await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN_2})
            res = await api_client.post("/api/v1/auth/register/bvn", json={"bvn": "44444444444"})
        assert res.status_code == 429


class TestAuthServiceUnit:
    async def test_register_persists_dojah_fields(self, db_session, fake_redis, fixed_otp):
        service = AuthService(db_session, fake_redis)
        await service.register_with_bvn(TEST_BVN, ip="10.0.0.1")

        result = await db_session.execute(select(Customer).where(Customer.bvn == TEST_BVN))
        customer = result.scalar_one()
        assert customer.first_name == "Adaeze"
        assert customer.state_of_residence == "LAGOS"
        assert customer.enrollment_bank == "GTB"
        assert customer.watch_listed == "NO"
        assert customer.status == CustomerStatus.PENDING_OTP
        assert customer.phone_primary == "+2348035794364"

    async def test_verify_activates_customer(self, db_session, fake_redis, fixed_otp):
        service = AuthService(db_session, fake_redis)
        await service.register_with_bvn(TEST_BVN, ip="10.0.0.1")
        result = await service.verify_registration_otp(
            TEST_BVN, TEST_OTP, meta=RequestMeta(ip="10.0.0.1")
        )

        assert result.access_token
        assert result.customer.status == "active"

        db_result = await db_session.execute(select(Customer).where(Customer.bvn == TEST_BVN))
        customer = db_result.scalar_one()
        assert customer.phone_verified is True
        assert customer.status == CustomerStatus.ACTIVE
