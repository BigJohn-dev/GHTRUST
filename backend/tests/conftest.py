"""Shared pytest fixtures for GH Trust MFB backend."""

from collections.abc import AsyncGenerator
from unittest.mock import patch

import fakeredis.aioredis
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import OtpService
from app.core.redis import get_redis
from app.integrations.dojah.schemas import DojahBvnEntity
from app.main import create_app
from app.modules.admin.models import Role, Staff
from app.modules.admin.service import ensure_super_admin_role, seed_super_admin
from app.modules.loans.models import (
    ApplicationCollateral,
    ApplicationDocument,
    ApplicationGuarantor,
    ApplicationStatusLog,
    Loan,
    LoanApplication,
    LoanProduct,
)
from app.modules.payments.models import (
    CustomerWallet,
    LedgerEntry,
    LedgerJournal,
    LoanDisbursement,
    PaymentTransaction,
    ProcessedWebhookEvent,
    WithdrawalRequest,
)
from app.modules.loans.workflow_models import (
    ApplicationAuditLog,
    ApplicationStageDecision,
    LoanWorkflow,
    LoanWorkflowStage,
)
from app.modules.users.models import Customer

TEST_BVN = "22222222222"
TEST_BVN_2 = "33333333333"
TEST_OTP = "123456"
TEST_PHONE = "+2348035794364"
TEST_ADMIN_EMAIL = "admin@ghtrust.com"
TEST_ADMIN_PHONE = "08107891549"
TEST_ADMIN_NAME = "Divine Obinali"

_SETTINGS_CONSUMER_MODULES = (
    "app.core.rate_limit",
    "app.integrations.dojah.client",
    "app.integrations.paystack.client",
    "app.integrations.monnify.client",
    "app.integrations.zest.client",
    "app.modules.payments.webhook_router",
    "app.modules.auth.service",
    "app.modules.admin.service",
    "app.core.security",
    "app.core.database",
    "app.core.redis",
    "app.main",
    "app.core.celery_app",
)


def refresh_settings() -> None:
    """Rebind module-level settings after env or cache changes."""
    import importlib

    get_settings.cache_clear()
    cfg = importlib.import_module("app.core.config")
    fresh = cfg.get_settings()
    cfg.settings = fresh
    for name in _SETTINGS_CONSUMER_MODULES:
        mod = importlib.import_module(name)
        mod.settings = fresh


@pytest.fixture(autouse=True)
def _test_env(monkeypatch):
    """Isolate settings for every test."""
    get_settings.cache_clear()
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("DOJAH_MOCK", "true")
    monkeypatch.setenv("PAYSTACK_MOCK", "true")
    monkeypatch.setenv("PAYSTACK_SECRET_KEY", "test_paystack_secret")
    monkeypatch.setenv("PAYMENT_PROVIDER", "monnify")
    monkeypatch.setenv("MONNIFY_MOCK", "true")
    monkeypatch.setenv("MONNIFY_SECRET_KEY", "test_monnify_secret")
    monkeypatch.setenv("MONNIFY_API_KEY", "MK_TEST_mock")
    monkeypatch.setenv("MONNIFY_CONTRACT_CODE", "1234567890")
    monkeypatch.setenv("ZEST_AUTH_ENCRYPTION_IV", "3A4CD38XVS621KZ6")
    monkeypatch.setenv("SMS_MOCK", "true")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-jwt-and-otp-hashing")
    monkeypatch.setenv("OTP_LENGTH", "6")
    monkeypatch.setenv("OTP_EXPIRE_SECONDS", "600")
    monkeypatch.setenv("OTP_MAX_ATTEMPTS", "5")
    monkeypatch.setenv("RATE_LIMIT_BVN_PER_IP_HOUR", "5")
    monkeypatch.setenv("RATE_LIMIT_BVN_PER_BVN_DAY", "3")
    monkeypatch.setenv("RATE_LIMIT_OTP_SEND_PER_PHONE_15MIN", "3")
    monkeypatch.setenv("RATE_LIMIT_OTP_SEND_PER_IP_HOUR", "20")
    monkeypatch.setenv("RATE_LIMIT_OTP_VERIFY_PER_IP_HOUR", "50")
    monkeypatch.setenv("RATE_LIMIT_LOGIN_REQUEST_PER_PHONE_15MIN", "5")
    refresh_settings()
    yield
    refresh_settings()


