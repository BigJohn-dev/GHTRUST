"""Add monnify to paymentprovider enum."""

from alembic import op

revision = "005_monnify_provider"
down_revision = "004_payments_ledger"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            ALTER TYPE paymentprovider ADD VALUE 'monnify';
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )


def downgrade() -> None:
    # PostgreSQL does not support removing enum values safely.
    pass
