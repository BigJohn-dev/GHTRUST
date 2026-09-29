"""Account opening: BVN → SMS code → selfie matched to the BVN photo (Dojah) → account open."""

import base64
from unittest.mock import AsyncMock, patch

from sqlalchemy import select

from app.integrations.dojah.schemas import DojahError, DojahSelfieVerification
from app.modules.users.models import Customer, CustomerStatus
from tests.conftest import TEST_BVN, TEST_OTP, refresh_settings

# A tiny but valid-looking JPEG: the right magic bytes and a plausible size.
SELFIE = base64.b64encode(b"\xff\xd8\xff\xe0" + b"\x00" * 8000).decode()
VERIFY = "app.integrations.dojah.client.DojahClient.verify_bvn_selfie"


def _selfie_on(monkeypatch, attempts: int = 3):
    monkeypatch.setenv("DOJAH_SELFIE_REQUIRED", "true")
    monkeypatch.setenv("DOJAH_SELFIE_MAX_ATTEMPTS", str(attempts))
    refresh_settings()


async def _start(api_client) -> dict:
    await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
    res = await api_client.post("/api/v1/auth/register/verify-otp", json={"bvn": TEST_BVN, "otp": TEST_OTP})
    assert res.status_code == 200, res.text
    return res.json()


async def _selfie(api_client, token: str, image: str = SELFIE):
    return await api_client.post(
        "/api/v1/auth/register/selfie",
        json={"registration_token": token, "selfie_image": image, "device": {"device_id": "phone-1"}},
    )


async def _customer(db_session) -> Customer:
    customer = (await db_session.execute(select(Customer))).scalar_one()
    await db_session.refresh(customer)
    return customer


class TestSelfieStep:
    async def test_code_then_selfie_opens_the_account(self, api_client, db_session, monkeypatch):
        _selfie_on(monkeypatch)
        started = await _start(api_client)
        assert started["status"] == "selfie_required"
        assert "access_token" not in started
        assert started["attempts_left"] == 3
        assert started["first_name"] == "Adaeze"
        # Not open yet: the code alone doesn't open the account.
        assert (await _customer(db_session)).status == CustomerStatus.PENDING_OTP

        with patch(VERIFY, AsyncMock(return_value=DojahSelfieVerification(confidence_value=96.4, match=True))) as call:
            res = await _selfie(api_client, started["registration_token"], f"data:image/jpeg;base64,{SELFIE}")
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["status"] == "signed_in" and body["access_token"] and body["device_token"]
        # The data: prefix is stripped and the configured threshold (Dojah's 90) is sent.
        assert call.await_args.args == (TEST_BVN, SELFIE, 90)

        customer = await _customer(db_session)
        assert customer.status == CustomerStatus.ACTIVE
        assert customer.phone_verified is True
        assert customer.selfie_match_score == 96.4
        assert customer.selfie_verified_at is not None

    async def test_ticket_is_single_use(self, api_client, monkeypatch):
        _selfie_on(monkeypatch)
        token = (await _start(api_client))["registration_token"]
        with patch(VERIFY, AsyncMock(return_value=DojahSelfieVerification(confidence_value=96, match=True))):
            assert (await _selfie(api_client, token)).status_code == 200
            again = await _selfie(api_client, token)
        assert again.status_code == 410
        assert again.json()["code"] == "REGISTRATION_EXPIRED"

    async def test_no_match_counts_down_then_sends_to_branch(self, api_client, db_session, monkeypatch):
        _selfie_on(monkeypatch, attempts=2)
        token = (await _start(api_client))["registration_token"]
        with patch(VERIFY, AsyncMock(return_value=DojahSelfieVerification(confidence_value=41.0, match=False))):
            first = await _selfie(api_client, token)
            assert first.status_code == 400
            assert first.json()["code"] == "SELFIE_NO_MATCH"
            assert first.json()["errors"] == [{"attempts_left": 1}]
            last = await _selfie(api_client, token)
            assert last.status_code == 403
            assert last.json()["code"] == "SELFIE_ATTEMPTS_EXCEEDED"
            gone = await _selfie(api_client, token)
            assert gone.json()["code"] == "REGISTRATION_EXPIRED"
        assert (await _customer(db_session)).status == CustomerStatus.PENDING_OTP

    async def test_unreadable_images_are_rejected_before_dojah(self, api_client, monkeypatch):
        _selfie_on(monkeypatch)
        token = (await _start(api_client))["registration_token"]
        not_an_image = base64.b64encode(b"hello" * 2000).decode()
        with patch(VERIFY, AsyncMock()) as call:
            res = await _selfie(api_client, token, not_an_image)
        assert res.status_code == 400
        assert res.json()["code"] == "SELFIE_UNREADABLE"
        call.assert_not_awaited()

    async def test_dojah_rejecting_the_image_does_not_use_an_attempt(self, api_client, monkeypatch):
        _selfie_on(monkeypatch)
        token = (await _start(api_client))["registration_token"]
        with patch(VERIFY, AsyncMock(side_effect=DojahError("Invalid image", status_code=400))):
            res = await _selfie(api_client, token)
        assert res.json()["code"] == "SELFIE_UNREADABLE"
        with patch(VERIFY, AsyncMock(return_value=DojahSelfieVerification(confidence_value=40, match=False))):
            res = await _selfie(api_client, token)
        assert res.json()["errors"] == [{"attempts_left": 2}]

    async def test_dojah_outage_is_retryable(self, api_client, monkeypatch):
        _selfie_on(monkeypatch)
        token = (await _start(api_client))["registration_token"]
        with patch(VERIFY, AsyncMock(side_effect=DojahError("down", status_code=503))):
            res = await _selfie(api_client, token)
        assert res.status_code == 503
        assert res.json()["code"] == "KYC_UNAVAILABLE"
        with patch(VERIFY, AsyncMock(return_value=DojahSelfieVerification(confidence_value=95, match=True))):
            assert (await _selfie(api_client, token)).status_code == 200

    async def test_selfie_off_opens_on_the_code(self, api_client):
        body = await _start(api_client)
        assert body["status"] == "signed_in"


class TestBvnLookupErrors:
    async def test_bvn_without_phone_goes_to_branch(self, api_client):
        from tests.conftest import make_dojah_entity

        entity = make_dojah_entity(phone_number1=None)
        with patch("app.integrations.dojah.client.DojahClient.lookup_bvn_advanced", AsyncMock(return_value=entity)):
            res = await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
        assert res.status_code == 422
        assert res.json()["code"] == "BVN_NO_PHONE"

    async def test_provider_problem_is_503_not_the_customers_fault(self, api_client):
        with patch(
            "app.integrations.dojah.client.DojahClient.lookup_bvn_advanced",
            AsyncMock(side_effect=DojahError("unavailable", status_code=503)),
        ):
            res = await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
        assert res.status_code == 503
        assert res.json()["code"] == "KYC_UNAVAILABLE"
