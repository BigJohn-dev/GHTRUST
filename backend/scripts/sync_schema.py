"""Patch Postgres schema when tables were created via create_all before new migrations."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

_LOAN_APPLICATION_PATCHES = (
    "ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ",
    "ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ",
    "ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS disbursed_at TIMESTAMPTZ",
    "ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS workflow_id UUID",
    "ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS current_stage_id UUID",
    "ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS current_stage_entered_at TIMESTAMPTZ",
)

_FK_PATCHES = (
    """
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_loan_applications_workflow_id') THEN
        ALTER TABLE loan_applications
          ADD CONSTRAINT fk_loan_applications_workflow_id
          FOREIGN KEY (workflow_id) REFERENCES loan_workflows(id);
      END IF;
    END $$
    """,
    """
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_loan_applications_current_stage_id') THEN
        ALTER TABLE loan_applications
          ADD CONSTRAINT fk_loan_applications_current_stage_id
          FOREIGN KEY (current_stage_id) REFERENCES loan_workflow_stages(id);
      END IF;
    END $$
    """,
)

_CUSTOMER_PAYSTACK_PATCHES = (
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS paystack_customer_code VARCHAR(64)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS paystack_dva_account_number VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS paystack_dva_bank_name VARCHAR(100)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS paystack_dva_bank_slug VARCHAR(50)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS paystack_transfer_recipient_code VARCHAR(64)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS payout_bank_code VARCHAR(10)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS payout_account_number VARCHAR(20)",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS payout_account_name VARCHAR(200)",
)


async def sync_loan_workflow_schema(conn: AsyncConnection) -> None:
    """Ensure loan_applications has workflow columns (create_all does not alter existing tables)."""
    for sql in _LOAN_APPLICATION_PATCHES:
        await conn.execute(text(sql))
    for sql in _FK_PATCHES:
        await conn.execute(text(sql))


async def sync_customer_paystack_schema(conn: AsyncConnection) -> None:
    for sql in _CUSTOMER_PAYSTACK_PATCHES:
        await conn.execute(text(sql))
