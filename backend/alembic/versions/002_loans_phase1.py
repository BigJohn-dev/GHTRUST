"""Loan products and application workflow — phase 1.

Revision ID: 002_loans_phase1
Revises: 001_initial_placeholder
Create Date: 2026-07-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_loans_phase1"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "loan_products",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("processing_fee_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("interest_rate_pct_monthly", sa.Numeric(5, 2), nullable=False),
        sa.Column("max_tenure_days", sa.Integer(), nullable=True),
        sa.Column("default_penalty_pct_daily", sa.Numeric(5, 2), nullable=True),
        sa.Column("repayment_cadence_options", sa.JSON(), nullable=False),
        sa.Column("required_document_types", sa.JSON(), nullable=False),
        sa.Column("workflow_steps", sa.JSON(), nullable=False),
        sa.Column("eligibility_rules", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_loan_products_code", "loan_products", ["code"])
    op.create_index("ix_loan_products_is_active", "loan_products", ["is_active"])

    # Replace loan_applications with expanded schema (if legacy table exists)
    op.execute("DROP TABLE IF EXISTS loan_applications CASCADE")
    op.create_table(
        "loan_applications",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "draft",
                "submitted",
                "under_review",
                "documents_incomplete",
                "approved",
                "offer_sent",
                "offer_accepted",
                "product_gate_pending",
                "processing_fee_paid",
                "ready_to_disburse",
                "disbursed",
                "rejected",
                "withdrawn",
                "expired",
                name="applicationstatus",
            ),
            nullable=False,
        ),
        sa.Column("channel", sa.Enum("web", "branch", name="applicationchannel"), nullable=False),
        sa.Column("step", sa.Integer(), nullable=False),
        sa.Column("total_steps", sa.Integer(), nullable=False),
        sa.Column("branch", sa.String(length=100), nullable=False),
        sa.Column("universal_form", sa.JSON(), nullable=False),
        sa.Column("product_data", sa.JSON(), nullable=False),
        sa.Column("requested_amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("approved_amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("repayment_cadence", sa.String(length=30), nullable=True),
        sa.Column("assigned_officer_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("applicant_signed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assigned_officer_id"], ["staff.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["loan_products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_loan_applications_customer_id", "loan_applications", ["customer_id"])
    op.create_index("ix_loan_applications_product_id", "loan_applications", ["product_id"])
    op.create_index("ix_loan_applications_status", "loan_applications", ["status"])

    op.create_table(
        "application_documents",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("document_type", sa.String(length=50), nullable=False),
        sa.Column("file_key", sa.String(length=500), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "verified", "rejected", name="documentstatus"),
            nullable=False,
        ),
        sa.Column("uploaded_by", sa.String(length=20), nullable=False),
        sa.Column("verified_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["loan_applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["verified_by"], ["staff.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "application_guarantors",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("bvn", sa.String(length=11), nullable=True),
        sa.Column("id_type", sa.String(length=50), nullable=True),
        sa.Column("id_number", sa.String(length=50), nullable=True),
        sa.Column("relationship_to_borrower", sa.String(length=100), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["loan_applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "application_collaterals",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("collateral_type", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("estimated_value", sa.Numeric(18, 2), nullable=True),
        sa.Column(
            "custody_status",
            sa.Enum("with_customer", "with_ghtrust", "released", name="collateralcustody"),
            nullable=False,
        ),
        sa.Column("affidavit_reference", sa.String(length=100), nullable=True),
        sa.Column("original_docs_received", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["loan_applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "application_status_logs",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("from_status", sa.String(length=40), nullable=True),
        sa.Column("to_status", sa.String(length=40), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_by_staff_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("changed_by_customer_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["loan_applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by_customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["changed_by_staff_id"], ["staff.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Extend loan product enum on loans table for asset loan
    op.execute("ALTER TYPE loanproductcode ADD VALUE IF NOT EXISTS 'asset_loan'")


def downgrade() -> None:
    op.drop_table("application_status_logs")
    op.drop_table("application_collaterals")
    op.drop_table("application_guarantors")
    op.drop_table("application_documents")
    op.drop_table("loan_applications")
    op.drop_table("loan_products")
    sa.Enum(name="applicationstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="applicationchannel").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="documentstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="collateralcustody").drop(op.get_bind(), checkfirst=True)
