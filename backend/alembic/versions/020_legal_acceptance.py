"""Legal acceptances: Terms/Privacy versions per customer, loan offer acceptance, audit trail.

Revision ID: 020_legal_acceptance
Revises: 019_notifications
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "020_legal_acceptance"
down_revision = "019_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("terms_accepted_version", sa.String(20), nullable=True))
    op.add_column("customers", sa.Column("privacy_accepted_version", sa.String(20), nullable=True))
    op.add_column("loan_applications", sa.Column("offer_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("loan_applications", sa.Column("offer_terms_hash", sa.String(64), nullable=True))

    op.create_table(
        "legal_acceptances",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("document", sa.String(30), nullable=False),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column(
            "application_id",
            postgresql.UUID(as_uuid=False),
            sa.ForeignKey("loan_applications.id"),
            nullable=True,
        ),
        sa.Column("terms_hash", sa.String(64), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("device_id", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_legal_acceptances_customer_id", "legal_acceptances", ["customer_id"])
    op.create_index("ix_legal_acceptances_application_id", "legal_acceptances", ["application_id"])


def downgrade() -> None:
    op.drop_index("ix_legal_acceptances_application_id", table_name="legal_acceptances")
    op.drop_index("ix_legal_acceptances_customer_id", table_name="legal_acceptances")
    op.drop_table("legal_acceptances")
    op.drop_column("loan_applications", "offer_terms_hash")
    op.drop_column("loan_applications", "offer_accepted_at")
    op.drop_column("customers", "privacy_accepted_version")
    op.drop_column("customers", "terms_accepted_version")
