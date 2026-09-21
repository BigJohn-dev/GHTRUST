# GH Trust MFB — Backend API

FastAPI **modular monolith** for GH Trust International Ltd microfinance platform.

## Architecture recommendation

| Approach | Verdict |
|----------|---------|
| **Modular monolith** (this scaffold) | **Recommended for Phase 1–2** — one deployable API, domain modules, shared Postgres |
| Microservices | Defer until you hit scale/regulatory isolation needs (payments, core banking) |
| BullMQ | **Node.js only** — this stack uses **Celery + Redis** (Python equivalent) |

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│  Next.js    │────▶│  FastAPI (modular monolith)              │
│  Frontend   │     │  ┌────────┐ ┌──────┐ ┌──────────────┐  │
└─────────────┘     │  │ Savings│ │ Loans│ │ Investments  │  │
                    │  └────────┘ └──────┘ └──────────────┘  │
                    │  ┌─────────────┐ ┌─────────────────┐  │
                    │  │Contributions│ │ Food Basket     │  │
                    │  └─────────────┘ └─────────────────┘  │
                    └───────┬─────────────────┬────────────┘
                            │                 │
                    ┌───────▼──────┐   ┌──────▼──────┐
                    │  PostgreSQL  │   │    Redis    │
                    │  (primary)   │   │ cache+queue │
                    └──────────────┘   └──────┬──────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │ Celery Worker/Beat │
                                    │ (background jobs)  │
                                    └───────────────────┘
```

### Why Redis + Celery?

| Job | Queue | Schedule |
|-----|-------|----------|
| Savings interest accrual | `scheduled` | Daily 00:30 WAT |
| Loan payment reminders | `notifications` | Daily 08:00 |
| Pending withdrawals | `transactions` | Every 15 min |
| Payment reconciliation | `reconciliation` | Every 2 hours |
| Food basket fulfillment | `scheduled` | Daily 09:00 |

Redis DB allocation: `0` cache, `1` Celery broker, `2` Celery results.

## Project structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI entry
│   ├── core/                   # config, db, redis, celery
│   ├── api/v1/                 # route aggregation
│   ├── modules/
│   │   ├── savings/            # Yearly Thrift, Regular, Fixed
│   │   ├── loans/              # Business, Payday, drafts, schedules
│   │   ├── investments/        # Plans, calculator, portfolios
│   │   ├── contributions/      # Group thrift / Ajo
│   │   ├── food_basket/        # Subscription plans & deliveries
│   │   └── users/              # Customer model (auth TBD)
│   └── workers/                # Celery tasks
├── alembic/                    # DB migrations
├── scripts/seed.py             # Default products
├── docker-compose.yml
└── Dockerfile
```

Each module follows: `models.py` → `schemas.py` → `service.py` → `router.py`

## Quick start (Docker)

```bash
cd backend
cp .env.example .env
docker compose up -d --build
```

Services:
- **API:** http://localhost:8000
- **Swagger:** http://localhost:8000/docs
- **Health:** http://localhost:8000/api/v1/health
- **Postgres:** localhost:5432
- **Redis:** localhost:6379

### Seed default products

```bash
docker compose exec api python scripts/seed.py
```

### Migrations

```bash
docker compose exec api alembic revision --autogenerate -m "initial schema"
docker compose exec api alembic upgrade head
```

## Local development (without Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: POSTGRES_HOST=localhost, REDIS_URL=redis://localhost:6379/0

uvicorn app.main:app --reload --port 8000

# Separate terminals:
celery -A app.core.celery_app.celery_app worker -l info -Q scheduled,notifications,transactions,reconciliation,celery
celery -A app.core.celery_app.celery_app beat -l info
```

## Authentication (BVN + OTP)

Passwordless onboarding via **Dojah BVN Advanced** + phone OTP.

### Flow

```
Registration                          Login
───────────                          ─────
POST /auth/register/bvn              POST /auth/login/request-otp
  (BVN only)                           (phone number)
       │                                    │
       ▼                                    ▼
  Dojah BVN Advanced                   Send OTP via SMS
  Create profile (pending)                  │
       │                                    ▼
       ▼                              POST /auth/login/verify-otp
  OTP → BVN phone                           │
       │                                    ▼
       ▼                              JWT access token
POST /auth/register/verify-otp
       │
       ▼
  Account active + JWT
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register/bvn` | Verify BVN via Dojah, create profile, send OTP |
| POST | `/api/v1/auth/register/verify-otp` | Verify OTP → activate account |
| POST | `/api/v1/auth/register/resend-otp` | Resend registration OTP |
| POST | `/api/v1/auth/login/request-otp` | Send login OTP to phone |
| POST | `/api/v1/auth/login/verify-otp` | Verify OTP → JWT |
| POST | `/api/v1/auth/login/resend-otp` | Resend login OTP |
| GET | `/api/v1/auth/me` | Current profile (Bearer token) |

### Sandbox test BVN

Use `22222222222` with `DOJAH_MOCK=true` (default). OTP is logged to console when `SMS_MOCK=true`.

### Rate limits (Redis)

| Action | Limit |
|--------|-------|
| BVN lookup | 5/hour per IP, 3/day per BVN |
| OTP send | 3/15min per phone, 10/hour per IP |
| OTP verify | 5 attempts per code, 20/hour per IP |
| Login OTP request | 5/15min per phone |

## API routes (scaffold)

| Module | Prefix | Key endpoints |
|--------|--------|---------------|
| Savings | `/api/v1/savings` | `GET /products`, `POST /customers/{id}/accounts` |
| Loans | `/api/v1/loans` | `GET /applications`, `POST /customers/{id}/applications` |
| Investments | `/api/v1/investments` | `GET /plans`, `POST /calculator` |
| Contributions | `/api/v1/contributions` | `GET /groups`, `POST /customers/{id}/contribute` |
| Food Basket | `/api/v1/food-basket` | `GET /plans`, `POST /customers/{id}/subscribe` |

Write endpoints return `501` until ledger/payment integration is implemented.

## Next phase

- [ ] Auth (JWT + RBAC for admin/customer)
- [ ] Double-entry ledger module
- [ ] Wallet & transactions module
- [ ] Paystack/NIBSS webhook handlers
- [ ] Connect Next.js frontend to API (replace Zustand mock)

## Monorepo layout

```
gh-trust-mfb/
├── src/          # Next.js frontend (dummy data demo)
└── backend/      # FastAPI API (this project)
```
