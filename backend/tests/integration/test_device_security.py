"""Sign-in PIN, transaction PIN, trusted phones, and approving sign-ins on new phones."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.modules.auth.models import AuthSession, DeviceApproval
from app.modules.users.models import Customer
from tests.conftest import TEST_BVN, TEST_LOGIN_PIN, TEST_OTP, TEST_TXN_PIN, set_transaction_pin

PHONE = "08035794364"
PHONE_A = {"device_id": "install-aaa", "device_name": "Tolu's iPhone", "platform": "ios", "app_version": "1.0.0"}
PHONE_B = {"device_id": "install-bbb", "device_name": "Galaxy A54", "platform": "android", "app_version": "1.0.0"}


def _auth(tokens: dict | str) -> dict:
    token = tokens if isinstance(tokens, str) else tokens["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _register(api_client, device=PHONE_A) -> dict:
    await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
    res = await api_client.post(
        "/api/v1/auth/register/verify-otp", json={"bvn": TEST_BVN, "otp": TEST_OTP, "device": device}
    )
    assert res.status_code == 200, res.text
    return res.json()


async def _set_pin(api_client, tokens: dict, pin: str = TEST_LOGIN_PIN):
    return await api_client.post("/api/v1/auth/pin", json={"pin": pin}, headers=_auth(tokens))


async def _otp_login(api_client, device: dict) -> dict:
    await api_client.post("/api/v1/auth/login/request-otp", json={"phone": PHONE})
    res = await api_client.post(
        "/api/v1/auth/login/verify-otp", json={"phone": PHONE, "otp": TEST_OTP, "device": device}
    )
    assert res.status_code == 200, res.text
    return res.json()


async def approve_new_phone(api_client, signed_in: dict, device: dict, pin: str = TEST_LOGIN_PIN) -> dict:
    """Sign in on a new phone by approving it from ``signed_in`` (sets the PIN there if needed)."""
    res = await _set_pin(api_client, signed_in, pin)
    assert res.status_code in (200, 409), res.text
    started = await _otp_login(api_client, device)
    assert started["status"] == "approval_required", started
    code = (
        await api_client.post(
            f"/api/v1/auth/device-approvals/{started['approval_id']}/approve",
            json={"pin": pin},
            headers=_auth(signed_in),
        )
    ).json()["code"]
    done = await api_client.post(
        f"/api/v1/auth/device-approvals/{started['approval_id']}/complete",
        json={"approval_secret": started["approval_secret"], "code": code, "device": device},
    )
    assert done.status_code == 200, done.text
    return done.json()


# ── Sign-in PIN ──────────────────────────────────────────────────────────────


class TestLoginPin:
    async def test_create_once_and_profile_reports_it(self, api_client):
        tokens = await _register(api_client)
        assert tokens["customer"]["login_pin_set"] is False
        res = await _set_pin(api_client, tokens)
        assert res.status_code == 200, res.text
        assert res.json()["login_pin_set"] is True
        again = await _set_pin(api_client, tokens, "480173")
        assert again.status_code == 409
        assert again.json()["code"] == "PIN_ALREADY_SET"

    async def test_rejects_guessable_pins(self, api_client, db_session):
        tokens = await _register(api_client)
        customer = (await db_session.execute(select(Customer))).scalar_one()
        customer.date_of_birth = datetime(1990, 4, 17).date()
        await db_session.commit()
        for weak in ("111111", "123456", "987654", "121212", "170490"):
            res = await _set_pin(api_client, tokens, weak)
            assert res.status_code == 400, weak
            assert res.json()["code"] == "PIN_TOO_WEAK"
        bad_shape = await _set_pin(api_client, tokens, "12a456")
        assert bad_shape.status_code == 422

    async def test_pin_is_never_stored_plain(self, api_client, db_session):
        tokens = await _register(api_client)
        await _set_pin(api_client, tokens)
        customer = (await db_session.execute(select(Customer))).scalar_one()
        await db_session.refresh(customer)
        assert customer.login_pin_hash.startswith("scrypt$")
        assert TEST_LOGIN_PIN not in customer.login_pin_hash

    async def test_unlock_counts_wrong_pins_then_signs_phone_out(self, api_client):
        tokens = await _register(api_client)
        await _set_pin(api_client, tokens)
        ok = await api_client.post("/api/v1/auth/pin/verify", json={"pin": TEST_LOGIN_PIN}, headers=_auth(tokens))
        assert ok.status_code == 204

        for left in (4, 3, 2, 1):
            res = await api_client.post("/api/v1/auth/pin/verify", json={"pin": "000111"}, headers=_auth(tokens))
            assert res.status_code == 400
            assert res.json()["errors"] == [{"attempts_left": left}]
        last = await api_client.post("/api/v1/auth/pin/verify", json={"pin": "000111"}, headers=_auth(tokens))
        assert last.status_code == 401
        assert last.json()["code"] == "PIN_ATTEMPTS_EXCEEDED"
        assert (await api_client.get("/api/v1/auth/me", headers=_auth(tokens))).status_code == 401
        # ...and the phone is no longer trusted for PIN sign-in.
        again = await api_client.post(
            "/api/v1/auth/login/pin",
            json={"device_id": PHONE_A["device_id"], "device_token": tokens["device_token"], "pin": TEST_LOGIN_PIN},
        )
        assert again.status_code == 401
        assert again.json()["code"] == "DEVICE_NOT_TRUSTED"

    async def test_right_pin_resets_the_count(self, api_client):
        tokens = await _register(api_client)
        await _set_pin(api_client, tokens)
        for _ in range(4):
            await api_client.post("/api/v1/auth/pin/verify", json={"pin": "000111"}, headers=_auth(tokens))
        await api_client.post("/api/v1/auth/pin/verify", json={"pin": TEST_LOGIN_PIN}, headers=_auth(tokens))
        res = await api_client.post("/api/v1/auth/pin/verify", json={"pin": "000111"}, headers=_auth(tokens))
        assert res.json()["errors"] == [{"attempts_left": 4}]

    async def test_change_pin_needs_the_current_one(self, api_client):
        tokens = await _register(api_client)
        await _set_pin(api_client, tokens)
        wrong = await api_client.post(
            "/api/v1/auth/pin/change", json={"current_pin": "000111", "new_pin": "480173"}, headers=_auth(tokens)
        )
        assert wrong.json()["code"] == "PIN_INVALID"
        res = await api_client.post(
            "/api/v1/auth/pin/change",
            json={"current_pin": TEST_LOGIN_PIN, "new_pin": "480173"},
            headers=_auth(tokens),
        )
        assert res.status_code == 204
        ok = await api_client.post("/api/v1/auth/pin/verify", json={"pin": "480173"}, headers=_auth(tokens))
        assert ok.status_code == 204

    async def test_forgot_pin_needs_fresh_sms_sign_in_and_bvn(self, api_client, db_session):
        tokens = await _register(api_client)
        await _set_pin(api_client, tokens)
        wrong_bvn = await api_client.post(
            "/api/v1/auth/pin/reset", json={"bvn": "99999999999", "new_pin": "480173"}, headers=_auth(tokens)
        )
        assert wrong_bvn.json()["code"] == "BVN_MISMATCH"
        ok = await api_client.post(
            "/api/v1/auth/pin/reset", json={"bvn": TEST_BVN, "new_pin": "480173"}, headers=_auth(tokens)
        )
        assert ok.status_code == 200

        session = await db_session.get(AuthSession, tokens["session_id"])
        session.created_at = datetime.now(timezone.utc) - timedelta(hours=1)
        await db_session.commit()
        stale = await api_client.post(
            "/api/v1/auth/pin/reset", json={"bvn": TEST_BVN, "new_pin": "730591"}, headers=_auth(tokens)
        )
        assert stale.status_code == 403
        assert stale.json()["code"] == "REAUTH_REQUIRED"


class TestPinSignIn:
    async def test_trusted_phone_signs_back_in_with_pin(self, api_client):
        tokens = await _register(api_client)
        assert tokens["device_token"]
        await _set_pin(api_client, tokens)
        await api_client.post("/api/v1/auth/logout", headers=_auth(tokens))

        res = await api_client.post(
            "/api/v1/auth/login/pin",
            json={"device_id": PHONE_A["device_id"], "device_token": tokens["device_token"], "pin": TEST_LOGIN_PIN},
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["status"] == "signed_in"
        assert body["device_token"] and body["device_token"] != tokens["device_token"]  # rotates
        assert (await api_client.get("/api/v1/auth/me", headers=_auth(body))).status_code == 200

        # The old token is spent.
        replay = await api_client.post(
            "/api/v1/auth/login/pin",
            json={"device_id": PHONE_A["device_id"], "device_token": tokens["device_token"], "pin": TEST_LOGIN_PIN},
        )
        assert replay.json()["code"] == "DEVICE_NOT_TRUSTED"

    async def test_wrong_device_or_pin(self, api_client):
        tokens = await _register(api_client)
        await _set_pin(api_client, tokens)
        other_phone = await api_client.post(
            "/api/v1/auth/login/pin",
            json={"device_id": "someone-else", "device_token": tokens["device_token"], "pin": TEST_LOGIN_PIN},
        )
        assert other_phone.json()["code"] == "DEVICE_NOT_TRUSTED"
        wrong_pin = await api_client.post(
            "/api/v1/auth/login/pin",
            json={"device_id": PHONE_A["device_id"], "device_token": tokens["device_token"], "pin": "000111"},
        )
        assert wrong_pin.json()["code"] == "PIN_INVALID"

    async def test_not_you_sign_out_forgets_the_phone(self, api_client):
        tokens = await _register(api_client)
        await _set_pin(api_client, tokens)
        await api_client.post("/api/v1/auth/logout", params={"forget_device": "true"}, headers=_auth(tokens))
        res = await api_client.post(
            "/api/v1/auth/login/pin",
            json={"device_id": PHONE_A["device_id"], "device_token": tokens["device_token"], "pin": TEST_LOGIN_PIN},
        )
        assert res.json()["code"] == "DEVICE_NOT_TRUSTED"


# ── Transaction PIN ──────────────────────────────────────────────────────────


async def _fund(db_session, amount: str = "50000") -> None:
    from app.models.base import TransactionStatus
    from app.modules.payments.ledger_service import LedgerService
    from app.modules.payments.models import PaymentDirection, PaymentProvider, PaymentTransaction

    customer = (await db_session.execute(select(Customer))).scalar_one()
    # Withdrawals go to a saved payout account; set it directly so no PIN is spent here.
    customer.payout_bank_code = "058"
    customer.payout_account_number = "0123456789"
    customer.payout_account_name = "Tolu Adebayo"
    funding = PaymentTransaction(
        provider=PaymentProvider.MONNIFY,
        provider_reference="F-SEC-1",
        direction=PaymentDirection.INBOUND,
        amount=Decimal(amount),
        status=TransactionStatus.COMPLETED,
        customer_id=customer.id,
    )
    db_session.add(funding)
    await db_session.flush()
    await LedgerService(db_session).credit_wallet_from_paystack(
        customer_id=customer.id,
        amount=Decimal(amount),
        idempotency_key="wf:F-SEC-1",
        reference="F-SEC-1",
        payment_transaction=funding,
    )
    await db_session.commit()


_keys = iter(range(10**6))


async def _withdraw(api_client, tokens, pin, key: str | None = None):
    key = key or f"withdraw-sec-{next(_keys):06d}"
    return await api_client.post(
        "/api/v1/wallet/withdraw",
        json={"amount": "1000", "transaction_pin": pin},
        headers={**_auth(tokens), "Idempotency-Key": key},
    )


class TestTransactionPin:
    async def test_money_cannot_move_until_pin_is_created(self, api_client):
        tokens = await _register(api_client)
        res = await _withdraw(api_client, tokens, "2580")
        assert res.status_code == 403
        assert res.json()["code"] == "TRANSACTION_PIN_NOT_SET"

    async def test_pin_is_required_and_checked(self, api_client, db_session):
        tokens = await _register(api_client)
        await _fund(db_session)
        await set_transaction_pin(api_client, _auth(tokens))

        missing = await api_client.post(
            "/api/v1/wallet/withdraw", json={"amount": "1000"}, headers={**_auth(tokens), "Idempotency-Key": "k-000001"}
        )
        assert missing.status_code == 422
        wrong = await _withdraw(api_client, tokens, "9999")
        assert wrong.status_code == 400
        assert wrong.json()["code"] == "TRANSACTION_PIN_INVALID"
        ok = await _withdraw(api_client, tokens, TEST_TXN_PIN)
        assert ok.status_code == 200, ok.text

    async def test_sign_in_pin_does_not_work_as_transaction_pin(self, api_client, db_session):
        tokens = await _register(api_client)
        await _set_pin(api_client, tokens)
        await set_transaction_pin(api_client, _auth(tokens))
        res = await _withdraw(api_client, tokens, TEST_LOGIN_PIN[:4])
        assert res.json()["code"] == "TRANSACTION_PIN_INVALID"

    async def test_locks_after_five_wrong_and_reset_with_sign_in_pin(self, api_client, db_session):
        tokens = await _register(api_client)
        await _fund(db_session)
        await _set_pin(api_client, tokens)
        await set_transaction_pin(api_client, _auth(tokens))
        for _ in range(4):
            assert (await _withdraw(api_client, tokens, "9999")).json()["code"] == "TRANSACTION_PIN_INVALID"
        assert (await _withdraw(api_client, tokens, "9999")).json()["code"] == "TRANSACTION_PIN_LOCKED"
        # Even the right PIN is refused while locked.
        assert (await _withdraw(api_client, tokens, TEST_TXN_PIN)).json()["code"] == "TRANSACTION_PIN_LOCKED"

        reset = await api_client.post(
            "/api/v1/auth/transaction-pin/reset",
            json={"login_pin": TEST_LOGIN_PIN, "new_pin": "3691"},
            headers=_auth(tokens),
        )
        assert reset.status_code == 204, reset.text
        assert (await _withdraw(api_client, tokens, "3691")).status_code == 200

    async def test_change_transaction_pin(self, api_client):
        tokens = await _register(api_client)
        await set_transaction_pin(api_client, _auth(tokens))
        res = await api_client.post(
            "/api/v1/auth/transaction-pin/change",
            json={"current_pin": TEST_TXN_PIN, "new_pin": "3691"},
            headers=_auth(tokens),
        )
        assert res.status_code == 204
        weak = await api_client.post(
            "/api/v1/auth/transaction-pin/change",
            json={"current_pin": "3691", "new_pin": "4444"},
            headers=_auth(tokens),
        )
        assert weak.json()["code"] == "PIN_TOO_WEAK"

    async def test_payout_account_change_needs_pin(self, api_client):
        tokens = await _register(api_client)
        body = {"bank_code": "058", "account_number": "0123456789", "account_name": "Test"}
        res = await api_client.post("/api/v1/wallet/payout-account", json=body, headers=_auth(tokens))
        assert res.status_code == 422
        res = await api_client.post(
            "/api/v1/wallet/payout-account", json={**body, "transaction_pin": "2580"}, headers=_auth(tokens)
        )
        assert res.json()["code"] == "TRANSACTION_PIN_NOT_SET"


# ── New-phone approval ───────────────────────────────────────────────────────


class TestNewPhoneApproval:
    async def test_new_phone_waits_for_approval(self, api_client):
        phone_a = await _register(api_client)
        started = await _otp_login(api_client, PHONE_B)
        assert started["status"] == "approval_required"
        assert "access_token" not in started
        assert started["approver_devices"] == ["Tolu's iPhone"]
        assert started["expires_in"] == 600

        pending = (await api_client.get("/api/v1/auth/device-approvals/pending", headers=_auth(phone_a))).json()
        assert [p["device_name"] for p in pending] == ["Galaxy A54"]

    async def test_same_phone_signing_in_again_skips_approval(self, api_client):
        await _register(api_client)
        again = await _otp_login(api_client, PHONE_A)
        assert again["status"] == "signed_in"

    async def test_trusted_phone_skips_approval(self, api_client):
        phone_a = await _register(api_client)
        phone_b = await approve_new_phone(api_client, phone_a, PHONE_B)
        await api_client.post("/api/v1/auth/logout", headers=_auth(phone_b))
        # B signed out but still holds its device token: no new approval needed.
        back = await _otp_login(api_client, {**PHONE_B, "device_token": phone_b["device_token"]})
        assert back["status"] == "signed_in"

    async def test_first_phone_or_no_other_signed_in_phone_needs_no_approval(self, api_client):
        phone_a = await _register(api_client)
        await api_client.post("/api/v1/auth/logout", headers=_auth(phone_a))
        res = await _otp_login(api_client, PHONE_B)
        assert res["status"] == "signed_in"

    async def test_full_approval_flow(self, api_client, db_session):
        phone_a = await _register(api_client)
        await _set_pin(api_client, phone_a)
        started = await _otp_login(api_client, PHONE_B)
        aid, secret = started["approval_id"], started["approval_secret"]
        status_url = f"/api/v1/auth/device-approvals/{aid}/status"

        assert (await api_client.post(status_url, json={"approval_secret": secret})).json()["status"] == "pending"
        early = await api_client.post(
            f"/api/v1/auth/device-approvals/{aid}/complete", json={"approval_secret": secret, "code": "000000"}
        )
        assert early.json()["code"] == "APPROVAL_NOT_ACTIVE"

        approved = await api_client.post(
            f"/api/v1/auth/device-approvals/{aid}/approve", json={"pin": TEST_LOGIN_PIN}, headers=_auth(phone_a)
        )
        assert approved.status_code == 200, approved.text
        code = approved.json()["code"]
        assert len(code) == 6
        assert (await api_client.post(status_url, json={"approval_secret": secret})).json()["status"] == "approved"
        row = await db_session.get(DeviceApproval, aid)
        assert code not in (row.code_hash or "")

        wrong_code = "000000" if code != "000000" else "111111"
        wrong = await api_client.post(
            f"/api/v1/auth/device-approvals/{aid}/complete", json={"approval_secret": secret, "code": wrong_code}
        )
        assert wrong.json()["code"] == "APPROVAL_CODE_INVALID"
        assert wrong.json()["errors"] == [{"attempts_left": 4}]

        done = await api_client.post(
            f"/api/v1/auth/device-approvals/{aid}/complete",
            json={"approval_secret": secret, "code": code, "device": PHONE_B},
        )
        assert done.status_code == 200, done.text
        phone_b = done.json()
        assert phone_b["device_token"]
        assert (await api_client.get("/api/v1/auth/me", headers=_auth(phone_b))).status_code == 200
        # Both phones stay signed in.
        assert (await api_client.get("/api/v1/auth/me", headers=_auth(phone_a))).status_code == 200

        replay = await api_client.post(
            f"/api/v1/auth/device-approvals/{aid}/complete", json={"approval_secret": secret, "code": code}
        )
        assert replay.json()["code"] == "APPROVAL_NOT_ACTIVE"

    async def test_wrong_secret_cannot_poll_or_complete(self, api_client):
        await _register(api_client)
        started = await _otp_login(api_client, PHONE_B)
        res = await api_client.post(
            f"/api/v1/auth/device-approvals/{started['approval_id']}/status",
            json={"approval_secret": "x" * 43},
        )
        assert res.status_code == 404

    async def test_approving_needs_pin_or_enabled_biometrics(self, api_client):
        phone_a = await _register(api_client)
        await _set_pin(api_client, phone_a)
        started = await _otp_login(api_client, PHONE_B)
        url = f"/api/v1/auth/device-approvals/{started['approval_id']}/approve"

        bare = await api_client.post(url, json={}, headers=_auth(phone_a))
        assert bare.json()["code"] == "REAUTH_REQUIRED"
        bio_off = await api_client.post(url, json={"biometric": True}, headers=_auth(phone_a))
        assert bio_off.json()["code"] == "REAUTH_REQUIRED"
        wrong = await api_client.post(url, json={"pin": "000111"}, headers=_auth(phone_a))
        assert wrong.json()["code"] == "PIN_INVALID"

        no_pin = await api_client.post("/api/v1/auth/biometrics", json={"enabled": True}, headers=_auth(phone_a))
        assert no_pin.json()["code"] == "PIN_INVALID"
        on = await api_client.post(
            "/api/v1/auth/biometrics", json={"enabled": True, "pin": TEST_LOGIN_PIN}, headers=_auth(phone_a)
        )
        assert on.status_code == 204
        bio_on = await api_client.post(url, json={"biometric": True}, headers=_auth(phone_a))
        assert bio_on.status_code == 200, bio_on.text

    async def test_deny(self, api_client):
        phone_a = await _register(api_client)
        started = await _otp_login(api_client, PHONE_B)
        aid, secret = started["approval_id"], started["approval_secret"]
        res = await api_client.post(f"/api/v1/auth/device-approvals/{aid}/deny", headers=_auth(phone_a))
        assert res.status_code == 204
        status = await api_client.post(f"/api/v1/auth/device-approvals/{aid}/status", json={"approval_secret": secret})
        assert status.json()["status"] == "denied"
        assert (await api_client.get("/api/v1/auth/device-approvals/pending", headers=_auth(phone_a))).json() == []
        late = await api_client.post(
            f"/api/v1/auth/device-approvals/{aid}/approve", json={"pin": TEST_LOGIN_PIN}, headers=_auth(phone_a)
        )
        assert late.json()["code"] == "APPROVAL_NOT_ACTIVE"

    async def test_request_expires(self, api_client, db_session):
        await _register(api_client)
        started = await _otp_login(api_client, PHONE_B)
        row = await db_session.get(DeviceApproval, started["approval_id"])
        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db_session.commit()
        res = await api_client.post(
            f"/api/v1/auth/device-approvals/{started['approval_id']}/status",
            json={"approval_secret": started["approval_secret"]},
        )
        assert res.json()["status"] == "expired"

    async def test_retry_replaces_the_previous_request(self, api_client):
        phone_a = await _register(api_client)
        await _otp_login(api_client, PHONE_B)
        await _otp_login(api_client, PHONE_B)
        pending = (await api_client.get("/api/v1/auth/device-approvals/pending", headers=_auth(phone_a))).json()
        assert len(pending) == 1


class TestLostPhone:
    async def test_bvn_and_pin_sign_in_signs_everyone_else_out_and_holds_money(self, api_client, db_session):
        phone_a = await _register(api_client)
        await _set_pin(api_client, phone_a)
        await set_transaction_pin(api_client, _auth(phone_a))
        started = await _otp_login(api_client, PHONE_B)
        assert started["fallback_needs_pin"] is True
        url = f"/api/v1/auth/device-approvals/{started['approval_id']}/lost-phone"
        secret = started["approval_secret"]

        bad_bvn = await api_client.post(url, json={"approval_secret": secret, "bvn": "99999999999", "pin": TEST_LOGIN_PIN})
        assert bad_bvn.json()["code"] == "BVN_MISMATCH"
        no_pin = await api_client.post(url, json={"approval_secret": secret, "bvn": TEST_BVN})
        assert no_pin.json()["code"] == "PIN_INVALID"

        res = await api_client.post(
            url, json={"approval_secret": secret, "bvn": TEST_BVN, "pin": TEST_LOGIN_PIN, "device": PHONE_B}
        )
        assert res.status_code == 200, res.text
        phone_b = res.json()
        assert phone_b["customer"]["transfers_blocked_until"]

        # The old phone is signed out and no longer trusted.
        assert (await api_client.get("/api/v1/auth/me", headers=_auth(phone_a))).status_code == 401
        pin_back = await api_client.post(
            "/api/v1/auth/login/pin",
            json={"device_id": PHONE_A["device_id"], "device_token": phone_a["device_token"], "pin": TEST_LOGIN_PIN},
        )
        assert pin_back.json()["code"] == "DEVICE_NOT_TRUSTED"

        await _fund(db_session)
        held = await _withdraw(api_client, phone_b, TEST_TXN_PIN)
        assert held.status_code == 403
        assert held.json()["code"] == "TRANSFERS_ON_HOLD"

    async def test_too_many_wrong_tries_kill_the_request(self, api_client):
        await _register(api_client)
        started = await _otp_login(api_client, PHONE_B)
        url = f"/api/v1/auth/device-approvals/{started['approval_id']}/lost-phone"
        for _ in range(4):
            res = await api_client.post(url, json={"approval_secret": started["approval_secret"], "bvn": "99999999999"})
            assert res.json()["code"] == "BVN_MISMATCH"
        last = await api_client.post(url, json={"approval_secret": started["approval_secret"], "bvn": "99999999999"})
        assert last.json()["code"] == "APPROVAL_NOT_ACTIVE"
        right = await api_client.post(url, json={"approval_secret": started["approval_secret"], "bvn": TEST_BVN})
        assert right.json()["code"] == "APPROVAL_NOT_ACTIVE"


class TestRevocation:
    async def test_signing_a_phone_out_remotely_untrusts_it(self, api_client):
        phone_a = await _register(api_client)
        phone_b = await approve_new_phone(api_client, phone_a, PHONE_B)
        res = await api_client.delete(f"/api/v1/auth/sessions/{phone_b['session_id']}", headers=_auth(phone_a))
        assert res.status_code == 204
        pin_back = await api_client.post(
            "/api/v1/auth/login/pin",
            json={"device_id": PHONE_B["device_id"], "device_token": phone_b["device_token"], "pin": TEST_LOGIN_PIN},
        )
        assert pin_back.json()["code"] == "DEVICE_NOT_TRUSTED"
