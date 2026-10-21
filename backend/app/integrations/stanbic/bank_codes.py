"""
Bank code conversion for Stanbic transfers (spec: specs/bank-list_2.0.0.json).

The app's bank picker and older saved payout accounts use the 3-digit CBN/NIBSS codes
(e.g. 058 for GTBank). Stanbic's name enquiry and NPS transfer APIs want 6-digit
institution codes (999xxx on the sandbox). Stanbic's Bank List API returns both for every
bank (v1InstitutionCode and institutionCode), so it is the source of truth: nothing here is
a hand-kept table that could drift from what Stanbic routes on.

Rules:
- A 6-digit code Stanbic lists passes through; a 3-digit code is converted.
- A code Stanbic doesn't list is refused, never guessed: a wrong guess sends money to the
  wrong bank, a refusal only fails the transfer (which is retried or refunded as usual).
- The list is cached in memory for CACHE_SECONDS. If a refresh fails, the last good list is
  used. With no list at all the call fails before anything is sent: a definite failure, not
  a "transient, outcome unknown" one, so a withdrawal is released rather than left waiting
  for a transfer that never went out.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

import structlog

from app.core.config import settings
from app.integrations.payments.schemas import PaymentRailError

logger = structlog.get_logger()

CACHE_SECONDS = 12 * 3600
PAGE_SIZE = 200
MAX_PAGES = 25


class UnknownBankCode(PaymentRailError):
    """The code isn't in Stanbic's bank list, so it can't be routed safely."""


@dataclass(frozen=True)
class BankEntry:
    code: str  # Stanbic's 6-digit institution code
    v1_code: str | None  # 3-digit CBN/NIBSS code, when Stanbic gives one
    name: str
    short_name: str | None = None
    category: str | None = None


@dataclass
class BankDirectory:
    entries: list[BankEntry] = field(default_factory=list)

    def __post_init__(self) -> None:
        self._by_code = {e.code: e for e in self.entries}
        by_v1: dict[str, list[BankEntry]] = {}
        for e in self.entries:
            if e.v1_code:
                by_v1.setdefault(e.v1_code, []).append(e)
        # A 3-digit code Stanbic gives to several institutions (e.g. 559) is ambiguous: refuse
        # it rather than pick one, or money could go to the wrong bank.
        self._by_v1 = {code: group[0] for code, group in by_v1.items() if len(group) == 1}

    def to_institution_code(self, code: str) -> str:
        """The 6-digit code Stanbic routes on, for a 3- or 6-digit code. Raises if unknown."""
        raw = "".join(ch for ch in str(code or "") if ch.isdigit())
        if raw in self._by_code:
            return raw
        for candidate in (raw, raw.zfill(3)):
            if candidate in self._by_v1:
                return self._by_v1[candidate].code
        raise UnknownBankCode(
            f"Bank code {code!r} isn't in Stanbic's bank list, so the transfer can't be routed. "
            "Check the payout account's bank.",
            status_code=422,
            provider_code="UNKNOWN_BANK_CODE",
        )


def _entry(item: dict[str, Any]) -> BankEntry | None:
    # The live sandbox sends bankCode/bankName/bankShortName; the spec says
    # institutionCode/institutionName/v1InstitutionShortName. Accept both.
    code = "".join(ch for ch in str(item.get("bankCode") or item.get("institutionCode") or "") if ch.isdigit())
    name = str(item.get("bankName") or item.get("institutionName") or "").strip()
    if len(code) != 6 or not name:
        return None
    v1 = "".join(ch for ch in str(item.get("v1InstitutionCode") or "") if ch.isdigit()) or None
    return BankEntry(
        code=code,
        v1_code=v1,
        name=name,
        short_name=str(item.get("bankShortName") or item.get("v1InstitutionShortName") or "").strip() or None,
        category=str(item.get("category") or "").strip() or None,
    )


async def _page(page: int) -> dict[str, Any]:
    from app.integrations.stanbic.portal_sandbox import _portal_request

    base = settings.stanbic_bank_list_base_url.rstrip("/")
    body = await _portal_request("GET", f"{base}/bank-list", params={"page": page, "size": PAGE_SIZE})
    # Live sandbox: responseCode/responseMsg/responseDetails. Spec: code/message/data.
    code = str(body.get("responseCode") or body.get("code") or "00")
    if code != "00":
        raise PaymentRailError(
            str(body.get("responseMsg") or body.get("message") or "Stanbic bank list failed"), status_code=502
        )
    return body.get("responseDetails") or body.get("data") or {}


async def fetch_bank_directory() -> BankDirectory:
    """Every page of Stanbic's bank list."""
    # Pages: the live sandbox echoes a 1-based "pageNumber". The spec shows a Spring-style
    # 0-based "number"; if page=1 comes back as number 1, page 0 exists and is fetched too.
    first = await _page(1)
    pages = [first]
    zero_based = "pageNumber" not in first and first.get("number") == 1
    if zero_based:
        pages.insert(0, await _page(0))
    total_pages = int(first.get("totalPages") or 1)
    last = total_pages - 1 if zero_based else total_pages
    for page in range(2, min(last, MAX_PAGES) + 1):
        pages.append(await _page(page))

    seen: dict[str, BankEntry] = {}
    for data in pages:
        for item in data.get("content") or []:
            entry = _entry(item) if isinstance(item, dict) else None
            if entry:
                seen.setdefault(entry.code, entry)
    if not seen:
        raise PaymentRailError("Stanbic bank list returned no banks", status_code=502)
    return BankDirectory(sorted(seen.values(), key=lambda e: e.name.lower()))


_cache: tuple[BankDirectory, float] | None = None
_lock = asyncio.Lock()


async def get_bank_directory() -> BankDirectory:
    global _cache
    if _cache and time.monotonic() - _cache[1] < CACHE_SECONDS:
        return _cache[0]
    async with _lock:
        if _cache and time.monotonic() - _cache[1] < CACHE_SECONDS:
            return _cache[0]
        try:
            directory = await fetch_bank_directory()
        except PaymentRailError as exc:
            if _cache:
                logger.warning("stanbic_bank_list_refresh_failed_using_cached", error=exc.message)
                return _cache[0]
            raise PaymentRailError(
                "Stanbic's bank list is unavailable, so bank codes can't be converted yet. Try again shortly.",
                status_code=503,
                provider_code="BANK_LIST_UNAVAILABLE",
            ) from exc
        _cache = (directory, time.monotonic())
        logger.info("stanbic_bank_list_loaded", banks=len(directory.entries))
        return directory


def clear_cache() -> None:
    global _cache
    _cache = None
