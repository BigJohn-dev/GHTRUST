"""Payments ledger, wallet, and Paystack integration tables.

Revision ID: 004_payments_ledger
Revises: 003_loan_workflows
Create Date: 2026-07-19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_payments_ledger"
down_revision: Union[str, None] = "003_loan_workflows"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _pg_enum(name: str, *values: str) -> postgresql.ENUM:
    """Reference an enum created explicitly in upgrade() — avoid double CREATE TYPE."""
    return postgresql.ENUM(*values, name=name, create_type=False)


journal_type = _pg_enum(
    "journaltype",
    "wallet_funding",
    "wallet_withdrawal",
    "wallet_withdrawal_hold",
    "wallet_withdrawal_release",
    "loan_disbursement",
)
ledger_direction = _pg_enum("ledgerdirection", "debit", "credit")
ledger_account = _pg_enum(
    "ledgeraccountcode",
    "paystack_settlement",
    "customer_wallet",
    "customer_wallet_locked",
    "loan_receivable",
)
payment_direction = _pg_enum("paymentdirection", "inbound", "outbound")
payment_provider = _pg_enum("paymentprovider", "paystack")
payment_channel = _pg_enum("paymentchannel", "dva", "transfer", "card", "ussd", "other")
withdrawal_status = _pg_enum(
    "withdrawalstatus", "pending", "processing", "completed", "failed", "cancelled"
)
dva_status = _pg_enum("dvastatus", "pending", "active", "failed")
transaction_status = _pg_enum("transactionstatus", "pending", "completed", "failed", "reversed")

_ENUMS_TO_CREATE = (
    journal_type,
    ledger_direction,
    ledger_account,
    payment_direction,
    payment_provider,
    payment_channel,
    withdrawal_status,
    dva_status,
    transaction_status,
)

_CUSTOMER_PAYSTACK_COLUMNS = (
    ("paystack_customer_code", "VARCHAR(64)"),
    ("paystack_dva_account_number", "VARCHAR(20)"),
    ("paystack_dva_bank_name", "VARCHAR(100)"),
    ("paystack_dva_bank_slug", "VARCHAR(50)"),
    ("paystack_transfer_recipient_code", "VARCHAR(64)"),
    ("payout_bank_code", "VARCHAR(10)"),
    ("payout_account_number", "VARCHAR(20)"),
    ("payout_account_name", "VARCHAR(200)"),
)


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :name)"
        ),
        {"name": table_name},
    )
    return bool(result.scalar())


def _index_exists(index_name: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        sa.text("SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :name)"),
        {"name": index_name},
    )
    return bool(result.scalar())


def _add_customer_columns_if_missing() -> None:
    for column_name, column_type in _CUSTOMER_PAYSTACK_COLUMNS:
        op.execute(
            sa.text(
                f"ALTER TABLE customers ADD COLUMN IF NOT EXISTS {column_name} {column_type}"
            )
        )

    if not _index_exists("ix_customers_paystack_customer_code"):
        op.create_index("ix_customers_paystack_customer_code", "customers", ["paystack_customer_code"])
    if not _index_exists("ix_customers_paystack_dva_account_number"):
        op.create_index(
            "ix_customers_paystack_dva_account_number",
            "customers",
            ["paystack_dva_account_number"],
            unique=True,
        )


def upgrade() -> None:
    bind = op.get_bind()
    for enum in _ENUMS_TO_CREATE:
        postgresql.ENUM(*enum.enums, name=enum.name, create_type=True).create(bind, checkfirst=True)

    _add_customer_columns_if_missing()

    if not _table_exists("customer_wallets"):
        op.create_table(
            "customer_wallets",
            sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="NGN", nullable=False),
        sa.Column("available_balance", sa.Numeric(18, 2), server_default="0", nullable=False),
        sa.Column("locked_balance", sa.Numeric(18, 2), server_default="0", nullable=False),
        sa.Column("dva_status", dva_status, server_default="pending", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("customer_id"),
        )

    if not _table_exists("withdrawal_requests"):
        op.create_table(
            "withdrawal_requests",
            sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("bank_code", sa.String(length=10), nullable=False),
        sa.Column("bank_name", sa.String(length=100), nullable=True),
        sa.Column("account_number", sa.String(length=20), nullable=False),
        sa.Column("account_name", sa.String(length=200), nullable=False),
        sa.Column("recipient_code", sa.String(length=64), nullable=True),
        sa.Column("transfer_reference", sa.String(length=128), nullable=False),
        sa.Column("transfer_code", sa.String(length=64), nullable=True),
        sa.Column("status", withdrawal_status, server_default="pending", nullable=False),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["wallet_id"], ["customer_wallets.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("transfer_reference"),
        )
        op.create_index("ix_withdrawal_requests_status", "withdrawal_requests", ["status"])
    elif not _index_exists("ix_withdrawal_requests_status"):
        op.create_index("ix_withdrawal_requests_status", "withdrawal_requests", ["status"])

    if not _table_exists("payment_transactions"):
        op.create_table(
            "payment_transactions",
            sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("provider", payment_provider, server_default="paystack", nullable=False),
        sa.Column("provider_reference", sa.String(length=128), nullable=False),
        sa.Column("provider_transaction_id", sa.String(length=64), nullable=True),
        sa.Column("direction", payment_direction, nullable=False),
        sa.Column("channel", payment_channel, server_default="other", nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="NGN", nullable=False),
        sa.Column("status", transaction_status, server_default="pending", nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("wallet_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("application_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("withdrawal_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("webhook_event", sa.String(length=64), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("raw_payload", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["loan_applications.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["wallet_id"], ["customer_wallets.id"]),
        sa.ForeignKeyConstraint(["withdrawal_id"], ["withdrawal_requests.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_reference", name="uq_payment_provider_reference"),
        )
        op.create_index("ix_payment_transactions_customer_status", "payment_transactions", ["customer_id", "status"])
    elif not _index_exists("ix_payment_transactions_customer_status"):
        op.create_index("ix_payment_transactions_customer_status", "payment_transactions", ["customer_id", "status"])

    if not _table_exists("ledger_journals"):
        op.create_table(
            "ledger_journals",
            sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("journal_type", journal_type, nullable=False),
        sa.Column("reference", sa.String(length=128), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("payment_transaction_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("metadata", postgresql.JSON(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["payment_transaction_id"], ["payment_transactions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
        )

    if not _table_exists("ledger_entries"):
        op.create_table(
            "ledger_entries",
            sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("journal_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("account_code", ledger_account, nullable=False),
        sa.Column("direction", ledger_direction, nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["journal_id"], ["ledger_journals.id"]),
        sa.PrimaryKeyConstraint("id"),
        )

    if not _table_exists("loan_disbursements"):
        op.create_table(
            "loan_disbursements",
            sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("transfer_reference", sa.String(length=128), nullable=False),
        sa.Column("transfer_code", sa.String(length=64), nullable=True),
        sa.Column("recipient_code", sa.String(length=64), nullable=True),
        sa.Column("status", transaction_status, server_default="pending", nullable=False),
        sa.Column("payment_transaction_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["loan_applications.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["payment_transaction_id"], ["payment_transactions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_id"),
        sa.UniqueConstraint("transfer_reference"),
        )

    if not _table_exists("processed_webhook_events"):
        op.create_table(
            "processed_webhook_events",
            sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
            sa.Column("event_key", sa.String(length=160), nullable=False),
            sa.Column("event_type", sa.String(length=64), nullable=False),
            sa.Column("provider", sa.String(length=32), server_default="paystack", nullable=False),
            sa.Column("payload_hash", sa.String(length=64), nullable=True),
            sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("event_key"),
        )


def downgrade() -> None:
    op.drop_table("processed_webhook_events")
    op.drop_table("loan_disbursements")
    op.drop_table("ledger_entries")
    op.drop_table("ledger_journals")
    op.drop_table("payment_transactions")
    op.drop_table("withdrawal_requests")
    op.drop_table("customer_wallets")

    op.drop_index("ix_customers_paystack_dva_account_number", table_name="customers")
    op.drop_index("ix_customers_paystack_customer_code", table_name="customers")
    op.drop_column("customers", "payout_account_name")
    op.drop_column("customers", "payout_account_number")
    op.drop_column("customers", "payout_bank_code")
    op.drop_column("customers", "paystack_transfer_recipient_code")
    op.drop_column("customers", "paystack_dva_bank_slug")
    op.drop_column("customers", "paystack_dva_bank_name")
    op.drop_column("customers", "paystack_dva_account_number")
    op.drop_column("customers", "paystack_customer_code")

    bind = op.get_bind()
    for enum in reversed(_ENUMS_TO_CREATE):
        postgresql.ENUM(*enum.enums, name=enum.name, create_type=False).drop(bind, checkfirst=True)
