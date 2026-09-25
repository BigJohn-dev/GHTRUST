import hashlib
import hmac

import pytest
from unittest.mock import AsyncMock, patch

import httpx


from app.integrations.paystack.client import PaystackClient
from app.integrations.payments.schemas import PaymentRailError
from app.integrations.paystack.schemas import (
    CreateCustomerRequest,
    CreateTransferRecipientRequest,
    InitiateTransferRequest,
    PaystackError,
    naira_to_kobo,
)
from tests.conftest import refresh_settings


class TestPaystackClient:
    async def test_mock_create_customer(self):
        client = PaystackClient()
        customer = await client.create_customer(
            CreateCustomerRequest(
                email="adaeze@email.com",
                first_name="ADAEZE",
                last_name="OKAFOR",
                phone="+2348035794364",
            )
        )
        assert customer.customer_code.startswith("CUS_")
        assert customer.email == "adaeze@email.com"

    async def test_mock_assign_dva(self):
        client = PaystackClient()
        from app.integrations.paystack.schemas import AssignDedicatedAccountRequest

        result = await client.assign_dedicated_account(
            AssignDedicatedAccountRequest(
                email="adaeze@email.com",
                first_name="ADAEZE",
                last_name="OKAFOR",
                phone="+2348035794364",
                preferred_bank="test-bank",
                account_number="0123456789",
                bvn="22222222222",
                bank_code="058",
            )
        )
        assert result["message"] == "Assign dedicated account in progress"

    async def test_mock_initiate_transfer(self):
        client = PaystackClient()
        transfer = await client.initiate_transfer(
            InitiateTransferRequest(amount=50_000, recipient="RCP_test", reason="Withdrawal")
        )
        assert transfer.status == "success"
        assert transfer.amount == 50_000

    async def test_mock_resolve_account(self):
        client = PaystackClient()
        resolved = await client.resolve_account("0123456789", "058")
        assert resolved.account_name
        assert resolved.account_number == "0123456789"

    async def test_naira_to_kobo(self):
        assert naira_to_kobo(1000) == 100_000
        assert naira_to_kobo(99.99) == 9999

    def test_verify_webhook_signature(self, monkeypatch):
        monkeypatch.setenv("PAYSTACK_SECRET_KEY", "test_secret")
        monkeypatch.setenv("PAYSTACK_MOCK", "false")
        refresh_settings()

        body = b'{"event":"charge.success","data":{"id":1}}'
        digest = hmac.new(b"test_secret", body, hashlib.sha512).hexdigest()
        assert PaystackClient.verify_webhook_signature(body, digest) is True
        assert PaystackClient.verify_webhook_signature(body, "bad") is False

    async def test_live_api_error(self, monkeypatch):
        monkeypatch.setenv("PAYSTACK_MOCK", "false")
        monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_test")
        refresh_settings()

        mock_response = httpx.Response(400, json={"status": False, "message": "Invalid email"})
        mock_client = AsyncMock()
        mock_client.request.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.integrations.paystack.client.httpx.AsyncClient", return_value=mock_client):
            client = PaystackClient()
            with pytest.raises(PaystackError) as exc:
                await client.create_customer(CreateCustomerRequest(email="bad"))
            # Now also a PaymentRailError, so rail-agnostic handlers catch it.
            assert isinstance(exc.value, PaymentRailError)
            assert mock_client.request.await_count == 1

    async def test_live_create_recipient(self, monkeypatch):
        monkeypatch.setenv("PAYSTACK_MOCK", "false")
        monkeypatch.setenv("PAYSTACK_SECRET_KEY", "sk_test")
        refresh_settings()

        mock_response = httpx.Response(
            200,
            json={
                "status": True,
                "message": "Recipient created",
                "data": {
                    "recipient_code": "RCP_live001",
                    "name": "ADAEZE OKAFOR",
                    "type": "nuban",
                    "currency": "NGN",
                },
            },
        )
        mock_client = AsyncMock()
        mock_client.request.return_value = mock_response
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        with patch("app.integrations.paystack.client.httpx.AsyncClient", return_value=mock_client):
            client = PaystackClient()
            recipient = await client.create_transfer_recipient(
                CreateTransferRecipientRequest(
                    name="ADAEZE OKAFOR",
                    account_number="0123456789",
                    bank_code="058",
                )
            )
            assert recipient.recipient_code == "RCP_live001"

            call_kwargs = mock_client.request.call_args
            assert call_kwargs[0][0] == "POST"
            assert "/transferrecipient" in call_kwargs[0][1]
