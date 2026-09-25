"""Indexes for the staff list/search/audit query patterns.

- Newest-first lists filtered by status (applications, loans, transactions, customers).
- Audit feed (actor type + time) and the "viewed recently" de-duplication lookup.
- Trigram (pg_trgm) GIN indexes so staff search — ILIKE '%term%' on names, email,
  phone and account number — doesn't scan the whole customers table.

Revision ID: 012_query_indexes
Revises: 011_loan_servicing
"""

from typing import Sequence, Union

from alembic import op

revision: str = "012_query_indexes"
down_revision: Union[str, None] = "011_loan_servicing"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BTREE = [
    ("ix_loan_applications_status_created_at", "loan_applications", ["status", "created_at"]),
    ("ix_loan_applications_created_at", "loan_applications", ["created_at"]),
    ("ix_loans_status_created_at", "loans", ["status", "created_at"]),
    ("ix_payment_transactions_created_at", "payment_transactions", ["created_at"]),
    ("ix_customers_created_at", "customers", ["created_at"]),
    ("ix_audit_logs_actor_type_created_at", "application_audit_logs", ["actor_type", "created_at"]),
    (
        "ix_audit_logs_app_event_actor_created",
        "application_audit_logs",
        ["application_id", "event_type", "actor_id", "created_at"],
    ),
]

TRGM_COLUMNS = ["first_name", "last_name", "middle_name", "email", "phone_primary", "account_number"]


def upgrade() -> None:
    for name, table, cols in BTREE:
        op.create_index(name, table, cols)

    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    for col in TRGM_COLUMNS:
        op.create_index(
            f"ix_customers_{col}_trgm",
            "customers",
            [col],
            postgresql_using="gin",
            postgresql_ops={col: "gin_trgm_ops"},
        )


def downgrade() -> None:
    for col in TRGM_COLUMNS:
        op.drop_index(f"ix_customers_{col}_trgm", table_name="customers")
    for name, table, _ in reversed(BTREE):
        op.drop_index(name, table_name=table)
    # pg_trgm is left installed: other objects may depend on it.
