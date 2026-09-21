# GH Trust International Ltd — Digital Microfinance Platform

Full-stack platform for **GH Trust MFB**: customer mobile/web banking, staff operations, loan origination, wallets, savings, investments, and group contributions. The product goal is a regulated microfinance experience—apply for loans, manage money, and run branch operations—without relying on a single monolithic core banking UI.

---

## What we are building

### Vision

A **digital-first MFB** where:

- **Customers** register with BVN, use a wallet (fund, withdraw), apply for loan products step-by-step, upload documents, and track applications and active loans.
- **Staff** review applications in a real admin portal, verify documents, move files through **configurable approval workflows**, and disburse approved loans to customer bank accounts.
- **Operations** reconcile payments via webhooks and background jobs, with a **double-entry ledger** behind customer balances.
- **Future phases** connect savings, investments, group thrift, food basket, automated loan repayments, and a **bank partner API** for wallet rails (see `docs/GH_Trust_Bank_Partner_Wallet_API_Requirements.pdf`).

### Product modules (roadmap)

| Module | Customer | Admin / API | Status |
|--------|----------|-------------|--------|
| **Auth (BVN + OTP)** | Register & login | Staff OTP + RBAC | **Live** |
| **Loans** | Apply, upload docs, track | Queue, workflows, disburse | **Live (core path)** |
| **Wallet & payments** | Fund, withdraw, balance | Disbursement rail, webhooks | **Backend live**; customer UI mostly mock |
| **Savings** | Products & accounts | Product config | API scaffold; wallet debit TBD |
| **Investments** | Plans & calculator | — | API scaffold |
| **Contributions (Ajo)** | Group thrift | — | API scaffold |
| **Food basket** | Subscriptions | — | API scaffold |

### Loan products (configured in backend)

| Product | Audience | Notes |
|---------|----------|--------|
| GH Trust Business Loan | Traders (3+ years) | Daily / weekly / monthly repayment options |
| Payday Loan | Salary earners | Salary-date cadence; Remita mandate planned |
| GH Trust Study Loan | Guardians / study abroad | School disbursement path in workflow |
| Asset Loan | Asset financing | Collateral & affidavit rules |
| LPO / Invoice Financing | — | Reserved (inactive) |

---

## Repository layout

| Path | Stack | Role |
|------|-------|------|
| **`backend/`** | FastAPI, PostgreSQL, Redis, Celery | **Source of truth** — APIs, ledger, loans, payments |
| **`admin/`** | Vite, React, TypeScript | **Staff portal** — applications, products, workflows (calls real API) |
| **`/` (`src/`)** | Next.js 14 | **Customer demo UI** — rich prototype; many screens still use local mock data |
| **`docs/`** | PDF / HTML briefs | Product-owner loan brief; bank partner wallet API requirements |

```
gh-trust-mfb/
├── backend/          # Modular monolith API
├── admin/            # Staff admin (production-oriented)
├── src/              # Next.js customer demo
└── docs/             # Shareable PDFs for stakeholders & bank
```

---

## What has been done so far

### Backend (implemented)

- **Modular monolith** with domain modules: auth, users, admin/RBAC, loans, payments, savings, investments, contributions, food basket.
- **Customer auth**: Dojah BVN verification (mockable), phone OTP, JWT sessions, rate limits on Redis.
- **Staff auth**: OTP login, roles, permissions (Loan Officer, Credit Analyst, Branch Manager, Operations, super admin).
- **Loans — full origination path**:
  - Product catalog with fees, rates, document lists, wizard steps, eligibility JSON.
  - Customer APIs: create application, wizard steps, document upload, submit.
  - Application statuses from draft through submitted, under review, approved, ready to disburse, disbursed, rejected.
  - **Configurable workflows** per product (create, edit stages, publish versions).
  - Admin: application queue, detail, stage approve/reject, document verify, status updates, audit log.
  - **Loan disbursement** to applicant bank account via payment rail (Monnify / Paystack paths); creates loan book entry on success webhook.
- **Payments & wallet (backend)**:
  - Customer wallet ledger (available + locked balances).
  - Reserved / dedicated virtual account provisioning (Monnify-style; provider-dependent).
  - Zest dynamic VA top-up sessions (optional provider).
  - Withdrawals with hold → transfer → settle/release via Celery.
  - Webhooks: Paystack, Monnify, Zest (inbound credit, outbound transfer, loan disbursement completion).
  - Demo seed scripts and Makefile targets (`bootstrap`, `seed-local`, `seed-demo`).
- **Database**: Alembic migrations (schema, loans, workflows, ledger, payment providers).
- **Tests**: Integration tests for auth, payments/ledger, webhooks; unit tests for payment clients.

### Admin app (implemented)

- Login with backend OTP.
- **Applications** list and filters, charts, workflow pipeline UI.
- **Application detail**: documents, stage actions, disburse (permission-gated).
- **Loan products** management and **workflow configuration** per product.
- Team / roles (partial), settings hooks.

