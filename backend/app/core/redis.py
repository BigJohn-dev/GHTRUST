import asyncio
from functools import lru_cache
from urllib.parse import urlparse

import redis.asyncio as aioredis
import structlog

from app.core.config import settings

logger = structlog.get_logger()


@lru_cache
def get_redis_pool() -> aioredis.Redis:
    return aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )


async def get_redis() -> aioredis.Redis:
    return get_redis_pool()


async def redis_for_scope(scope) -> aioredis.Redis:
    """Redis for ASGI middleware, honouring FastAPI dependency overrides (tests)."""
    app = scope.get("app")
    override = getattr(app, "dependency_overrides", {}).get(get_redis) if app else None
    if override is not None:
        return await override()
    return get_redis_pool()


def _is_local(url: str) -> bool:
    return (urlparse(url).hostname or "") in {"localhost", "127.0.0.1", "::1"}


async def check_redis_on_startup() -> bool:
    """
    Ping Redis once at boot and say loudly if it's missing.

    The API still starts (so /health answers and the logs are readable), but sign-up,
    sign-in, OTPs and rate limits all need Redis, so every one of those requests would
    fail. On a hosted deploy the usual cause is REDIS_URL never being set, which leaves
    it on the localhost default.
    """
    local_default = _is_local(settings.redis_url) and settings.app_env != "development"
    try:
        await asyncio.wait_for(get_redis_pool().ping(), timeout=3)
    except Exception as exc:  # noqa: BLE001 - any failure here means "not reachable"
        logger.error(
            "redis_unreachable",
            redis_host=urlparse(settings.redis_url).hostname,
            error=f"{type(exc).__name__}: {exc}",
            hint=(
                "REDIS_URL is not set, so it points at localhost. Add a Redis service and set "
                "REDIS_URL to its connection URL."
                if local_default
                else "Check that REDIS_URL is correct and the Redis service is running."
            ),
            impact="sign-up, sign-in, OTPs and rate limits will return 503 until Redis is reachable",
        )
        return False
    if local_default:
        logger.warning(
            "redis_on_localhost",
            app_env=settings.app_env,
            hint="REDIS_URL points at localhost outside development; set it to your Redis service.",
        )
    return True
