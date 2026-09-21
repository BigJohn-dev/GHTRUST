"""Zest Payments API constants — merchant Notion documentation."""

# Virtual account inner authData payloads (encrypted before POST)
VAS_DYNAMIC = "GENERATE_TEMPORARY_VIRTUAL_ACCOUNT"
VAS_TRANSFER_STATUS = "TRANSFER_PAYMENT_STATUS"

# Official paths (base URL ends with /payment-engine)
PATH_TRANSACTION_INIT = "/api/v1/process/transaction-initialization"
PATH_VIRTUAL_ACCOUNT = "/api/v1/process/virtual-account"

# Dynamic VAs expire quickly (Notion: disabled after ~5 minutes)
DEFAULT_VA_EXPIRY_MINUTES = 5

# Webhook / payment status values (normalize case-insensitive in handlers)
PAYMENT_STATUS_SUCCESS = frozenset({"success", "successful", "paid", "completed", "01", "00"})
PAYMENT_STATUS_FAILED = frozenset({"failed", "failure"})

WEBHOOK_EVENT_TRANSACTION = "transactions"

# Successful webEngine response code in VA generation
WEBENGINE_RESPONSE_COMPLETED = "COMPLETED"
