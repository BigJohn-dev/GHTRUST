"""Production hardening: headers, limits, readiness, cache invalidation, worker safety."""

from app.core.cache import GENERATION_KEY
from app.core.config import Settings
from tests.conftest import refresh_settings
from tests.integration.test_disbursement_lifecycle import booked_loan


async def test_security_headers_on_api_responses(api_client):
    res = await api_client.get("/api/v1/health")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["referrer-policy"] == "no-referrer"
    assert res.headers["cache-control"] == "no-store"
    assert "strict-transport-security" not in res.headers  # production only


async def test_oversized_json_body_is_refused(api_client, monkeypatch):
    monkeypatch.setenv("MAX_JSON_BODY_KB", "1")
    refresh_settings()
    big = {"phone": "0" * 4000}
    res = await api_client.post("/api/v1/admin/auth/login/request-otp", json=big)
    assert res.status_code == 413
    assert res.json()["code"] == "PAYLOAD_TOO_LARGE"

    # A body without a truthful Content-Length is still bounded.
    res = await api_client.post(
        "/api/v1/admin/auth/login/request-otp",
        content=b'{"phone":"' + b"0" * 4000 + b'"}',
        headers={"content-type": "application/json", "content-length": "20"},
    )
    assert res.status_code in (400, 413, 422)


async def test_api_rate_limit_per_ip(api_client, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_API_PER_IP_MINUTE", "3")
    refresh_settings()
    codes = [(await api_client.get("/api/v1/app/config", params={"platform": "android"})).status_code for _ in range(5)]
    assert codes[:3] == [200, 200, 200]
    limited = await api_client.get("/api/v1/app/config", params={"platform": "android"})
    assert limited.status_code == 429
    assert limited.json()["code"] == "RATE_LIMITED"
    assert int(limited.headers["retry-after"]) >= 1
    # Health checks are never throttled (load balancers poll them).
    assert (await api_client.get("/api/v1/health")).status_code == 200
    assert (await api_client.get("/health")).status_code == 200


async def test_root_health_aliases(api_client):
    # Unversioned paths for hosting platforms; same answers as /api/v1/health*.
    live = await api_client.get("/health")
    assert live.status_code == 200
    assert live.json() == (await api_client.get("/api/v1/health")).json()
    ready = await api_client.get("/health/ready")
    assert ready.status_code == 200
    assert ready.json()["checks"] == {"database": "ok", "redis": "ok"}


async def test_readiness_reports_dependencies(api_client):
    res = await api_client.get("/api/v1/health/ready")
    assert res.status_code == 200
    assert res.json()["checks"] == {"database": "ok", "redis": "ok"}


async def test_dashboard_cache_invalidated_by_writes(api_client, db_session, admin_headers, fake_redis):
    loan = await booked_loan(api_client, db_session, admin_headers)
    first = (await api_client.get("/api/v1/admin/dashboard", headers=admin_headers)).json()
    generation = await fake_redis.get(GENERATION_KEY)
    assert any(k.startswith("cache:admin:dashboard") for k in await fake_redis.keys("cache:*"))

    # Served from cache while nothing changes...
    again = (await api_client.get("/api/v1/admin/dashboard", headers=admin_headers)).json()
    assert again == first

    # ...and never stale after a write.
    await api_client.post(
        f"/api/v1/admin/loans/loans/{loan.id}/repayments",
        json={"amount": "50000.00", "channel": "cash", "reference": "CACHE-1"},
        headers=admin_headers,
    )
    assert await fake_redis.get(GENERATION_KEY) != generation
    after = (await api_client.get("/api/v1/admin/dashboard", headers=admin_headers)).json()
    assert after["loan_book_amount"] < first["loan_book_amount"]


def test_production_refuses_insecure_cors_and_public_docs():
    s = Settings(
        app_env="production",
        cors_origins="http://portal.ghtrust.com",
        enable_api_docs=True,
    )
    problems = "\n".join(s.production_config_errors())
    assert "https://" in problems
    assert "ENABLE_API_DOCS" in problems


def test_periodic_money_tasks_retry_and_never_overlap(monkeypatch):
    import fakeredis

    from app.core.celery_app import celery_app
    from app.workers import tasks

    for name in ("process_pending_withdrawals", "reconcile_payments", "refresh_loan_statuses"):
        assert getattr(tasks, name).autoretry_for, f"{name} does not retry transient failures"
    assert celery_app.conf.task_acks_late is True
    assert celery_app.conf.task_reject_on_worker_lost is True

    server = fakeredis.FakeServer()
    monkeypatch.setattr(tasks.sync_redis.Redis, "from_url", classmethod(lambda cls, url: fakeredis.FakeRedis(server=server)))
    runs = []

    @tasks.single_flight("demo", ttl_seconds=60)
    def job():
        runs.append(1)
        # A second trigger while this run holds the lock is skipped.
        assert job_again() == {"status": "skipped", "reason": "already running"}
        return "done"

    job_again = tasks.single_flight("demo", ttl_seconds=60)(lambda: runs.append(2))
    assert job() == "done"
    assert runs == [1]
    assert fakeredis.FakeRedis(server=server).get("cache:generation") == b"1"  # reads invalidated
    assert job() == "done"  # lock released after the run
