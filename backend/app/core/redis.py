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
