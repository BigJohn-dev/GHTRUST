"""
Error tracking (Sentry), off unless SENTRY_DSN is set.

Privacy: this API handles BVNs, phone numbers and account details, so events are
sent without request bodies, cookies, auth headers or user IPs
(``send_default_pii=False`` plus ``_scrub`` below). Structured logs remain the
system of record; Sentry adds alerting, grouping and stack traces.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import structlog

if TYPE_CHECKING:
    from app.core.config import Settings

logger = structlog.get_logger()
_enabled = False

_SENSITIVE_HEADERS = {"authorization", "cookie", "set-cookie", "x-api-key", "x-token-transport"}


def _scrub(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any]:
    request = event.get("request") or {}
    request.pop("data", None)
    request.pop("cookies", None)
    request.pop("query_string", None)  # may carry phone/BVN search terms
    headers = request.get("headers")
    if isinstance(headers, dict):
        request["headers"] = {k: ("[filtered]" if k.lower() in _SENSITIVE_HEADERS else v) for k, v in headers.items()}
    event.pop("user", None)
    return event


def init_error_tracking(settings: Settings, *, component: str = "api") -> None:
    global _enabled
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:  # dependency missing: keep running, say so loudly
        logger.error("sentry_unavailable", reason="sentry-sdk not installed")
        return

    from app import __version__

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        release=f"ghtrust-api@{__version__}",
        send_default_pii=False,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        before_send=_scrub,
        integrations=[
            StarletteIntegration(failed_request_status_codes={*range(500, 600)}),
            FastApiIntegration(failed_request_status_codes={*range(500, 600)}),
            CeleryIntegration(),
        ],
    )
    sentry_sdk.set_tag("component", component)
    _enabled = True
    logger.info("error_tracking_enabled", component=component)


def capture_exception(exc: BaseException) -> None:
    """Report an exception we handled ourselves (e.g. converted to a 500)."""
    if not _enabled:
        return
    import sentry_sdk

    sentry_sdk.capture_exception(exc)
