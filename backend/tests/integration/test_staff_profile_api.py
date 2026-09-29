"""Staff self-service profile (PATCH /admin/auth/me)."""

from tests.conftest import TEST_ADMIN_PHONE


class TestStaffProfile:
    async def test_update_own_profile(self, api_client, admin_headers):
        res = await api_client.patch(
            "/api/v1/admin/auth/me",
            json={"full_name": "  Ada Obi  ", "job_title": "Head of Credit", "avatar_color": "emerald"},
            headers=admin_headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["full_name"] == "Ada Obi"
        assert body["job_title"] == "Head of Credit"
        assert body["avatar_color"] == "emerald"

        me = await api_client.get("/api/v1/admin/auth/me", headers=admin_headers)
        assert me.json()["job_title"] == "Head of Credit"

    async def test_partial_update_and_clearing(self, api_client, admin_headers):
        await api_client.patch("/api/v1/admin/auth/me", json={"job_title": "Analyst"}, headers=admin_headers)
        before = (await api_client.get("/api/v1/admin/auth/me", headers=admin_headers)).json()

        cleared = await api_client.patch("/api/v1/admin/auth/me", json={"job_title": ""}, headers=admin_headers)
        assert cleared.json()["job_title"] is None
        assert cleared.json()["full_name"] == before["full_name"]  # untouched

    async def test_phone_and_email_are_not_self_service(self, api_client, admin_headers):
        before = (await api_client.get("/api/v1/admin/auth/me", headers=admin_headers)).json()
        res = await api_client.patch(
            "/api/v1/admin/auth/me",
            json={"phone": "08099999999", "email": "attacker@example.com"},
            headers=admin_headers,
        )
        assert res.status_code == 200
        after = res.json()
        assert after["email"] == before["email"]
        assert after["phone"] == before["phone"]
        # Signing in still uses the original number.
        otp = await api_client.post("/api/v1/admin/auth/login/request-otp", json={"phone": TEST_ADMIN_PHONE})
        assert otp.status_code == 200

    async def test_rejects_unknown_colour_and_short_name(self, api_client, admin_headers):
        for payload in ({"avatar_color": "#ff0000"}, {"full_name": "A"}, {"job_title": "x" * 101}):
            res = await api_client.patch("/api/v1/admin/auth/me", json=payload, headers=admin_headers)
            assert res.status_code == 422, payload

    async def test_requires_sign_in(self, api_client):
        res = await api_client.patch("/api/v1/admin/auth/me", json={"job_title": "x"})
        assert res.status_code == 401
