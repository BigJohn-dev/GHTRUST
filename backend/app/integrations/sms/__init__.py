"""
SMS delivery.

Provider integrations (Termii / Africa's Talking) are pending credentials. Until
one is wired in, the behaviour is deliberately loud:

* SMS_MOCK=true             → OTP written to the log (local dev only)
* SMS_MOCK=false, no provider → 503 SMS_UNAVAILABLE, and the production config
                               guard refuses to boot. Previously this path
                               silently sent nothing, so login looked healthy
                               while no customer could receive an OTP.

To add a provider: implement ``SmsSender.send`` and return it from
``get_sms_sender`` for the matching ``SMS_PROVIDER`` value.
"""

from typing import Protocol

import structlog
from fastapi import status

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode

logger = structlog.get_logger()


class SmsSender(Protocol):
    async def send(self, phone: str, message: str) -> None: ...


class ConsoleSmsSender:
    """Dev-only sender: logs the message instead of sending it."""

    async def send(self, phone: str, message: str) -> None:
        logger.info("sms_mock_delivery", phone=_mask(phone), message=message)


class UnavailableSmsSender:
    def __init__(self, reason: str) -> None:
        self.reason = reason

    async def send(self, phone: str, message: str) -> None:
        logger.error("sms_unavailable", reason=self.reason, phone=_mask(phone))
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            ErrorCode.SMS_UNAVAILABLE,
            "We couldn't send your verification code right now. Please try again shortly.",
        )


def get_sms_sender() -> SmsSender:
    settings = get_settings()
    if settings.sms_mock:
        return ConsoleSmsSender()
    provider = settings.sms_provider.strip().lower()
    if not provider:
        return UnavailableSmsSender("SMS_MOCK=false but SMS_PROVIDER is not set")
    # TODO(sms-provider): return TermiiSender() / AfricasTalkingSender() once
    # credentials and sender ID are provisioned.
    return UnavailableSmsSender(f"SMS provider '{provider}' is not integrated yet")


def otp_message(otp: str, purpose: str) -> str:
    action = {
        "register": "complete your GH Trust registration",
        "login": "sign in to GH Trust",
        "staff_login": "sign in to the GH Trust admin portal",
    }.get(purpose, "verify your GH Trust request")
    return f"{otp} is your code to {action}. It expires in 10 minutes. Never share it."


def _mask(phone: str) -> str:
    return f"{phone[:4]}****{phone[-4:]}" if len(phone) >= 8 else "****"
