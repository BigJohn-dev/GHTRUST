"""Defensive-input sweep: no write endpoint may answer malformed input with a 5xx.

Every POST/PUT/PATCH/DELETE route is called with empty, null-filled and wrongly
typed bodies, and with path IDs that don't exist — each with the credentials its audience uses.
A 4xx is the right answer; a 500 means a missing null check or unhandled case.
"""

import uuid

from fastapi.routing import APIRoute

from app.main import create_app
from tests.conftest import refresh_settings
from tests.integration.test_loan_workflow_api import _customer_token, _seed

BODIES = [
    {},
    {"amount": None, "status": None, "note": None, "reference": None},
    {"amount": "not-a-number", "status": 123, "phone": [], "otp": {}, "action": "explode"},
    {"amount": "-5", "tenure_months": -1, "limit": 10**12},
]
# Provider callbacks verify signatures; covered by their own tests.
SKIP_PREFIXES = ("/api/v1/webhooks",)
# Ending the sweep's own session would turn every later call into a 401 and hide failures.
SKIP_SUBSTRINGS = ("logout", "/sessions")


def _write_routes():
    app = create_app()
    for route in app.routes:
        if not isinstance(route, APIRoute) or route.path.startswith(SKIP_PREFIXES):
            continue
        if any(part in route.path for part in SKIP_SUBSTRINGS):
            continue
        for method in route.methods & {"POST", "PUT", "PATCH", "DELETE"}:
            yield method, route.path


def _fill(path: str) -> str:
    out = path
    while "{" in out:
        start = out.index("{")
        end = out.index("}", start)
        out = out[:start] + str(uuid.uuid4()) + out[end + 1 :]
    return out


async def test_write_endpoints_never_500_on_bad_input(api_client, db_session, admin_headers, monkeypatch):
    # The sweep sends hundreds of requests; don't let the global limiter turn them into 429s.
    monkeypatch.setenv("RATE_LIMIT_API_PER_IP_MINUTE", "1000000")
    refresh_settings()
    await _seed(db_session)
    customer = {"Authorization": f"Bearer {await _customer_token(api_client)}"}

    failures, unexpected_401 = [], []
    statuses: dict[int, int] = {}
    for method, path in _write_routes():
        url = _fill(path)
        headers = admin_headers if path.startswith("/api/v1/admin") else customer
        for body in BODIES:
            res = await api_client.request(method, url, json=body, headers=headers)
            statuses[res.status_code] = statuses.get(res.status_code, 0) + 1
            if res.status_code >= 500:
                failures.append(f"{method} {path} {body} -> {res.status_code} {res.text[:160]}")
            elif res.status_code == 401 and "/auth/" not in path:
                unexpected_401.append(f"{method} {path}")

    print(dict(sorted(statuses.items())))
    assert statuses.get(429, 0) == 0, "rate limiter interfered with the sweep"
    assert not unexpected_401, f"credentials lost mid-sweep: {sorted(set(unexpected_401))[:5]}"
    assert sum(statuses.values()) > 150, statuses  # really exercised the API
    assert not failures, "5xx on malformed input:\n" + "\n".join(failures)
