"""Add stanbic to paymentprovider enum."""

from alembic import op

revision = "008_stanbic_provider"
down_revision = "007_guarantor_rel"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            ALTER TYPE paymentprovider ADD VALUE 'stanbic';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )


def downgrade() -> None:
    pass
