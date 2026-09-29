"""
Customer PINs: the 6-digit sign-in PIN and the 4-digit transaction PIN.

A PIN has at most a million values, so a salted hash alone would fall to an offline
search in seconds if the database leaked. Each hash is therefore also keyed with a
server-side pepper derived from SECRET_KEY, which never lives in the database: without
it a stolen hash can't be tested at all. Rotating SECRET_KEY invalidates every PIN
(customers reset theirs), so rotate it only for a real compromise.

Online guessing is capped by per-PIN attempt limits in the security service.
"""

import hashlib
import hmac
import secrets

from app.core.config import get_settings

LOGIN_PIN_LENGTH = 6
TRANSACTION_PIN_LENGTH = 4

_SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def _pepper() -> bytes:
    return hmac.new(get_settings().secret_key.encode(), b"ghtrust-pin-pepper-v1", hashlib.sha256).digest()


def _derive(pin: str, salt: bytes) -> bytes:
    keyed = hmac.new(_pepper(), pin.encode(), hashlib.sha256).digest()
    return hashlib.scrypt(keyed, salt=salt, **_SCRYPT)


def hash_pin(pin: str) -> str:
    salt = secrets.token_bytes(16)
    return f"scrypt${salt.hex()}${_derive(pin, salt).hex()}"


def verify_pin(pin: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    return hmac.compare_digest(_derive(pin, bytes.fromhex(salt_hex)), bytes.fromhex(digest_hex))


def weak_pin_reason(pin: str, *, length: int, birth_patterns: tuple[str, ...] = ()) -> str | None:
    """Why a chosen PIN is too easy to guess, or None if it's acceptable."""
    if len(pin) != length or not pin.isdigit():
        return f"Your PIN must be exactly {length} digits."
    if len(set(pin)) == 1:
        return "Avoid repeating one digit, like 1111."
    digits = [int(c) for c in pin]
    steps = {b - a for a, b in zip(digits, digits[1:])}
    if steps in ({1}, {-1}):
        return "Avoid counting up or down, like 1234."
    if len(set(pin)) <= 2 and length >= 6:
        return "Use more than two different digits."
    if pin in birth_patterns:
        return "Avoid your date of birth."
    return None


def keyed_digest(value: str) -> str:
    """HMAC of a short secret (e.g. a 6-digit approval code) that can't be reversed without the pepper."""
    return hmac.new(_pepper(), value.encode(), hashlib.sha256).hexdigest()
