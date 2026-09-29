"""Customer security: sign-in and transaction PINs, trusted devices, new-device approvals.

Revision ID: 016_customer_security
Revises: 015_staff_profile
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "016_customer_security"
down_revision = "015_staff_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("login_pin_hash", sa.String(200), nullable=True))
    op.add_column("customers", sa.Column("login_pin_set_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "customers", sa.Column("login_pin_failed_attempts", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column("customers", sa.Column("transaction_pin_hash", sa.String(200), nullable=True))
    op.add_column("customers", sa.Column("transaction_pin_set_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "customers",
        sa.Column("transaction_pin_failed_attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("customers", sa.Column("transfers_blocked_until", sa.DateTime(timezone=True), nullable=True))

    op.add_column(
        "auth_sessions",
        sa.Column("biometric_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "customer_devices",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("device_id", sa.String(128), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("device_name", sa.String(128), nullable=True),
        sa.Column("platform", sa.String(20), nullable=True),
        sa.Column("trusted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("customer_id", "device_id", name="uq_customer_devices_device"),
    )
    op.create_index("ix_customer_devices_customer_id", "customer_devices", ["customer_id"])

    op.create_table(
        "device_approvals",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column(
            "customer_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("secret_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("device_id", sa.String(128), nullable=True),
        sa.Column("device_name", sa.String(128), nullable=True),
        sa.Column("platform", sa.String(20), nullable=True),
        sa.Column("app_version", sa.String(32), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by_session_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("code_hash", sa.String(64), nullable=True),
        sa.Column("code_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("code_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_device_approvals_customer_id", "device_approvals", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_device_approvals_customer_id", table_name="device_approvals")
    op.drop_table("device_approvals")
    op.drop_index("ix_customer_devices_customer_id", table_name="customer_devices")
    op.drop_table("customer_devices")
    op.drop_column("auth_sessions", "biometric_enabled")
    for column in (
        "transfers_blocked_until",
        "transaction_pin_failed_attempts",
        "transaction_pin_set_at",
        "transaction_pin_hash",
        "login_pin_failed_attempts",
        "login_pin_set_at",
        "login_pin_hash",
    ):
        op.drop_column("customers", column)