### Customer Next.js app (prototype)

- Polished UI for dashboard, savings, loans apply wizard, wallet, investments, group thrift, admin mock screens.
- **Most data is Zustand + localStorage** — not wired to production loan/wallet APIs yet.
- Useful for demos and UX; **admin + backend** are the live stack for loan operations today.

### Documentation

- **`docs/GH_Trust_Loan_Platform_Brief.pdf`** — Product-owner summary: loans can launch without wallet; customer/admin flows.
- **`docs/GH_Trust_Bank_Partner_Wallet_API_Requirements.pdf`** — APIs needed from a bank partner for wallet go-live.

### Known gaps (honest status)

| Area | Gap |
|------|-----|
| Customer app | Wire Next.js (or mobile) to `/api/v1/loans` and `/api/v1/wallet` |
| Wallet UI | Root customer wallet page still mock; backend wallet API is real |
| Processing fee | Product fee defined; no payment collection flow yet |
| Repayment schedules | Table exists; auto-generation and collections not built |
| Payday Remita | Eligibility rules only; mandate API not integrated |
| Savings / investments / contributions | Routers exist; wallet debit returns not implemented |
| Paystack as sole `PAYMENT_PROVIDER` | DVA provisioning path incomplete vs Monnify |
| Zest | Inbound dynamic VA only; no outbound disbursement on Zest |

**Loans can still run end-to-end** (apply → approve → disburse) with **manual or Monnify/Paystack outbound** transfer; wallet funding is optional for loan MVP.

---

## Architecture (high level)

```
┌──────────────────┐     ┌─────────────────────────────────────────┐
│  Customer app    │     │  FastAPI backend (modular monolith)      │
│  (Next.js demo   │────▶│  Auth · Loans · Payments/Ledger · …     │
│   or future app) │     └───────────────┬─────────────────────────┘
└──────────────────┘                     │
┌──────────────────┐                     ├── PostgreSQL
│  admin/ (Vite)   │─────────────────────┤
│  Staff portal    │                     └── Redis → Celery (withdrawals, reconcile)
└──────────────────┘
                              │
                    Payment rails (configurable):
                    Monnify · Paystack · Zest (partial)
                              │
                    Webhooks → credit wallet / complete disbursement
```

Details: **[backend/README.md](backend/README.md)** (Celery queues, auth flow, Docker).

---

## Quick start

### 1. Backend + database

```bash
cd backend
cp .env.example .env
# Edit .env as needed (DOJAH_MOCK=true, SMS_MOCK=true for local dev)

make bootstrap          # wait for Postgres, migrate, seed staff + products
make seed-demo          # optional: sample loan applications in queue

# Or Docker:
docker compose up -d --build
docker compose exec api alembic upgrade head
docker compose exec api python scripts/seed.py
```

- API: http://localhost:8000  
- Swagger: http://localhost:8000/docs  

### 2. Admin portal (recommended for loan ops)

```bash
cd admin
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 — staff OTP login (see seeded super admin in `backend/scripts/seed.py` / team docs).

### 3. Customer demo (Next.js)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — **demo data**; not the live loan API.

---

## Key API surfaces

| Audience | Base | Examples |
|----------|------|----------|
| Customer | `/api/v1/auth`, `/api/v1/loans`, `/api/v1/wallet` | Register, apply, submit, wallet summary, withdraw |
| Staff | `/api/v1/admin/...` | Applications, stage actions, disburse, products, workflows |
| Webhooks | `/api/v1/webhooks/{provider}` | Inbound transfers, transfer success/fail |

---

## Brand (UI)

| Color | Hex | Usage |
|-------|-----|-------|
| Navy | `#1B2F6B` | Primary, headers |
| Cyan | `#2FA4D7` | Accents, CTAs |
| Mint | `#E9F8F9` | Backgrounds |
| Success | `#00A86B` | Active / completed |
| Warning | `#E5AF59` | Pending |
| Error | `#CF2E2E` | Failed / overdue |

Font: **Montserrat**

---

## Scripts (root Next.js)

```bash
npm run dev      # Customer demo dev server
npm run build    # Production build
npm run lint     # ESLint
```

---

## Deployment notes

- Deploy **backend** (API + worker + beat + Postgres + Redis) as the core service.
- Deploy **admin/** as static or Node host pointing `VITE_API_URL` at the API.
- Customer app: deploy when wired to API; until then treat as prototype.
- Set `PAYMENT_PROVIDER` and provider secrets in production; enable webhook URLs on the provider dashboard.
- Never commit `.env` files (see `backend/.gitignore`).

---

## Contributing & license

Internal GH Trust / Divine Mercy project. For questions on loan workflows or bank API specs, see `docs/`.

---

**Summary:** The platform is a **working loan origination and admin operations stack** on a real API, with **wallet and ledger** ready for bank partner integration, and a **customer UI prototype** ahead of full API wiring. Loans-first go-live is supported without customer wallet funding.
