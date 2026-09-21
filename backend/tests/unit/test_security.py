import pytest
from jose import jwt

from app.core.security import create_access_token, decode_access_token


class TestJWT:
    def test_create_and_decode_token(self):
        token = create_access_token("cust-123", "+2348035794364")
        payload = decode_access_token(token)
        assert payload.sub == "cust-123"
        assert payload.phone == "+2348035794364"

    def test_invalid_token_raises(self):
        with pytest.raises(ValueError, match="Invalid or expired"):
            decode_access_token("not.a.valid.token")

    def test_tampered_token_raises(self):
        token = create_access_token("cust-123", "+2348035794364")
        parts = token.split(".")
        parts[1] = parts[1][::-1]
        with pytest.raises(ValueError):
            decode_access_token(".".join(parts))

    def test_token_contains_expiry(self):
        token = create_access_token("cust-123", "+2348035794364")
        decode_access_token(token)
        claims = jwt.get_unverified_claims(token)
        assert "exp" in claims
        assert claims["sub"] == "cust-123"
