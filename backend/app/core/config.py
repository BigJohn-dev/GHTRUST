from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "GH Trust MFB API"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    secret_key: str = Field(default="dev-secret-change-in-production")
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"

    # JWT
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24  # 24 hours

    # Dojah KYC
    dojah_base_url: str = "https://api.dojah.io"
    dojah_app_id: str = ""
    dojah_secret_key: str = ""
    dojah_mock: bool = True  # Use sandbox mock when keys missing or mock=true

    # Payment rail: monnify (default), paystack, or zest
    payment_provider: str = "monnify"

    # Zest Payments (https://www.zestpayment.com/developers)
    zest_base_url: str = "https://api.dev.gateway.zestpayment.com/payment-engine"
    zest_public_key: str = ""
    zest_secret_key: str = ""
    zest_mock: bool = True
    # AES key/IV for encrypting authData (Notion doc). IV from Zest dashboard; key defaults to secret without SK_ prefix.
    zest_auth_encryption_key: str = ""
    zest_auth_encryption_iv: str = ""
    zest_dynamic_vas_request_type: str = "GENERATE_TEMPORARY_VIRTUAL_ACCOUNT"
    zest_transfer_status_vas_request_type: str = "TRANSFER_PAYMENT_STATUS"
    zest_va_expiry_minutes: int = 5

    # Monnify (https://developers.monnify.com/api)
    monnify_base_url: str = "https://sandbox.monnify.com"
    monnify_api_key: str = ""
    monnify_secret_key: str = ""
    monnify_contract_code: str = ""
    monnify_wallet_account_number: str = ""
    monnify_mock: bool = True
    monnify_webhook_ip_check: bool = False

    # Paystack (legacy / optional — https://paystack.com/docs/api/)
    paystack_base_url: str = "https://api.paystack.co"
    paystack_secret_key: str = ""
    paystack_public_key: str = ""
    paystack_mock: bool = True
    paystack_preferred_bank: str = "test-bank"  # test-bank in sandbox; live bank slug in prod

    # OTP
    otp_length: int = 6
    otp_expire_seconds: int = 600  # 10 minutes
    otp_max_attempts: int = 5
    sms_mock: bool = True  # Log OTP to console in dev

    # Rate limits (requests per window). Disabled automatically when APP_ENV=development.
    rate_limit_enabled: bool = True
    rate_limit_bvn_per_ip_hour: int = 5
    rate_limit_bvn_per_bvn_day: int = 3
    rate_limit_otp_send_per_phone_15min: int = 3
    rate_limit_otp_send_per_ip_hour: int = 10
    rate_limit_otp_verify_per_ip_hour: int = 20
    rate_limit_login_request_per_phone_15min: int = 5

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "ghtrust"
    postgres_password: str = "ghtrust_secret"
    postgres_db: str = "ghtrust_mfb"
    database_url: str | None = None

    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    celery_task_always_eager: bool = False

    default_branch: str = "Lagos Main"

    upload_dir: str = "uploads"
    max_upload_size_mb: int = 10

    # Seeded super admin (first staff)
    seed_super_admin_name: str = "Divine Obinali"
    seed_super_admin_email: str = "admin@ghtrust.com"
    seed_super_admin_phone: str = "08107891549"

    @property
    def rate_limits_active(self) -> bool:
        """Production/test enforce limits; development is unrestricted for local UX."""
        if self.app_env == "development":
            return False
        return self.rate_limit_enabled

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def async_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sync_database_url(self) -> str:
        url = self.async_database_url
        return url.replace("postgresql+asyncpg://", "postgresql://")

    @property
    def dojah_enabled(self) -> bool:
        return bool(self.dojah_app_id and self.dojah_secret_key) and not self.dojah_mock

    @property
    def paystack_enabled(self) -> bool:
        return bool(self.paystack_secret_key) and not self.paystack_mock

    @property
    def monnify_enabled(self) -> bool:
        return (
            bool(self.monnify_api_key and self.monnify_secret_key and self.monnify_contract_code)
            and not self.monnify_mock
        )

    @property
    def zest_enabled(self) -> bool:
        return bool(self.zest_public_key and self.zest_secret_key) and not self.zest_mock

    @property
    def active_payment_provider(self) -> str:
        return self.payment_provider.lower()

    @property
    def payment_rail_enabled(self) -> bool:
        provider = self.active_payment_provider
        if provider == "paystack":
            return self.paystack_enabled
        if provider == "zest":
            return self.zest_enabled
        return self.monnify_enabled


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
