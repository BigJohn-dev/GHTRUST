"""Account numbers for mocked payment rails (development and tests)."""

import hashlib


def mock_account_number(reference: str, prefix: str) -> str:
    """
    A stable 10-digit NUBAN for a mocked provider account, derived from its reference.

    Wallet account numbers are unique per customer in the database, so a mock must not
    hand every customer the same number. The same reference always gets the same number,
    as a real provider's fetch would return.
    """
    digits = str(int(hashlib.sha256(reference.encode()).hexdigest(), 16))
    return (prefix + digits)[:10]
