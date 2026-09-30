"""Postgres down: a fast, clean 503 and one log line, never a 500 with a traceback flood."""

import fakeredis.aioredis
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import check_database_on_startup, get_db
from app.core.redis import get_redis
from app.main import create_app

# Nothing listens on port 1: connections fail like a stopped Postgres.
UNREACHABLE = "postgresql+asyncpg://ghtrust:x@127.0.0.1:1/ghtrust_mfb"


def _app_with_dead_database():
    engine = create_async_engine(UNREACHABLE, connect_args={"timeout": 2})
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    app = create_app()

    async def dead_db():
        async with sessions() as session:
            yield session

    async def fake_redis():
        return redis

    app.dependency_overrides[get_db] = dead_db
    app.dependency_overrides[get_redis] = fake_redis
    return app, engine


async def test_requests_get_a_retryable_503_when_postgres_is_down():
    app, engine = _app_with_dead_database()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/auth/login/request-otp", json={"phone": "08027218077"})
    await engine.dispose()

    assert res.status_code == 503, res.text
    assert res.json()["code"] == "SERVICE_UNAVAILABLE"
    assert res.headers["retry-after"] == "30"


async def test_other_os_errors_are_still_reported_as_bugs():
    app, engine = _app_with_dead_database()

    @app.get("/boom")
    async def boom():
        raise OSError("disk full while writing an upload")

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as client:
        res = await client.get("/boom")
    await engine.dispose()
    assert res.status_code == 500


async def test_startup_check_reports_an_unreachable_database():
    engine = create_async_engine(UNREACHABLE, connect_args={"timeout": 2})
    assert await check_database_on_startup(engine) is False
    await engine.dispose()
