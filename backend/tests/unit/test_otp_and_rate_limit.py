import pytest
from fastapi import HTTPException

from app.core.rate_limit import OtpService, RateLimitExceeded, RateLimiter
from tests.conftest import TEST_OTP, refresh_settings


class TestOtpService:
    async def test_send_and_verify_success(self, fake_redis, fixed_otp):
        otp_svc = OtpService(fake_redis)
        expires = await otp_svc.send("register", "22222222222", "+2348035794364")
        assert expires == 600
        assert await otp_svc.verify("register", "22222222222", TEST_OTP) is True

    async def test_verify_wrong_otp_increments_attempts(self, fake_redis, fixed_otp):
        otp_svc = OtpService(fake_redis)
        await otp_svc.send("register", "22222222222", "+2348035794364")

        with pytest.raises(HTTPException) as exc:
            await otp_svc.verify("register", "22222222222", "000000")
        assert exc.value.status_code == 400
        assert "remaining" in exc.value.detail.lower()

    async def test_verify_expired_otp(self, fake_redis, fixed_otp):
        otp_svc = OtpService(fake_redis)
        with pytest.raises(HTTPException) as exc:
            await otp_svc.verify("register", "22222222222", TEST_OTP)
        assert exc.value.status_code == 400
        assert "expired" in exc.value.detail.lower()

    async def test_max_attempts_lockout(self, fake_redis, fixed_otp, monkeypatch):
        monkeypatch.setenv("OTP_MAX_ATTEMPTS", "2")
        refresh_settings()

        otp_svc = OtpService(fake_redis)
        await otp_svc.send("register", "22222222222", "+2348035794364")

        for _ in range(2):
            with pytest.raises(HTTPException):
                await otp_svc.verify("register", "22222222222", "000000")

        with pytest.raises(HTTPException) as exc:
            await otp_svc.verify("register", "22222222222", "000000")
        assert exc.value.status_code == 429

    async def test_otp_consumed_after_success(self, fake_redis, fixed_otp):
        otp_svc = OtpService(fake_redis)
        await otp_svc.send("login", "+2348035794364", "+2348035794364")
        await otp_svc.verify("login", "+2348035794364", TEST_OTP)

        with pytest.raises(HTTPException) as exc:
            await otp_svc.verify("login", "+2348035794364", TEST_OTP)
        assert exc.value.status_code == 400


class TestRateLimiter:
    async def test_allows_under_limit(self, fake_redis):
        limiter = RateLimiter(fake_redis)
        for _ in range(3):
            await limiter.hit("test:key", limit=5, window_seconds=60)

    async def test_blocks_over_limit(self, fake_redis):
        limiter = RateLimiter(fake_redis)
        for _ in range(5):
            await limiter.hit("test:block", limit=5, window_seconds=60)

        with pytest.raises(RateLimitExceeded) as exc:
            await limiter.hit("test:block", limit=5, window_seconds=60)
        assert exc.value.status_code == 429
        assert "Retry-After" in exc.value.headers

    async def test_bvn_registration_dual_limits(self, fake_redis):
        limiter = RateLimiter(fake_redis)
        await limiter.check_bvn_registration("1.2.3.4", "22222222222")
        await limiter.check_bvn_registration("1.2.3.4", "33333333333")

    async def test_otp_send_per_phone_limit(self, fake_redis, monkeypatch):
        monkeypatch.setenv("RATE_LIMIT_OTP_SEND_PER_PHONE_15MIN", "2")
        refresh_settings()

        limiter = RateLimiter(fake_redis)
        phone = "+2348035794364"
        await limiter.check_otp_send("1.2.3.4", phone)
        await limiter.check_otp_send("1.2.3.4", phone)

        with pytest.raises(RateLimitExceeded):
            await limiter.check_otp_send("1.2.3.4", phone)
