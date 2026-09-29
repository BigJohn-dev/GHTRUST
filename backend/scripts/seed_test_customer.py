"""
Create (or refresh) a registered, phone-verified customer for testing the mobile app.

    python scripts/seed_test_customer.py
    python scripts/seed_test_customer.py --phone 08031112222 --bvn 22211133344

Then sign in on the app with the phone number. With SMS_MOCK=true the code is printed in
the API log, and in development it is also sent back to the app, which fills it in.

Safe to run repeatedly: the same BVN updates the same customer. Refuses production.
"""

import argparse
import asyncio
import sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.database import AsyncSessionLocal, engine  # noqa: E402
from app.modules.auth.service import _generate_account_number  # noqa: E402
from app.modules.users.models import Customer, CustomerStatus  # noqa: E402
from scripts.seed import SeedError, ensure_migrated  # noqa: E402

DEFAULT_PHONE = "08012345678"
DEFAULT_BVN = "22200011122"

PROFILE = {
    "first_name": "Tolu",
    "middle_name": "Grace",
    "last_name": "Adebayo",
    "gender": "Female",
    "date_of_birth": date(1992, 6, 14),
    "title": "MRS",
    "email": "tolu.adebayo@example.com",
    "residential_address": "14 Admiralty Way, Lekki Phase 1, Lagos",
    "state_of_residence": "LAGOS",
    "lga_of_residence": "ETI-OSA",
    "state_of_origin": "OYO",
    "lga_of_origin": "IBADAN NORTH",
    "nationality": "NIGERIAN",
    "marital_status": "MARRIED",
    "enrollment_bank": "GTB",
    "enrollment_branch": "LEKKI",
    "level_of_account": "LEVEL 3",
    "name_on_card": "TOLU G ADEBAYO",
    "watch_listed": "NO",
}


async def seed(phone: str, bvn: str) -> Customer:
    settings = get_settings()
    if settings.app_env == "production":
        raise SeedError("Refusing to create a test customer in production.")
    await ensure_migrated()

    normalized = Customer.normalize_phone(phone)
    async with AsyncSessionLocal() as session:
        clash = await session.execute(
            select(Customer).where(Customer.phone_primary == normalized, Customer.bvn != bvn)
        )
        if clash.scalar_one_or_none():
            raise SeedError(f"{phone} already belongs to another customer. Pass a different --phone.")

        customer = (await session.execute(select(Customer).where(Customer.bvn == bvn))).scalar_one_or_none()
        if customer is None:
            customer = Customer(bvn=bvn, account_number=_generate_account_number(), branch=settings.default_branch)
            session.add(customer)

        for field, value in PROFILE.items():
            setattr(customer, field, value)
        customer.phone_primary = normalized
        customer.status = CustomerStatus.ACTIVE
        customer.phone_verified = True
        customer.phone_verified_at = customer.phone_verified_at or datetime.now(timezone.utc)
        await session.flush()

        # The same payment-rail setup registration does (mocked unless provider keys are set).
        from app.modules.payments.wallet_service import WalletService

        await WalletService(session).provision_paystack(customer)
        await session.commit()
        await session.refresh(customer)
        return customer


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--phone", default=DEFAULT_PHONE, help=f"sign-in phone (default {DEFAULT_PHONE})")
    parser.add_argument("--bvn", default=DEFAULT_BVN, help=f"11-digit BVN (default {DEFAULT_BVN})")
    args = parser.parse_args()
    if not (args.bvn.isdigit() and len(args.bvn) == 11):
        sys.exit("--bvn must be 11 digits")

    engine.echo = False  # DEBUG=true echoes every SQL statement; keep the output readable
    try:
        customer = asyncio.run(seed(args.phone, args.bvn))
    except SeedError as exc:
        sys.exit(f"Error: {exc}")

    print(
        "\nTest customer ready (registered, phone verified, active)\n"
        f"  Name:            {customer.first_name} {customer.middle_name} {customer.last_name}\n"
        f"  Sign-in phone:   {args.phone}\n"
        f"  BVN:             {customer.bvn}\n"
        f"  Account number:  {customer.account_number}\n"
        "\nIn the app: 'I already have an account' -> enter the phone -> the code is filled in\n"
        "(development with SMS_MOCK=true), or copy it from the API log line 'sms_mock_delivery'.\n"
    )


if __name__ == "__main__":
    main()
