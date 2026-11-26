# The Arena — Master Audit & Implementation Plan

Audit date: 2026-11-26. Covers the brief "The Arena – Complete Sports Ecosystem" against the code at commit `852860a` (Phase 2: security foundation).
Builds on [`AUDIT.md`](./AUDIT.md) (2026-11-21); findings already fixed there are not repeated.

**Nothing in the project was changed for this audit.** Baseline verified: working tree clean; `npm test` → 7 files, 43 tests passing; dev database reachable.

Status legend: **Done** · **Partial** · **Simulated** (looks real, isn't) · **Missing**.

---

## A. Existing project overview

| Area | Current state |
|---|---|
| Backend | Node ≥20, TypeScript 5.9, Express 5, Mongoose 8, JWT (HS256, pinned), bcrypt 12, Helmet, CORS allow-list, express-rate-limit, Multer + Cloudinary, Nodemailer. ~3,900 lines in `backend/src`. |
| Frontend | React 19, Vite 6, Tailwind 4 (CSS-variable design tokens in `src/index.css`), React Router 7, Framer Motion, lucide-react, axios. ~10,500 lines, 35 pages. Context API for auth and cart. |
| Data | MongoDB Atlas (**replica set** — multi-document transactions are available). 16 models + a `Lock` collection. Dev DB holds only seed data: 10 sports, 24 grounds, **0 users / teams / orders**. |
| Tests | Vitest + Supertest + mongodb-memory-server, 43 security-focused tests. |
| Hosting | Backend → Render (`render.yaml`), frontend → Vercel, uploads → Cloudinary, email → Resend SMTP. |
| Architecture | Layered: `routes → controllers → services → models`, response shapers in `utils/shapers.ts`, central error handler, `AppError`, `asyncHandler`, audit log, request IDs, Mongo-backed mutex (`utils/lock.ts`), 5-minute expiry sweeper. |

**Verdict:** the foundation is clean and security-conscious (atomic state transitions, ownership checks, server-side pricing, append-only audit log). The brief is mostly **new domain depth** on top of it, so the plan **extends** the codebase. It does not rewrite it.

Because the database is still essentially empty, schema changes are cheap **now**. Every change below still ships with an idempotent migration (`--dry-run` first, like `migrate:phase2`), in case a production database already holds data.

## B. Current folder structure

```
TheArena/
├── API_CONTRACT.md, README.md, render.yaml
├── docs/AUDIT.md                     security audit + Phase 2 results
├── backend/
│   ├── src/
│   │   ├── app.ts, server.ts, seed.ts
│   │   ├── config/        db.ts, env.ts
│   │   ├── controllers/   13 thin controllers (auth, challenges, grounds, membership, orders,
│   │   │                  payments, players, products, rankings, sports, stores, teams, tournaments)
│   │   ├── middleware/    verifyToken (verifyToken/optionalAuth/requireRole), requirePremium,
│   │   │                  security (sanitizeBody, rate limiters), requestContext
│   │   ├── models/        16 Mongoose models
│   │   ├── routes/        14 routers, mounted under /api/*
│   │   ├── services/      business logic (auth, teams, challenges, tournaments, rankings,
│   │   │                  groundBookings, payments, orders, products, stores, admin, audit, expiry)
│   │   ├── scripts/       createAdmin.ts, migratePhase2.ts
│   │   └── utils/         jwt, lock, upload, validation, pagination, shapers, sports, provinces,
│   │                      shopCategories, sendEmail
│   └── tests/             admin, auth, booking, legacy, payments, shop, teams
└── frontend/src/
    ├── api/               axios client (+ session-ended event), image helpers
    ├── components/        Navbar, Footer, ProtectedRoute, ui/ (Badge, Button, CustomSelect, Field,
    │                      SportMark, StateBlock), page/, shop/, challenge/
    ├── context/           AuthContext, CartContext (localStorage cart)
    ├── data/              sports, provinces, shopCategories (duplicated from backend)
    └── pages/             public pages, Dashboard, TeamDashboard, challenges/, shop/
```

### Recommendation on structure

The brief asks for feature folders (`auth/`, `teams/`, …). **I recommend keeping the current layered layout** and adding new domains in the same shape, for three reasons:
1. Moving all files would touch every import and destroy `git blame` history, for no functional gain.
2. The layering is already applied consistently and is easy to navigate at this size.
3. Each domain is already one file per layer (`teamsService.ts`, `teamsController.ts`, `teamsRoutes.ts`), so it is effectively "feature files in layer folders".

One addition: a `validators/` folder for request schemas (see R.3), and `services/<domain>/` sub-folders only where a domain outgrows one file (fixtures, statistics).

---

## C. Existing features (working)

| Feature | Evidence |
|---|---|
| Register / login / logout-all / forgot + reset password | `authService.ts`; reset tokens hashed; timing-safe login; `tokenVersion` revocation |
| Account suspension & permanent ban | `User.status` active/suspended/banned, enforced on every request and at login |
| Admin API (users list, set status, set role, audit log) | `adminRoutes.ts` — **API only, no admin UI** |
| Append-only audit log | `AuditLog` model blocks updates/deletes |
| Player directory & profile | `/api/players`, email/phone shown only to self |
| Teams: create, join request, accept/reject, remove member, delete | `teamsService.ts`; free plan = 1 owned team |
| Challenges: player or team, open or direct, accept/decline/cancel, optional ground with clash check | `challengesService.ts` |
| Tournaments: single elimination, register team, start, score, auto-advance, byes, standings | `tournamentsService.ts`; atomic start/score |
| Rankings: per-sport team and player tables (3/1/0 points) | `rankingsService.ts` |
| Grounds: list, detail, day availability | 24 seeded grounds, read-only |
| Ground booking with no double booking | per-ground-per-day lock; 15-minute hold; premium 10% discount; server price |
| Payment lifecycle (TEST provider) | pending → success/failed, idempotent, one pending per ref |
| Premium membership (monthly/yearly) | stacks renewals; lazy expiry; prices from env |
| Shop: one store per user, product CRUD, atomic stock, multi-store order, seller sees own line items | `storesService`, `productsService`, `ordersService` |
| Expiry sweeper | releases unpaid orders (restock) and bookings |
| Upload safety, NoSQL operator stripping, ReDoS-safe search, rate limits | `upload.ts`, `security.ts`, `validation.ts` |

## D. Partially implemented features

| Feature | What exists | What's missing vs the brief |
|---|---|---|
| Player profile | name, email, phone, photo, location, province, sportPreferences | username, district/municipality, geo point, DOB, gender, bio, position, experience level, privacy settings, statistics |
| Player dashboard | `Dashboard.tsx`: bookings, teams, membership | change password, match history, W/L, rankings, invitations, challenges, notifications, privacy |
| Teams | name, sport, logo, owner, members, pendingRequests | **unique name**, slug, cover, description, location, captain/vice-captain roles, invitations, leave team, ownership transfer, roster limits, stats |
| Team dashboard | `TeamDashboard.tsx`: join requests, remove members | edit details, invitations, role assignment, challenges inbox, match history, stats, tournaments |
| Challenges | open/pending/accepted/declined/cancelled, owner-only | `completed` status, captain authority, counter-proposals (date/location), result reporting, "Find a Ground Near You" after accept |
| Tournaments | single elimination only | approval workflow, 4-team rule, registration requests, deadlines, fees, poster, rules, prizes, 4 more formats, points table, scheduling |
| Rankings | W/L/D/points per sport | verified-only updates, per-sport config, sport-specific stats, reversibility |
| Grounds | name, sport (single), location string, price, image, amenities | owner, approval, multiple sports, images, address hierarchy, geo, opening hours, contact, owner dashboard |
| Bookings | create, list mine, hold expiry | user cancellation, owner management, pay-at-venue, link to challenges |
| Membership | one premium tier for players | plan catalogue, team & merchant plans, cancellation, upgrade/downgrade, manual payment verification, admin-configurable benefits |
| Payments | TEST provider | MANUAL provider + admin verification; statuses `paid/refunded/cancelled`; payment history page |
| Shop | store + product + order | merchant application & approval, banner/docs/address, slug, brand, SKU, discount, variants, product approval, per-merchant sub-orders, fulfilment lifecycle, wishlist, reviews, sales reports |
| Admin | users + audit log API | everything else (see N) |
| Email | password reset only | templated notifications |

## E. Missing features

- **Permission-based staff RBAC** (Super Admin, staff roles, per-permission grants).
- **Notifications** (model, service, unread count, inbox).
- **Unified match model** shared by challenges and tournaments, plus **match reports**, confirm/dispute, admin dispute resolution.
- **Sport-specific statistics** and configurable ranking rules.
- **Location hierarchy** (province → district → municipality) and **geospatial** "near me" search.
- **Ground owners** and ground approval.
- **Merchant approval**, product moderation, wishlist, reviews, sales dashboard.
- **Plan catalogue** and entitlements engine.
- **Admin dashboard UI** (none exists) and staff management UI.
- **Account reports** ("reported accounts"), blacklist of email/phone on re-registration.
- **Platform settings** & admin-managed categories/sports.
- **Matches** and **Notifications** pages in the main navigation.

### New findings not in AUDIT.md

| # | Severity | Finding | Where |
|---|---|---|---|
| N1 | **High** | **No admin hierarchy.** Any admin can promote anyone to admin, and can suspend or demote other admins. Once staff accounts exist, this is privilege escalation. | `adminService.setUserRole/setUserStatus` |
| N2 | **High** | **Rankings update from unverified results.** The organizer types a score and both teams' rankings, plus every *current* roster member's ranking, change immediately. This breaks business rule 10, and AUDIT S7 (self-organized tournaments to farm points) is still open. | `tournamentsService.completeMatch` → `recordMatchResult` |
| N3 | **Medium** | **Accepted challenges block ground slots for free.** An accepted challenge with a `ground` makes those hours unavailable to paying customers, with no booking, payment or owner consent. Two accounts can block any ground for 12 h/day, 90 days ahead. | `challengesService.findGroundClash`, `getGroundAvailability` |
| N4 | Medium | Team names aren't unique (no index), so teams can impersonate each other. | `models/Team.ts` |
| N5 | Medium | A team's `sport` can be edited after creation, even while registered in a tournament or holding rankings and challenges. That leaves inconsistent data. | `teamsService.updateTeam` |
| N6 | Medium | If SMTP isn't configured, **password-reset links are written to the server log**. That includes production, where `validateEnv` doesn't require SMTP, so anyone with log access can take over accounts. | `utils/sendEmail.ts` |
| N7 | Medium | Seller order view still shows the order's `totalAmount` across all shops (AUDIT S8, open). | `ordersService.listStoreOrders` |
| N8 | Low | Player directory and profiles include suspended/banned users and admins. | `playersController.listPlayers/getPlayer` |
| N9 | Low | Members can't leave a team, and owners can't transfer ownership. | no route |
| N10 | Low | There's no change-password endpoint (users must use the email reset flow). | no route |
| N11 | Low | Users can't cancel a booking (only an unpaid hold expires). | no route |
| N12 | Low | Expired premium is downgraded only when that user makes a request, so badges in listings and rankings can be stale. | `verifyToken.loadUser`, sweeper |
| N13 | Low | Free-plan "1 team" check is count-then-create, so two parallel requests can create 2 teams. | `teamsService.createTeam` |
| N14 | Low | Deleting a team leaves open/pending challenges pointing at it. | `teamsService.deleteTeam` |
| N15 | Low | Tournament registration doesn't check roster size; organizers can enter only their own teams. | `tournamentsService.registerTeam` |
| N16 | Info | Adding a sport needs a code deploy: sport slugs are a hard-coded enum validated in 8 models. The brief wants new sports to be addable. | `utils/sports.ts` |
| N17 | Info | Replaced images (logo, photo, product) are never deleted from Cloudinary or disk. | upload flows |

Still open from AUDIT.md: **S5** (token in `localStorage`; needs a same-site custom domain), **S14** (in-memory rate limiter).

---

## F. Database model requirements

Conventions for every new or changed model: `timestamps: true`; slugs unique and immutable after creation; every list query backed by an index; money stored as integer **paisa** (`amountPaisa`) for new fields, to avoid float rounding. Existing NPR float fields are migrated when their module is touched.

### F.1 Changes to existing models

| Model | Change | Migration |
|---|---|---|
| **User** | add `username` (unique), `usernameKey` (lowercased, unique index), `dateOfBirth`, `gender?`, `bio`, `district`, `municipality`, `geo` (GeoJSON Point, `2dsphere`), `sportProfiles[] {sport, position, experienceLevel}`, `privacy {showPhone, showEmail, showLocation, discoverable}`, `isSuperAdmin`, `staffRole` (ref StaffRole), `permissionOverrides[]`. Keep `role` (`player`/`admin`) for backward compatibility; `admin` comes to mean "staff". Keep `isPremium` as a **cache** written only by the subscription service. | Generate `username` from name + 4-digit suffix; first admin → `isSuperAdmin: true` |
| **Team** | add `slug` (unique), `nameKey` (normalized: NFKC, trim, collapse spaces, lowercase; **unique index**), `description`, `coverImage`, `province/district/municipality`, `geo`, `captain`, `viceCaptain`, `status` (active/suspended/disbanded), `stats` cache, `isPremium` cache. Replace `members: ObjectId[]` + `pendingRequests` with a **TeamMembership** collection (below); keep `members` as a denormalized id array for existing queries during transition. Lock `sport` once the team has a match, registration or ranking. | Build `nameKey` and run a duplicate check before the unique index (dev DB: 0 duplicates); create TeamMembership rows from `members` / `pendingRequests` |
| **Challenge** | statuses add `countered`, `completed`, `expired`; add `counterProposals[] {by, date, startTime, endTime, ground, venueNote, at}`, `match` (ref Match), `booking` (ref GroundBooking), `format`. Allow the captain as well as the owner. **Stop** treating accepted challenges as ground reservations (N3): a challenge with a ground creates a normal `GroundBooking` hold instead. | none needed |
| **Match** | generalize: `source` (tournament/challenge/friendly), `tournament?`, `challenge?`, `sport`, `sideA/sideB {kind: team/player, team?, user?}`; keep `teamA/teamB` as aliases. Add `stage`, `group`, `round`, `matchNumber`, `nextMatch` + `nextSlot`, `scheduledAt`, `ground?`, `booking?`. Status: `scheduled → awaiting_report → reported → disputed → verified \| cancelled`. Add `result {scoreA, scoreB, winner, isDraw}`, `statsAppliedAt`. | existing matches: `source: "tournament"`, `pending → scheduled`, `completed → verified` |
| **Tournament** | add `slug`, `poster`, `format` (knockout/league/round_robin/group_stage/group_knockout), `formatConfig {groups, advancePerGroup, legs}`, `registrationOpensAt`, `registrationClosesAt`, `endDate`, `minTeams` (≥4), `entryFeePaisa`, `prizes[]`, `rules`, `district/municipality`, `geo`. Status: `draft, open, eligible, under_review, approved, rejected, registration_closed, ongoing, completed, cancelled`. Add `review {by, at, note}`. Replace `teams[]` with **TournamentRegistration** (keep `teams[]` as a cache of approved teams). | `upcoming → approved` with `legacy: true` (decision Q3) |
| **Ground** | add `owner`, `slug`, `sports[]` (from `sport`), `images[]`, `address`, `province/district/municipality`, `geo`, `facilities` (rename of `amenities`), `openingHours[7] {open, close, closed}`, `slotMinutes`, `contactPhone`, `status` (pending/approved/rejected/suspended), `review`. Prices in paisa. | seeded grounds → `status: approved`, `owner: null` (platform-managed) |
| **GroundBooking** | add `source` (direct/challenge), `challenge?`, `paymentMethod` (online/pay_at_venue), statuses add `cancelled_by_user`, `cancelled_by_owner`, `completed`, `no_show`; add `cancelledAt`, `cancelReason`. Add `slotKey` + partial unique index for exact-slot races. The lock already covers overlaps. | none |
| **Payment** | statuses → `pending, paid, failed, refunded, cancelled` (`success → paid`); providers add `MANUAL` (and later `KHALTI`, `ESEWA`); add `reference`, `proofImage`, `verifiedBy`, `verifiedAt`, `rejectionReason`, `refundOf`; types add `subscription`. | `success → paid` |
| **Membership** | superseded by **Subscription**; keep the collection read-only for history. | copy rows → Subscription |
| **Store** → merchant shop | add `slug`, `banner`, `ownerName`, `email`, `phone`, `address`, `province/district`, `businessDescription`, `documents[]` (private), `status` (draft/pending/approved/rejected/suspended/blacklisted), `review`, `isPremium` cache, `rating {avg, count}`. Only `approved` stores are publicly visible. | existing stores → `approved` (dev DB: 0 stores) |
| **Product** | add `slug` (unique), `brand`, `sku` (unique per store), `compareAtPricePaisa` (discount), `variants[] {_id, sku, size, color, pricePaisa?, stock}`, `status` (draft/pending_review/active/rejected/archived), `featured`, `review`, `rating`. Text index on name + brand. Categories move to a collection. | existing → `active` |
| **Order** | becomes the **parent** order (buyer, payment, grand total, shipping). Items move to **SellerOrder**. | group existing items by store into SellerOrders |
| **Sport** | becomes the source of truth: `slug, name, order, active, minPlayers, maxPlayers, positions[], statDefinitions[], rankingRules {win, draw, loss, tieBreakers[]}, resultType` (goals/runs/sets/points). Replace hard-coded Mongoose `enum: SPORT_SLUG_ENUM` with a cached `isActiveSport()` validator (N16). | seed fills the new fields for all 10 sports |
| **PlayerRanking / TeamRanking** | add `matches`, `rating` (optional Elo), `streak`, `lastMatchAt`, `season`. Written **only** by the statistics service from verified matches. | rebuild from verified matches |

### F.2 New models

| Model | Key fields | Indexes / constraints |
|---|---|---|
| **StaffRole** | `name`, `key`, `description`, `permissions[]`, `isSystem`, `createdBy` | unique `key` |
| **TeamMembership** | `team`, `user`, `role` (owner/captain/vice_captain/player), `status` (active/invited/requested/left/removed), `invitedBy`, `respondedAt`, `joinedAt` | unique (`team`, `user`); (`user`, `status`); (`team`, `status`) |
| **Location** | `type` (province/district/municipality), `name`, `nameNe`, `slug`, `parent`, `centroid` (Point) | unique (`type`, `slug`); `parent`; `2dsphere` |
| **MatchReport** | `match`, `submittedBy`, `submittedForSide`, `result {scoreA, scoreB, winnerSide, isDraw, detail}`, `playerStats[] {user, side, stats: Map<string, number>}`, `teamStats {A, B}`, `evidence[]`, `status` (submitted/confirmed/disputed/verified/rejected/superseded), `response {by, action, reason, at}`, `review {by, decision, note, at}`, `version` | (`match`, `status`); one live report per match (partial unique index) |
| **PlayerSportStats** | `user`, `sport`, `matches`, `wins`, `losses`, `draws`, `totals: Map<string, number>` | unique (`user`, `sport`) |
| **TeamSportStats** | `team`, `sport`, `matches`, `wins`, `losses`, `draws`, `goalsFor/Against`-style `totals`, `currentStreak`, `tournamentsPlayed`, `tournamentsWon` | unique (`team`, `sport`) |
| **StatLedger** | `match`, `subjectType`, `subject`, `sport`, `delta` (the exact increments applied), `reversedAt` | unique (`match`, `subjectType`, `subject`), so stats are applied once and can be reversed exactly if a dispute overturns a result |
| **TournamentRegistration** | `tournament`, `team`, `requestedBy`, `status` (requested/approved/rejected/withdrawn), `eligibility {ok, reasons[]}`, `rosterSnapshot[]`, `seed` | unique (`tournament`, `team`) |
| **TournamentStanding** | `tournament`, `group`, `team`, `played`, `won`, `drawn`, `lost`, `for`, `against`, `points`, `position` | unique (`tournament`, `team`) |
| **Plan** | `code`, `audience` (player/team/merchant), `name`, `pricePaisa`, `interval` (month/year), `entitlements {maxOwnedTeams, maxProducts, advancedStats, advancedFilters, featuredListing, badge, bookingDiscountPct, …}`, `active`, `version`, `sortOrder` | unique `code` |
| **Subscription** | `subscriberType` (user/team/store), `subscriber`, `plan`, `planSnapshot` (price + entitlements at purchase), `status` (pending/active/cancelled/expired/past_due), `startAt`, `endAt`, `autoRenew`, `cancelAtPeriodEnd`, `payments[]`, `changedFrom` | (`subscriberType`, `subscriber`, `status`); `endAt` for the expiry sweep |
| **SellerOrder** | `order`, `store`, `buyer`, `items[] {product, variant, name, sku, size, color, pricePaisa, quantity, image}`, `subtotalPaisa`, `shippingPaisa`, `status` (pending_payment/confirmed/processing/shipped/delivered/cancelled/returned), `statusHistory[]`, `tracking {carrier, code}` | (`store`, `status`, `createdAt`); (`order`); (`buyer`, `createdAt`) |
| **Review** | `product`, `store`, `user`, `sellerOrder`, `rating` 1–5, `text`, `status` (visible/hidden), `merchantReply` | unique (`user`, `product`, `sellerOrder`) — only delivered buyers |
| **WishlistItem** | `user`, `product` | unique (`user`, `product`) |
| **ShopCategory** | `slug`, `name`, `sport?`, `parent?`, `active`, `order` | unique `slug` |
| **Notification** | `recipient`, `type`, `title`, `body`, `entity {type, id}`, `link`, `readAt`, `channels {email: sent/failed/skipped}` | (`recipient`, `readAt`, `createdAt`); TTL 180 days |
| **Announcement** | `title`, `body`, `audience` (all/players/merchants/ground_owners), `publishedAt`, `expiresAt`, `createdBy` | one row per announcement, no fan-out |
| **Report** (moderation) | `reporter`, `targetType` (user/team/store/product/review/match), `targetId`, `reason`, `details`, `status` (open/in_review/actioned/dismissed), `handledBy`, `resolution` | (`status`, `createdAt`); (`targetType`, `targetId`) |
| **Blacklist** | `kind` (email/phone), `valueHash`, `reason`, `user`, `createdBy` | unique (`kind`, `valueHash`), checked at register and profile change |
| **Setting** | `key`, `value`, `updatedBy` | unique `key` (booking hold, premium discount, default limits, report auto-verify window, …) |

---

## G. API endpoint requirements

Existing endpoints stay as they are (documented in `API_CONTRACT.md`). New endpoints are additive; list endpoints gain `?page&limit` (default 20, max 100) while keeping their current response keys. Every mutating route passes through `verifyToken` and either an **ownership/membership guard** or `requirePermission(...)`.

| Domain | New endpoints |
|---|---|
| **Auth / me** | `PATCH /auth/me/password` (current + new; bumps `tokenVersion`), `PATCH /auth/me/username`, `PATCH /auth/me/privacy`, `PATCH /auth/me/location` (incl. geo), `GET /auth/username-available?u=` |
| **Players** | `GET /players?sport&province&district&municipality&experience&near=lat,lng&radiusKm&page` (excludes blocked/staff/non-discoverable), `GET /players/:username`, `GET /players/:id/stats?sport`, `GET /players/:id/matches` |
| **My** | `GET /my/challenges`, `/my/matches`, `/my/invitations`, `/my/tournaments`, `/my/subscriptions`, `/my/payments`, `/my/wishlist` |
| **Teams** | `GET /teams?sport&province&near&radiusKm&page`, `GET /teams/:idOrSlug`, `GET /teams/name-available?name=`, `POST /teams/:id/invitations` (by username), `POST /my/invitations/:id/accept\|decline`, `POST /teams/:id/leave`, `PATCH /teams/:id/members/:userId/role`, `POST /teams/:id/transfer-ownership`, `GET /teams/:id/matches`, `GET /teams/:id/stats` |
| **Challenges** | `POST /challenges/:id/counter`, `POST /challenges/:id/accept-counter`, `GET /challenges/:id/nearby-grounds?radiusKm`, `POST /challenges/:id/book-ground` (creates booking hold linked to challenge) |
| **Matches** | `GET /matches?sport&status&page`, `GET /matches/:id`, `POST /matches/:id/reports`, `POST /matches/:id/reports/:rid/confirm`, `POST /matches/:id/reports/:rid/dispute`, `POST /matches/:id/cancel` |
| **Rankings** | `GET /rankings/players?sport&province&page`, `GET /rankings/teams?sport&province&page` (existing paths, extended) |
| **Tournaments** | `PATCH /tournaments/:id`, `POST /tournaments/:id/registrations` (team requests), `PATCH /tournaments/:id/registrations/:rid` (organizer approves/rejects), `POST /tournaments/:id/withdraw`, `POST /tournaments/:id/submit-for-review`, `POST /tournaments/:id/close-registration`, `POST /tournaments/:id/fixtures` (generate), `PATCH /tournaments/:id/matches/:mid/schedule`, `GET /tournaments/:id/table`, `POST /tournaments/:id/cancel` |
| **Grounds (public)** | `GET /grounds?sport&near&radiusKm&minPrice&maxPrice&province&page`, `GET /grounds/:idOrSlug/slots?date` (free slots from opening hours − bookings) |
| **Grounds (owner)** | `POST /owner/grounds`, `PATCH /owner/grounds/:id`, `GET /owner/grounds`, `GET /owner/bookings?groundId&date`, `POST /owner/bookings/:id/confirm-pay-at-venue`, `POST /owner/bookings/:id/cancel`, `POST /owner/grounds/:id/blocks` (maintenance) |
| **Bookings** | `POST /ground-bookings/:id/cancel` (policy-checked), `POST /ground-bookings` gains `paymentMethod` |
| **Subscriptions** | `GET /plans?audience`, `POST /subscriptions` (planCode, subscriberType/id), `POST /subscriptions/:id/cancel`, `POST /subscriptions/:id/change-plan`, `POST /payments/:id/manual-proof` (reference + image) |
| **Merchant** | `POST /merchant/application`, `GET /merchant/application`, `GET /merchant/dashboard` (sales, revenue), `GET /merchant/orders?status`, `PATCH /merchant/orders/:sellerOrderId/status`, `PATCH /merchant/orders/:id/tracking`, product variant endpoints under `/merchant/products/:id/variants`, `POST /merchant/reviews/:id/reply` |
| **Shop (customer)** | `GET /shop/products?q&category&sport&brand&minPrice&maxPrice&sort&page`, `GET /shop/products/:slug`, `POST/DELETE /shop/wishlist/:productId`, `POST /shop/products/:id/reviews`, `GET /shop/orders/:id` (parent + seller orders + timeline), `POST /shop/orders/:id/cancel` |
| **Notifications** | `GET /notifications?unread&page`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET /announcements` |
| **Reports** | `POST /reports` |
| **Admin** (each behind `requirePermission`) | `GET /admin/overview`; users: list/get/edit/status/blacklist; staff: `GET/POST/PATCH /admin/staff`, `GET/POST/PATCH/DELETE /admin/staff-roles`; teams: list/suspend/delete; merchants: `GET /admin/merchants?status`, `POST /admin/merchants/:id/review`; products: `GET /admin/products?status`, `POST /admin/products/:id/review`; grounds: list/create/edit, `POST /admin/grounds/:id/review`; tournaments: `GET /admin/tournaments?status=eligible`, `POST /admin/tournaments/:id/review`; disputes: `GET /admin/match-reports?status=disputed`, `POST /admin/match-reports/:id/resolve`; orders: list/get/status override; subscriptions & payments: list, `POST /admin/payments/:id/verify\|reject\|refund`; plans: CRUD; categories & sports: CRUD; settings: get/patch; announcements: CRUD; reports: list/resolve; audit logs (exists) |

## H. Dashboard requirements

Each dashboard gets its own layout shell (sidebar + header) on top of the existing `components/ui` primitives and `index.css` tokens. The public site keeps its current design.

| Dashboard | Route | Visual identity | Sections |
|---|---|---|---|
| Player | `/me/*` | current dark sport aesthetic, personal accent | Overview (next match, invites, unread), Profile & privacy, Sports & positions, Matches & results, Stats & rankings, Teams, Invitations, Challenges, Tournaments, Bookings, Orders, Subscription & payments, Notifications, Security (password, sessions) |
| Team management | `/me/teams/:slug/*` | team colours (taken from the logo) | Overview, Edit details, Roster & roles, Invitations & requests, Challenges inbox, Matches & reports to submit, Tournaments, Stats, Team subscription |
| Merchant | `/merchant/*` | light, data-dense commerce UI | Application status, Shop profile, Products (variants, stock), Orders (per seller order), Shipping, Reviews, Sales & revenue charts, Subscription |
| Ground owner | `/owner/*` | calendar-first | Grounds, Opening hours & pricing, Day/week booking calendar, Pay-at-venue confirmation, Blocks, Earnings records |
| Admin | `/admin/*` (lazy-loaded bundle) | neutral, dense, high-contrast; separate brand mark so staff always know they are in admin | Overview KPIs, Approval queues (merchants, products, grounds, tournaments), Disputes, Users, Teams, Orders, Payments & subscriptions, Plans, Categories & sports, Reports, Announcements, Staff & roles, Settings, Audit log |

Frontend guards: `RequireAuth` (exists as `ProtectedRoute`), plus `RequirePermission`, `RequireMerchant` and `RequireGroundOwner`, all driven by an `/auth/me` payload extended with `permissions[]`, `capabilities {merchant, groundOwner}` and `entitlements`. These guards are **for UX only**; the backend enforces everything.

## I. Security and permission requirements

### I.1 Permission model

- **Permission catalogue** (`config/permissions.ts`, code-defined so a typo fails at compile time):
  `users.read, users.edit, users.suspend, users.blacklist, staff.manage, teams.moderate, merchants.review, products.review, grounds.review, grounds.manage, tournaments.review, fixtures.manage, reports.verify, disputes.resolve, orders.manage, payments.read, payments.verify, payments.refund, subscriptions.manage, plans.manage, categories.manage, sports.manage, settings.manage, announcements.manage, moderation.reports, audit.read, analytics.read`.
- **Effective permissions** = (`isSuperAdmin` ? all) ∪ `staffRole.permissions` ∪ `permissionOverrides.grant` − `permissionOverrides.revoke`. Computed per request from the DB, like `requireRole` does today.
- `requirePermission(...perms)` middleware; `/api/admin` router keeps `verifyToken` + "is staff" at router level, plus a permission on **every** route.
- **Escalation rules (enforced server-side, tested):**
  1. Only a Super Admin can create staff, edit staff roles, or grant `staff.manage` / `settings.manage`.
  2. Nobody can edit their own role, permissions or status.
  3. A staff member can never grant a permission they don't hold.
  4. Super Admin accounts can only be changed by another Super Admin, and the last Super Admin can't be removed.
  5. Every grant, revoke and role edit is audit-logged with before/after.
- Default role templates (editable, from the brief): HR Manager, Tournament Manager, Merchant Manager, Ground Manager, Support Manager, Finance Manager, Content Manager.

### I.2 Resource authority (not platform roles)

Keep the existing principle from `User.ts`: team owner/captain, merchant and ground owner are **capabilities on a resource**, not account types. That satisfies "one personal account per player" (rule 1). Central helpers:
- `assertTeamRole(user, team, ["owner", "captain"])`
- `assertStoreOwner`, `assertGroundOwner`, `assertTournamentOrganizer`
- `assertMatchParticipantAuthority(user, match, side)`

### I.3 Hardening items

| Item | Plan |
|---|---|
| Blacklist | `banned` status + Blacklist hash of email/phone checked at register and profile change |
| Reset links in logs (N6) | in production, refuse to start without SMTP *or* never log the link (log "email skipped"). Recommended: never log links. |
| Refresh tokens (S5) | after a same-site custom domain (`thearena.com.np` + `api.`): 15-minute access token + httpOnly rotating refresh cookie with reuse detection. Until then, keep `tokenVersion` revocation. |
| Validation | schema validation for all new endpoints (R.3) |
| Rate limits | add per-route limits: invitations, challenges, reports, reviews (anti-spam) |
| Uploads | merchant documents are **private**: Cloudinary `type: "authenticated"` and served through signed URLs only to the owner and to staff with `merchants.review` |
| Idempotency | atomic `findOneAndUpdate` on status (existing pattern) + `Idempotency-Key` header on checkout / order create |
| Trust | prices, roles, ownership, subscription state and statistics are never read from the client body (existing practice; extended to variants and plans) |
| Transactions | use Mongo transactions (Atlas is a replica set) for multi-document writes: order + seller orders + stock, stats application, registration approval. Keep `withLock` for slot overlaps. |

## J. Subscription architecture

```
Plan (catalogue, admin-editable) ──► Subscription (per user | team | store, holds planSnapshot)
                                        │
                                        ├─► Payment (MANUAL now; KHALTI/ESEWA later)
                                        │      pending ──► paid (staff verifies proof) ──► activates
                                        │               └► failed / cancelled / refunded
                                        ▼
                               EntitlementService.get(subject) ──► every backend check
```

- **EntitlementService** is the only place a backend check asks "can this subject do X / how many Y". It replaces the ~20 direct `isPremium` / `requirePremium` checks. It reads the **active subscription's `planSnapshot`**, so editing a plan never changes what existing subscribers paid for. Free defaults come from the free plans in the catalogue.
- Seed plans: `player_free`, `player_premium`, `team_free`, `team_premium`, `merchant_basic`, `merchant_pro` (limits like `maxProducts` are configurable).
- **Manual payment flow (honest, no gateway):** user picks a plan → Payment `pending`, provider `MANUAL` → user pays outside The Arena and submits a transaction reference and screenshot → Finance staff (`payments.verify`) approves → Payment `paid` → Subscription `active`. The UI labels this "Manual verification — online payment coming soon". The `TEST` provider stays available only when `PAYMENT_MODE=test`.
- Upgrade = new subscription starting now, with the old one cancelled (no proration until a gateway exists). Downgrade/cancel = `cancelAtPeriodEnd`.
- Expiry: the sweeper (already runs every 5 minutes) moves `active → expired` at `endAt`, refreshes the `isPremium` caches and sends a notification 7 days and 1 day before expiry (fixes N12).
- Gateway readiness: a `PaymentProvider` interface (`initiate`, `verify`, `refund`) with a `MANUAL` and a `TEST` implementation. Khalti/eSewa become new implementations of the existing `verifyWithGateway` seam.

## K. Tournament and matchmaking workflow

### K.1 Matchmaking & challenges

1. Discover players or teams: filter by sport, location hierarchy, experience, and `$geoNear` within a radius, from the viewer's geo or the chosen municipality's centroid. Premium can unlock advanced filters through entitlements.
2. Send challenge: player → player, or team → team (owner or captain only). Statuses: `pending → accepted | rejected(declined) | cancelled | countered | expired | completed`. Open challenges stay as they are today.
3. The receiver can accept, reject, or **counter** (new date/time/location). The counter flips the turn; there's a cap of 5 counters.
4. On accept → a **Match** is created (`source: challenge`, `scheduled`). The response includes a **"Find a Ground Near You"** list: approved grounds supporting the sport, with free slots at the agreed time, sorted by distance.
5. Booking is **optional**: "Book this ground" creates a normal `GroundBooking` hold linked to the challenge (fixes N3); "We'll arrange it ourselves" sets a free-text venue.
6. After the scheduled time the match becomes `awaiting_report` → report flow (K.3).

### K.2 Tournament lifecycle (4-team rule)

```
draft ─► open (accepting participation requests)
          │  teams request → organizer approves/rejects each (eligibility auto-checked:
          │  sport match, team active, roster ≥ sport.minPlayers, not already entered)
          ▼
        eligible  (automatic when approved+eligible registrations ≥ max(4, minTeams))
          │  organizer "submit for review" (or auto-submit, decision Q4)
          ▼
        under_review ─► rejected (with reason; organizer may edit & resubmit)
          ▼
        approved ─► registration continues until registrationClosesAt / maxTeams
          ▼
        registration_closed ─► fixtures generated ─► ongoing ─► completed (winner declared)
                                                        └► cancelled (any time before completed)
```

- Four eligible teams make a tournament **eligible for review**. They never start it automatically.
- Self-dealing guard (fixes AUDIT S7): the four teams must have **at least two different owners** besides the organizer. Admins see the owner spread in the review queue.
- **Fixture generators** (pure functions, unit-tested):
  - Knockout: seeded bracket padded to a power of two, with byes in round 1 only. This improves on today's "odd team out each round".
  - Round robin and league: circle method; league supports 2 legs.
  - Group stage: snake seeding into groups, round robin inside each group.
  - Group + knockout: top N per group feed a knockout bracket via `nextMatch` links.
- The points table (`TournamentStanding`) is recomputed from **verified** matches using the sport's `rankingRules` and tie-breakers.

### K.3 Match report & verification

1. The authorized representative of either side submits a `MatchReport`. That's the team owner/captain, the player for a player match, or the organizer for a tournament match.
2. The other side **confirms** (→ `verified`) or **disputes** with a reason (→ `disputed`).
3. Staff with `disputes.resolve` review the report and evidence and verify, amend or void it (audit-logged).
4. If the opponent doesn't respond within the configured window, the report auto-verifies (decision Q1).
5. On `verified`, `StatisticsService.applyVerifiedMatch(matchId)` runs **in a transaction**, guarded by `statsAppliedAt` and the `StatLedger` unique key. It updates PlayerSportStats, TeamSportStats and rankings once. If a verified result is later overturned, the ledger reverses the exact deltas.
6. Player stats count **only players listed in the report's lineup**, not the whole current roster (fixes N2).
7. Tournament brackets advance when a result is **verified**, or when the organizer reports and the other side confirms. Decision Q2 covers organizer-final results.

### K.4 Sport-specific statistics

Each Sport's `statDefinitions[]` describes its stats: `{ key, label, type: count|number, aggregate: sum|max, perMatch: bool }`, plus derived formulas, e.g. cricket `battingAverage = runs / dismissals`, `strikeRate = runs / balls * 100`. Reports store raw stats in a `Map`; aggregates store sums; derived values are computed when read. Adding a sport or a stat is a data change, not a code change.

## L. Ground booking workflow

1. A user applies as a ground owner by submitting a ground (no separate account) → Ground `pending`.
2. Staff with `grounds.review` approve or reject it → owner notified; approved grounds appear in search.
3. Search: `$geoNear` + sport + price range + location filters, paginated.
4. Slots: computed from `openingHours` and `slotMinutes`, minus bookings, owner blocks and active holds.
5. Book: existing locked check-and-insert (kept), plus an opening-hours check. Payment method:
   - `online`: today's flow, TEST/MANUAL until a gateway exists.
   - `pay_at_venue`: booking `confirmed_unpaid`; the owner marks it paid or no-show.
6. Cancel: the user cancels before the cutoff in the settings; the owner can cancel with a reason. Both sides get a notification. Payment becomes `cancelled`, or `refunded` when staff process a refund.
7. Owner dashboard: calendar of bookings, confirm pay-at-venue, block slots, earnings **records** (not payouts).
8. Challenge integration: K.1 steps 4–5.

## M. Multi-vendor e-commerce workflow

1. **Merchant application** → Store `pending` (documents private) → staff with `merchants.review` approve/reject → merchant subscription (`merchant_basic` free tier) sets product limits.
2. **Products**: merchant creates them as `draft` → submits → `pending_review` → staff with `products.review` approve (→ `active`) or reject with reason. Optional setting: auto-approve products from trusted merchants. Sports-only rule enforced by the category whitelist plus review.
3. **Catalogue**: ShopCategory collection, admin-managed, seeded with the 14 categories in the brief. Keep the separate `sport` field (already on Product), so "Cricket equipment" = category `equipment` + sport `cricket` and clothing/shoes can also be filtered by sport.
4. **Cart**: stays client-side (`CartContext`). Prices and stock are re-validated server-side at checkout (existing behaviour).
5. **Checkout** (one transaction): create parent `Order` → group lines by store → one `SellerOrder` per store → atomic stock decrement per product or **variant** (`$elemMatch` + positional `$inc`) → Payment for the parent total. Payment methods: `cash_on_delivery` (the practical way to sell in Nepal without a gateway; merchant marks it delivered/paid), `manual`, `test`.
6. **Fulfilment** per SellerOrder: `confirmed → processing → shipped (tracking) → delivered`, or `cancelled` (restock) / `returned`. Each change is written to `statusHistory` and triggers a buyer notification. The parent order shows the combined status.
7. Merchants only ever see their own SellerOrders, with their own subtotal (fixes N7).
8. **Reviews**: only from buyers with a delivered SellerOrder containing that product; merchants can reply; staff can hide.
9. **Wishlist**: WishlistItem.
10. **Sales dashboard**: aggregation over the merchant's SellerOrders (revenue **records** by day, top products, order counts by status).

## N. Main admin and staff management

- **Overview** (one aggregation endpoint, cached 60 s): users (total/active/suspended/banned), players active in the last 30 days, teams, merchants (approved/pending), grounds, tournaments by status, matches (verified/disputed), bookings, orders and revenue **records** (clearly labelled "recorded, not settled"), active subscriptions by plan, pending approvals per queue, open reports, and recent audit activity.
- **Approval queues** share one component pattern: list → detail → approve/reject with a required reason → audit + notification.
- **Users**: search, view (profile, teams, orders, reports), edit safe fields, suspend, ban + blacklist, reactivate. Existing `setUserStatus` is reused and the Super Admin guard is added.
- **Staff**: Super Admin creates staff from existing users or invites by email, assigns a StaffRole and optional overrides; role editor with a permission checklist grouped by area.
- **Content**: categories, sports (activate new sports), announcements, platform settings.
- **Audit log** viewer over the existing `/admin/audit-logs`, with filters.

---

## O. Recommended development phases (adjusted for dependencies)

Compared with the brief's order, I made three changes, each driven by a dependency in the code:

1. **The notification core moves into Phase 1.** Team invitations, challenges, reports and approvals in later phases all emit notifications, so the service must exist first. Only the inbox UI and email templates stay in Phase 10.
2. **Admin approval screens are built inside each phase that needs them**: tournaments (5), grounds (6), merchants and products (8). Otherwise those phases can't be completed or tested. The admin shell and permission system come in Phase 1; Phase 9 adds the overview, users, staff and settings screens.
3. **An entitlements facade arrives in Phase 1** as a thin wrapper over today's `isPremium`. Phases 2–6 call `entitlements` instead of `isPremium`, so Phase 7 only swaps the data source.

| Phase | Scope | Models | Backend | Frontend | Depends on | Tests |
|---|---|---|---|---|---|---|
| **1 — Foundations: RBAC, profiles, locations, notifications core** | Permission RBAC + Super Admin + StaffRole; User profile fields, username, privacy, change password; Location hierarchy + geo; Sport as data (remove enum, N16); Setting; Notification model + `notify()` service; EntitlementService facade; fix N1, N6, N8, N10 | StaffRole, Location, Setting, Notification; User/Sport changes | `requirePermission`, `/admin/staff*`, `/auth/me/*`, `/locations`, `/notifications` (API) | Admin shell + staff screens, profile & security pages, location picker, navbar bell (count only) | — | escalation matrix (staff can't self-grant, last Super Admin protected), username uniqueness and case, privacy filtering, sport added as data |
| **2 — Player discovery & team management** | Unique team names + slug; TeamMembership with roles; invitations; leave/transfer; team profile; geo search for players and teams; fix N4, N5, N9, N13, N14 | TeamMembership; Team changes | team, invitation and discovery endpoints | Players & Teams search with filters and near-me; team management dashboard; invitations inbox | 1 | case-insensitive duplicate names under concurrency, role permissions matrix, invitation lifecycle, geo queries |
| **3 — Matchmaking & challenges** | Unified Match; counter-proposals; captain authority; challenge → match; "Find a Ground Near You"; optional booking hold; fix N3 | Match (generalized), Challenge changes | challenge counter/accept/nearby-grounds/book-ground; `/matches` | Matches page; challenge flow redesign with counter UI and ground suggestions | 2 | counter turn order, booking hold from challenge respects lock, no free slot blocking |
| **4 — Match reports, verification, statistics, rankings** | MatchReport; confirm/dispute; admin dispute queue; sport statDefinitions; StatLedger; rankings rebuilt from verified matches only; fix N2 | MatchReport, PlayerSportStats, TeamSportStats, StatLedger; Ranking changes | report endpoints, `/admin/match-reports`, stats endpoints | report form (per-sport fields), confirm/dispute UI, stats on player/team pages, disputes admin screen | 3 | unverified never counts; apply-once under double submit; reversal restores exact numbers; per-sport derived stats |
| **5 — Tournaments & fixtures** | Full lifecycle with 4-team rule + admin review; registrations; 5 formats; scheduling; points table; winner | TournamentRegistration, TournamentStanding; Tournament + Match changes | tournament endpoints; `/admin/tournaments` review | create/edit wizard, registration management, bracket and table views, admin review queue | 4 | state machine (no activation <4 or without approval), owner-diversity rule, generator unit tests per format, table tie-breakers |
| **6 — Grounds & bookings** | Ground owners; approval; multi-sport; opening hours; slots; cancel; pay-at-venue; owner dashboard; fix N11 | Ground + GroundBooking changes | `/owner/*`, slots, cancel; `/admin/grounds` | ground search with map-ready list, slot picker, owner dashboard (calendar), admin queue | 1 (geo), 3 | booking outside opening hours rejected, cancel policy, owner sees only own grounds, existing double-booking tests still pass |
| **7 — Subscriptions** | Plan catalogue; Subscription; MANUAL payments + proof + Finance verification; upgrade/downgrade/cancel; expiry sweep + reminders; payment statuses migrated | Plan, Subscription; Payment changes | `/plans`, `/subscriptions`, manual proof, `/admin/payments`, `/admin/plans` | plans page, subscription management, payment history, finance admin screens | 1 (entitlements) | entitlements from snapshot, plan edit doesn't affect existing subs, user can't self-verify, expiry |
| **8 — Multi-vendor marketplace** | Merchant application/approval; product moderation, slug/brand/SKU/discount/variants; SellerOrder + fulfilment; COD; reviews; wishlist; sales dashboard; categories; fix N7 | SellerOrder, Review, WishlistItem, ShopCategory; Store/Product/Order changes | `/merchant/*`, shop endpoints, `/admin/merchants`, `/admin/products` | merchant dashboard (new shell), product editor with variants, order timeline, reviews, wishlist | 7 (merchant plans), 1 | variant stock race, cross-merchant isolation, review only after delivery, transaction rollback on partial stock failure |
| **9 — Admin overview, users, moderation** | Overview KPIs; users management UI; reports/moderation; blacklist; announcements; settings UI; audit viewer | Report, Blacklist, Announcement | `/admin/overview`, `/reports`, `/admin/reports`, blacklist | full admin dashboard | 1–8 | each admin route denies without its permission (generated test over the route table) |
| **10 — Notifications UX, hardening, performance** | Inbox UI; email templates for key events; pagination audit; text indexes; N+1 fixes; refresh tokens (once a domain exists); shared rate-limit store if scaled; Cloudinary cleanup (N17); E2E tests; load test of booking and checkout | — | email adapter, indexes | notifications page, preferences | all | E2E happy paths per role; performance budget on list endpoints |

## P. Potential technical problems

1. **Data migrations on live data.** Every phase that changes a schema ships a `migrate:phaseN` script with `--dry-run`, run before the new unique indexes are built (team `nameKey`, `username`, product `slug`). The dev DB is empty, but production may not be. Please confirm (Q6).
2. **Case-insensitive uniqueness.** A collation index handles case but not whitespace or Unicode variants ("Kathmandu  Kings" vs "kathmandu kings"); a normalized `nameKey` field with a unique index handles both. Check availability up front, and treat a duplicate-key error (11000) as the final arbiter under races.
3. **Transactions in tests.** `mongodb-memory-server` runs standalone. Tests for transactional code must switch to `MongoMemoryReplSet`, which makes the suite slower; split into fast and slow suites.
4. **Geo data.** Nepal has 7 provinces, 77 districts and 753 local levels. Seeding them needs a reliable public dataset with centroids (decision Q5). Without a map API, coordinates come from browser geolocation (free, needs user consent) or the municipality centroid.
5. **Removing the sport enum** touches 8 models and the frontend `data/sports.ts`. Plan: a cached in-memory set of active sport slugs refreshed on change; the frontend fetches `/api/sports` instead of the static file.
6. **Embedded arrays to collections** (Team.members → TeamMembership, Tournament.teams → TournamentRegistration). For one release both are written, so old code paths and the frontend keep working; the old array becomes a read-only cache.
7. **Statistics correctness.** Idempotency and reversal must be designed in from the start (StatLedger); bolting them on later means rebuilding rankings.
8. **Notification volume.** Announcements are stored once (not fanned out); per-user notifications are TTL-expired; the bell polls every 60 s (no websockets needed on Render free tier, which sleeps).
9. **Render free tier sleeps.** The in-process sweeper doesn't run while asleep, so expiry is also checked lazily at read time (existing pattern). Move the sweeper to a Render cron or a paid instance before launch.
10. **Bundle size.** Five dashboards in one SPA → lazy-load each shell with `React.lazy` so public pages stay fast on mobile data.
11. **Money as floats.** The current NPR float fields risk rounding errors (`Math.round(x*100)/100` today). New money fields use integer paisa; existing ones are converted per module.

## Q. Estimated complexity and dependencies

Rough effort for one full-stack developer, including tests. These are relative sizes for planning, not commitments.

| Phase | Complexity | Rough effort | Main risk |
|---|---|---|---|
| 1 Foundations | L | 2–3 weeks | breadth (touches auth, admin, sports enum) |
| 2 Teams & discovery | M | 1.5–2 weeks | membership migration |
| 3 Challenges & matches | M | 1.5 weeks | Match generalization |
| 4 Reports & stats | L | 2–3 weeks | correctness, per-sport stat design |
| 5 Tournaments | XL | 3–4 weeks | 5 fixture formats + state machine |
| 6 Grounds | M | 2 weeks | slot computation |
| 7 Subscriptions | M | 1.5–2 weeks | entitlement migration |
| 8 Marketplace | XL | 3–4 weeks | variants, sub-orders, transactions |
| 9 Admin | M | 1.5–2 weeks | breadth of screens |
| 10 Hardening | M | 1.5–2 weeks | refresh tokens need a custom domain |

External dependencies (things only you can provide):
- Nepal location dataset (or approval to compile one).
- A custom domain, for httpOnly refresh cookies.
- A verified Resend domain, for email delivery to all users.
- Khalti/eSewa merchant accounts — not needed for this plan.

## R. Final recommended architecture

1. **Keep:** Express 5 + TypeScript + Mongoose; layered folders; shapers as the only response path; `AppError`; audit log; `withLock`; atomic status transitions; Cloudinary; React 19 + Vite + Tailwind 4 + Context.
2. **Add on the backend:**
   - `config/permissions.ts`, `middleware/requirePermission.ts`
   - `services/entitlementsService.ts`, `services/notificationService.ts` (channel adapters: inApp, email; push later)
   - `services/statistics/`, `services/fixtures/` (pure generators)
   - `services/paymentProviders/` (TEST, MANUAL; gateway later)
   - `utils/transaction.ts` (`withTransaction`)
   - `utils/geo.ts`
3. **Validation:** add **Zod** for new and changed endpoints (`validators/<domain>.ts`, a `validate(schema)` middleware). The new request bodies (tournament wizard, product variants, match reports with per-sport stats) are too large for the current hand-written checks to stay readable. Existing hand-written validators stay until their endpoint is touched. Zod schemas can also be shared with the frontend later.
4. **Frontend:**
   - One app, lazy-loaded dashboard shells (`/me`, `/merchant`, `/owner`, `/admin`).
   - Add **TanStack Query** for server state (caching, pagination, refetching the notification count), because five data-heavy dashboards built on hand-rolled `useEffect` fetches will duplicate loading/error logic everywhere. Context stays for auth and cart.
   - Shared constants (sports, provinces, categories) are fetched from the API instead of duplicated in `src/data/`.
5. **Data:** Atlas replica set with transactions; `2dsphere` indexes on User, Team, Ground and Tournament; text indexes on Product (name, brand) and Team (name); paginated everything.
6. **Ops:** Render web service + Render cron (sweeper, expiry reminders); health check already exists; daily Atlas backups.

---

## Recommended database schema (summary)

```
User ─┬─< TeamMembership >─ Team ─< TournamentRegistration >─ Tournament ─< Match
      │                       │                                              │
      │                       └─< Challenge ──(accept)──────────────────────►┘
      │                                                                      │
      ├─< MatchReport (submittedBy) ──────────────────────────────── Match ──┘
      │        │ verified → StatisticsService (transaction, StatLedger)
      │        ▼
      ├── PlayerSportStats / PlayerRanking          TeamSportStats / TeamRanking ── Team
      │
      ├─< Ground (owner) ─< GroundBooking >─ User          GroundBooking ─? Challenge
      │
      ├── Store (owner) ─< Product (variants[]) ─< Review >─ User
      │        └─< SellerOrder >─ Order (buyer) ── Payment
      │
      ├─< Subscription (subscriber: User|Team|Store) >─ Plan ;  Subscription ─< Payment
      ├─< Notification ; Announcement ; Report ; WishlistItem
      └── StaffRole (staffRole) ; AuditLog (actor)

Reference data: Sport (statDefinitions, rankingRules) · Location (province>district>municipality) ·
ShopCategory · Setting · Blacklist · Lock
```

## Feature checklist

Legend: ✅ done · 🟡 partial · ⬜ missing. The number after each item is its phase.

**Accounts & profiles**
- ✅ register / login / reset / logout-all / suspension
- 🟡 profile fields (1)
- ⬜ username (1)
- ⬜ change password (1)
- ⬜ privacy settings (1)
- ⬜ location hierarchy + geo (1)
- 🟡 player dashboard (1–4)

**RBAC & admin**
- 🟡 admin role (API only)
- ⬜ Super Admin hierarchy (1)
- ⬜ staff roles & permissions (1)
- ⬜ admin UI (1, 5, 6, 8, 9)
- ✅ audit log
- ⬜ reports & moderation (9)
- ⬜ blacklist (9)
- ⬜ settings (1, 9)
- ⬜ announcements (9)

**Teams**
- 🟡 create / join / remove
- ⬜ unique name + slug (2)
- ⬜ roles: captain / vice-captain (2)
- ⬜ invitations (2)
- ⬜ leave / transfer (2)
- ⬜ team profile (2)
- 🟡 team dashboard (2)

**Discovery & challenges**
- 🟡 player/team lists (2)
- ⬜ near-me geo search (2)
- 🟡 challenges (3)
- ⬜ counter-proposal (3)
- ⬜ captain authority (3)
- ⬜ find a ground after accept (3)
- ⬜ optional booking from challenge (3)

**Matches & statistics**
- ⬜ unified matches (3)
- ⬜ match reports (4)
- ⬜ confirm / dispute (4)
- ⬜ admin dispute resolution (4)
- ⬜ sport-specific stats (4)
- 🟡 rankings (4: verified-only, configurable)

**Tournaments**
- 🟡 single elimination
- ⬜ registration requests (5)
- ⬜ 4-team eligibility + admin approval (5)
- ⬜ league / round robin / groups / groups + knockout (5)
- ⬜ scheduling (5)
- ⬜ points table (5)
- ⬜ poster / rules / fees / prizes (5)

**Grounds**
- 🟡 list / detail / availability
- ✅ no double booking
- ⬜ owners + approval (6)
- ⬜ multi-sport, images, opening hours (6)
- ⬜ slot picker (6)
- ⬜ cancel (6)
- ⬜ pay at venue (6)
- ⬜ owner dashboard (6)

**Subscriptions**
- 🟡 player premium (test payments)
- ⬜ plan catalogue (7)
- ⬜ team / merchant plans (7)
- ⬜ manual payment verification (7)
- ⬜ cancel / upgrade / downgrade (7)
- ⬜ expiry reminders (7)
- ⬜ payment history (7)

**Shop**
- 🟡 stores / products / orders
- ✅ stock safety
- ⬜ merchant approval (8)
- ⬜ product moderation (8)
- ⬜ slug / brand / SKU / discount / variants (8)
- ⬜ seller sub-orders + fulfilment (8)
- ⬜ cash on delivery (8)
- ⬜ reviews (8)
- ⬜ wishlist (8)
- ⬜ sales dashboard (8)
- ⬜ admin categories (8)

**Notifications**
- ⬜ model / service (1)
- ⬜ inbox (10)
- ⬜ email templates (10)
- ⬜ push (later)

**Hardening**
- ✅ rate limits / sanitization / upload safety
- ⬜ refresh tokens (10, needs domain)
- ⬜ pagination everywhere (per phase, 10)
- ⬜ E2E tests (10)

## Phased implementation roadmap

Phase 1 → 2 → 3 → 4 → 5, with 6 able to start after 3 and 7 after 1 (parallel tracks if a second developer joins). 8 needs 7. 9 and 10 close out. See table O for each phase's contents, dependencies and tests.

## First recommended implementation task

**Phase 1, step 1 — Permission-based RBAC with a protected Super Admin (backend only, with tests).**

Why this first: it is the root of every later approval workflow (tournaments, grounds, merchants, disputes, finance), it closes the one open **High** finding that grows with every new staff account (N1), and the database is empty, so the change carries no data risk.

Scope:
1. `config/permissions.ts`: permission catalogue + default role templates.
2. `StaffRole` model; `User.isSuperAdmin`, `User.staffRole`, `User.permissionOverrides`.
3. `middleware/requirePermission.ts` + `getEffectivePermissions(user)`.
4. Convert the 4 existing admin routes from `requireRole("admin")` to specific permissions. `requireRole` stays for compatibility.
5. Escalation guards (I.1 rules 1–5) in `adminService`, plus `/admin/staff` and `/admin/staff-roles` endpoints.
6. `createAdmin` script creates a Super Admin; a `migrate:phase3-rbac` script promotes the earliest existing admin.
7. `/auth/me` returns `permissions[]` (frontend use comes in step 2: the admin shell).
8. Tests: the full escalation matrix (self-grant, granting unheld permissions, editing a Super Admin, removing the last Super Admin, every admin route denied without its permission). All 43 existing tests must keep passing.

Estimated effort: 2–3 days.

## Progress

| Phase | Status | Notes |
|---|---|---|
| Rankings | **Removed** (2026-11-26, at the user's request) | Leaderboards, ranking models and routes deleted, so finding **N2** no longer applies. Verified records and stats (Phase 4) remain. |
| 1 — RBAC, profiles, locations, notifications | **Done** | Permission RBAC + protected Super Admin (fixes N1); usernames, profile fields, privacy, change password; 77 districts + near-me geo search; sports as data; notification inbox and announcements; blacklist on ban; reset links never logged in production (N6); directory hides blocked/staff (N8). Admin console shell. |
| 2 — Teams | **Done** | Unique names (case/spacing-insensitive, race-safe), slugs, owner/captain/vice-captain roles, invitations, leave, transfer, sport lock (N5), roster limits, race-safe free-plan limit (N13), team delete calls off challenges (N14), location search. Roles stored on the team (no separate membership collection). |
| 3 — Challenges & matches | **Done** | Captains act for teams, counter-proposals, accepted challenge → Match, "Find a Ground Near You" + optional booking; challenges no longer hold ground slots for free (N3); unanswered challenges expire. |
| 4 — Results & stats | **Done** | Match reports, confirm/dispute, staff dispute resolution, auto-verify after 72 h, per-sport stat definitions, verified-only team/player records, streaks. Tournament results also need confirmation before the bracket moves (deviation from Q2: avoids undoing later rounds). |
| 5 — Tournaments | **Done** | Registration requests, 4-team eligibility (≥2 owners besides the organizer), staff approval, 5 formats with tested fixture generators, scheduling, standings, champion, cancellation. |
| 6 — Grounds | **Done** | Owner listings + staff approval, multi-sport, opening hours, slots, pay at venue, cancellation cutoff (N11), owner dashboard, blocks. |
| 7 — Subscriptions & payments | **On hold** (user's decision: no Khalti/eSewa access yet) | Backend exists (plans, subscriptions, manual payments, refunds, entitlement caches) but has no dedicated tests yet and no new UI; add both when a gateway is connected. Bookings use pay-at-venue and the shop uses cash on delivery meanwhile. |
| 8 — Shop | **Done** | Merchant applications + approval, product moderation, variants, sale prices, per-shop seller orders with fulfilment (fixes N7), cash on delivery, reviews, wishlist, sales dashboard, staff-managed categories. |
| 9 — Admin | **Done** | Overview, reports/moderation queue, platform settings (Super Admin), user edits, plus all approval queues above. |
| 10 — Hardening | **Done (part)** | Email channel for important notifications (when SMTP is set, opt-out in privacy), rate limits on spam-prone actions, docs. Still open: refresh-token cookies (needs a same-site custom domain, S5), shared rate-limit store if scaled out (S14), Cloudinary cleanup of replaced images (N17), end-to-end browser tests. |

Tests: 183 backend tests across 17 files (`npm test`), all passing.

Decisions: the defaults below were accepted on 2026-11-26.

## Open decisions (need your answer before the phase that uses them)

| # | Question | My default if you don't decide | Phase |
|---|---|---|---|
| Q1 | Auto-verify a match report if the opponent doesn't respond? After how long? | Yes, after 72 hours | 4 |
| Q2 | In approved tournaments, is the organizer's result final, or does the opponent still confirm? | Organizer's result advances the bracket, but the opponent can still dispute within 72 h before it counts for rankings | 4–5 |
| Q3 | Existing tournaments created before the approval workflow: treat as approved (legacy) or force re-review? | Legacy-approved, excluded from official rankings | 5 |
| Q4 | When 4 teams are eligible, submit for admin review automatically or let the organizer submit? | Organizer submits (they may want more teams first) | 5 |
| Q5 | Source for Nepal's 753 local levels + centroids? | I compile one from public government data and you review it | 1 |
| Q6 | Is there a production database with real users/data, or is the Atlas DB in this `.env` the only one? | Treat production as possibly non-empty; migrations always dry-run first | all |
| Q7 | Can a player be in more than one team **of the same sport**? | Yes (the brief allows multiple teams); a tournament roster can't share players across two entered teams | 2, 5 |
| Q8 | Platform commission on shop sales or ground bookings? | None now; the data model records gross amounts so a commission can be added later | 6, 8 |
| Q9 | Will you get a custom domain (e.g. `thearena.com.np`)? | Refresh-token work waits until you do | 10 |
