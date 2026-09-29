"""
Push delivery through Expo's push service, which forwards to FCM (Android) and
APNs (iOS) using the credentials stored on the Expo project.

* PUSH_MOCK=true  → messages are logged and kept in ``MockPushSender.sent`` (dev, tests)
* PUSH_MOCK=false → POST https://exp.host/--/api/v2/push/send, up to 100 messages a call

Each message gets a ticket back. A ticket error of ``DeviceNotRegistered`` means
the app was uninstalled or the token is stale; the caller should forget that token.
"""

from dataclasses import dataclass, field
from typing import Protocol

import httpx
import structlog

from app.core.config import get_settings

logger = structlog.get_logger()

BATCH = 100


@dataclass
class PushMessage:
    to: str
    title: str
    body: str
    data: dict = field(default_factory=dict)

    def payload(self) -> dict:
        return {
            "to": self.to,
            "title": self.title,
            "body": self.body,
            "data": self.data,
            "sound": "default",
            "priority": "high",
            "channelId": "default",
        }


@dataclass
class PushTicket:
    token: str
    ok: bool
    # Expo's error code, e.g. "DeviceNotRegistered", "MessageRateExceeded".
    error: str | None = None

    @property
    def token_invalid(self) -> bool:
        return self.error == "DeviceNotRegistered"


class PushError(Exception):
    """The push service couldn't be reached or rejected the whole request."""


class PushSender(Protocol):
    async def send(self, messages: list[PushMessage]) -> list[PushTicket]: ...


class MockPushSender:
    sent: list[PushMessage] = []

    async def send(self, messages: list[PushMessage]) -> list[PushTicket]:
        for m in messages:
            MockPushSender.sent.append(m)
            logger.info("push_mock_delivery", token=_mask(m.to), title=m.title, body=m.body)
        return [PushTicket(token=m.to, ok=True) for m in messages]


class ExpoPushSender:
    def __init__(self) -> None:
        s = get_settings()
        self.url = s.expo_push_url
        self.headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if s.expo_push_access_token:
            self.headers["Authorization"] = f"Bearer {s.expo_push_access_token}"

    async def send(self, messages: list[PushMessage]) -> list[PushTicket]:
        tickets: list[PushTicket] = []
        async with httpx.AsyncClient(timeout=15) as client:
            for start in range(0, len(messages), BATCH):
                batch = messages[start : start + BATCH]
                try:
                    res = await client.post(self.url, json=[m.payload() for m in batch], headers=self.headers)
                except httpx.HTTPError as exc:
                    raise PushError(f"Push service unreachable: {exc}") from exc
                if res.status_code >= 400:
                    raise PushError(f"Push service returned {res.status_code}: {res.text[:200]}")
                data = res.json().get("data", [])
                for message, ticket in zip(batch, data, strict=False):
                    if ticket.get("status") == "ok":
                        tickets.append(PushTicket(token=message.to, ok=True))
                    else:
                        error = (ticket.get("details") or {}).get("error") or ticket.get("message")
                        tickets.append(PushTicket(token=message.to, ok=False, error=error))
        return tickets


def get_push_sender() -> PushSender:
    return MockPushSender() if get_settings().push_mock else ExpoPushSender()


def is_expo_token(token: str) -> bool:
    return token.startswith(("ExponentPushToken[", "ExpoPushToken[")) and token.endswith("]")


def _mask(token: str) -> str:
    return f"{token[:22]}…" if len(token) > 22 else token
