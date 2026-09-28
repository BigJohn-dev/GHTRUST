import hashlib
import hmac
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.integrations.payments.schemas import PaymentRailError
from app.integrations.stanbic.client import StanbicClient
from app.integrations.stanbic.constants import (
    TRANSFER_STATUS_FAILED,
    TRANSFER_STATUS_PENDING,
    TRANSFER_STATUS_REVERSED,
    TRANSFER_STATUS_SUCCESS,
)


def _mock_http(status_code: int, payload: dict) -> AsyncMock:
    response = MagicMock()
    response.status_code = status_code
    response.json.return_value = payload

    client = AsyncMock()
    client.post.return_value = response
    client.get.return_value = response
    client.request.return_value = response
    client.__aenter__.return_value = client
    client.__aexit__.return_value = None
    return client


class TestStanbicMockMode:
    """Mock mode is the default for local dev — no credentials required."""

    @pytest.mark.asyncio
    async def test_create_reserved_account_returns_nuban(self):
        client = StanbicClient()
        result = await client.create_reserved_account(
            account_reference="ghtrust_cust_001",
            account_name="GH Trust / Ada Okafor",
            customer_email="ada@email.com",
            customer_name="Ada Okafor",
            bvn="22222222222",
            phone="+2348035794364",
        )
        assert result.account_reference == "ghtrust_cust_001"
        assert len(result.account_number) == 10
        assert result.bank_name == "Stanbic IBTC Bank"
        assert result.bank_code == "221"
        assert result.currency == "NGN"

    @pytest.mark.asyncio
    async def test_get_reserved_account(self):
        client = StanbicClient()
        result = await client.get_reserved_account("ghtrust_cust_001")
        assert result.account_reference == "ghtrust_cust_001"
        assert result.account_number

    @pytest.mark.asyncio
    async def test_deactivate_reserved_account(self):
        client = StanbicClient()
        assert await client.deactivate_reserved_account("ghtrust_cust_001") is True

    @pytest.mark.asyncio
    async def test_validate_bank_account(self):
        client = StanbicClient()
        resolved = await client.validate_bank_account("0123456789", "221")
        assert resolved.account_number == "0123456789"
        assert resolved.account_name
        assert resolved.bank_code == "221"

    @pytest.mark.asyncio
    async def test_initiate_disbursement_is_pending(self):
        client = StanbicClient()
        result = await client.initiate_disbursement(
            amount=Decimal("25000.00"),
            reference="ghtrust_loan_abc123",
            bank_code="221",
            account_number="0123456789",
            account_name="Ada Okafor",
            narration="GH Trust loan disbursement abc123",
        )
        assert result.reference == "ghtrust_loan_abc123"
        assert result.status == TRANSFER_STATUS_PENDING
        assert result.amount == Decimal("25000.00")
        # Pending must not read as terminal in either direction.
        assert StanbicClient.is_disbursement_success(result.status) is False
        assert StanbicClient.is_disbursement_failed(result.status) is False

    @pytest.mark.asyncio
    async def test_verify_disbursement_and_transaction(self):
        client = StanbicClient()
        transfer = await client.verify_disbursement("ghtrust_loan_abc123")
        assert StanbicClient.is_disbursement_success(transfer.status)

        inbound = await client.verify_transaction("STB_TXN_001")
        assert StanbicClient.is_payment_success(inbound.status)

    @pytest.mark.asyncio
    async def test_get_wallet_balance(self):
        client = StanbicClient()
        balance = await client.get_wallet_balance()
        assert balance.available_balance > 0
        assert balance.currency == "NGN"


class TestStanbicStatusHelpers:
    def test_success_statuses(self):
        assert StanbicClient.is_disbursement_success(TRANSFER_STATUS_SUCCESS)
        assert StanbicClient.is_disbursement_success("completed")
        assert StanbicClient.is_disbursement_success("") is False

    def test_failure_statuses(self):
        assert StanbicClient.is_disbursement_failed(TRANSFER_STATUS_FAILED)
        assert StanbicClient.is_disbursement_failed(TRANSFER_STATUS_REVERSED)
        assert StanbicClient.is_disbursement_failed(TRANSFER_STATUS_SUCCESS) is False


class TestStanbicWebhookSignature:
    def test_sha512_and_sha256_accepted(self):
        body = b'{"event_type":"payment.success","amount":"5000.00"}'
        with patch("app.integrations.stanbic.client.settings") as s:
            s.stanbic_webhook_secret = "whsec_test"
            sha512 = hmac.new(b"whsec_test", body, hashlib.sha512).hexdigest()
            sha256 = hmac.new(b"whsec_test", body, hashlib.sha256).hexdigest()
            assert StanbicClient.verify_webhook_signature(body, sha512) is True
            assert StanbicClient.verify_webhook_signature(body, sha256) is True
            assert StanbicClient.verify_webhook_signature(body, "deadbeef") is False
            assert StanbicClient.verify_webhook_signature(body, None) is False

    def test_rejects_when_secret_unset(self):
        body = b"{}"
        with patch("app.integrations.stanbic.client.settings") as s:
            s.stanbic_webhook_secret = ""
            assert StanbicClient.verify_webhook_signature(body, "anything") is False

    def test_signature_is_case_and_whitespace_tolerant(self):
        body = b'{"event_type":"transfer.success"}'
        with patch("app.integrations.stanbic.client.settings") as s:
            s.stanbic_webhook_secret = "whsec_test"
            digest = hmac.new(b"whsec_test", body, hashlib.sha512).hexdigest()
            assert StanbicClient.verify_webhook_signature(body, f"  {digest.upper()}  ") is True


