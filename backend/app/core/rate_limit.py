import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import HTTPException, Request, status
from redis.asyncio import Redis

from app.core.config import settings

logger = structlog.get_logger()


class RateLimitExceeded(HTTPException):
    def __init__(self, retry_after: int = 60):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )


class RateLimiter:
    """Redis sliding-window rate limiter."""

    def __init__(self, redis: Redis):
        self.redis = redis

    async def hit(self, key: str, limit: int, window_seconds: int) -> None:
        if not settings.rate_limits_active:
            return
        full_key = f"ratelimit:{key}"
        count = await self.redis.incr(full_key)
        if count == 1:
            await self.redis.expire(full_key, window_seconds)
        if count > limit:
            ttl = await self.redis.ttl(full_key)
            raise RateLimitExceeded(retry_after=max(ttl, 1))

    async def check_bvn_registration(self, ip: str, bvn: str) -> None:
        await self.hit(f"bvn:ip:{ip}", settings.rate_limit_bvn_per_ip_hour, 3600)
        await self.hit(f"bvn:bvn:{bvn}", settings.rate_limit_bvn_per_bvn_day, 86400)

    async def check_otp_send(self, ip: str, phone: str) -> None:
        await self.hit(f"otp:send:phone:{phone}", settings.rate_limit_otp_send_per_phone_15min, 900)
        await self.hit(f"otp:send:ip:{ip}", settings.rate_limit_otp_send_per_ip_hour, 3600)

    async def check_otp_verify(self, ip: str) -> None:
        await self.hit(f"otp:verify:ip:{ip}", settings.rate_limit_otp_verify_per_ip_hour, 3600)

    async def check_login_request(self, ip: str, phone: str) -> None:
        await self.hit(f"login:phone:{phone}", settings.rate_limit_login_request_per_phone_15min, 900)
        await self.hit(f"login:ip:{ip}", settings.rate_limit_otp_send_per_ip_hour, 3600)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(f"{otp}:{settings.secret_key}".encode()).hexdigest()


class OtpService:
    """OTP generation, storage, and verification via Redis."""

    def __init__(self, redis: Redis):
        self.redis = redis

    def _generate(self) -> str:
        return "".join(secrets.choice("0123456789") for _ in range(settings.otp_length))

    async def send(
        self,
        purpose: str,
        identifier: str,
        phone: str,
    ) -> int:
        """Generate OTP, store hash in Redis, dispatch SMS. Returns expiry seconds."""
        otp = self._generate()
        key = f"otp:{purpose}:{identifier}"
        attempts_key = f"otp:attempts:{purpose}:{identifier}"

        await self.redis.setex(key, settings.otp_expire_seconds, _hash_otp(otp))
        await self.redis.setex(attempts_key, settings.otp_expire_seconds, "0")

        await self._dispatch_sms(phone, otp, purpose)
        return settings.otp_expire_seconds

    async def verify(self, purpose: str, identifier: str, otp: str) -> bool:
        key = f"otp:{purpose}:{identifier}"
        attempts_key = f"otp:attempts:{purpose}:{identifier}"

        stored = await self.redis.get(key)
        if not stored:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP expired or not found. Request a new one.",
            )

        attempts = int(await self.redis.get(attempts_key) or "0")
        if attempts >= settings.otp_max_attempts:
            await self.redis.delete(key, attempts_key)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed OTP attempts. Request a new OTP.",
            )

        if stored != _hash_otp(otp):
            await self.redis.incr(attempts_key)
            remaining = settings.otp_max_attempts - attempts - 1
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OTP. {remaining} attempt(s) remaining.",
            )

        await self.redis.delete(key, attempts_key)
        return True

    async def _dispatch_sms(self, phone: str, otp: str, purpose: str) -> None:
        if settings.sms_mock or settings.debug:
            logger.info(
                "sms_otp_mock",
                phone=CustomerMask.mask_phone(phone),
                purpose=purpose,
                otp=otp if settings.debug else "******",
            )
            return
        # TODO: Termii / Africa's Talking integration
        logger.info("sms_otp_sent", phone=CustomerMask.mask_phone(phone), purpose=purpose)


class CustomerMask:
    @staticmethod
    def mask_phone(phone: str) -> str:
        from app.modules.users.models import Customer
        return Customer.mask_phone(phone)

    @staticmethod
    def mask_bvn(bvn: str) -> str:
        if len(bvn) >= 6:
            return f"{bvn[:3]}****{bvn[-3:]}"
        return "****"
