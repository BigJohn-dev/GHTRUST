"""
Idempotency-Key support for authenticated mutating requests.

A client that retries a POST/PUT/PATCH/DELETE with the same ``Idempotency-Key``
header gets the ORIGINAL response replayed (with ``Idempotent-Replayed: true``)
instead of the action running twice. Mobile networks drop responses after the
server has acted; without this, "retry" meant a duplicate application,
submission or withdrawal.

Semantics (per authenticated subject, 24h window):
* first request      → runs; a response < 500 is stored and replayed later
* same key, running  → 409 IDEMPOTENCY_IN_PROGRESS (client should back off)
* same key, new body → 422 IDEMPOTENCY_KEY_REUSED
* response >= 500    → not stored, so the client can retry
* no header          → request runs normally (header optional except where a
                       route requires it, e.g. withdrawals)

Unauthenticated routes (OTP login, webhooks) are passed through untouched.
"""

import base64
import hashlib
import json
import re

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.redis import redis_for_scope
from app.core.security import TOKEN_TYPE_CUSTOMER, TOKEN_TYPE_STAFF, TokenError, decode_access_token

logger = structlog.get_logger()

HEADER = b"idempotency-key"
KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
TTL_SECONDS = 24 * 3600
IN_FLIGHT_TTL_SECONDS = 120
_MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
_EXCLUDED_PREFIXES = ("/api/v1/webhooks", "/api/v1/auth/", "/api/v1/admin/auth/")


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope.get("headers", []):
        if key == name:
            return value.decode("latin-1")
    return None


def _subject(scope: Scope) -> str | None:
    auth = _header(scope, b"authorization") or ""
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    for typ in (TOKEN_TYPE_CUSTOMER, TOKEN_TYPE_STAFF):
        try:
            return f"{typ}:{decode_access_token(token, expected_typ=typ).sub}"
        except TokenError:
            continue
    return None


async def _redis_for(scope: Scope):
    return await redis_for_scope(scope)


async def _send_json(send: Send, status: int, body: dict, extra_headers=()) -> None:
    payload = json.dumps(body).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"), *extra_headers],
        }
    )
    await send({"type": "http.response.body", "body": payload})


class IdempotencyMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") not in _MUTATING
            or scope.get("path", "").startswith(_EXCLUDED_PREFIXES)
        ):
            await self.app(scope, receive, send)
            return

        key = _header(scope, HEADER)
        if key is None:
            await self.app(scope, receive, send)
            return
        request_id = scope.get("state", {}).get("request_id")
        if not KEY_PATTERN.match(key):
            await _send_json(
                send,
                400,
                {
                    "detail": "Idempotency-Key must be 8-64 characters: letters, digits, '-' or '_'.",
                    "code": "IDEMPOTENCY_KEY_INVALID",
                    "request_id": request_id,
                },
            )
            return

        subject = _subject(scope)
        if subject is None:  # unauthenticated: the route itself will reject it
            await self.app(scope, receive, send)
            return

        # Buffer the body so it can be fingerprinted and then replayed downstream.
        chunks: list[bytes] = []
        more = True
        while more:
            message = await receive()
            chunks.append(message.get("body", b""))
            more = message.get("more_body", False)
        body = b"".join(chunks)
        fingerprint = hashlib.sha256(
            scope["method"].encode() + b" " + scope["path"].encode() + b"\n" + body
        ).hexdigest()

        redis = await _redis_for(scope)
        store_key = f"idem:{subject}:{key}"
        claimed = await redis.set(
            store_key,
            json.dumps({"state": "processing", "fingerprint": fingerprint}),
            nx=True,
            ex=IN_FLIGHT_TTL_SECONDS,
        )
        if not claimed:
            await self._replay(send, await redis.get(store_key), fingerprint, request_id)
            return

        replayed = False

        async def replay_receive() -> Message:
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        captured: dict = {"status": 500, "headers": [], "body": []}

        async def capture_send(message: Message) -> None:
            if message["type"] == "http.response.start":
                captured["status"] = message["status"]
                captured["headers"] = [
                    (k, v) for k, v in message.get("headers", []) if k.lower() in (b"content-type", b"location")
                ]
            elif message["type"] == "http.response.body":
                captured["body"].append(message.get("body", b""))
            await send(message)

        try:
            await self.app(scope, replay_receive, capture_send)
        except Exception:
            await redis.delete(store_key)
            raise

        if captured["status"] >= 500:
            await redis.delete(store_key)
            return
        record = {
            "state": "done",
            "fingerprint": fingerprint,
            "status": captured["status"],
            "headers": [[k.decode("latin-1"), v.decode("latin-1")] for k, v in captured["headers"]],
            "body": base64.b64encode(b"".join(captured["body"])).decode("ascii"),
        }
        await redis.set(store_key, json.dumps(record), ex=TTL_SECONDS)

    @staticmethod
    async def _replay(send: Send, raw: str | None, fingerprint: str, request_id: str | None) -> None:
        record = json.loads(raw) if raw else {"state": "processing"}
        if record.get("fingerprint") and record["fingerprint"] != fingerprint:
            await _send_json(
                send,
                422,
                {
                    "detail": "This Idempotency-Key was already used for a different request.",
                    "code": "IDEMPOTENCY_KEY_REUSED",
                    "request_id": request_id,
                },
            )
            return
        if record.get("state") != "done":
            await _send_json(
                send,
                409,
                {
                    "detail": "A request with this Idempotency-Key is still being processed.",
                    "code": "IDEMPOTENCY_IN_PROGRESS",
                    "request_id": request_id,
                },
                extra_headers=[(b"retry-after", b"2")],
            )
            return
        headers = [(k.encode("latin-1"), v.encode("latin-1")) for k, v in record.get("headers", [])]
        headers.append((b"idempotent-replayed", b"true"))
        await send({"type": "http.response.start", "status": record["status"], "headers": headers})
        await send({"type": "http.response.body", "body": base64.b64decode(record["body"])})
