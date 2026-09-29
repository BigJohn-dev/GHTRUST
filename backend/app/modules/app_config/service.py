"""Remote configuration for the mobile app: version gate, maintenance, features."""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel

from app.core.config import get_settings

Platform = Literal["ios", "android"]

# Optional modules the app can show. Loans are always on.
OPTIONAL_FEATURES = ("wallet", "savings", "investments", "contributions", "food_basket")


def parse_version(value: str | None) -> tuple[int, ...] | None:
    """'1.4.2' → (1, 4, 2). Pre-release/build suffixes are ignored. None if unparseable."""
    if not value:
        return None
    core = value.strip().lstrip("vV").split("-")[0].split("+")[0]
    try:
        parts = tuple(int(p) for p in core.split("."))
    except ValueError:
        return None
    return parts + (0,) * (3 - len(parts)) if parts else None


def min_version(platform: Platform) -> str:
    s = get_settings()
    return s.app_min_version_ios if platform == "ios" else s.app_min_version_android


def latest_version(platform: Platform) -> str:
    s = get_settings()
    latest = s.app_latest_version_ios if platform == "ios" else s.app_latest_version_android
    return latest or min_version(platform)


def update_required(platform: Platform, version: str | None) -> bool:
    current, minimum = parse_version(version), parse_version(min_version(platform))
    if current is None or minimum is None:
        return False
    return current < minimum


def enabled_features() -> dict[str, bool]:
    configured = {f.strip() for f in get_settings().feature_flags.split(",") if f.strip()}
    return {"loans": True, **{name: name in configured for name in OPTIONAL_FEATURES}}


class MaintenanceInfo(BaseModel):
    enabled: bool
    message: str | None = None


class SupportInfo(BaseModel):
    phone: str | None = None
    email: str | None = None
    whatsapp: str | None = None
    hours: str | None = None


class AppConfigResponse(BaseModel):
    platform: Platform
    min_supported_version: str
    latest_version: str
    update_required: bool
    update_available: bool
    maintenance: MaintenanceInfo
    features: dict[str, bool]
    support: SupportInfo
    server_time: datetime


def build_config(platform: Platform, version: str | None) -> AppConfigResponse:
    s = get_settings()
    latest = latest_version(platform)
    current, latest_parsed = parse_version(version), parse_version(latest)
    return AppConfigResponse(
        platform=platform,
        min_supported_version=min_version(platform),
        latest_version=latest,
        update_required=update_required(platform, version),
        update_available=bool(current and latest_parsed and current < latest_parsed),
        maintenance=MaintenanceInfo(
            enabled=s.maintenance_mode,
            message=s.maintenance_message if s.maintenance_mode else None,
        ),
        features=enabled_features(),
        support=SupportInfo(
            phone=s.support_phone or None,
            email=s.support_email or None,
            whatsapp="".join(ch for ch in s.support_whatsapp if ch.isdigit()) or None,
            hours=s.support_hours or None,
        ),
        server_time=datetime.now(timezone.utc),
    )
