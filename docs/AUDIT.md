# The Arena — Phase 1 codebase audit

Audit date: 2026-11-21. Scope: the whole repository (`backend/` ~4,550 lines TypeScript, `frontend/` ~10,450 lines, 35 pages), plus `npm audit` and a scan of the full git history for secrets.

Status legend: **Working** · **Partial** (exists but missing key parts) · **Simulated** (looks real, isn't) · **Missing** · **Vulnerable**.

## 1. Architecture

- **Backend:** Express 5 + Mongoose 8, layered routes → controllers → services → models, with response shapers (`utils/shapers.ts`) that decide what each endpoint exposes. Central error handler, `AppError`, `asyncHandler`. Single process; `server.ts` runs a 5-minute timer that releases expired holds.
- **Frontend:** React 19 SPA (Vite, React Router 7, Tailwind 4). One axios client (`src/api/axios.ts`); auth state in `AuthContext`; `ProtectedRoute` guards logged-in pages.
- **Data:** 15 collections (User, Team, Tournament, Match, TeamRanking, PlayerRanking, Sport, Ground, GroundBooking, Challenge, Payment, Membership, Store, Product, Order).
- **Hosting:** frontend on Vercel; backend prepared for Render (`render.yaml`); MongoDB Atlas; Cloudinary; Resend over SMTP.

The architecture is sound and consistent. The problems are missing layers (roles, moderation, fulfilment, real payments, tests), not a bad foundation — so the plan is to extend it, not rewrite it.

## 2. Feature inventory

| Feature | Status | Notes |
|---|---|---|
| Register / login | Working | bcrypt (10 rounds), JWT HS256 with pinned algorithm |
| Password reset | Working | Token hashed (SHA-256) at rest, 1-hour expiry, enumeration-safe response |
| Refresh tokens / sessions | **Missing** | One 7-day access token, no refresh, no revocation, no logout-all |
| Email verification | Missing | |
| Two-factor auth | Missing | |
| Roles (admin) | **Simulated** | `role: "player" \| "admin"` exists on User, but no code checks it |
| Account suspension / ban | Missing | |
| Admin dashboard / CMS | Missing | Sports and grounds can only be changed by editing `seed.ts` |
| Audit log | Missing | |
| Reports / moderation | Missing | |
| Player profiles | Working | Email and phone hidden from everyone except the owner |
| Teams | Partial | Create, join requests, remove member work. No captain/vice-captain, invitations, ownership transfer, roster limit, location, description, history |
| Challenges | Working | Team/player challenges with accept/decline/cancel, owner-checked |
| Tournaments | Partial | Single elimination, atomic start/score/advance, organizer-only scoring. No approval, referees, score audit, disputes, end date, fees |
| Rankings | Partial | Updated from tournament results only. Any Premium user can organize a tournament between their own teams and award themselves wins (**ranking manipulation**) |
| Grounds | Partial | 24 seeded grounds, read-only. No owners/operators, operating hours, images, admin management |
| Ground booking | **Vulnerable** | Server-side pricing ✓, hold expiry ✓, but check-then-insert race allows **double booking** under concurrent requests |
| Shop: stores | Partial | Anyone can open one store instantly. No application/approval, verification, suspension |
| Shop: products | Partial | CRUD with ownership checks, up to 5 images. No brand, discount price, variants, archive, moderation |
| Inventory | Working | Atomic conditional decrement prevents overselling; restock on failure/expiry. No adjustment history or low-stock alerts |
| Orders | Partial | Multi-store cart in one order; sellers see only their line items. Status is only `pending_payment → paid → cancelled`; **no fulfilment lifecycle** (processing, shipped, delivered, returns, refunds) |
| Payments | **Simulated** | Only provider is `TEST` (user confirms their own payment). Lifecycle is well built: server-side amounts, idempotent pending→success, one pending payment per order. Khalti/eSewa need merchant accounts **and** verification code (README's "no code changes needed" is inaccurate) |
| Membership | Working (test payments) | Stacks renewals, lazy expiry downgrade. Pricing from env, not admin-configurable |
| Notifications (in-app) | Missing | |
| Email | Partial | Only password reset. Resend works but only delivers to the account owner until a domain is verified |
| Pagination | Missing | Lists return everything (players capped at 200); `listStores` runs one count query per store (N+1) |
| Tests | **Missing** | No test files, no test runner |

## 3. Security findings

| # | Severity | Finding | Fix |
|---|---|---|---|
| S1 | **Critical** | **No role enforcement at all.** There is no way to administer the platform, and nothing stops abuse (fake shops, fake tournaments, spam) | Phase 2: `requireRole`, account status, admin bootstrap; Phase 3: admin API |
| S2 | **High** | **Double booking race:** `createBooking` checks for conflicts and then inserts as two steps; two simultaneous requests for the same slot both succeed. Same gap when two overlapping holds are confirmed at once | Phase 2: per-ground/date lock around check + insert/confirm |
| S3 | **High** | **Sessions can't be revoked.** A stolen 7-day token keeps working after a password reset, and there's no logout-all | Phase 2: `tokenVersion` in the JWT, bumped on reset/logout-all; suspended users rejected on every request |
| S4 | **High** | **Test payments in production.** `PAYMENT_MODE=test` lets every user mark their own payment as paid (free Premium, free orders). It is opt-in and off by default, but there is no real provider | Keep off for real users; Phase 7 adds verified gateways |
| S5 | Medium | Auth token in `localStorage` — readable by any XSS. Moving to httpOnly refresh cookies needs the frontend and API on the **same site** (e.g. `thearena.com.np` + `api.thearena.com.np`); `vercel.app` ↔ `onrender.com` are different sites and Safari blocks such cookies | After a custom domain: httpOnly refresh cookie + short access token. Until then: revocation (S3) limits the damage |
| S6 | Medium | Profile update copies the request body: a user can set `photo` to any URL (tracking pixels, offensive images bypassing upload checks) | Phase 2: only accept photos from uploads |
| S7 | Medium | Ranking manipulation via self-organized tournaments (see table above) | Phase 5: tournament approval; only approved tournaments count |
| S8 | Medium | Seller order view includes the order's **total** across all shops, revealing other shops' amounts | Phase 4/7: per-shop sub-orders |
| S9 | Medium | No audit trail for any privileged action | Phase 2: `AuditLog` model + helper; used by every admin action |
| S10 | Medium | Login timing reveals whether an email is registered (bcrypt only runs for existing users) | Phase 2: compare against a dummy hash |
| S11 | Low | bcrypt cost 10 | Phase 2: raise to 12 for new hashes (existing hashes keep working) |
| S12 | Low | Store name/description have no length validation | Phase 2 |
| S13 | Low | Frontend dependencies: 3 high-severity advisories (`follow-redirects` via axios, `source-map-js`) | Phase 2: `npm audit fix` |
| S14 | Info | Rate limiting is in-memory per instance | Fine on one Render instance; use a shared store if scaled out |

**Already done well:** NoSQL-operator stripping on bodies; escaped regex search (ReDoS-safe); upload type allow-list with server-chosen extensions; Helmet; strict CORS allow-list; 100 KB body limit; rate limits on auth and reset; consistent ownership checks on teams, stores, products, orders, payments; atomic state transitions; private fields hidden by shapers; **no secrets in git history** (only the `.env.example` placeholder).

**Credentials pasted in chat during setup** (Atlas user password, Cloudinary secret, Resend key) should be rotated before launch, and the Atlas user replaced by one limited to the `the-arena` database.

## 4. Performance

- No pagination on teams, tournaments, stores, products, bookings, orders.
- `listStores`: N+1 product counts — replace with one aggregation.
- Missing indexes for common filters (products by sport/category/price, teams by sport, tournaments by status/startDate).
- Overlap check loads all bookings for a ground/day — fine at current scale.

## 5. Deployment

- `render.yaml` is correct (build with dev deps, health check, Singapore region). Free tier sleeps after 15 min idle.
- Production startup validates `JWT_SECRET` length, `CLIENT_URL`, and Cloudinary.
- Missing: documented backup/restore and rollback procedure (Phase 9), a verified Resend domain, CI.

## 6. Roadmap

| Phase | Content | Depends on you for |
|---|---|---|
| **2 — Security foundation** (now) | Roles + account status, admin bootstrap, session revocation & logout-all, double-booking lock, audit log, profile photo fix, login timing, bcrypt cost, validation gaps, dependency fixes, **test suite with security tests** | — |
| 3 — Super Admin | Admin API + `/admin` dashboard: users, teams, shops, products, orders, tournaments, grounds (CRUD), memberships, settings, real analytics | — |
| 4 — Shop owner | Shop applications + approval, shop dashboard, product variants/brand/discounts, inventory history, low stock | — |
| 5 — Sports | Captains, invitations, ownership transfer, roster limits, tournament approval/referees/score audit/disputes | — |
| 6 — Grounds | Operators, operating hours, availability calendar, cancellations/refunds | — |
| 7 — Commerce & payments | Parent order + per-shop orders, fulfilment lifecycle, returns/refunds, commission, **Khalti/eSewa verification** | Merchant accounts + test keys |
| 8 — Notifications & performance | In-app notifications, email templates, pagination, indexes, job queue | Verified Resend domain |
| 9 — Testing & deployment | E2E tests, backup/restore + rollback docs, production checklist | Render + Atlas access |

## 7. Phase 2 results (security foundation)

| Finding | Status | Where |
|---|---|---|
| S1 Role enforcement | **Fixed (foundation)** — `requireRole()` reads the role from the database on every request; admin router is guarded as a whole; first admin endpoints (users, status, role, audit log) | `middleware/verifyToken.ts`, `routes/adminRoutes.ts`, `services/adminService.ts` |
| S2 Double booking | **Fixed** — per-ground-per-day lock around check + insert, payment confirmation and challenge accept. Verified: with the lock removed the test sees 6/6 bookings succeed; with it, exactly 1 | `utils/lock.ts`, `services/groundBookingsService.ts`, `paymentsService.ts`, `challengesService.ts` |
| S3 Session revocation | **Fixed** — `tokenVersion` claim; bumped by password reset, logout-all, suspension/ban. Suspended/banned accounts are rejected on every request and at login | `utils/jwt.ts`, `middleware/verifyToken.ts`, `services/authService.ts` |
| S4 Test payments | Unchanged by design (off unless `PAYMENT_MODE=test`); tests prove a user can't self-confirm when it's off | `tests/payments.test.ts` |
| S5 Token in localStorage | **Open** — needs same-site domain; frontend now clears revoked sessions automatically | `frontend/src/api/axios.ts` |
| S6 Photo URL injection | **Fixed** — photo only from uploads | `controllers/authController.ts` |
| S9 Audit log | **Fixed** — append-only `AuditLog` (Mongoose blocks updates/deletes), request ID on every request, secrets redacted. Records: admin login, suspension/ban/reactivation, role changes, password reset, logout-all, payment confirmation, admin creation, migrations | `models/AuditLog.ts`, `services/auditService.ts`, `middleware/requestContext.ts` |
| S10 Login timing | **Fixed** — dummy-hash compare for unknown emails | `services/authService.ts` |
| S11 bcrypt cost | **Fixed** — 12 for new hashes; old hashes upgraded on next login | `services/authService.ts` |
| S12 Store validation | **Fixed** | `services/storesService.ts` |
| S13 Dependencies | **Fixed** — `npm audit`: 0 vulnerabilities in backend and frontend | |
| S7, S8, S14 | Open — scheduled for Phases 5, 4/7 and later | |

**Tests:** 43 backend tests (Vitest + Supertest + in-memory MongoDB) covering all ten security cases from the brief: admin APIs (#1), cross-shop products (#2) and orders (#3), team takeover (#4), price manipulation (#5), self-confirmed payment (#6), concurrent booking (#7), last-item race (#8), expired token (#9), revoked session (#10) — plus forged/alg-none tokens, mass assignment, NoSQL injection, idempotent payments and pre-upgrade user documents.

**Backward compatibility:** existing users and existing 7-day tokens keep working (tested with raw pre-upgrade documents). No API was removed or changed in shape; new endpoints only.
