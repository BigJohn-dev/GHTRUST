from functools import lru_cache

import redis.asyncio as aioredis

from app.core.config import settings


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