@pytest.fixture
async def fake_redis():
    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield redis
    await redis.aclose()


@pytest.fixture
async def db_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Role.__table__.create)
        await conn.run_sync(Staff.__table__.create)
        await conn.run_sync(Customer.__table__.create)
        await conn.run_sync(LoanProduct.__table__.create)
        await conn.run_sync(LoanApplication.__table__.create)
        await conn.run_sync(ApplicationDocument.__table__.create)
        await conn.run_sync(ApplicationGuarantor.__table__.create)
        await conn.run_sync(ApplicationCollateral.__table__.create)
        await conn.run_sync(ApplicationStatusLog.__table__.create)
        await conn.run_sync(LoanWorkflow.__table__.create)
        await conn.run_sync(LoanWorkflowStage.__table__.create)
        await conn.run_sync(ApplicationStageDecision.__table__.create)
        await conn.run_sync(ApplicationAuditLog.__table__.create)
        await conn.run_sync(CustomerWallet.__table__.create)
        await conn.run_sync(WithdrawalRequest.__table__.create)
        await conn.run_sync(PaymentTransaction.__table__.create)
        await conn.run_sync(LedgerJournal.__table__.create)
        await conn.run_sync(LedgerEntry.__table__.create)
        await conn.run_sync(LoanDisbursement.__table__.create)
        await conn.run_sync(ProcessedWebhookEvent.__table__.create)
        await conn.run_sync(Loan.__table__.create)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
def fixed_otp(monkeypatch):
    """Deterministic OTP for integration tests."""
    monkeypatch.setattr(OtpService, "_generate", lambda self: TEST_OTP)


@pytest.fixture
async def api_client(db_session, fake_redis, fixed_otp) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def override_db():
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    async def override_redis():
        return fake_redis

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_redis] = override_redis

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
async def registered_customer(api_client) -> dict:
    """Register + verify OTP and return token payload."""
    await api_client.post("/api/v1/auth/register/bvn", json={"bvn": TEST_BVN})
    verify = await api_client.post(
        "/api/v1/auth/register/verify-otp",
        json={"bvn": TEST_BVN, "otp": TEST_OTP},
    )
    assert verify.status_code == 200
    return verify.json()


@pytest.fixture
async def super_admin(db_session) -> Staff:
    await ensure_super_admin_role(db_session)
    return await seed_super_admin(
        db_session,
        full_name=TEST_ADMIN_NAME,
        email=TEST_ADMIN_EMAIL,
        phone=TEST_ADMIN_PHONE,
    )


@pytest.fixture
async def admin_token(api_client, super_admin) -> str:
    await api_client.post("/api/v1/admin/auth/login/request-otp", json={"phone": TEST_ADMIN_PHONE})
    res = await api_client.post(
        "/api/v1/admin/auth/login/verify-otp",
        json={"phone": TEST_ADMIN_PHONE, "otp": TEST_OTP},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
async def admin_headers(admin_token) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


def make_dojah_entity(**overrides) -> DojahBvnEntity:
    base = dict(
        bvn=TEST_BVN,
        first_name="ADAEZE",
        last_name="OKAFOR",
        middle_name="CHINWE",
        gender="Female",
        date_of_birth="1995-03-15",
        phone_number1="08035794364",
        phone_number2="08134709697",
        email="adaeze.okafor@email.com",
        enrollment_bank="GTB",
        enrollment_branch="OGBA",
        level_of_account="LEVEL 2",
        lga_of_origin="ONITSHA NORTH",
        lga_of_residence="IKEJA",
        marital_status="SINGLE",
        name_on_card="ADAEZE C OKAFOR",
        nationality="NIGERIAN",
        registration_date="15-MAR-2018",
        residential_address="52 Ijaye Road, Ogba, Lagos",
        state_of_origin="ANAMBRA",
        state_of_residence="LAGOS",
        title="MISS",
        watch_listed="NO",
        image=None,
    )
    base.update(overrides)
    return DojahBvnEntity(**base)
