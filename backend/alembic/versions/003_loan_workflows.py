"""Configurable loan workflows, stage decisions, and audit logs.

Revision ID: 003_loan_workflows
Revises: 002_loans_phase1
Create Date: 2026-07-15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_loan_workflows"
down_revision: Union[str, None] = "002_loans_phase1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

stage_action = postgresql.ENUM("approved", "rejected", name="stagedecisionaction", create_type=False)
audit_actor = postgresql.ENUM("customer", "staff", "system", name="auditactortype", create_type=False)
audit_event = postgresql.ENUM(
    "application_created",
    "application_submitted",
    "application_viewed",
    "bvn_viewed",
    "stage_entered",
    "stage_approved",
    "stage_rejected",
    "status_changed",
    "document_verified",
    "document_rejected",
    "disbursed",
    "workflow_assigned",
    name="auditeventtype",
    create_type=False,
)


def upgrade() -> None:
    stage_action.create(op.get_bind(), checkfirst=True)
    audit_actor.create(op.get_bind(), checkfirst=True)
    audit_event.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "loan_workflows",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_staff_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["loan_products.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_staff_id"], ["staff.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_id", "version", name="uq_loan_workflow_product_version"),
    )
    op.create_index("ix_loan_workflows_product_id", "loan_workflows", ["product_id"])
    op.create_index("ix_loan_workflows_is_published", "loan_workflows", ["is_published"])

    op.create_table(
        "loan_workflow_stages",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("workflow_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("approver_role_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["workflow_id"], ["loan_workflows.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["approver_role_id"], ["roles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_loan_workflow_stages_workflow_id", "loan_workflow_stages", ["workflow_id"])
    op.create_index("ix_loan_workflow_stages_approver_role_id", "loan_workflow_stages", ["approver_role_id"])

    op.add_column("loan_applications", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("loan_applications", sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("loan_applications", sa.Column("disbursed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("loan_applications", sa.Column("workflow_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.add_column("loan_applications", sa.Column("current_stage_id", postgresql.UUID(as_uuid=False), nullable=True))
    op.add_column(
        "loan_applications", sa.Column("current_stage_entered_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_loan_applications_workflow_id", "loan_applications", "loan_workflows", ["workflow_id"], ["id"]
    )
    op.create_foreign_key(
        "fk_loan_applications_current_stage_id",
        "loan_applications",
        "loan_workflow_stages",
        ["current_stage_id"],
        ["id"],
    )
    op.create_index("ix_loan_applications_workflow_id", "loan_applications", ["workflow_id"])
    op.create_index("ix_loan_applications_current_stage_id", "loan_applications", ["current_stage_id"])

    op.create_table(
        "application_stage_decisions",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("stage_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("action", stage_action, nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("entered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["loan_applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["stage_id"], ["loan_workflow_stages.id"]),
        sa.ForeignKeyConstraint(["staff_id"], ["staff.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_application_stage_decisions_application_id", "application_stage_decisions", ["application_id"]
    )

    op.create_table(
        "application_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("event_type", audit_event, nullable=False),
        sa.Column("actor_type", audit_actor, nullable=False),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("actor_label", sa.String(length=200), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("event_metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["loan_applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_application_audit_logs_application_id", "application_audit_logs", ["application_id"])
    op.create_index("ix_application_audit_logs_event_type", "application_audit_logs", ["event_type"])
    op.create_index("ix_application_audit_logs_created_at", "application_audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_table("application_audit_logs")
    op.drop_table("application_stage_decisions")
    op.drop_constraint("fk_loan_applications_current_stage_id", "loan_applications", type_="foreignkey")
    op.drop_constraint("fk_loan_applications_workflow_id", "loan_applications", type_="foreignkey")
    op.drop_index("ix_loan_applications_current_stage_id", table_name="loan_applications")
    op.drop_index("ix_loan_applications_workflow_id", table_name="loan_applications")
    op.drop_column("loan_applications", "current_stage_entered_at")
    op.drop_column("loan_applications", "current_stage_id")
    op.drop_column("loan_applications", "workflow_id")
    op.drop_column("loan_applications", "disbursed_at")
    op.drop_column("loan_applications", "rejected_at")
    op.drop_column("loan_applications", "approved_at")
    op.drop_table("loan_workflow_stages")
    op.drop_table("loan_workflows")
    bind = op.get_bind()
    audit_event.drop(bind, checkfirst=True)
    audit_actor.drop(bind, checkfirst=True)
    stage_action.drop(bind, checkfirst=True)
