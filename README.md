# GH Trust MFB — Digital Microfinance Platform

Backend and staff portal for **GH Trust International Ltd (MFB)**: BVN-based
onboarding, loan origination with configurable approval workflows,
disbursement, loan servicing (schedules, repayments, overdue tracking), and a
double-entry ledger behind customer wallets. The customer channel is a **mobile
app** (not in this repo yet — see [docs/mobile-app-handoff.md](docs/mobile-app-handoff.md)).

## Repository

| Path | Stack | Role |
|---|---|---|
| [`backend/`](backend/README.md) | Python 3.12, FastAPI, PostgreSQL 16, Redis 7, Celery | The API and background jobs — source of truth |
| `src/` (repo root) | Next.js 15, React 19, Tailwind v3 | **Staff portal** (`/admin`) on the live API: dashboard, applications & workflows, documents, disbursement, loan book, customers, transactions, reports, staff & roles, audit log. `/customer` is a sample-data design demo only |
| [`admin/`](admin/README.md) | Vite, React 19, TypeScript, Tailwind v4 | Earlier staff portal, superseded by `src/` |
| `docs/` | | Product brief, bank-partner API requirements, mobile handoff |
| `.github/workflows/ci.yml` | GitHub Actions | Lint, migrations (apply + drift + rollback), tests, Docker image, admin build, Next.js lint + build |

## Status

| Area | State |
|---|---|
| Customer auth (BVN + OTP), device sessions, refresh tokens | **Working** — SMS delivery pending a provider |
| Staff auth, roles & permissions | **Working** |
| Loan application → workflow approval | **Working** |
| Disbursement (rail, or manual record of an off-rail transfer) | **Working** — rails run in mock mode until credentials |
| Loan servicing: schedule, repayments (staff-recorded + wallet), overdue job | **Working** — interest method & penalties need credit-team sign-off |
| Wallet: balances, funding webhooks, withdrawals | **Working** on mock rails |
| Savings, investments, group thrift, food basket | Read-only; writes return 501 |
| Customer mobile app | Not started |

**External dependencies still mocked** (the app runs fully without them in
development; production refuses to boot until they are configured):

- SMS provider (Termii / Africa's Talking) — **required to launch**: no OTP, no login
- Dojah credentials (BVN Advanced)
- Bank partner: Stanbic IBTC sandbox spec + credentials (adapter scaffolded, see
  `backend/app/integrations/stanbic/`), or Monnify/Paystack credentials
- Object storage for loan documents (currently a Docker volume)

## Quick start

```bash
cd backend
cp .env.example .env              # set SEED_SUPER_ADMIN_* at minimum
make bootstrap                    # Postgres + Redis, migrate, seed
make dev                          # API on :8000, docs at /docs
```

```bash
cp .env.example .env.local        # repo root: NEXT_PUBLIC_API_URL
npm ci && npm run dev             # staff portal on http://localhost:3000/admin (Turbopack)
```

Sign in with `SEED_SUPER_ADMIN_PHONE`. With `SMS_MOCK=true` the one-time code is
printed in the API's terminal (the `sms_mock_delivery` line).

For day-to-day use, run the production build — pages are precompiled and much
faster than dev mode: `npm run build && npm start`.

**Against the deployed API.** `npm run build` / `npm start` use the Railway API
(`https://ghtrust-production.up.railway.app`, set in `.env.production`; a `.env.local` or a
host setting overrides it). For dev mode against it: `npm run dev:railway`. Signing in
works from `localhost`, but the staff session cookie isn't sent across sites, so a page
refresh signs you out. That goes away once the portal and API share a domain
(`docs/go-live.md`, step 5).

### Staff portal sessions

- **No automatic sign-in on launch.** The access token (10 min) lives only in
  memory; the refresh token is an `httpOnly`, `SameSite=Strict` browser-session
  cookie that page scripts can't read. A fresh launch shows the sign-in screen and
  ends any leftover session. Reloading a tab, or opening another tab while one is
  signed in, continues the session.
- **Background lock:** no portal tab visible for 5 minutes → signed out.
- **Inactivity:** 15 minutes without input → 60-second warning → signed out. The
  server independently refuses to renew a staff session unused for
  `STAFF_SESSION_IDLE_MINUTES` (20).
- Signing out in one tab signs out all tabs.
- **Deployment:** the portal and API must be on the same site (e.g.
  `portal.ghtrust.com` and `api.ghtrust.com`) and served over HTTPS; the API's
  `CORS_ORIGINS` must list the portal origin.

## Decisions pending from GH Trust

1. **Interest method** — flat (current default) or reducing balance; per product.
2. **Late penalties** — products list a daily %, but base, cap and compounding are
   unspecified; installments are only marked overdue until defined.
3. **Payment rails** — keep Monnify / Paystack / Zest as fallbacks alongside
   Stanbic, or remove them.
4. **Mobile stack** — React Native or Flutter (determines the generated API client).
