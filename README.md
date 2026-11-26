# The Arena

A sports/gaming community platform — find teams, join tournaments, challenge rivals and book grounds by the hour across 10 sports (cricket, football, tennis, table tennis, volleyball, hockey, badminton, basketball, kabaddi, futsal).

## Stack

- **Backend**: Node.js, TypeScript, Express 5, MongoDB/Mongoose, JWT auth, Multer (local disk storage)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4, Framer Motion, React Router

## Features

- **Accounts** — register/login, usernames, profiles (sports, positions, experience, location down to district), privacy controls, change password, log out everywhere, in-app (and optional email) notifications.
- **Discovery** — find players and teams by sport, province, district and near-me radius; advanced filters for Premium.
- **Teams** — unique names, owner / captain / vice-captain / player roles, invitations by username, join requests, leave, ownership transfer.
- **Challenges & matches** — player or team challenges with counter-proposals; accepted challenges become matches; optional ground booking via "Find a Ground Near You".
- **Results** — either side reports the score (plus per-sport player stats); the other side confirms or disputes; staff resolve disputes. Records and stats count verified results only. (There are no leaderboards/rankings.)
- **Tournaments** — knockout, round robin, league, group stage and groups + knockout; teams request to join; four eligible teams make a tournament eligible for staff approval; fixtures, scheduling, points tables, champion.
- **Grounds** — owners list grounds for staff approval; opening hours, slot picker, pay online or at the venue, cancellations, owner dashboard (bookings, no-shows, blocked slots).
- **Shop** — multi-vendor sports marketplace: merchant applications and product approval, sizes/colours with stock, sale prices, one checkout split per shop, cash on delivery, fulfilment tracking, reviews, wishlist, sales dashboard.
- **Admin console** (`/admin`) — permission-based staff roles with a protected Super Admin; approval queues, disputes, users, teams, reports, blacklist, announcements, sports and categories, platform settings, audit log, overview.
- **Payments** — **on hold**: no gateway (Khalti/eSewa) is connected. Bookings can be paid at the venue and shop orders by cash on delivery. A sandbox "test mode" flow and a manual-payment/subscription backend exist for later (`PAYMENT_MODE=test` must never be on in production).

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

- **First admin (Super Admin):** `cd backend && ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long passphrase' ADMIN_NAME='Your Name' npm run create-admin` (production: `npm run build` then `npm run create-admin:prod` with `MONGO_URI` set). Creates the account, or promotes an existing one, as a **Super Admin** (full access). Passwords come from the environment only. Other staff are added by a Super Admin through `/api/admin/staff` with a role and permissions — see the Admin API section of `API_CONTRACT.md`.
- **RBAC migration** (once, on an existing database): `npm run migrate:rbac -- --dry-run`, then without `--dry-run`. Creates the staff role templates and promotes the oldest admin to Super Admin; other existing admins keep no permissions until assigned a role.
- **Tests:** `cd backend && npm test` — runs against an in-memory MongoDB, never your real database. `npm run typecheck` checks source and tests.
- **Migrations** (safe, repeatable; run each with `-- --dry-run` first, then without, in this order on an existing database): `migrate:phase2`, `migrate:rbac`, `migrate:profiles`, `migrate:teams`, `migrate:tournaments`, `migrate:grounds`, `migrate:shop`, `migrate:subscriptions`. In production use the `:prod` variants after `npm run build`. Then `npm run seed` adds sport positions, staff role templates and plans without overwriting edits.
- **Audit:** see [`docs/AUDIT.md`](./docs/AUDIT.md) for the security audit and what each phase fixed.

## Deployment

- **Backend → Render** (Web Service). Root Directory `backend`, Build `npm ci --include=dev && npm run build`, Start `npm start`, Health Check `/api/health`. Environment variables are documented in `backend/.env.example`; `render.yaml` is an optional Blueprint with the same settings.
- **Frontend → Vercel**. Root Directory `frontend`, framework Vite. Set `VITE_API_URL` to the Render URL (no trailing slash, no `/api`). `frontend/vercel.json` makes deep links like `/teams/123` work on refresh.
- **Database → MongoDB Atlas**. Seed once from your machine: `cd backend && npm run build && MONGO_URI="<atlas uri>" NODE_ENV=production npm run seed:prod` (sports + grounds; the demo shop is skipped unless `SEED_DEMO_SHOP=true`).
- **Payments**: test mode is **off in production** unless `PAYMENT_MODE=test`. Turning it on lets any user confirm their own payment (free premium) — demo use only.
- **Uploads**: stored on **Cloudinary** (folder `thearena/`) when the `CLOUDINARY_*` keys are set — required in production, since Render's filesystem is wiped on each deploy/restart. Without them (local dev) they go to `backend/uploads`. The frontend shrinks large photos to ≤1920 px before upload so they send quickly on mobile data.
