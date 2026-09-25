# GH Trust MFB — Backend API

FastAPI modular monolith. Each domain module under `app/modules/` follows
`models → schemas → service → router`; external providers live under
`app/integrations/`.

```
app/
  main.py              app factory, middleware, production config guard
  core/                config, db, redis, security (JWT), errors, middleware,
                       idempotency, rate limiting + OTP, celery
  integrations/        dojah, monnify, paystack, zest, stanbic, sms, retry policy
  modules/
    auth/              customer auth, device sessions, refresh-token rotation
    admin/             staff auth, roles & permissions, settings
    users/             customers
    loans/             products, applications, workflows, servicing (schedules, repayments)
    payments/          wallet, ledger, disbursement, webhooks, worker jobs
    app_config/        mobile remote config
    savings/ investments/ contributions/ food_basket/   (read-only for now)
  workers/tasks.py     Celery entry points
alembic/versions/      migrations — the only source of schema
tests/                 unit + integration (SQLite + fakeredis)
```

## Run locally

```bash
cp .env.example .env    # set SEED_SUPER_ADMIN_NAME / _EMAIL / _PHONE
make bootstrap          # docker Postgres + Redis, alembic upgrade head, seed
make dev                # uvicorn --reload on :8000
make seed-demo          # optional: 10 submitted applications for the admin queue
make worker / make beat # Celery (separate terminals)
```

Docs: http://localhost:8000/docs (`ENABLE_API_DOCS=true`). Sandbox BVN
`22222222222` with `DOJAH_MOCK=true`; OTPs are logged with `SMS_MOCK=true`.

## Schema changes

Alembic owns the schema; nothing calls `create_all`.

```bash
make migration msg="describe change"   # autogenerate, then REVIEW the file
make migrate-local                     # apply
make migration-check                   # fails if models and migrations disagree (CI runs this)
```

Autogenerate does not detect new enum *values* or type conversions — add those
by hand (see `011_loan_servicing.py` for the pattern).

## Tests

```bash
make test        # or: pytest -q
make test-cov
ruff check app scripts tests alembic
```

## Auth

Passwordless. Customers: BVN (Dojah BVN Advanced) + SMS OTP to register, phone +
OTP to sign in. Staff: phone + OTP.

- **Access token**: 15 min (customers) / 30 min (staff) HS256 JWT with `typ`
  (customer|staff — each rejects the other) and `sid` (session id).
- **Refresh token**: opaque, stored hashed in `auth_sessions`, rotated on every
  use; replaying a used one revokes the session. One session per device.
- Every request checks the session is live, so logout, "sign out other devices"
  and staff deactivation take effect immediately.
- RBAC: permissions on roles (`app/modules/admin/permissions.py`); workflow
  stages additionally bind to a role.

## Money safety

- **Ledger** (`payments/ledger_service.py`): double-entry, every journal
  balanced, idempotency key per journal (race-safe via savepoint).
- **Provider calls**: only transient failures (network, 5xx) are retried, and
  the provider's own error type always surfaces (`integrations/retry.py`).
- **Disbursement / withdrawal**: the attempt is committed *before* the bank is
  called. A rejection marks it failed (retryable); a timeout leaves it pending
  for reconciliation — never a second payout.
- **Webhooks**: signature required outside dev; handler failure → rollback +
  500 so the provider retries; events de-duplicated.
- **Reconciliation** (every 20 min) resolves pending transfers through the same
  code paths as the webhooks.
- **Idempotency-Key** header replays the original response for retried
  mutations (required on withdrawals and wallet repayments).

## Background jobs (Celery beat, Africa/Lagos)

| Job | Schedule | State |
|---|---|---|
| `refresh_loan_statuses` | 00:15 daily | overdue marking, next due date |
| `process_pending_withdrawals` | every 15 min | live |
| `reconcile_payments` | every 20 min | live |
| `send_loan_reminders` | 08:00 | blocked on SMS/push provider |
| `accrue_savings_interest`, `food_basket_fulfillment_check` | daily | modules not live |

Each job opens its own DB engine (Celery runs each task on a new event loop).

## Deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Runs migrations once, then API + worker + beat; non-root image with healthcheck;
uploads on a named volume. With `APP_ENV=production` the API **refuses to start**
on insecure config (default secret, `DEBUG`, mock SMS/KYC/rail, missing webhook
secret, localhost CORS) and lists every problem. Behind a load balancer set
`TRUSTED_PROXY_COUNT=1` so per-IP rate limits see real client IPs.

## Provider status

| Provider | Purpose | State |
|---|---|---|
| Dojah | BVN Advanced | Integrated; mock until credentials |
| SMS (Termii / Africa's Talking) | OTP | **Not integrated** — `app/integrations/sms` |
| Monnify | Default rail | Integrated; mock until credentials |
| Stanbic IBTC | Bank partner | Adapter scaffolded against our requirements doc; every unconfirmed field marked `TODO(stanbic-spec)` |
| Paystack / Zest | Alternative rails | Integrated (Zest inbound only) |
