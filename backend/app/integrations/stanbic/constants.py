"""
Stanbic IBTC bank-partner API constants.

Developer portal: https://developer.stanbicibtc.com/sandbox/

IMPORTANT — UNCONFIRMED CONTRACT
The public Stanbic developer portal exposes only an "Investment Public Offer
Webhook" and a "Bank-Test" product. The account-provisioning, NIP transfer and
name-enquiry APIs GH Trust needs are behind plan subscription + API
administrator approval (partner onboarding / NDA).

Every path and field name marked ``TODO(stanbic-spec)`` below is derived from
docs/bank-partner-wallet-api-requirements.html (sections B, C, D, E) and MUST be
reconciled against the sandbox OpenAPI spec once Stanbic grants access. The
adapter shape is stable; only the wire names should change.
"""

# ── Endpoint paths ──────────────────────────────────────────────────────────
# TODO(stanbic-spec): confirm all paths against the sandbox OpenAPI document.
PATH_TOKEN = "/oauth2/token"
PATH_CREATE_ACCOUNT = "/accounts/v1/virtual-accounts"           # req B1
PATH_GET_ACCOUNT = "/accounts/v1/virtual-accounts/{reference}"  # req B2
PATH_DEACTIVATE_ACCOUNT = "/accounts/v1/virtual-accounts/{reference}/deactivate"  # req B4
PATH_NAME_ENQUIRY = "/payments/v1/name-enquiry"                 # req D1
PATH_BANKS = "/payments/v1/banks"                               # req D2
PATH_TRANSFER = "/payments/v1/transfers"                        # req D3
PATH_TRANSFER_STATUS = "/payments/v1/transfers/{reference}"     # req D4
PATH_TRANSACTION_STATUS = "/collections/v1/transactions/{reference}"  # req C2
PATH_SETTLEMENT_BALANCE = "/accounts/v1/settlement/balance"     # req E1

# ── Account provisioning status (req B1) ────────────────────────────────────
ACCOUNT_STATUS_ACTIVE = "ACTIVE"
ACCOUNT_STATUS_PENDING = "PENDING"
ACCOUNT_STATUS_FAILED = "FAILED"

# ── Inbound collection status (req C1/C2) ───────────────────────────────────
PAYMENT_STATUS_PAID = "PAID"
PAYMENT_STATUS_FAILED = "FAILED"

# ── Outbound transfer status (req D3/D4) ────────────────────────────────────
TRANSFER_STATUS_PENDING = "PENDING"
TRANSFER_STATUS_PROCESSING = "PROCESSING"
TRANSFER_STATUS_SUCCESS = "SUCCESS"
TRANSFER_STATUS_COMPLETED = "COMPLETED"
TRANSFER_STATUS_FAILED = "FAILED"
TRANSFER_STATUS_REVERSED = "REVERSED"

TRANSFER_SUCCESS_STATUSES = frozenset({TRANSFER_STATUS_SUCCESS, TRANSFER_STATUS_COMPLETED})
TRANSFER_FAILED_STATUSES = frozenset({TRANSFER_STATUS_FAILED, TRANSFER_STATUS_REVERSED})

# ── Webhook event types (req section 4) ─────────────────────────────────────
EVENT_PAYMENT_SUCCESS = "payment.success"
EVENT_ACCOUNT_ACTIVATED = "account.activated"
EVENT_ACCOUNT_FAILED = "account.failed"
EVENT_TRANSFER_SUCCESS = "transfer.success"
EVENT_TRANSFER_FAILED = "transfer.failed"
EVENT_TRANSFER_REVERSED = "transfer.reversed"

INBOUND_WEBHOOK_EVENTS = frozenset({EVENT_PAYMENT_SUCCESS})
ACCOUNT_WEBHOOK_EVENTS = frozenset({EVENT_ACCOUNT_ACTIVATED, EVENT_ACCOUNT_FAILED})
TRANSFER_WEBHOOK_EVENTS = frozenset(
    {EVENT_TRANSFER_SUCCESS, EVENT_TRANSFER_FAILED, EVENT_TRANSFER_REVERSED}
)
SUPPORTED_WEBHOOK_EVENTS = (
    INBOUND_WEBHOOK_EVENTS | ACCOUNT_WEBHOOK_EVENTS | TRANSFER_WEBHOOK_EVENTS
)

# Header carrying the HMAC signature over the raw webhook body (req section 4).
# TODO(stanbic-spec): confirm header name and digest (SHA-256 vs SHA-512).
WEBHOOK_SIGNATURE_HEADER = "x-stanbic-signature"
