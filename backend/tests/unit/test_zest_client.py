import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.integrations.payments.schemas import PaymentRailError
from app.integrations.zest.client import ZestClient
from app.integrations.zest.constants import PATH_VIRTUAL_ACCOUNT, VAS_DYNAMIC, VAS_TRANSFER_STATUS
from app.integrations.zest.crypto import encrypt_auth_data


class TestZestCrypto:
    def test_encrypt_produces_base64(self):
        encrypted = encrypt_auth_data(
            {"vasRequestType": VAS_DYNAMIC, "transactionRef": "TESTREF123"},
            key="419184D35088AF2CB7E4508AF1DD68AF",
            iv="3A4CD38XVS621KZ6",
        )
        assert isinstance(encrypted, str)
        assert len(encrypted) > 20


class TestZestClient:
    @pytest.mark.asyncio
    async def test_mock_funding_session(self):
        client = ZestClient()
        session = await client.create_wallet_funding_session(
            amount=Decimal("5000"),
            email="user@test.com",
        )
        assert session["account_number"]
        assert session["transaction_ref"]
        assert session["expires_in_minutes"] == 5

    @pytest.mark.asyncio
    async def test_create_reserved_account_not_supported(self):
        client = ZestClient()
        with pytest.raises(PaymentRailError) as err:
            await client.create_reserved_account(
                account_reference="ref1",
                account_name="Test",
                customer_email="t@t.com",
                customer_name="Test User",
            )
        assert err.value.status_code == 501

    def test_verify_webhook_signature(self, monkeypatch):
        monkeypatch.setenv("ZEST_SECRET_KEY", "test_zest_secret")
        from app.core.config import get_settings
        import app.integrations.zest.client as zest_mod

        get_settings.cache_clear()
        zest_mod.settings = get_settings()

        body = b'{"event_type":"transactions","event_status":"success"}'
        digest = hmac.new(b"test_zest_secret", body, hashlib.sha256).hexdigest()
        assert ZestClient.verify_webhook_signature(body, digest) is True

    @pytest.mark.asyncio
    async def test_live_dynamic_virtual_account(self):
        create_response = MagicMock()
        create_response.status_code = 200
        create_response.json.return_value = {
            "message": "Request successfully treated",
            "statusCode": 200,
            "success": True,
            "data": {
                "webEngineResponseCodes": "COMPLETED",
                "accountNumber": "0000052823",
                "accountName": "Oluwatobi-Zest",
                "responseCode": "00",
                "responseDescription": "success",
            },
            "errors": [],
        }

        mock_client = AsyncMock()
        mock_client.request.return_value = create_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.integrations.zest.client.settings") as mock_settings:
            mock_settings.zest_mock = False
            mock_settings.zest_enabled = True
            mock_settings.zest_base_url = "https://api.dev.gateway.zestpayment.com/payment-engine"
            mock_settings.zest_public_key = "PK_test"
            mock_settings.zest_secret_key = "SK_419184D35088AF2CB7E4508AF1DD68AF"
            mock_settings.zest_auth_encryption_key = "419184D35088AF2CB7E4508AF1DD68AF"
            mock_settings.zest_auth_encryption_iv = "3A4CD38XVS621KZ6"
            mock_settings.zest_dynamic_vas_request_type = VAS_DYNAMIC
            mock_settings.zest_transfer_status_vas_request_type = VAS_TRANSFER_STATUS
            mock_settings.zest_va_expiry_minutes = 5

            with patch("app.integrations.zest.client.httpx.AsyncClient", return_value=mock_client):
                client = ZestClient()
                result = await client.create_dynamic_virtual_account(transaction_ref="202403171412477RAHO")
                assert result.account_number == "0000052823"

                call_kwargs = mock_client.request.call_args.kwargs
                assert call_kwargs["json"]["authData"]
                assert PATH_VIRTUAL_ACCOUNT in mock_client.request.call_args.args[1]

    @pytest.mark.asyncio
    async def test_initialize_transaction_sends_string_amount(self):
        init_response = MagicMock()
        init_response.status_code = 200
        init_response.json.return_value = {"success": True, "data": {}}

        mock_client = AsyncMock()
        mock_client.request.return_value = init_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.integrations.zest.client.settings") as mock_settings:
            mock_settings.zest_mock = False
            mock_settings.zest_enabled = True
            mock_settings.zest_base_url = "https://api.dev.gateway.zestpayment.com/payment-engine"
            mock_settings.zest_public_key = "PK_test"
            mock_settings.zest_secret_key = "SK_test"
            mock_settings.zest_auth_encryption_key = "419184D35088AF2CB7E4508AF1DD68AF"
            mock_settings.zest_auth_encryption_iv = "3A4CD38XVS621KZ6"
            mock_settings.zest_dynamic_vas_request_type = VAS_DYNAMIC
            mock_settings.zest_transfer_status_vas_request_type = VAS_TRANSFER_STATUS
            mock_settings.zest_va_expiry_minutes = 5

            with patch("app.integrations.zest.client.httpx.AsyncClient", return_value=mock_client):
                client = ZestClient()
                await client.initialize_transaction(
                    amount=Decimal("500000"),
                    currency="NGN",
                    email="user@test.com",
                )
                payload = mock_client.request.call_args.kwargs["json"]
                assert payload["amount"] == "500000"
                assert payload["email"] == "user@test.com"
