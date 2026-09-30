"""
Demo sign-in for testers and app-store review.

Phone numbers listed in DEMO_PHONES get the fixed DEMO_OTP instead of an SMS, so a
reviewer or tester can sign in with credentials written down in advance. Everything
else about sign-in is unchanged: the code still expires, attempts are still capped,
and numbers not on the list still get a random code by SMS.

BVNs listed in DEMO_BVNS simulate sign-up on test servers: no Dojah lookup, face match
or liveness check. Each gets a made-up identity whose phone is a demo number, and
entering the BVN again starts sign-up over. Production refuses DEMO_BVNS: it would open
accounts without identity checks.

Production limits (the start-up guard in config enforces the code's strength):
- staff sign-in never uses the demo code, so a published code can't open the portal;
- money never leaves a demo account (no withdrawals, transfers or loan payouts).
"""

import re

from app.core.config import get_settings
from app.integrations.dojah.schemas import DojahBvnEntity

STAFF_PURPOSES = frozenset({"staff_login"})


def normalize_phone(phone: str) -> str:
    """Same rule as Customer.normalize_phone (E.164, +234…), without importing the model."""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("234"):
        return f"+{digits}"
    if digits.startswith("0"):
        return f"+234{digits[1:]}"
    if len(digits) == 10:
        return f"+234{digits}"
    return f"+{digits}" if not phone.startswith("+") else phone


def demo_bvns() -> frozenset[str]:
    raw = get_settings().demo_bvns
    return frozenset(b.strip() for b in raw.split(",") if b.strip())


def is_demo_bvn(bvn: str | None) -> bool:
    return bool(bvn) and bvn.strip() in demo_bvns()


def demo_bvn_phone(bvn: str) -> str:
    """The made-up phone on a demo BVN's record: 070 + the BVN's last 8 digits."""
    return normalize_phone("070" + bvn.strip()[-8:])


def demo_phones() -> frozenset[str]:
    """DEMO_PHONES plus the phones on demo BVN records (so their codes are DEMO_OTP too)."""
    raw = get_settings().demo_phones
    listed = {normalize_phone(p) for p in raw.split(",") if p.strip()}
    return frozenset(listed | {demo_bvn_phone(b) for b in demo_bvns()})


def is_demo_phone(phone: str | None) -> bool:
    return bool(phone) and normalize_phone(phone) in demo_phones()


def demo_code_for(purpose: str, phone: str) -> str | None:
    """The fixed code to use for this send, or None to send a random code by SMS."""
    s = get_settings()
    code = s.demo_otp.strip()
    if not code or not is_demo_phone(phone):
        return None
    if not (code.isdigit() and len(code) == s.otp_length):
        return None
    if purpose in STAFF_PURPOSES and s.is_production:
        return None
    return code


def demo_identity(bvn: str) -> DojahBvnEntity:
    """What a BVN lookup returns for a demo BVN."""
    return DojahBvnEntity(
        bvn=bvn,
        first_name="DEMO",
        last_name="APPLICANT",
        gender="Female",
        date_of_birth="1994-06-01",
        phone_number1=demo_bvn_phone(bvn),
        residential_address="1 Demo Street, Ikeja, Lagos",
        state_of_residence="LAGOS",
        lga_of_residence="IKEJA",
        state_of_origin="LAGOS",
        nationality="NIGERIAN",
        watch_listed="NO",
    )


def blocks_money_out(phone: str | None) -> bool:
    """Demo accounts on the live system can't send money anywhere."""
    return get_settings().is_production and is_demo_phone(phone)


def weak_code(code: str) -> bool:
    """All one digit (000000) or a straight run (123456, 654321)."""
    if len(set(code)) == 1:
        return True
    steps = {int(b) - int(a) for a, b in zip(code, code[1:])}
    return steps in ({1}, {-1})
