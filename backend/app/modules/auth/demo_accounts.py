"""
Demo customers for testers and app-store review (see app/core/demo.py).

`scripts/seed.py` calls this. Each DEMO_PHONES number that isn't a staff member gets
an open customer account, so it can sign in straight away with DEMO_OTP. Re-running
resets the account's PINs to DEMO_LOGIN_PIN / DEMO_TRANSACTION_PIN (if set) and clears
failed attempts, which undoes whatever the last tester changed.
"""

import secrets
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.demo import demo_phones
from app.core.pins import LOGIN_PIN_LENGTH, TRANSACTION_PIN_LENGTH, hash_pin
from app.modules.admin.models import Staff
from app.modules.users.models import Customer, CustomerStatus


class DemoSeedError(ValueError):
    pass


def _pin(value: str, length: int, name: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    if not (value.isdigit() and len(value) == length):
        raise DemoSeedError(f"{name} must be {length} digits")
    return value


def _demo_bvn(phone: str) -> str:
    # Not a real BVN (those start with 22); fixed per number so re-runs find the same row.
    return "000" + phone[-8:]


async def seed_demo_customers(session: AsyncSession) -> list[str]:
    """Create or reset a demo customer per DEMO_PHONES number. Returns the numbers seeded."""
    s = get_settings()
    login_pin = _pin(s.demo_login_pin, LOGIN_PIN_LENGTH, "DEMO_LOGIN_PIN")
    transaction_pin = _pin(s.demo_transaction_pin, TRANSACTION_PIN_LENGTH, "DEMO_TRANSACTION_PIN")
    now = datetime.now(timezone.utc)
    seeded: list[str] = []

    for phone in sorted(demo_phones()):
        if (await session.execute(select(Staff.id).where(Staff.phone == phone))).first():
            continue  # a staff number: it signs in to the portal, not the app
        customer = (
            await session.execute(select(Customer).where(Customer.phone_primary == phone))
        ).scalar_one_or_none()
        if customer is None:
            customer = Customer(
                account_number=f"30{secrets.randbelow(10**8):08d}",
                branch=s.default_branch,
                bvn=_demo_bvn(phone),
                first_name="Demo",
                last_name="Customer",
                phone_primary=phone,
                phone_verified=True,
                phone_verified_at=now,
                selfie_verified_at=now,
                status=CustomerStatus.ACTIVE,
            )
            session.add(customer)
        else:
            customer.status = CustomerStatus.ACTIVE
        if login_pin:
            customer.login_pin_hash = hash_pin(login_pin)
            customer.login_pin_set_at = now
        if transaction_pin:
            customer.transaction_pin_hash = hash_pin(transaction_pin)
            customer.transaction_pin_set_at = now
        customer.login_pin_failed_attempts = 0
        customer.transaction_pin_failed_attempts = 0
        seeded.append(phone)

    await session.flush()
    return seeded
