FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app \
    UPLOAD_DIR=/app/uploads

WORKDIR /app

# Runtime only — pip installs prebuilt wheels, so no compiler toolchain.
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Runtime dependencies only; test/lint tools live in requirements-dev.txt.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY scripts ./scripts
COPY alembic ./alembic
COPY alembic.ini .

# Unprivileged user. /app/uploads holds loan documents — mount a persistent
# volume there (see docker-compose.prod.yml) or they are lost on redeploy.
RUN useradd --system --uid 10001 --home-dir /app ghtrust \
    && mkdir -p /app/uploads \
    && chown -R ghtrust:ghtrust /app/uploads
USER ghtrust

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4).status == 200 else 1)"

# WEB_CONCURRENCY worker processes (default 2). Each holds its own DB pool, so keep
# WEB_CONCURRENCY × (DB_POOL_SIZE + DB_MAX_OVERFLOW) under Postgres max_connections.
# Access logs come from AccessLogMiddleware (structured JSON with request IDs).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WEB_CONCURRENCY:-2} --no-access-log --timeout-graceful-shutdown 30"]