class TestStanbicLiveMode:
    """Live-mode transport behaviour with the HTTP layer mocked."""

    def setup_method(self):
        StanbicClient.clear_token_cache()

    def teardown_method(self):
        StanbicClient.clear_token_cache()

    @pytest.mark.asyncio
    async def test_ibm_key_pair_headers_when_no_token_url(self):
        with patch("app.integrations.stanbic.client.settings") as s:
            s.stanbic_mock = False
            s.stanbic_enabled = True
            s.stanbic_base_url = "https://api.sandbox.stanbicibtc.com"
            s.stanbic_token_url = ""
            s.stanbic_client_id = "client-id-123"
            s.stanbic_client_secret = "client-secret-456"
            s.stanbic_merchant_id = "GHTRUST01"
            s.stanbic_settlement_account_number = "0011223344"

            client = StanbicClient()
            headers = await client._headers()

        assert headers["X-IBM-Client-Id"] == "client-id-123"
        assert headers["X-IBM-Client-Secret"] == "client-secret-456"
        assert headers["X-Merchant-Id"] == "GHTRUST01"
        assert "Authorization" not in headers

    @pytest.mark.asyncio
    async def test_oauth_bearer_token_when_token_url_set(self):
        mock_http = _mock_http(200, {"access_token": "tok_live_abc", "expires_in": 3600})

        with patch("app.integrations.stanbic.client.settings") as s:
            s.stanbic_mock = False
            s.stanbic_enabled = True
            s.stanbic_base_url = "https://api.sandbox.stanbicibtc.com"
            s.stanbic_token_url = "https://api.sandbox.stanbicibtc.com/oauth2/token"
            s.stanbic_client_id = "client-id-123"
            s.stanbic_client_secret = "client-secret-456"
            s.stanbic_merchant_id = ""
            s.stanbic_settlement_account_number = ""

            with patch("httpx.AsyncClient", return_value=mock_http):
                client = StanbicClient()
                headers = await client._headers()

        assert headers["Authorization"] == "Bearer tok_live_abc"

    @pytest.mark.asyncio
    async def test_create_account_parses_live_response(self):
        mock_http = _mock_http(
            201,
            {
                "responseCode": "00",
                "data": {
                    "accountReference": "ghtrust_cust_001",
                    "accountNumber": "9920011223",
                    "accountName": "GH Trust / Ada Okafor",
                    "bankName": "Stanbic IBTC Bank",
                    "bankCode": "221",
                    "currency": "NGN",
                    "status": "ACTIVE",
                },
            },
        )

        with patch("app.integrations.stanbic.client.settings") as s:
            s.stanbic_mock = False
            s.stanbic_enabled = True
            s.stanbic_base_url = "https://api.sandbox.stanbicibtc.com"
            s.stanbic_token_url = ""
            s.stanbic_client_id = "id"
            s.stanbic_client_secret = "secret"
            s.stanbic_merchant_id = ""
            s.stanbic_settlement_account_number = ""

            with patch("httpx.AsyncClient", return_value=mock_http):
                client = StanbicClient()
                result = await client.create_reserved_account(
                    account_reference="ghtrust_cust_001",
                    account_name="GH Trust / Ada Okafor",
                    customer_email="ada@email.com",
                    customer_name="Ada Okafor",
                    bvn="22222222222",
                )

        assert result.account_number == "9920011223"
        assert result.bank_code == "221"
        assert result.raw["status"] == "ACTIVE"

    @pytest.mark.asyncio
    async def test_missing_account_number_raises(self):
        mock_http = _mock_http(200, {"responseCode": "00", "data": {"accountReference": "x"}})

        with patch("app.integrations.stanbic.client.settings") as s:
            s.stanbic_mock = False
            s.stanbic_enabled = True
            s.stanbic_base_url = "https://api.sandbox.stanbicibtc.com"
            s.stanbic_token_url = ""
            s.stanbic_client_id = "id"
            s.stanbic_client_secret = "secret"
            s.stanbic_merchant_id = ""
            s.stanbic_settlement_account_number = ""

            with patch("httpx.AsyncClient", return_value=mock_http):
                client = StanbicClient()
                with pytest.raises(PaymentRailError, match="missing account number"):
                    await client.create_reserved_account(
                        account_reference="x",
                        account_name="GH Trust / X",
                        customer_email="x@email.com",
                        customer_name="X",
                    )

    @pytest.mark.asyncio
    async def test_provider_error_code_surfaces(self):
        mock_http = _mock_http(
            400,
            {"responseCode": "57", "responseMessage": "BVN does not match account name"},
        )

        with patch("app.integrations.stanbic.client.settings") as s:
            s.stanbic_mock = False
            s.stanbic_enabled = True
            s.stanbic_base_url = "https://api.sandbox.stanbicibtc.com"
            s.stanbic_token_url = ""
            s.stanbic_client_id = "id"
            s.stanbic_client_secret = "secret"
            s.stanbic_merchant_id = ""
            s.stanbic_settlement_account_number = ""

            with patch("httpx.AsyncClient", return_value=mock_http):
                client = StanbicClient()
                with pytest.raises(PaymentRailError) as exc_info:
                    await client.create_reserved_account(
                        account_reference="x",
                        account_name="GH Trust / X",
                        customer_email="x@email.com",
                        customer_name="X",
                    )

        assert exc_info.value.provider_code == "57"
        assert "BVN" in exc_info.value.message


class TestStanbicFactoryWiring:
    def test_factory_returns_stanbic_client(self):
        from app.integrations.payments import factory

        with patch.object(factory, "settings") as s:
            s.active_payment_provider = "stanbic"
            assert isinstance(factory.get_payment_client(), StanbicClient)
