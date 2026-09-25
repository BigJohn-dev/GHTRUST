from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.core.config import get_settings
from app.core.security import (
    TOKEN_TYPE_CUSTOMER,
    TOKEN_TYPE_STAFF,
    TokenError,
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_token,
)


def _customer_token(**kw) -> str:
    token, _ = create_access_token(
        "cust-123", typ=TOKEN_TYPE_CUSTOMER, session_id="sess-1", phone="+2348035794364", **kw
    )
    return token


class TestAccessToken:
    def test_round_trip(self):
        claims = decode_access_token(_customer_token(), expected_typ=TOKEN_TYPE_CUSTOMER)
        assert claims.sub == "cust-123"
        assert claims.sid == "sess-1"
        assert claims.phone == "+2348035794364"
        assert claims.typ == TOKEN_TYPE_CUSTOMER

    def test_expires_in_matches_configured_ttl(self):
        _, expires_in = create_access_token("c", typ=TOKEN_TYPE_CUSTOMER, session_id="s")
        assert expires_in == get_settings().customer_access_token_minutes * 60

    def test_customer_token_rejected_as_staff(self):
        with pytest.raises(TokenError):
            decode_access_token(_customer_token(), expected_typ=TOKEN_TYPE_STAFF)

    def test_staff_token_rejected_as_customer(self):
        token, _ = create_access_token(
            "staff-1", typ=TOKEN_TYPE_STAFF, session_id="s", is_super_admin=True
        )
        with pytest.raises(TokenError):
            decode_access_token(token, expected_typ=TOKEN_TYPE_CUSTOMER)
        claims = decode_access_token(token, expected_typ=TOKEN_TYPE_STAFF)
        assert claims.is_super_admin is True

    def test_garbage_rejected(self):
        with pytest.raises(TokenError, match="Invalid or expired"):
            decode_access_token("not.a.valid.token", expected_typ=TOKEN_TYPE_CUSTOMER)

    def test_tampered_rejected(self):
        parts = _customer_token().split(".")
        parts[1] = parts[1][::-1]
        with pytest.raises(TokenError):
            decode_access_token(".".join(parts), expected_typ=TOKEN_TYPE_CUSTOMER)

    def test_expired_rejected(self):
        token, _ = create_access_token(
            "c", typ=TOKEN_TYPE_CUSTOMER, session_id="s", expires_minutes=-1
        )
        with pytest.raises(TokenError):
            decode_access_token(token, expected_typ=TOKEN_TYPE_CUSTOMER)

    def test_token_without_session_id_rejected(self):
        """Legacy 24h tokens (pre-session) carry no sid and must stop working."""
        s = get_settings()
        now = datetime.now(timezone.utc)
        legacy = jwt.encode(
            {"sub": "c", "phone": "+234", "iat": now, "exp": now + timedelta(hours=1)},
            s.secret_key,
            algorithm=s.jwt_algorithm,
        )
        with pytest.raises(TokenError):
            decode_access_token(legacy, expected_typ=TOKEN_TYPE_CUSTOMER)

    def test_alg_none_rejected(self):
        now = datetime.now(timezone.utc)
        forged = jwt.encode(
            {"sub": "c", "typ": "customer", "sid": "s", "iat": now, "exp": now + timedelta(hours=1)},
            key=None,
            algorithm="none",
        )
        with pytest.raises(TokenError):
            decode_access_token(forged, expected_typ=TOKEN_TYPE_CUSTOMER)


class TestRefreshToken:
    def test_is_long_and_unique(self):
        a, b = generate_refresh_token(), generate_refresh_token()
        assert a != b
        assert len(a) >= 60

    def test_hash_is_stable_and_not_the_token(self):
        token = generate_refresh_token()
        assert hash_token(token) == hash_token(token)
        assert hash_token(token) != token
        assert len(hash_token(token)) == 64
