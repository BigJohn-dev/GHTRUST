import hashlib
import hmac
import json
from decimal import Decimal

import pytest

from app.models.base import TransactionStatus
from app.modules.payments.ledger_service import LedgerError, LedgerService
from app.modules.payments.models import PaymentDirection, PaymentProvider, PaymentTransaction
from app.modules.users.models import Customer, CustomerStatus


@pytest.fixture
async def active_customer(db_session) -> Customer:
    customer = Customer(
        bvn="44444444444",
        account_number="3012345678",
        branch="Lagos Main",
        status=CustomerStatus.ACTIVE,
        first_name="ADAEZE",
        last_name="OKAFOR",
        phone_primary="+2348035794364",
        email="adaeze@email.com",
        paystack_customer_code="ghtrust_cust_test001",
        paystack_dva_account_number="9930000901",
        paystack_dva_bank_name="Test Bank",
        payout_bank_code="058",
        payout_account_number="0123456789",
        payout_account_name="ADAEZE OKAFOR",
        paystack_transfer_recipient_code="RCP_test001",
        phone_verified=True,
    )
    db_session.add(customer)
    await db_session.flush()
    return customer


def sign_payload(payload: dict) -> tuple[bytes, str]:
    body = json.dumps(payload, separators=(",", ":")).encode()
    digest = hmac.new(b"test_paystack_secret", body, hashlib.sha512).hexdigest()
    return body, digest


class TestLedgerService:
    async def test_credit_wallet_is_idempotent(self, db_session, active_customer):
        ledger = LedgerService(db_session)
        wallet = await ledger.get_or_create_wallet(active_customer.id)
        payment_tx = PaymentTransaction(
            provider=PaymentProvider.PAYSTACK,
            provider_reference="ref_credit_001",
            direction=PaymentDirection.INBOUND,
            amount=Decimal("1000.00"),
            status=TransactionStatus.COMPLETED,
            customer_id=active_customer.id,
            wallet_id=wallet.id,
        )
        db_session.add(payment_tx)
        await db_session.flush()

        await ledger.credit_wallet_from_paystack(
            customer_id=active_customer.id,
            amount=Decimal("1000.00"),
            idempotency_key="wallet_funding:ref_credit_001",
            reference="ref_credit_001",
            payment_transaction=payment_tx,
        )
        await ledger.credit_wallet_from_paystack(
            customer_id=active_customer.id,
            amount=Decimal("1000.00"),
            idempotency_key="wallet_funding:ref_credit_001",
            reference="ref_credit_001",
            payment_transaction=payment_tx,
        )
        await db_session.refresh(wallet)
        assert wallet.available_balance == Decimal("1000.00")

    async def test_hold_requires_balance(self, db_session, active_customer):
        ledger = LedgerService(db_session)
        with pytest.raises(LedgerError):
            await ledger.hold_wallet_for_withdrawal(
                customer_id=active_customer.id,
                amount=Decimal("500.00"),
                idempotency_key="hold:001",
                reference="ref_hold_001",
            )


def sign_monnify_payload(payload: dict) -> tuple[bytes, str]:
    body = json.dumps(payload, separators=(",", ":")).encode()
    digest = hmac.new(b"test_monnify_secret", body, hashlib.sha512).hexdigest()
    return body, digest


