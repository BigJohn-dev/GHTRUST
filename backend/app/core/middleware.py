"""ASGI middleware: request correlation IDs."""

import re
import uuid

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

REQUEST_ID_HEADER = "x-request-id"
# Accept a caller-supplied ID only if it is short and boring, so it can't be
# used to inject content into logs.
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


class RequestIDMiddleware:
    """
    Attach a request ID to every request.

    * Reuses an inbound ``X-Request-ID`` (e.g. from the mobile app or a load
      balancer) when well-formed, otherwise generates one.
    * Binds it to structlog context vars, so every log line for the request
      carries ``request_id``.
    * Exposes it on ``request.state.request_id`` (used by the error envelope)
      and echoes it in the ``X-Request-ID`` response header.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        inbound = ""
        for name, value in scope.get("headers", []):
            if name == REQUEST_ID_HEADER.encode():
                inbound = value.decode("latin-1")
                break
        request_id = inbound if _SAFE_REQUEST_ID.match(inbound) else uuid.uuid4().hex

        scope.setdefault("state", {})["request_id"] = request_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id, path=scope.get("path"), method=scope.get("method")
        )

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.encode(), request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            structlog.contextvars.clear_contextvars()


class ClientGateMiddleware:
    """
    Enforce the mobile version gate and maintenance mode.

    * Requests carrying ``X-App-Platform`` (ios|android) and ``X-App-Version``
      below the configured minimum get 426 APP_UPDATE_REQUIRED. Clients that
      don't send the headers (admin portal, integrations) are unaffected.
    * With MAINTENANCE_MODE on, customer-facing API routes return 503
      MAINTENANCE_MODE. Staff/admin routes, webhooks, health and app config stay
      up so operations and payment callbacks continue.
    """

    _ALWAYS_OPEN = ("/api/v1/app/config", "/api/v1/health", "/docs", "/redoc", "/openapi.json")
    _MAINTENANCE_EXEMPT = ("/api/v1/admin", "/api/v1/webhooks", *_ALWAYS_OPEN)

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        from app.core.config import get_settings
        from app.modules.app_config.service import min_version, update_required

        path = scope.get("path", "")
        if path.startswith(self._ALWAYS_OPEN) or scope.get("method") == "OPTIONS":
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1"): v.decode("latin-1") for k, v in scope.get("headers", [])}
        request_id = scope.get("state", {}).get("request_id")
        platform = headers.get("x-app-platform", "").lower()
        version = headers.get("x-app-version")
        if platform in ("ios", "android") and update_required(platform, version):
            await self._reject(
                send,
                426,
                "APP_UPDATE_REQUIRED",
                "Please update GH Trust to continue.",
                request_id,
                extra={"min_supported_version": min_version(platform)},
            )
            return

        settings = get_settings()
        if settings.maintenance_mode and not path.startswith(self._MAINTENANCE_EXEMPT):
            await self._reject(send, 503, "MAINTENANCE_MODE", settings.maintenance_message, request_id)
            return

        await self.app(scope, receive, send)

    @staticmethod
    async def _reject(send, status, code, message, request_id, extra=None):
        import json

        body = {"detail": message, "code": code, "request_id": request_id, **(extra or {})}
        headers = [(b"content-type", b"application/json")]
        if status == 503:
            headers.append((b"retry-after", b"300"))
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": json.dumps(body).encode()})
