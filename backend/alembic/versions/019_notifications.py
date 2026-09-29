"""Notifications (inbox + push outbox) and the push token of each signed-in app.

Revision ID: 019_notifications
Revises: 018_payout_bank_name
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "019_notifications"
down_revision = "018_payout_bank_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("auth_sessions", sa.Column("push_token", sa.String(255), nullable=True))
    op.create_index("ix_auth_sessions_push_token", "auth_sessions", ["push_token"])

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("route", sa.String(200), nullable=True),
        sa.Column("dedupe_key", sa.String(160), nullable=True),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("push_status", sa.String(20), nullable=False),
        sa.Column("push_attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("pushed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("push_error", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("dedupe_key"),
    )
    op.create_index("ix_notifications_customer_id", "notifications", ["customer_id"])
    op.create_index("ix_notifications_customer_created", "notifications", ["customer_id", "created_at"])
    op.create_index("ix_notifications_push_status", "notifications", ["push_status"])


def downgrade() -> None:
    op.drop_index("ix_notifications_push_status", table_name="notifications")
    op.drop_index("ix_notifications_customer_created", table_name="notifications")
    op.drop_index("ix_notifications_customer_id", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_auth_sessions_push_token", table_name="auth_sessions")
    op.drop_column("auth_sessions", "push_token")
