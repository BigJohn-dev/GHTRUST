.PHONY: up down infra wait-postgres dev seed seed-local logs api-shell test migrate-local reset-db bootstrap

# ── Fast local dev (recommended) — like Elizade ─────────────────────────────
# Docker: postgres + redis only. API runs on your Mac via .venv (no image build).

infra:
	docker compose -f docker-compose.dev.yml up -d

# Block until Postgres accepts connections (needed right after `make infra`).
wait-postgres:
	@echo "Waiting for Postgres..."
	@for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do \
		docker exec ghtrust-postgres pg_isready -U ghtrust -d ghtrust_mfb >/dev/null 2>&1 && \
		echo "Postgres is ready." && exit 0; \
		sleep 2; \
	done; \
	echo "Postgres did not become ready in time. Is Colima/Docker running?"; \
	exit 1

dev:
	@test -d .venv || python3.11 -m venv .venv
	.venv/bin/pip install -q -r requirements.txt
	POSTGRES_HOST=localhost \
	DATABASE_URL=postgresql+asyncpg://ghtrust:ghtrust_secret@localhost:5432/ghtrust_mfb \
	REDIS_URL=redis://localhost:6379/0 \
	CELERY_BROKER_URL=redis://localhost:6379/1 \
	CELERY_RESULT_BACKEND=redis://localhost:6379/2 \
	.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

seed-local:
	POSTGRES_HOST=localhost \
	DATABASE_URL=postgresql+asyncpg://ghtrust:ghtrust_secret@localhost:5432/ghtrust_mfb \
	REDIS_URL=redis://localhost:6379/0 \
	.venv/bin/python scripts/seed.py

seed-demo:
	POSTGRES_HOST=localhost \
	DATABASE_URL=postgresql+asyncpg://ghtrust:ghtrust_secret@localhost:5432/ghtrust_mfb \
	REDIS_URL=redis://localhost:6379/0 \
	.venv/bin/python scripts/seed_demo_applications.py

# One-shot: start infra, migrate, seed — ready for `make dev` in another terminal
bootstrap: infra wait-postgres migrate-local seed-local

# Wipe local DB volume, recreate infra, migrate from scratch
reset-db:
	docker compose -f docker-compose.dev.yml down -v
	$(MAKE) infra wait-postgres migrate-local

# ── Full Docker stack (api + celery) — slower first build ───────────────────

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f api

api-shell:
	docker compose exec api bash

seed:
	docker compose exec api python scripts/seed.py

migrate:
	docker compose exec api alembic revision --autogenerate -m "$(msg)"
	docker compose exec api alembic upgrade head

migrate-local: wait-postgres
	POSTGRES_HOST=localhost \
	DATABASE_URL=postgresql+asyncpg://ghtrust:ghtrust_secret@localhost:5432/ghtrust_mfb \
	.venv/bin/alembic upgrade head

# For DBs bootstrapped via seed/create_all (tables exist, alembic_version empty).
# Run ONCE only. If already migrated, use `make migrate-local` instead.
migrate-existing-db: stamp-local migrate-local

stamp-head:
	POSTGRES_HOST=localhost \
	DATABASE_URL=postgresql+asyncpg://ghtrust:ghtrust_secret@localhost:5432/ghtrust_mfb \
	.venv/bin/alembic stamp head

# Use once if DB was created via seed/create_all before Alembic was run
stamp-local:
	POSTGRES_HOST=localhost \
	DATABASE_URL=postgresql+asyncpg://ghtrust:ghtrust_secret@localhost:5432/ghtrust_mfb \
	.venv/bin/alembic stamp 003_loan_workflows

worker:
	celery -A app.core.celery_app.celery_app worker -l info -Q scheduled,notifications,transactions,reconciliation,celery

beat:
	celery -A app.core.celery_app.celery_app beat -l info

test:
	.venv/bin/pytest -v --tb=short

test-cov:
	.venv/bin/pytest -v --tb=short --cov=app --cov-report=term-missing
