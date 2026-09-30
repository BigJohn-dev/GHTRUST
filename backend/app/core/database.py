import asyncio
from collections.abc import AsyncGenerator
from urllib.parse import urlparse

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _connect_args() -> dict:
    # Postgres-side guard: a query running longer than this is cancelled instead
    # of pinning a pooled connection (and the request) indefinitely.
    if settings.async_database_url.startswith("postgresql+asyncpg"):
        return {
            "server_settings": {"statement_timeout": str(settings.db_statement_timeout_ms)},
            # Give up on an unreachable server quickly: requests fail fast with a 503.
            "timeout": 5,
        }
    return {}


engine = create_async_engine(
    settings.async_database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_recycle=settings.db_pool_recycle_seconds,
    connect_args=_connect_args(),
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def database_host() -> str:
    return urlparse(settings.async_database_url.replace("+asyncpg", "")).hostname or "?"


async def check_database_on_startup(bind=None) -> bool:
    """
    Connect once at boot and say loudly if Postgres is missing.

    The API still starts (so /health answers), but almost every request needs the
    database, and would otherwise surface as a stream of connection tracebacks.
    """
    try:
        async with asyncio.timeout(6):
            async with (bind or engine).connect() as conn:
                await conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - any failure here means "not reachable"
        structlog.get_logger().error(
            "database_unreachable",
            db_host=database_host(),
            error=f"{type(exc).__name__}: {exc}",
            hint="Start Postgres (locally: docker compose up -d postgres redis) or fix DATABASE_URL.",
            impact="requests that use the database will return 503 until it is reachable",
        )
        return False
    return True
