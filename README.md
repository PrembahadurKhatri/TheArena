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
npm run seed            # seeds the 10 sports + sample grounds
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` and `/uploads` to the backend on `localhost:5050` — see `frontend/vite.config.ts`.
