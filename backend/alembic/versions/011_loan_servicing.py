"""Loan servicing: schedules, repayments, interest method, manual rail.

Revision ID: 011_loan_servicing
Revises: 010_auth_sessions

Hand-finished from an autogenerate draft:
* new enum types are created explicitly (Alembic does not create types used
  only in ``add_column``);
* repayment_schedules.status converts VARCHAR → enum with a USING cast;
* enum values are appended to journaltype / ledgeraccountcode /
  paymentprovider (autogenerate cannot detect these).

Pre-existing ``loans`` rows (booked by the old code, which had no schedule)
are backfilled as zero-interest with principal still outstanding. The API
could not disburse before this release, so none are expected.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "011_loan_servicing"
down_revision = "010_auth_sessions"
branch_labels = None
depends_on = None

interestmethod = postgresql.ENUM("flat", "reducing_balance", name="interestmethod", create_type=False)
installmentstatus = postgresql.ENUM(
    "pending", "partial", "paid", "overdue", name="installmentstatus", create_type=False
)
repaymentchannel = postgresql.ENUM(
    "wallet", "bank_transfer", "cash", "remita", "other", name="repaymentchannel", create_type=False
)


def _add_enum_value(type_name: str, value: str) -> None:
    op.execute(f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{value}'")


def upgrade() -> None:
    bind = op.get_bind()
    for enum in (interestmethod, installmentstatus, repaymentchannel):
        enum.create(bind, checkfirst=True)

    _add_enum_value("journaltype", "loan_repayment")
    _add_enum_value("ledgeraccountcode", "interest_income")
    _add_enum_value("paymentprovider", "manual")

    # ── loan_products / loan_applications ──
    op.add_column(
        "loan_products",
        sa.Column("interest_method", interestmethod, server_default="flat", nullable=False),
    )
    op.add_column("loan_applications", sa.Column("approved_tenure_months", sa.Integer(), nullable=True))

    # ── loans ──
    money = sa.Numeric(precision=18, scale=2)
    for column in ("principal_outstanding", "total_interest", "total_repayable", "amount_paid"):
        op.add_column("loans", sa.Column(column, money, server_default="0", nullable=False))
    op.add_column("loans", sa.Column("interest_method", interestmethod, server_default="flat", nullable=False))
    op.add_column(
        "loans", sa.Column("repayment_cadence", sa.String(length=30), server_default="monthly", nullable=False)
    )
    op.add_column("loans", sa.Column("installments_count", sa.Integer(), server_default="0", nullable=False))
    op.add_column("loans", sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(
        "UPDATE loans SET principal_outstanding = outstanding, total_repayable = principal "
        "WHERE total_repayable = 0"
    )
    op.create_index("ix_loans_next_due_date", "loans", ["next_due_date"])
    op.create_index("ix_loans_status", "loans", ["status"])
    op.create_unique_constraint("uq_loans_application_id", "loans", ["application_id"])

    # ── repayment_schedules ──
    op.add_column("repayment_schedules", sa.Column("principal_paid", money, server_default="0", nullable=False))
    op.add_column("repayment_schedules", sa.Column("interest_paid", money, server_default="0", nullable=False))
    op.add_column("repayment_schedules", sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("ALTER TABLE repayment_schedules ALTER COLUMN status DROP DEFAULT")
    op.execute(
        "ALTER TABLE repayment_schedules ALTER COLUMN status TYPE installmentstatus "
        "USING (CASE WHEN status IN ('pending','partial','paid','overdue') "
        "THEN status ELSE 'pending' END)::installmentstatus"
    )
    op.execute("ALTER TABLE repayment_schedules ALTER COLUMN status SET DEFAULT 'pending'")
    op.create_index("ix_repayment_schedules_due_date", "repayment_schedules", ["due_date"])
    op.create_unique_constraint(
        "uq_repayment_schedule_installment", "repayment_schedules", ["loan_id", "installment"]
    )

    # ── loan_repayments ──
    op.create_table(
        "loan_repayments",
        sa.Column("loan_id", sa.UUID(as_uuid=False), sa.ForeignKey("loans.id"), nullable=False),
        sa.Column("customer_id", sa.UUID(as_uuid=False), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("amount", money, nullable=False),
        sa.Column("principal_amount", money, nullable=False),
        sa.Column("interest_amount", money, nullable=False),
        sa.Column("channel", repaymentchannel, nullable=False),
        sa.Column("reference", sa.String(length=128), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_by_staff_id", sa.UUID(as_uuid=False), sa.ForeignKey("staff.id"), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("allocation", sa.JSON(), nullable=False),
        sa.Column("journal_id", sa.UUID(as_uuid=False), sa.ForeignKey("ledger_journals.id"), nullable=True),
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("reference", name="uq_loan_repayments_reference"),
    )
    op.create_index("ix_loan_repayments_customer_id", "loan_repayments", ["customer_id"])
    op.create_index("ix_loan_repayments_loan_id", "loan_repayments", ["loan_id"])


def downgrade() -> None:
    op.drop_index("ix_loan_repayments_loan_id", table_name="loan_repayments")
    op.drop_index("ix_loan_repayments_customer_id", table_name="loan_repayments")
    op.drop_table("loan_repayments")

    op.drop_constraint("uq_repayment_schedule_installment", "repayment_schedules", type_="unique")
    op.drop_index("ix_repayment_schedules_due_date", table_name="repayment_schedules")
    op.execute("ALTER TABLE repayment_schedules ALTER COLUMN status DROP DEFAULT")
    op.execute("ALTER TABLE repayment_schedules ALTER COLUMN status TYPE VARCHAR(20) USING status::text")
    op.execute("ALTER TABLE repayment_schedules ALTER COLUMN status SET DEFAULT 'pending'")
    for column in ("paid_at", "interest_paid", "principal_paid"):
        op.drop_column("repayment_schedules", column)

    op.drop_constraint("uq_loans_application_id", "loans", type_="unique")
    op.drop_index("ix_loans_status", table_name="loans")
    op.drop_index("ix_loans_next_due_date", table_name="loans")
    for column in (
        "closed_at", "installments_count", "repayment_cadence", "interest_method",
        "amount_paid", "total_repayable", "total_interest", "principal_outstanding",
    ):
        op.drop_column("loans", column)

    op.drop_column("loan_applications", "approved_tenure_months")
    op.drop_column("loan_products", "interest_method")

    bind = op.get_bind()
    for enum in (repaymentchannel, installmentstatus, interestmethod):
        enum.drop(bind, checkfirst=True)
    # Postgres cannot drop individual enum values; the appended values remain.
