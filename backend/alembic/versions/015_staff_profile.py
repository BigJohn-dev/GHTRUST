"""Staff self-service profile: job title and avatar colour.

Revision ID: 015_staff_profile
Revises: 014_open_loan_product_codes
"""

import sqlalchemy as sa
from alembic import op

revision = "015_staff_profile"
down_revision = "014_open_loan_product_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("staff", sa.Column("job_title", sa.String(length=100), nullable=True))
    op.add_column("staff", sa.Column("avatar_color", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("staff", "avatar_color")
    op.drop_column("staff", "job_title")
