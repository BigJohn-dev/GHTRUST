"""Reconcile database schema with SQLAlchemy models.

Before this revision the model registry omitted the workflow models, so
``alembic --autogenerate`` / ``alembic check`` could not run and drift went
unnoticed. This migration:

* adds ~26 missing indexes on foreign-key / lookup columns (ledger entries,
  payment transactions, loan documents, audit logs, ...) — real query cost on
  every wallet, ledger and application lookup;
* adds the missing ``loans.application_id`` foreign key;
* normalises unique constraints / unique indexes to the form the models
  declare, so ``alembic check`` passes and can gate CI.

Every step inspects the live schema first. Databases built by migrations and
older dev databases built by ``Base.metadata.create_all`` (which name
constraints differently) both converge on the same result, and re-running is
a no-op.
"""

from alembic import op
import sqlalchemy as sa

revision = "009_schema_reconcile"
down_revision = "008_stanbic_provider"
branch_labels = None
depends_on = None


# Model declares ``unique=True, index=True`` → a single unique index ix_<t>_<c>.
UNIQUE_INDEX_COLUMNS: list[tuple[str, str]] = [
    ("customers", "account_number"),
    ("customers", "bvn"),
    ("customers", "phone_primary"),
    ("customer_wallets", "customer_id"),
    ("loan_products", "code"),
    ("roles", "name"),
    ("savings_accounts", "account_number"),
    ("staff", "email"),
    ("staff", "phone"),
]

# Model declares a named UniqueConstraint in __table_args__.
NAMED_UNIQUE_CONSTRAINTS: list[tuple[str, str, str]] = [
    ("ledger_journals", "idempotency_key", "uq_ledger_journals_idempotency_key"),
    ("loan_disbursements", "application_id", "uq_loan_disbursements_application_id"),
    ("processed_webhook_events", "event_key", "uq_processed_webhook_event_key"),
    ("withdrawal_requests", "transfer_reference", "uq_withdrawal_transfer_reference"),
]

# Model declares ``index=True`` but no index exists.
PLAIN_INDEXES: list[tuple[str, str]] = [
    ("application_audit_logs", "actor_id"),
    ("application_collaterals", "application_id"),
    ("application_documents", "application_id"),
    ("application_documents", "document_type"),
    ("application_guarantors", "application_id"),
    ("application_stage_decisions", "staff_id"),
    ("application_stage_decisions", "stage_id"),
    ("application_status_logs", "application_id"),
    ("ledger_entries", "account_code"),
    ("ledger_entries", "customer_id"),
    ("ledger_entries", "journal_id"),
    ("ledger_journals", "customer_id"),
    ("ledger_journals", "idempotency_key"),
    ("ledger_journals", "journal_type"),
    ("ledger_journals", "reference"),
    ("loan_applications", "assigned_officer_id"),
    ("loan_disbursements", "application_id"),
    ("loan_disbursements", "customer_id"),
    ("loan_disbursements", "status"),
    ("payment_transactions", "application_id"),
    ("payment_transactions", "customer_id"),
    ("payment_transactions", "direction"),
    ("payment_transactions", "provider_transaction_id"),
    ("payment_transactions", "status"),
    ("processed_webhook_events", "event_key"),
    ("withdrawal_requests", "customer_id"),
]

LOANS_APPLICATION_FK = "fk_loans_application_id"
DVA_UNIQUE = "uq_customers_paystack_dva_account_number"


def _ix(table: str, column: str) -> str:
    return f"ix_{table}_{column}"


def _indexes(insp, table: str) -> dict[str, dict]:
    return {ix["name"]: ix for ix in insp.get_indexes(table)}


def _unique_constraints_on(insp, table: str, column: str) -> list[str]:
    return [
        uc["name"]
        for uc in insp.get_unique_constraints(table)
        if uc["column_names"] == [column] and uc["name"]
    ]


def upgrade() -> None:
    bind = op.get_bind()

    # 1. unique=True + index=True → one unique index.
    for table, column in UNIQUE_INDEX_COLUMNS:
        insp = sa.inspect(bind)
        for name in _unique_constraints_on(insp, table, column):
            op.drop_constraint(name, table, type_="unique")
        insp = sa.inspect(bind)
        existing = _indexes(insp, table).get(_ix(table, column))
        if existing and existing.get("unique"):
            continue
        if existing:
            op.drop_index(_ix(table, column), table_name=table)
        op.create_index(_ix(table, column), table, [column], unique=True)

    # 2. Named unique constraints — rename by drop/recreate when the name differs.
    for table, column, name in NAMED_UNIQUE_CONSTRAINTS:
        insp = sa.inspect(bind)
        current = _unique_constraints_on(insp, table, column)
        if current == [name]:
            continue
        for old in current:
            op.drop_constraint(old, table, type_="unique")
        # A create_all-era DB may carry the uniqueness as a unique *index*.
        unique_ix = _indexes(sa.inspect(bind), table).get(_ix(table, column))
        if unique_ix and unique_ix.get("unique"):
            op.drop_index(_ix(table, column), table_name=table)
        op.create_unique_constraint(name, table, [column])

    # 3. Missing plain indexes.
    for table, column in PLAIN_INDEXES:
        if _ix(table, column) not in _indexes(sa.inspect(bind), table):
            op.create_index(_ix(table, column), table, [column])

    # 4. customers.paystack_dva_account_number: unique constraint, not an index.
    insp = sa.inspect(bind)
    dva_ix = _ix("customers", "paystack_dva_account_number")
    if dva_ix in _indexes(insp, "customers"):
        op.drop_index(dva_ix, table_name="customers")
    if not _unique_constraints_on(sa.inspect(bind), "customers", "paystack_dva_account_number"):
        op.create_unique_constraint(DVA_UNIQUE, "customers", ["paystack_dva_account_number"])

    # 5. Missing FK: loans.application_id → loan_applications.id.
    fks = sa.inspect(bind).get_foreign_keys("loans")
    if not any(fk["constrained_columns"] == ["application_id"] for fk in fks):
        op.create_foreign_key(
            LOANS_APPLICATION_FK, "loans", "loan_applications", ["application_id"], ["id"]
        )


def downgrade() -> None:
    bind = op.get_bind()
    fks = sa.inspect(bind).get_foreign_keys("loans")
    if any(fk["name"] == LOANS_APPLICATION_FK for fk in fks):
        op.drop_constraint(LOANS_APPLICATION_FK, "loans", type_="foreignkey")
    for table, column in PLAIN_INDEXES:
        if _ix(table, column) in _indexes(sa.inspect(bind), table):
            op.drop_index(_ix(table, column), table_name=table)
    # Unique-form normalisation (steps 1, 2, 4) is semantically equivalent and
    # intentionally left in place: uniqueness is enforced either way.
