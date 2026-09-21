"""Add zest to paymentprovider enum."""

from alembic import op

revision = "006_zest_provider"
down_revision = "005_monnify_provider"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            ALTER TYPE paymentprovider ADD VALUE 'zest';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )


def downgrade() -> None:
    pass
