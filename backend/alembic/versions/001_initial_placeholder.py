"""Initial schema — domain modules

Revision ID: 001_initial
Revises:
Create Date: 2026-07-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

customer_status = postgresql.ENUM(
    "pending_otp",
    "active",
    "suspended",
    "inactive",
    name="customerstatus",
    create_type=False,
)
staff_status = postgresql.ENUM("active", "inactive", name="staffstatus", create_type=False)
loan_product_code = postgresql.ENUM(
    "business_loan",
    "payday_loan",
    "study_loan",
    "lpo_invoice_financing",
    name="loanproductcode",
    create_type=False,
)
loan_status = postgresql.ENUM(
    "active",
    "overdue",
    "completed",
    "written_off",
    name="loanstatus",
    create_type=False,
)
savings_product_type = postgresql.ENUM(
    "yearly_thrift",
    "regular_savings",
    "fixed_savings",
    "save_to_invest",
    name="savingsproducttype",
    create_type=False,
)
savings_account_status = postgresql.ENUM(
    "active",
    "matured",
    "closed",
    name="savingsaccountstatus",
    create_type=False,
)
group_status = postgresql.ENUM(
    "active",
    "completed",
    "suspended",
    name="groupstatus",
    create_type=False,
)
risk_level = postgresql.ENUM("low", "medium", "high", name="risklevel", create_type=False)
food_basket_plan_type = postgresql.ENUM(
    "basic",
    "standard",
    "premium",
    name="foodbasketplantype",
    create_type=False,
)
subscription_status = postgresql.ENUM(
    "active",
    "paused",
    "cancelled",
    "completed",
    name="subscriptionstatus",
    create_type=False,
)

_ENUMS = (
    customer_status,
    staff_status,
    loan_product_code,
    loan_status,
    savings_product_type,
    savings_account_status,
    group_status,
    risk_level,
    food_basket_plan_type,
    subscription_status,
)


def upgrade() -> None:
    bind = op.get_bind()
    for enum in _ENUMS:
        enum.create(bind, checkfirst=True)

    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_roles_name", "roles", ["name"])

    op.create_table(
        "staff",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", staff_status, nullable=False, server_default="inactive"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("phone"),
    )
    op.create_index("ix_staff_email", "staff", ["email"])
    op.create_index("ix_staff_phone", "staff", ["phone"])
    op.create_index("ix_staff_role_id", "staff", ["role_id"])
    op.create_index("ix_staff_is_super_admin", "staff", ["is_super_admin"])
    op.create_index("ix_staff_status", "staff", ["status"])

    op.create_table(
        "customers",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("account_number", sa.String(length=20), nullable=False),
        sa.Column("branch", sa.String(length=100), nullable=False),
        sa.Column("status", customer_status, nullable=False, server_default="pending_otp"),
        sa.Column("bvn", sa.String(length=11), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("middle_name", sa.String(length=100), nullable=True),
        sa.Column("gender", sa.String(length=20), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("title", sa.String(length=20), nullable=True),
        sa.Column("phone_primary", sa.String(length=20), nullable=False),
        sa.Column("phone_secondary", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("residential_address", sa.Text(), nullable=True),
        sa.Column("state_of_residence", sa.String(length=100), nullable=True),
        sa.Column("lga_of_residence", sa.String(length=100), nullable=True),
        sa.Column("state_of_origin", sa.String(length=100), nullable=True),
        sa.Column("lga_of_origin", sa.String(length=100), nullable=True),
        sa.Column("nationality", sa.String(length=50), nullable=True),
        sa.Column("marital_status", sa.String(length=30), nullable=True),
        sa.Column("enrollment_bank", sa.String(length=100), nullable=True),
        sa.Column("enrollment_branch", sa.String(length=100), nullable=True),
        sa.Column("level_of_account", sa.String(length=50), nullable=True),
        sa.Column("name_on_card", sa.String(length=200), nullable=True),
        sa.Column("bvn_registration_date", sa.String(length=30), nullable=True),
        sa.Column("watch_listed", sa.String(length=10), nullable=True),
        sa.Column("bvn_photo_base64", sa.Text(), nullable=True),
        sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_number"),
        sa.UniqueConstraint("bvn"),
        sa.UniqueConstraint("phone_primary"),
    )
    op.create_index("ix_customers_account_number", "customers", ["account_number"])
    op.create_index("ix_customers_status", "customers", ["status"])
    op.create_index("ix_customers_bvn", "customers", ["bvn"])
    op.create_index("ix_customers_phone_primary", "customers", ["phone_primary"])
    op.create_index("ix_customers_email", "customers", ["email"])

    op.create_table(
        "loan_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("product_type", loan_product_code, nullable=False),
        sa.Column("step", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("total_steps", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_loan_drafts_customer_id", "loan_drafts", ["customer_id"])

    op.create_table(
        "loans",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("product_type", loan_product_code, nullable=False),
        sa.Column("principal", sa.Numeric(18, 2), nullable=False),
        sa.Column("disbursed_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("outstanding", sa.Numeric(18, 2), nullable=False),
        sa.Column("interest_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("tenure_months", sa.Integer(), nullable=False),
        sa.Column("monthly_payment", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", loan_status, nullable=False, server_default="active"),
        sa.Column("disbursement_date", sa.Date(), nullable=True),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("branch", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_loans_customer_id", "loans", ["customer_id"])

    op.create_table(
        "repayment_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("loan_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("installment", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("principal", sa.Numeric(18, 2), nullable=False),
        sa.Column("interest", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["loan_id"], ["loans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_repayment_schedules_loan_id", "repayment_schedules", ["loan_id"])

    op.create_table(
        "savings_products",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("product_type", savings_product_type, nullable=False),
        sa.Column("interest_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("min_deposit", sa.Numeric(18, 2), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("product_type"),
    )

    op.create_table(
        "savings_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("account_number", sa.String(length=20), nullable=False),
        sa.Column("balance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("interest_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("opened_date", sa.Date(), nullable=False),
        sa.Column("maturity_date", sa.Date(), nullable=True),
        sa.Column("status", savings_account_status, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["savings_products.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_number"),
    )
    op.create_index("ix_savings_accounts_customer_id", "savings_accounts", ["customer_id"])
    op.create_index("ix_savings_accounts_account_number", "savings_accounts", ["account_number"])

    op.create_table(
        "contribution_groups",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("leader_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("member_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_members", sa.Integer(), nullable=False, server_default="12"),
        sa.Column("target_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("collected_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("cycle", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("branch", sa.String(length=100), nullable=False),
        sa.Column("next_meeting", sa.Date(), nullable=True),
        sa.Column("status", group_status, nullable=False, server_default="active"),
        sa.Column("service_fee_percent", sa.Numeric(4, 2), nullable=False, server_default="2"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["leader_id"], ["customers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "group_members",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["group_id"], ["contribution_groups.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_group_members_group_id", "group_members", ["group_id"])
    op.create_index("ix_group_members_customer_id", "group_members", ["customer_id"])

    op.create_table(
        "group_contributions",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("member_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("cycle", sa.Integer(), nullable=False),
        sa.Column("contributed_at", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["contribution_groups.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["customers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_group_contributions_group_id", "group_contributions", ["group_id"])

    op.create_table(
        "investment_plans",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("min_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("return_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("tenure_months", sa.Integer(), nullable=False),
        sa.Column("risk", risk_level, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "customer_investments",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("return_rate", sa.Numeric(5, 2), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("maturity_date", sa.Date(), nullable=False),
        sa.Column("projected_return", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["plan_id"], ["investment_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_customer_investments_customer_id", "customer_investments", ["customer_id"])

    op.create_table(
        "food_basket_plans",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("plan_type", food_basket_plan_type, nullable=False),
        sa.Column("monthly_price", sa.Numeric(18, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("items_included", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "food_basket_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("monthly_price", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", subscription_status, nullable=False, server_default="active"),
        sa.Column("delivery_address", sa.Text(), nullable=False),
        sa.Column("pickup_branch", sa.String(length=100), nullable=True),
        sa.Column("next_delivery_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["plan_id"], ["food_basket_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_food_basket_subscriptions_customer_id", "food_basket_subscriptions", ["customer_id"])

    op.create_table(
        "food_basket_deliveries",
        sa.Column("id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="scheduled"),
        sa.Column("fulfillment_partner", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["subscription_id"], ["food_basket_subscriptions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_food_basket_deliveries_subscription_id", "food_basket_deliveries", ["subscription_id"])


def downgrade() -> None:
    op.drop_table("food_basket_deliveries")
    op.drop_table("food_basket_subscriptions")
    op.drop_table("food_basket_plans")
    op.drop_table("customer_investments")
    op.drop_table("investment_plans")
    op.drop_table("group_contributions")
    op.drop_table("group_members")
    op.drop_table("contribution_groups")
    op.drop_table("savings_accounts")
    op.drop_table("savings_products")
    op.drop_table("repayment_schedules")
    op.drop_table("loans")
    op.drop_table("loan_drafts")
    op.drop_table("customers")
    op.drop_table("staff")
    op.drop_table("roles")

    bind = op.get_bind()
    for enum in reversed(_ENUMS):
        enum.drop(bind, checkfirst=True)
