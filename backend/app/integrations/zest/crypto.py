"""AES authData encryption matching Zest / CryptoJS (CBC + ZeroPadding)."""

import base64
import json
from typing import Any


def _latin1_bytes(value: str) -> bytes:
    return value.encode("latin-1")


def encrypt_auth_data(payload: dict[str, Any], *, key: str, iv: str) -> str:
    """
    Encrypt inner VAS payload for Zest ``authData`` field.

    Mirrors:
    CryptoJS.AES.encrypt(JSON.stringify(payload), Latin1.parse(key),
      { iv: Latin1.parse(iv), mode: CBC, padding: ZeroPadding })
    """
    from Crypto.Cipher import AES

    plaintext = json.dumps(payload, separators=(",", ":"))
    data = plaintext.encode("utf-8")
    block_size = AES.block_size
    pad_len = (block_size - len(data) % block_size) % block_size
    if pad_len:
        data += b"\x00" * pad_len

    key_bytes = _latin1_bytes(key)
    iv_bytes = _latin1_bytes(iv)
    if len(key_bytes) not in {16, 24, 32}:
        raise ValueError("Zest encryption key must be 16, 24, or 32 bytes (Latin-1)")
    if len(iv_bytes) != 16:
        raise ValueError("Zest encryption IV must be 16 bytes (Latin-1)")

    cipher = AES.new(key_bytes, AES.MODE_CBC, iv_bytes)
    encrypted = cipher.encrypt(data)
    return base64.b64encode(encrypted).decode("ascii")


def default_encryption_key_from_secret(secret_key: str) -> str:
    """Zest docs use a 32-char key; merchant secret often works without SK_ prefix."""
    normalized = secret_key.strip()
    if normalized.upper().startswith("SK_"):
        normalized = normalized[3:]
    return normalized
