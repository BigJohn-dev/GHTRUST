from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import settings
from app.core.redis import get_redis_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ]
    )
    logger = structlog.get_logger()
    logger.info("starting_api", app=settings.app_name, env=settings.app_env)
    yield
    await get_redis_pool().aclose()
    logger.info("shutdown_api")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        description="GH Trust International Ltd — Microfinance Banking API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_v1_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["Root"])
    async def root():
        return {
            "message": "GH Trust MFB API",
            "tagline": "Secure Today. Grow Tomorrow.",
            "docs": "/docs",
            "health": f"{settings.api_v1_prefix}/health",
        }

    return app


app = create_app()
