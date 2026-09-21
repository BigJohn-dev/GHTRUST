"""Rename application_guarantors.relationship to relationship_to_borrower.

Revision ID: 007_guarantor_relationship_column
Revises: 006_zest_provider
Create Date: 2026-08-07
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_guarantor_rel"
down_revision: Union[str, None] = "006_zest_provider"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    has_old = bind.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'application_guarantors' "
            "AND column_name = 'relationship')"
        )
    ).scalar()
    has_new = bind.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'application_guarantors' "
            "AND column_name = 'relationship_to_borrower')"
        )
    ).scalar()
    if has_old and not has_new:
        op.alter_column(
            "application_guarantors",
            "relationship",
            new_column_name="relationship_to_borrower",
        )


def downgrade() -> None:
    bind = op.get_bind()
    has_new = bind.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'application_guarantors' "
            "AND column_name = 'relationship_to_borrower')"
        )
    ).scalar()
    has_old = bind.execute(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = 'application_guarantors' "
            "AND column_name = 'relationship')"
        )
    ).scalar()
    if has_new and not has_old:
        op.alter_column(
            "application_guarantors",
            "relationship_to_borrower",
            new_column_name="relationship",
        )