class TestMonnifyWebhook:
    async def test_successful_transaction_credits_wallet(self, api_client, db_session, active_customer):
        payload = {
            "eventType": "SUCCESSFUL_TRANSACTION",
            "eventData": {
                "product": {
                    "reference": active_customer.paystack_customer_code,
                    "type": "RESERVED_ACCOUNT",
                },
                "transactionReference": "MNFY|04|20260115120000|000001",
                "paymentReference": "MNFY|04|20260115120000|000001",
                "amountPaid": 2500,
                "currency": "NGN",
                "paymentStatus": "PAID",
                "paymentMethod": "ACCOUNT_TRANSFER",
                "destinationAccountInformation": {
                    "accountNumber": active_customer.paystack_dva_account_number,
                },
            },
        }
        body, signature = sign_monnify_payload(payload)
        response = await api_client.post(
            "/api/v1/webhooks/monnify",
            content=body,
            headers={"monnify-signature": signature, "Content-Type": "application/json"},
        )
        assert response.status_code == 200

        wallet = await LedgerService(db_session).get_or_create_wallet(active_customer.id)
        await db_session.refresh(wallet)
        assert wallet.available_balance == Decimal("2500.00")

    async def test_invalid_signature_rejected(self, api_client):
        payload = {
            "eventType": "SUCCESSFUL_TRANSACTION",
            "eventData": {"paymentStatus": "PAID", "amountPaid": 100},
        }
        body = json.dumps(payload).encode()
        response = await api_client.post(
            "/api/v1/webhooks/monnify",
            content=body,
            headers={"monnify-signature": "bad", "Content-Type": "application/json"},
        )
        assert response.status_code == 401

    async def test_duplicate_webhook_not_double_credit(self, api_client, db_session, active_customer):
        payload = {
            "eventType": "SUCCESSFUL_TRANSACTION",
            "eventData": {
                "product": {
                    "reference": active_customer.paystack_customer_code,
                    "type": "RESERVED_ACCOUNT",
                },
                "transactionReference": "MNFY|04|20260115120000|000002",
                "paymentReference": "MNFY|04|20260115120000|000002",
                "amountPaid": 1000,
                "currency": "NGN",
                "paymentStatus": "PAID",
                "destinationAccountInformation": {
                    "accountNumber": active_customer.paystack_dva_account_number,
                },
            },
        }
        body, signature = sign_monnify_payload(payload)
        headers = {"monnify-signature": signature, "Content-Type": "application/json"}
        first = await api_client.post("/api/v1/webhooks/monnify", content=body, headers=headers)
        second = await api_client.post("/api/v1/webhooks/monnify", content=body, headers=headers)
        assert first.status_code == 200
        assert second.status_code == 200

        wallet = await LedgerService(db_session).get_or_create_wallet(active_customer.id)
        await db_session.refresh(wallet)
        assert wallet.available_balance == Decimal("1000.00")


class TestPaystackWebhook:
    async def test_charge_success_credits_wallet(self, api_client, db_session, active_customer):
        payload = {
            "event": "charge.success",
            "data": {
                "id": 9001,
                "reference": "pay_ref_9001",
                "amount": 250000,
                "currency": "NGN",
                "status": "success",
                "authorization": {
                    "channel": "dedicated_nuban",
                    "receiver_bank_account_number": active_customer.paystack_dva_account_number,
                },
                "customer": {"customer_code": active_customer.paystack_customer_code},
            },
        }
        body, signature = sign_payload(payload)
        response = await api_client.post(
            "/api/v1/webhooks/paystack",
            content=body,
            headers={"x-paystack-signature": signature, "Content-Type": "application/json"},
        )
        assert response.status_code == 200

        wallet = await LedgerService(db_session).get_or_create_wallet(active_customer.id)
        await db_session.refresh(wallet)
        assert wallet.available_balance == Decimal("2500.00")

    async def test_invalid_signature_rejected(self, api_client):
        payload = {"event": "charge.success", "data": {"id": 1, "reference": "x", "amount": 100, "status": "success"}}
        body = json.dumps(payload).encode()
        response = await api_client.post(
            "/api/v1/webhooks/paystack",
            content=body,
            headers={"x-paystack-signature": "bad", "Content-Type": "application/json"},
        )
        assert response.status_code == 401

    async def test_duplicate_webhook_not_double_credit(self, api_client, db_session, active_customer):
        payload = {
            "event": "charge.success",
            "data": {
                "id": 9002,
                "reference": "pay_ref_9002",
                "amount": 100000,
                "currency": "NGN",
                "status": "success",
                "authorization": {
                    "channel": "dedicated_nuban",
                    "receiver_bank_account_number": active_customer.paystack_dva_account_number,
                },
            },
        }
        body, signature = sign_payload(payload)
        headers = {"x-paystack-signature": signature, "Content-Type": "application/json"}
        first = await api_client.post("/api/v1/webhooks/paystack", content=body, headers=headers)
        second = await api_client.post("/api/v1/webhooks/paystack", content=body, headers=headers)
        assert first.status_code == 200
        assert second.status_code == 200

        wallet = await LedgerService(db_session).get_or_create_wallet(active_customer.id)
        await db_session.refresh(wallet)
        assert wallet.available_balance == Decimal("1000.00")
