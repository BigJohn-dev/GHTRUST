"""Redis missing or down: a loud startup log and a clean 503, never a bare 500."""

from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError
from structlog.testing import capture_logs

from app.core import redis as redis_module
from app.core.errors import register_exception_handlers


def _app_raising(exc: Exception) -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    async def boom():
        raise exc

    return app


@pytest.mark.parametrize(
    "exc",
    [
        RedisConnectionError("Error 111 connecting to localhost:6379. Connection refused."),
        RedisTimeoutError("Timeout reading from socket"),
    ],
)
async def test_redis_errors_become_503(exc):
    transport = httpx.ASGITransport(app=_app_raising(exc), raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/boom")
    assert res.status_code == 503
    assert res.json()["code"] == "SERVICE_UNAVAILABLE"
    assert res.headers["Retry-After"] == "30"
    assert "6379" not in res.text  # internals stay in the logs


class _Pool:
    def __init__(self, fail: bool):
        self.fail = fail

    async def ping(self):
        if self.fail:
            raise RedisConnectionError("Connection refused.")
        return True


def _patch(monkeypatch, *, url: str, env: str, fail: bool):
    monkeypatch.setattr(redis_module, "settings", SimpleNamespace(redis_url=url, app_env=env))
    monkeypatch.setattr(redis_module, "get_redis_pool", lambda: _Pool(fail))


async def test_startup_logs_unreachable_redis_with_localhost_hint(monkeypatch):
    _patch(monkeypatch, url="redis://localhost:6379/0", env="staging", fail=True)
    with capture_logs() as logs:
        assert await redis_module.check_redis_on_startup() is False
    [entry] = [e for e in logs if e["event"] == "redis_unreachable"]
    assert entry["log_level"] == "error"
    assert "REDIS_URL is not set" in entry["hint"]


async def test_startup_unreachable_remote_redis_gets_generic_hint(monkeypatch):
    _patch(monkeypatch, url="redis://default:pw@redis.railway.internal:6379", env="staging", fail=True)
    with capture_logs() as logs:
        assert await redis_module.check_redis_on_startup() is False
    [entry] = [e for e in logs if e["event"] == "redis_unreachable"]
    assert "Check that REDIS_URL is correct" in entry["hint"]
    assert "pw" not in str(entry)  # never log the password


async def test_startup_warns_on_localhost_outside_development(monkeypatch):
    _patch(monkeypatch, url="redis://localhost:6379/0", env="staging", fail=False)
    with capture_logs() as logs:
        assert await redis_module.check_redis_on_startup() is True
    assert [e["event"] for e in logs] == ["redis_on_localhost"]


async def test_startup_quiet_when_healthy(monkeypatch):
    _patch(monkeypatch, url="redis://localhost:6379/0", env="development", fail=False)
    with capture_logs() as logs:
        assert await redis_module.check_redis_on_startup() is True
    assert logs == []
