"""One definition of "find a customer" for every staff list (customers, applications, loans).

- Words are matched independently against the name/email fields, so "Adaeze Okafor"
  finds first_name=Adaeze, last_name=Okafor.
- Phone numbers match however they're typed (0803…, 234803…, +234803…).
- A BVN only matches exactly (all 11 digits) — no substring probing of BVNs.
- LIKE wildcards in the input are escaped.
"""

import re

from sqlalchemy import ColumnElement, and_, false, or_

from app.modules.users.models import Customer


def like_pattern(term: str) -> str:
    """%term% with LIKE wildcards escaped; use with escape='\\'."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def customer_search_clause(search: str) -> ColumnElement[bool]:
    term = search.strip()
    if not term:
        return false()

    digits = re.sub(r"\D", "", term)
    clauses: list[ColumnElement[bool]] = []

    # Numeric input (digits with optional + - spaces brackets): account number, phone or BVN.
    if digits and re.fullmatch(r"[\d\s+\-()]+", term):
        clauses.append(Customer.account_number.ilike(like_pattern(digits), escape="\\"))
        if len(digits) == 11:
            clauses.append(Customer.bvn == digits)
        if len(digits) >= 4:
            # Compare on the national part (without 0 / 234 prefix) so any format matches.
            national = digits[1:] if digits.startswith("0") else digits[3:] if digits.startswith("234") else digits
            clauses.append(Customer.phone_primary.ilike(like_pattern(national), escape="\\"))
            clauses.append(Customer.phone_secondary.ilike(like_pattern(national), escape="\\"))

    words = [w for w in re.split(r"\s+", term) if w]
    name_fields = (Customer.first_name, Customer.middle_name, Customer.last_name, Customer.email)
    clauses.append(and_(*[or_(*[f.ilike(like_pattern(w), escape="\\") for f in name_fields]) for w in words]))

    return or_(*clauses)
