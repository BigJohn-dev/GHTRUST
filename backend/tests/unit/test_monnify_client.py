import hashlib
import hmac
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.integrations.monnify.client import MonnifyClient
from app.integrations.payments.schemas import PaymentRailError


class TestMonnifyClient:
    @pytest.mark.asyncio
    async def test_mock_create_reserved_account_async(self):
        client = MonnifyClient()
        result = await client.create_reserved_account(
            account_reference="ghtrust_cust_001",
            account_name="GH Trust / Ada Okafor",
            customer_email="ada@email.com",
            customer_name="Ada Okafor",
        )
        assert result.account_reference == "ghtrust_cust_001"
        assert result.account_number
        assert result.bank_name

    @pytest.mark.asyncio
    async def test_mock_validate_bank_account(self):
        client = MonnifyClient()
        resolved = await client.validate_bank_account("0123456789", "058")
        assert resolved.account_number == "0123456789"
        assert resolved.account_name

    @pytest.mark.asyncio
    async def test_mock_initiate_disbursement(self):
        client = MonnifyClient()
        result = await client.initiate_disbursement(
            amount=Decimal("5000.00"),
            reference="ghtrust_wdr_test001",
            bank_code="058",
            account_number="0123456789",
            account_name="Test User",
            narration="Test withdrawal",
        )
        assert result.reference == "ghtrust_wdr_test001"
        assert MonnifyClient.is_disbursement_success(result.status)

    def test_verify_webhook_signature(self):
        body = b'{"eventType":"SUCCESSFUL_TRANSACTION"}'
        digest = hmac.new(b"test_monnify_secret", body, hashlib.sha512).hexdigest()
        assert MonnifyClient.verify_webhook_signature(body, digest) is True
        assert MonnifyClient.verify_webhook_signature(body, "bad") is False

    @pytest.mark.asyncio
    async def test_auth_and_request_error(self):
        MonnifyClient.clear_token_cache()
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {
            "requestSuccessful": False,
            "responseMessage": "Invalid credentials",
            "responseCode": "99",
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.request.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.integrations.monnify.client.settings") as mock_settings:
            mock_settings.monnify_mock = False
            mock_settings.monnify_enabled = True
            mock_settings.monnify_base_url = "https://sandbox.monnify.com"
            mock_settings.monnify_api_key = "MK_TEST_key"
            mock_settings.monnify_secret_key = "secret"
            mock_settings.monnify_contract_code = "1234567890"
            mock_settings.monnify_wallet_account_number = "1234567890"

            with patch("app.integrations.monnify.client.httpx.AsyncClient", return_value=mock_client):
                client = MonnifyClient()
                with pytest.raises(PaymentRailError) as err:
                    await client._authenticate()
                assert "Invalid credentials" in err.value.message

    @pytest.mark.asyncio
    async def test_live_create_reserved_account(self):
        MonnifyClient.clear_token_cache()
        auth_response = MagicMock()
        auth_response.status_code = 200
        auth_response.json.return_value = {
            "requestSuccessful": True,
            "responseMessage": "success",
            "responseCode": "0",
            "responseBody": {"accessToken": "tok123", "expiresIn": 3600},
        }

        create_response = MagicMock()
        create_response.status_code = 200
        create_response.json.return_value = {
            "requestSuccessful": True,
            "responseMessage": "success",
            "responseCode": "0",
            "responseBody": {
                "accountReference": "ghtrust_cust_001",
                "accounts": [
                    {
                        "accountNumber": "5000112233",
                        "accountName": "GH Trust / Ada",
                        "bankName": "Wema Bank",
                        "bankCode": "035",
                        "reservationReference": "RSV001",
                    }
                ],
            },
        }

        mock_client = AsyncMock()
        mock_client.post.return_value = auth_response
        mock_client.request.return_value = create_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.integrations.monnify.client.settings") as mock_settings:
            mock_settings.monnify_mock = False
            mock_settings.monnify_enabled = True
            mock_settings.monnify_base_url = "https://sandbox.monnify.com"
            mock_settings.monnify_api_key = "MK_TEST_key"
            mock_settings.monnify_secret_key = "secret"
            mock_settings.monnify_contract_code = "1234567890"
            mock_settings.monnify_wallet_account_number = "1234567890"

            with patch("app.integrations.monnify.client.httpx.AsyncClient", return_value=mock_client):
                client = MonnifyClient()
                result = await client.create_reserved_account(
                    account_reference="ghtrust_cust_001",
                    account_name="GH Trust / Ada",
                    customer_email="ada@email.com",
                    customer_name="Ada Okafor",
                )
                assert result.account_number == "5000112233"
                assert result.bank_name == "Wema Bank"
