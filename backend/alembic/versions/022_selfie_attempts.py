"""Face checks at sign-up, passed and failed: pilot data for tuning thresholds.

Revision ID: 022_selfie_attempts
Revises: 021_support_tickets
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "022_selfie_attempts"
down_revision = "021_support_tickets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "selfie_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("threshold", sa.Integer(), nullable=False),
        sa.Column("liveness_min", sa.Float(), nullable=True),
        sa.Column("match_score", sa.Float(), nullable=True),
        sa.Column("liveness_probability", sa.Float(), nullable=True),
        sa.Column("liveness_reason", sa.String(40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_selfie_attempts_customer_id", "selfie_attempts", ["customer_id"])
    op.create_index("ix_selfie_attempts_created_at", "selfie_attempts", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_selfie_attempts_created_at", table_name="selfie_attempts")
    op.drop_index("ix_selfie_attempts_customer_id", table_name="selfie_attempts")
    op.drop_table("selfie_attempts")
