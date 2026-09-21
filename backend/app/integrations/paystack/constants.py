"""Paystack API constants — https://paystack.com/docs/api/"""

# Webhook events GH Trust should handle (ordered by priority).
INBOUND_WEBHOOK_EVENTS = frozenset(
    {
        "charge.success",
        "customeridentification.success",
        "customeridentification.failed",
        "dedicatedaccount.assign.success",
        "dedicatedaccount.assign.failed",
    }
)

OUTBOUND_WEBHOOK_EVENTS = frozenset(
    {
        "transfer.success",
        "transfer.failed",
        "transfer.reversed",
    }
)

SUPPORTED_WEBHOOK_EVENTS = INBOUND_WEBHOOK_EVENTS | OUTBOUND_WEBHOOK_EVENTS

# Paystack transfer statuses (data.status on verify/poll).
TRANSFER_STATUS_SUCCESS = "success"
TRANSFER_STATUS_FAILED = "failed"
TRANSFER_STATUS_PENDING = "pending"
TRANSFER_STATUS_OTP = "otp"
TRANSFER_STATUS_REVERSED = "reversed"

# Transaction statuses.
TRANSACTION_STATUS_SUCCESS = "success"
TRANSACTION_STATUS_FAILED = "failed"
TRANSACTION_STATUS_PENDING = "pending"
TRANSACTION_STATUS_ABANDONED = "abandoned"
