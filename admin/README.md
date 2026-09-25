# GH Trust Admin Portal

React staff admin app — separate from the customer Next.js portal and the FastAPI backend.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- React Router
- Real admin OTP auth via backend API

## Run

```bash
# Terminal 1 — backend
cd backend && docker compose up -d
docker compose exec api python scripts/seed.py

# Terminal 2 — admin UI
cd admin
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173**

## Login (dev)

- Phone: the `SEED_SUPER_ADMIN_PHONE` you set in `backend/.env` before running `make seed`
- OTP: logged in API console when `SMS_MOCK=true`

## Layout

Fincan.io-inspired dark header, light content cards, portfolio stats, pending review progress bars, and applications table. All screens use the live API. Sessions use a 30-minute access token renewed automatically with a rotating refresh token (`src/lib/api.ts`); signing out revokes the session server-side.
