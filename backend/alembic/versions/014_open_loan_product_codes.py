"""Loan product codes are data, not an enum: staff can create products.

loans.product_type and loan_drafts.product_type held the fixed `loanproductcode` enum,
so a loan could only be booked for the five built-in products. They now hold the
product's code as text (it matches loan_products.code).

Revision ID: 014_open_loan_product_codes
Revises: 013_mobile_app_support
"""

import sqlalchemy as sa
from alembic import op

revision = "014_open_loan_product_codes"
down_revision = "013_mobile_app_support"
branch_labels = None
depends_on = None

_TABLES = ("loans", "loan_drafts")
_BUILT_IN = ("business_loan", "payday_loan", "study_loan", "asset_loan", "lpo_invoice_financing")


def upgrade() -> None:
    for table in _TABLES:
        op.alter_column(
            table,
            "product_type",
            type_=sa.String(length=50),
            existing_nullable=False,
            postgresql_using="product_type::text",
        )
    op.execute("DROP TYPE IF EXISTS loanproductcode")


def downgrade() -> None:
    # Only possible while every loan still uses a built-in product.
    values = ", ".join(f"'{v}'" for v in _BUILT_IN)
    op.execute(f"CREATE TYPE loanproductcode AS ENUM ({values})")
    for table in _TABLES:
        op.alter_column(
            table,
            "product_type",
            type_=sa.Enum(*_BUILT_IN, name="loanproductcode", create_type=False),
            existing_nullable=False,
            postgresql_using="product_type::loanproductcode",
        )
