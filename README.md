# The Arena

A sports/gaming community platform — find teams, join tournaments, book grounds by the hour, and climb per-sport leaderboards across 10 sports (cricket, football, tennis, table tennis, volleyball, hockey, badminton, basketball, kabaddi, futsal).

## Stack

- **Backend**: Node.js, TypeScript, Express 5, MongoDB/Mongoose, JWT auth, Multer (local disk storage)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion, React Router

## Features

- Auth (register/login/forgot-password)
- Teams — create, browse, join requests, roster management (free plan capped at 1 team)
- Tournaments — single-elimination brackets, live score entry, auto-advancing rounds (premium-only to organize)
- Grounds — browse, book by the hour, server-computed pricing with a 10% premium discount
- Rankings — per-sport player/team leaderboards, updated automatically from match results
- Membership — a real, DB-enforced premium tier with a test-mode payment flow (swap in Khalti/eSewa keys later via env vars, no code changes needed)

See [`API_CONTRACT.md`](./API_CONTRACT.md) for the full API reference.

## Getting started

### Backend

```bash
cd backend
cp .env.example .env   # fill in MONGO_URI, JWT_SECRET, etc.
npm install
npm run seed            # seeds the 10 sports + sample grounds (+ a demo shop in development)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` and `/uploads` to the backend on `localhost:5050` — see `frontend/vite.config.ts`.

## Admin, tests and maintenance

- **First admin:** `cd backend && ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long passphrase' ADMIN_NAME='Your Name' npm run create-admin` (production: `npm run build` then `npm run create-admin:prod` with `MONGO_URI` set). Creates the account, or promotes an existing one. Passwords come from the environment only.
- **Tests:** `cd backend && npm test` — runs against an in-memory MongoDB, never your real database. `npm run typecheck` checks source and tests.
- **Phase 2 backfill** (safe, additive, repeatable): `npm run migrate:phase2 -- --dry-run` to see counts, then without `--dry-run`.
- **Audit:** see [`docs/AUDIT.md`](./docs/AUDIT.md) for the security audit and what each phase fixed.

## Deployment

- **Backend → Render** (Web Service). Root Directory `backend`, Build `npm ci --include=dev && npm run build`, Start `npm start`, Health Check `/api/health`. Environment variables are documented in `backend/.env.example`; `render.yaml` is an optional Blueprint with the same settings.
- **Frontend → Vercel**. Root Directory `frontend`, framework Vite. Set `VITE_API_URL` to the Render URL (no trailing slash, no `/api`). `frontend/vercel.json` makes deep links like `/teams/123` work on refresh.
- **Database → MongoDB Atlas**. Seed once from your machine: `cd backend && npm run build && MONGO_URI="<atlas uri>" NODE_ENV=production npm run seed:prod` (sports + grounds; the demo shop is skipped unless `SEED_DEMO_SHOP=true`).
- **Payments**: test mode is **off in production** unless `PAYMENT_MODE=test`. Turning it on lets any user confirm their own payment (free premium) — demo use only.
- **Uploads**: stored on **Cloudinary** (folder `thearena/`) when the `CLOUDINARY_*` keys are set — required in production, since Render's filesystem is wiped on each deploy/restart. Without them (local dev) they go to `backend/uploads`. The frontend shrinks large photos to ≤1920 px before upload so they send quickly on mobile data.
