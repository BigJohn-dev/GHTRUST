"""Device sessions, refresh-token rotation, revocation, and route auth."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.modules.auth.models import AuthSession
from tests.conftest import TEST_ADMIN_PHONE, TEST_BVN, TEST_OTP

DEVICE = {"device_id": "install-abc", "device_name": "Test Phone", "platform": "android", "app_version": "1.0.0"}


async def _register(api_client, device=DEVICE) -> dict:
    await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
    res = await api_client.post(
        "/api/v1/auth/register/verify-otp",
        json={"bvn": TEST_BVN, "otp": TEST_OTP, "device": device},
    )
    assert res.status_code == 200, res.text
    return res.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestTokenIssue:
    async def test_verify_returns_token_pair(self, api_client):
        body = await _register(api_client)
        assert body["access_token"]
        assert body["refresh_token"]
        assert body["session_id"]
        assert body["expires_in"] == 15 * 60
        assert body["refresh_expires_in"] > 29 * 24 * 3600
        assert body["customer"]["status"] == "active"

    async def test_session_records_device(self, api_client, db_session):
        body = await _register(api_client)
        session = await db_session.get(AuthSession, body["session_id"])
        assert session.device_id == "install-abc"
        assert session.platform == "android"
        assert session.refresh_token_hash != body["refresh_token"]  # stored hashed


class TestRefreshRotation:
    async def test_refresh_rotates_both_tokens(self, api_client):
        first = await _register(api_client)
        res = await api_client.post(
            "/api/v1/auth/token/refresh", json={"refresh_token": first["refresh_token"]}
        )
        assert res.status_code == 200, res.text
        second = res.json()
        assert second["refresh_token"] != first["refresh_token"]
        assert second["session_id"] == first["session_id"]
        me = await api_client.get("/api/v1/auth/me", headers=_auth(second["access_token"]))
        assert me.status_code == 200

    async def test_old_refresh_token_reuse_revokes_session(self, api_client, db_session, monkeypatch):
        monkeypatch.setenv("REFRESH_TOKEN_REUSE_GRACE_SECONDS", "0")
        from tests.conftest import refresh_settings

        refresh_settings()
        first = await _register(api_client)
        rotated = (
            await api_client.post(
                "/api/v1/auth/token/refresh", json={"refresh_token": first["refresh_token"]}
            )
        ).json()

        # Attacker replays the original token.
        replay = await api_client.post(
            "/api/v1/auth/token/refresh", json={"refresh_token": first["refresh_token"]}
        )
        assert replay.status_code == 401
        assert replay.json()["code"] == "REFRESH_TOKEN_REUSED"

        # The legitimate device is signed out too — both tokens are dead.
        again = await api_client.post(
            "/api/v1/auth/token/refresh", json={"refresh_token": rotated["refresh_token"]}
        )
        assert again.status_code == 401
        me = await api_client.get("/api/v1/auth/me", headers=_auth(rotated["access_token"]))
        assert me.status_code == 401
        assert me.json()["code"] == "SESSION_REVOKED"

    async def test_concurrent_refresh_within_grace_does_not_revoke(self, api_client):
        first = await _register(api_client)
        rotated = (
            await api_client.post(
                "/api/v1/auth/token/refresh", json={"refresh_token": first["refresh_token"]}
            )
        ).json()
        # Second in-flight refresh with the same old token, inside the grace window.
        racing = await api_client.post(
            "/api/v1/auth/token/refresh", json={"refresh_token": first["refresh_token"]}
        )
        assert racing.status_code == 401
        assert racing.json()["code"] == "REFRESH_TOKEN_INVALID"
        # Session survives: the token the client stored still works.
        ok = await api_client.post(
            "/api/v1/auth/token/refresh", json={"refresh_token": rotated["refresh_token"]}
        )
        assert ok.status_code == 200

    async def test_unknown_refresh_token_rejected(self, api_client):
        res = await api_client.post(
            "/api/v1/auth/token/refresh", json={"refresh_token": "x" * 64}
        )
        assert res.status_code == 401
        assert res.json()["code"] == "REFRESH_TOKEN_INVALID"

    async def test_expired_session_cannot_refresh(self, api_client, db_session):
        first = await _register(api_client)
        session = await db_session.get(AuthSession, first["session_id"])
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db_session.commit()
        res = await api_client.post(
            "/api/v1/auth/token/refresh", json={"refresh_token": first["refresh_token"]}
        )
        assert res.status_code == 401


class TestLogoutAndDevices:
    async def test_logout_kills_access_token_immediately(self, api_client):
        body = await _register(api_client)
        headers = _auth(body["access_token"])
        assert (await api_client.post("/api/v1/auth/logout", headers=headers)).status_code == 204
        me = await api_client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 401
        assert me.json()["code"] == "SESSION_REVOKED"
        refresh = await api_client.post(
            "/api/v1/auth/token/refresh", json={"refresh_token": body["refresh_token"]}
        )
        assert refresh.status_code == 401

    async def test_list_and_revoke_other_device(self, api_client):
        from tests.integration.test_device_security import approve_new_phone

        phone_a = await _register(api_client)
        phone_b = await approve_new_phone(
            api_client, phone_a, {"device_id": "install-xyz", "platform": "ios"}
        )

        listing = await api_client.get("/api/v1/auth/sessions", headers=_auth(phone_a["access_token"]))
        sessions = listing.json()
        assert len(sessions) == 2
        assert sum(s["current"] for s in sessions) == 1

        revoke = await api_client.delete(
            f"/api/v1/auth/sessions/{phone_b['session_id']}", headers=_auth(phone_a["access_token"])
        )
        assert revoke.status_code == 204
        assert (
            await api_client.get("/api/v1/auth/me", headers=_auth(phone_b["access_token"]))
        ).status_code == 401
        assert (
            await api_client.get("/api/v1/auth/me", headers=_auth(phone_a["access_token"]))
        ).status_code == 200

    async def test_relogin_same_device_replaces_session(self, api_client, db_session):
        first = await _register(api_client)
        await api_client.post("/api/v1/auth/login/request-otp", json={"phone": "08035794364"})
        await api_client.post(
            "/api/v1/auth/login/verify-otp",
            json={"phone": "08035794364", "otp": TEST_OTP, "device": DEVICE},
        )
        old = await db_session.get(AuthSession, first["session_id"])
        await db_session.refresh(old)
        assert old.revoked_reason == "replaced"

    async def test_logout_all(self, api_client, db_session):
        body = await _register(api_client)
        res = await api_client.post("/api/v1/auth/logout-all", headers=_auth(body["access_token"]))
        assert res.status_code == 204
        live = await db_session.execute(select(AuthSession).where(AuthSession.revoked_at.is_(None)))
        assert live.scalars().all() == []


class TestAudienceSeparation:
    async def test_customer_token_rejected_on_admin_routes(self, api_client):
        body = await _register(api_client)
        res = await api_client.get("/api/v1/admin/auth/me", headers=_auth(body["access_token"]))
        assert res.status_code == 401
        assert res.json()["code"] == "TOKEN_INVALID"

    async def test_staff_token_rejected_on_customer_routes(self, api_client, admin_token):
        res = await api_client.get("/api/v1/auth/me", headers=_auth(admin_token))
        assert res.status_code == 401


class TestStaffSessions:
    async def test_staff_refresh_and_logout(self, api_client, super_admin):
        await api_client.post("/api/v1/admin/auth/login/request-otp", json={"phone": TEST_ADMIN_PHONE})
        login = (
            await api_client.post(
                "/api/v1/admin/auth/login/verify-otp",
                json={"phone": TEST_ADMIN_PHONE, "otp": TEST_OTP},
            )
        ).json()
        assert login["refresh_token"]
        assert login["expires_in"] == 10 * 60

        refreshed = await api_client.post(
            "/api/v1/admin/auth/token/refresh", json={"refresh_token": login["refresh_token"]}
        )
        assert refreshed.status_code == 200
        token = refreshed.json()["access_token"]

        # Customer refresh endpoint must not accept a staff refresh token.
        cross = await api_client.post(
            "/api/v1/auth/token/refresh", json={"refresh_token": refreshed.json()["refresh_token"]}
        )
        assert cross.status_code == 401

        assert (await api_client.post("/api/v1/admin/auth/logout", headers=_auth(token))).status_code == 204
        assert (await api_client.get("/api/v1/admin/auth/me", headers=_auth(token))).status_code == 401

    async def test_deactivating_staff_revokes_live_sessions(self, api_client, admin_headers, db_session):
        role = (await api_client.get("/api/v1/admin/roles", headers=admin_headers)).json()
        role_id = next(r["id"] for r in role if r["name"] != "Super Admin") if len(role) > 1 else None
        if role_id is None:
            created = await api_client.post(
                "/api/v1/admin/roles",
                json={"name": "Reviewer", "permissions": ["loan:read"]},
                headers=admin_headers,
            )
            role_id = created.json()["id"]
        staff = (
            await api_client.post(
                "/api/v1/admin/staff",
                json={"full_name": "Temp Officer", "email": "temp.officer@example.com", "phone": "08000000077", "role_id": role_id},
                headers=admin_headers,
            )
        ).json()
        await api_client.post(f"/api/v1/admin/staff/{staff['id']}/activate", headers=admin_headers)

        await api_client.post("/api/v1/admin/auth/login/request-otp", json={"phone": "08000000077"})
        officer = (
            await api_client.post(
                "/api/v1/admin/auth/login/verify-otp", json={"phone": "08000000077", "otp": TEST_OTP}
            )
        ).json()
        officer_headers = _auth(officer["access_token"])
        assert (await api_client.get("/api/v1/admin/auth/me", headers=officer_headers)).status_code == 200

        await api_client.post(f"/api/v1/admin/staff/{staff['id']}/deactivate", headers=admin_headers)

        res = await api_client.get("/api/v1/admin/auth/me", headers=officer_headers)
        assert res.status_code == 401
        assert res.json()["code"] == "SESSION_REVOKED"


class TestSecuredRoutes:
    async def test_legacy_unauthenticated_application_list_removed(self, api_client):
        res = await api_client.get("/api/v1/loans/applications")
        assert res.status_code in (404, 405)

    async def test_customer_scoped_routes_require_auth(self, api_client):
        for method, path in [
            ("get", "/api/v1/savings/me"),
            ("get", "/api/v1/investments/me"),
            ("get", "/api/v1/food-basket/me/subscriptions"),
            ("post", "/api/v1/contributions/me/contributions"),
        ]:
            res = await getattr(api_client, method)(path)
            assert res.status_code == 401, (path, res.status_code)

    async def test_old_customer_id_routes_are_gone(self, api_client):
        for path in [
            "/api/v1/savings/customers/abc/summary",
            "/api/v1/investments/customers/abc",
            "/api/v1/food-basket/customers/abc/subscriptions",
        ]:
            assert (await api_client.get(path)).status_code == 404, path

    async def test_savings_me_returns_own_summary(self, api_client):
        body = await _register(api_client)
        res = await api_client.get("/api/v1/savings/me", headers=_auth(body["access_token"]))
        assert res.status_code == 200
        assert res.json()["active_accounts"] == 0


class TestErrorEnvelope:
    async def test_error_has_code_and_request_id(self, api_client):
        res = await api_client.get("/api/v1/auth/me")
        body = res.json()
        assert res.status_code == 401
        assert body["code"] == "UNAUTHENTICATED"
        assert body["detail"] == "Not authenticated"
        assert body["request_id"] == res.headers["x-request-id"]

    async def test_inbound_request_id_is_echoed(self, api_client):
        res = await api_client.get("/api/v1/health", headers={"X-Request-ID": "mobile-req-12345678"})
        assert res.headers["x-request-id"] == "mobile-req-12345678"

    async def test_unsafe_request_id_is_replaced(self, api_client):
        res = await api_client.get("/api/v1/health", headers={"X-Request-ID": "bad id\nwith newline"})
        assert res.headers["x-request-id"] != "bad id\nwith newline"

    async def test_validation_error_keeps_detail_list(self, api_client):
        res = await api_client.post("/api/v1/auth/register/bvn", json={"bvn": "123"})
        body = res.json()
        assert res.status_code == 422
        assert body["code"] == "VALIDATION_ERROR"
        assert isinstance(body["detail"], list)  # admin portal renders this list

    async def test_otp_errors_are_coded(self, api_client):
        await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
        res = await api_client.post(
            "/api/v1/auth/register/verify-otp", json={"bvn": TEST_BVN, "otp": "000000"}
        )
        assert res.json()["code"] == "OTP_INVALID"
