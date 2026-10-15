"""Stanbic Fundable Virtual ID account numbers per customer."""

import sqlalchemy as sa
from alembic import op

revision = "027_stanbic_virtual_accounts"
down_revision = "026_loan_offer_gate"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "stanbic_virtual_accounts",
        sa.Column("id", sa.UUID(as_uuid=False), primary_key=True),
        sa.Column("customer_id", sa.UUID(as_uuid=False), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("prefix", sa.String(4), nullable=False),
        sa.Column("serial", sa.Integer(), nullable=False),
        sa.Column("account_number", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("prefix", "serial", name="uq_stanbic_va_prefix_serial"),
    )
    op.create_index("ix_stanbic_virtual_accounts_customer_id", "stanbic_virtual_accounts", ["customer_id"], unique=True)
    op.create_index(
        "ix_stanbic_virtual_accounts_account_number", "stanbic_virtual_accounts", ["account_number"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_stanbic_virtual_accounts_account_number", table_name="stanbic_virtual_accounts")
    op.drop_index("ix_stanbic_virtual_accounts_customer_id", table_name="stanbic_virtual_accounts")
    op.drop_table("stanbic_virtual_accounts")
