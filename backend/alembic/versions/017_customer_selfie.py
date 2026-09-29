"""Record the selfie-to-BVN-photo match made at account opening.

Revision ID: 017_customer_selfie
Revises: 016_customer_security
"""

import sqlalchemy as sa
from alembic import op

revision = "017_customer_selfie"
down_revision = "016_customer_security"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("selfie_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("customers", sa.Column("selfie_match_score", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "selfie_match_score")
    op.drop_column("customers", "selfie_verified_at")
