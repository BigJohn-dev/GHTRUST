"""
Redis read-through cache for expensive, frequently-read aggregates.

Correctness over cleverness: every cache key embeds a global *generation*
number that ``CacheGenerationMiddleware`` bumps after any successful write to the
API. So a cached value is served only until something changes — never stale after
an approval, disbursement or repayment — and the TTL is just a backstop.

Fails open: if Redis is unavailable the loader runs directly.
"""

from collections.abc import Awaitable, Callable
from typing import TypeVar

import structlog
from pydantic import BaseModel
from redis.asyncio import Redis
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.redis import redis_for_scope

logger = structlog.get_logger()
GENERATION_KEY = "cache:generation"
M = TypeVar("M", bound=BaseModel)


async def cached_model(
    redis: Redis,
    name: str,
    model: type[M],
    loader: Callable[[], Awaitable[M]],
    *,
    ttl_seconds: int = 60,
) -> M:
    try:
        generation = await redis.get(GENERATION_KEY) or "0"
        key = f"cache:{name}:g{generation}"
        hit = await redis.get(key)
        if hit is not None:
            return model.model_validate_json(hit)
    except Exception:
        logger.warning("cache_unavailable", cache=name, exc_info=True)
        return await loader()

    value = await loader()
    try:
        await redis.set(key, value.model_dump_json(), ex=ttl_seconds)
    except Exception:
        logger.warning("cache_write_failed", cache=name, exc_info=True)
    return value


class CacheGenerationMiddleware:
    """After any successful non-GET API request, invalidate every cached read."""

    _WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("method") not in self._WRITE_METHODS:
            await self.app(scope, receive, send)
            return
        status = {"code": 0}

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                status["code"] = message["status"]
            await send(message)

        await self.app(scope, receive, send_wrapper)
        if 200 <= status["code"] < 300:
            try:
                redis = await redis_for_scope(scope)
                await redis.incr(GENERATION_KEY)
            except Exception:
                logger.warning("cache_invalidation_failed", exc_info=True)
