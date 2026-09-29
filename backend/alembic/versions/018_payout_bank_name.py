"""Keep the payout bank's name so the app can show where withdrawals go.

Revision ID: 018_payout_bank_name
Revises: 017_customer_selfie
"""

import sqlalchemy as sa
from alembic import op

revision = "018_payout_bank_name"
down_revision = "017_customer_selfie"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("payout_bank_name", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "payout_bank_name")
