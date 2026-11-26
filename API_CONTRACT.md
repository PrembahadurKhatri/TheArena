# The Arena — API contract (v1 / MVP)

This is the single source of truth for the REST API shared between `backend/` and
`frontend/`. Both sides must match this exactly — do not invent alternate shapes
or paths. Base URL from the frontend is `/api` (proxied to `http://localhost:5050`
by Vite in dev — see `frontend/vite.config.ts`).

## Sport slugs (fixed, exactly these 10 — used as plain strings everywhere)

```
cricket, football, tennis, table-tennis, volleyball, hockey, badminton, basketball, kabaddi, futsal
```

These are defined in `frontend/src/data/sports.ts` (`SPORTS` array — already written, do
not change the slugs). The backend seeds a `Sport` collection with the same slugs
(name, slug, order) purely so `GET /api/sports` can drive filter dropdowns — every
OTHER model (`Team`, `Tournament`, `Ground`, etc.) stores `sport` as a
**plain lowercase slug string** (not an ObjectId ref), validated against this fixed list.
This keeps queries simple (`Team.find({ sport: "cricket" })`, no populate needed).

## Provinces (fixed, exactly these 7 — Nepal's provinces, used as plain strings)

```
Koshi Province, Madhesh Province, Bagmati Province, Gandaki Province, Lumbini Province, Karnali Province, Sudurpashchim Province
```

Defined in `backend/src/utils/provinces.ts` and mirrored in `frontend/src/data/provinces.ts`.
A user's `province` (set at registration, editable later) and a tournament's `province`
(set by its organizer at creation) are matched against each other to power the
Tournaments page's "Near Me" filter — see `GET /api/tournaments` below.

## Auth

- `POST /api/auth/register` — body `{ name, email, password, phone?, location?, province? }` → `201 { token, user }`. Password min 8 chars; email must be valid. Rate-limited (with login/reset) to 20 requests / 15 min per IP → `429`.
- `POST /api/auth/login` — body `{ email, password }` → `200 { token, user }`
- `GET /api/auth/me` — Bearer token → `200 { user }`
- `PATCH /api/auth/me` — Bearer token, multipart if `photo` file included, else JSON. Body: any of `{ name, phone, photo, location, province, sportPreferences[] }` → `200 { user }`
- `POST /api/auth/forgot-password` — body `{ email }` → `200 { message }` (rate-limited 5/hour per IP; the reset token is stored only as a SHA-256 hash, valid 1 hour, single use) (emails a reset link if SMTP configured, else logs the link to console — see `backend/src/utils/sendEmail.ts` pattern)
- `POST /api/auth/reset-password/:token` — body `{ password }` → `200 { message }`

**`user` object shape** (returned everywhere a user is embedded):
```ts
{
  id: string
  name: string
  email: string
  phone?: string
  photo?: string | null   // "/uploads/xxx.jpg" or null
  location?: string       // free-text, e.g. "Pokhara"
  province?: string       // one of the 7 provinces above
  isPremium: boolean
  membershipExpiresAt: string | null // ISO date
  role: "player" | "admin"
  sportPreferences: string[] // sport slugs
}
```

Auth middleware: `Authorization: Bearer <jwt>` header. JWT payload `{ id, role }`, secret
from `process.env.JWT_SECRET`, 7-day expiry. Protected routes use
`backend/src/middleware/verifyToken.ts`. A `backend/src/middleware/requirePremium.ts`
middleware runs AFTER `verifyToken` and 403s with `{ message: "Premium membership required" }`
if `req.user.isPremium` is false or `membershipExpiresAt` has passed.

## Sports

- `GET /api/sports` → `200 { sports: [{ slug, name, order }] }` (public, seeded data)

## Teams

- `GET /api/teams?sport=<slug>&search=<q>` → `200 { teams: [TeamSummary] }` (public)
- `GET /api/teams/:id` → `200 { team: TeamDetail }` (public)
- `GET /api/my/teams` — auth required. Returns teams the caller owns or is a member of → `200 { teams: [TeamSummary] }`
- `POST /api/teams` — auth required. Multipart form: `{ name, sport, logo? }`.
  **Free users are capped at 1 owned team** — if they already own one, respond
  `403 { message: "Free plan is limited to 1 team. Upgrade to Premium for unlimited teams." }`.
  Premium users have no cap. → `201 { team }`
- `PATCH /api/teams/:id` — owner only → `200 { team }`
- `DELETE /api/teams/:id` — owner only → `200 { message }`
- `POST /api/teams/:id/join-requests` — auth required, adds requester to team's pending list → `200 { team }`
- `PATCH /api/teams/:id/join-requests/:userId` — owner only, body `{ action: "accept" | "reject" }` → `200 { team }`
- `DELETE /api/teams/:id/members/:userId` — owner only → `200 { team }`

`TeamSummary`: `{ id, name, sport, logo, memberCount, owner: { id, name } }`
`TeamDetail`: `TeamSummary & { members: [{ id, name, photo }], pendingRequests: [{ id, name }] }` (pendingRequests only included when caller is the owner)

## Players

- `GET /api/players?sport=<slug>&search=<q>` → `200 { players: [PlayerSummary] }` (public — lists users with that sport in `sportPreferences`)
- `GET /api/players/:id` → `200 { player }` — `PlayerProfile` (with `email`/`phone`) only when the viewer is that player (optional Bearer token); everyone else gets `PlayerSummary`.

`PlayerSummary`: `{ id, name, photo, sportPreferences, isPremium }`

## Tournaments

- `GET /api/tournaments?sport=<slug>&status=<upcoming|ongoing|completed>&province=<province>` → `200 { tournaments: [TournamentSummary] }`. The frontend's "Near Me" toggle passes the logged-in user's own `province` as this param — it's a plain equality filter, nothing geo/coordinate-based.
- `GET /api/tournaments/:id` → `200 { tournament: TournamentDetail }` (includes `matches[]`)
- `POST /api/tournaments` — auth + **premium required** (`requirePremium` middleware). Body `{ name, sport, maxTeams, startDate, province, description?, location? }` → `201 { tournament }`. `province` is required (one of the 7 provinces); `location` is optional free text (e.g. a venue name).
- `POST /api/tournaments/:id/register-team` — auth, caller must own the team. Body `{ teamId }` → `200 { tournament }`. 400 if already full or already started.
- `POST /api/tournaments/:id/start` — organizer only. Generates a single-elimination bracket from registered teams (shuffle, create round-1 `Match` docs with `round: 1`) and sets `status: "ongoing"` → `200 { tournament, matches }`
- `PATCH /api/tournaments/:id/matches/:matchId` — organizer only. Body `{ scoreA, scoreB, winnerTeamId }`. Marks the match `completed`, and if every match in the current round is complete, auto-generates the next round's matches (`round: currentRound + 1`) pairing winners, until a final winner exists (then `tournament.status = "completed"`, `tournament.winner = teamId`). → `200 { tournament, matches }`
- `GET /api/tournaments/:id/standings` → `200 { standings: [{ team, wins, losses }] }`

`TournamentSummary`: `{ id, name, sport, status, maxTeams, teamsCount, startDate, organizer: { id, name }, province, location? }`
`TournamentDetail`: `TournamentSummary & { teams: [TeamSummary], matches: [{ id, round, teamA, teamB, scoreA, scoreB, winner, status }], description }`

## Grounds & bookings

- `GET /api/grounds?sport=<slug>&search=<q>` → `200 { grounds: [GroundSummary] }` (public)
- `GET /api/grounds/:id` → `200 { ground: GroundDetail }`
- `POST /api/ground-bookings` — auth. Body `{ groundId, date, startTime, endTime }`. Server computes `hours` and `totalAmount = ground.pricePerHour * hours`, applying a **10% discount if `req.user.isPremium`**. Creates booking `status: "pending_payment"` → `201 { booking }`.
  `date` is `YYYY-MM-DD`, times are Nepal time (`HH:MM`); past slots, >12h and >90 days ahead are rejected (`400`). Overlapping a confirmed booking, or an unpaid one less than `BOOKING_HOLD_MINUTES` (15) old, → `409`. Unpaid bookings are auto-cancelled after the hold expires. The premium discount only applies while membership is unexpired.
- `GET /api/my/bookings` — auth → `200 { bookings: [BookingSummary] }`

`GroundSummary`: `{ id, name, sport, location, pricePerHour, image }`
`BookingSummary`: `{ id, ground: GroundSummary, date, startTime, endTime, totalAmount, status, payment: PaymentSummary | null }`

`status` values: `pending_payment | confirmed | cancelled`

## Payments (shared TEST-mode flow — ground bookings, membership, AND shop orders)

This is the "real, not fake" part — a real DB-backed flow with a clearly-labeled
sandbox confirm step standing in for a live Khalti/eSewa call (no live keys yet).

- `POST /api/payments/checkout` — auth. Body `{ type: "ground_booking" | "membership" | "shop_order", refId, plan? }`
  - `type: "ground_booking"`: `refId` = booking id. Amount = `booking.totalAmount`.
  - `type: "membership"`: `refId` omitted, `plan` = `"monthly" | "yearly"`. Amount from
    `process.env.MEMBERSHIP_MONTHLY_PRICE` / `MEMBERSHIP_YEARLY_PRICE`.
  - `type: "shop_order"`: `refId` = order id. Amount = `order.totalAmount`.
  - Creates a `Payment` doc, `status: "pending"`, `provider: "TEST"`. → `201 { payment: PaymentSummary }`
  - Idempotent: if a pending payment already exists for that booking/order (or the same membership plan), it is returned instead of creating a second one.
- `POST /api/payments/:id/confirm` — auth, must own the payment. Simulates the gateway
  callback. **Only allowed when test payments are enabled** (`PAYMENT_MODE=test`; default on in development, off in production → `503`). Atomic: a payment can only be confirmed once (`400`/`409` otherwise). If the booking/order expired or the slot was taken meanwhile → payment marked failed, `409`. On success sets `payment.status = "success"`, and:
  - if `type === "ground_booking"`: sets that `GroundBooking.status = "confirmed"`
  - if `type === "membership"`: creates/extends a `Membership` doc and sets
    `user.isPremium = true`, `user.membershipExpiresAt` (+30 days for monthly, +365 for yearly)
  - if `type === "shop_order"`: sets that `Order.status = "paid"`
  → `200 { payment, redirect: "/dashboard" }`
- `POST /api/payments/:id/fail` — auth. Sets `payment.status = "failed"` → `200 { payment }`. Also cancels the booking, or cancels the order and restores its stock.

`PaymentSummary`: `{ id, type, amount, status, provider, createdAt }`

## Membership

- `GET /api/membership/me` — auth → `200 { isPremium, membershipExpiresAt, activeMembership: MembershipSummary | null }`

Checkout for membership goes through the shared `/api/payments/checkout` + `/confirm`
flow above with `type: "membership"`.


## Shop (multi-vendor marketplace — sports gear)

A self-serve marketplace bolted onto The Arena: any logged-in user can open ONE
store and list products (bats, balls, jerseys, boots, etc.); anyone (including
guests) can browse and buy. Checkout reuses the shared TEST-mode payments flow
above with `type: "shop_order"`. This is intentionally free/self-serve — no
premium gate, no admin approval step (there's no admin panel yet — see the
"Deferred to phase 2" list at the end of this doc).

### Product categories (fixed, exactly these — used as plain strings)

```
Bats, Balls, Jerseys, Footwear, Protective Gear, Rackets, Accessories, Other
```

Defined in `frontend/src/data/shopCategories.ts` and mirrored in
`backend/src/utils/shopCategories.ts`. A product's `sport` field is optional and,
when set, must be one of the 10 sport slugs (same list as everywhere else) — some
products are generic (e.g. a water bottle) and don't belong to one sport.

### Stores

- `GET /api/shop/stores` → `200 { stores: [StoreSummary] }` (public)
- `GET /api/shop/stores/:id` → `200 { store: StoreDetail }` (public; `products` is that store's full active catalog)
- `GET /api/shop/stores/mine` — auth → `200 { store: StoreDetail | null }` (null if the caller hasn't opened a store yet)
- `POST /api/shop/stores` — auth, multipart if `logo` file included. Body `{ name, description? }`. 409 if the caller already owns a store (one store per user). → `201 { store }`
- `PATCH /api/shop/stores/:id` — owner only. Same body shape as create → `200 { store }`

`StoreSummary`: `{ id, name, description?, logo: string | null, owner: ApiUserRef, productCount }`
`StoreDetail`: `StoreSummary & { products: [ProductSummary] }`

### Products

- `GET /api/shop/products?sport=<slug>&category=<name>&search=<q>&storeId=<id>&minPrice=<n>&maxPrice=<n>&inStock=1&sort=<newest|price_asc|price_desc|name_asc>` → `200 { products: [ProductSummary] }` (public — all filters optional and combinable; `sort` defaults to `newest`; a negative or non-numeric price bound is a 400)
- `GET /api/shop/products/:id` → `200 { product: ProductDetail }` (public)
- `POST /api/shop/products` — auth, caller must own a store, multipart if `images` files included. Body `{ name, description?, category, sport?, price, stock }` → `201 { product }`
- `PATCH /api/shop/products/:id` — store owner only → `200 { product }`
- `DELETE /api/shop/products/:id` — store owner only → `200 { message }`

`ProductSummary`: `{ id, name, price, stock, images: string[], category, sport?: string, store: { id, name } }`
`ProductDetail`: `ProductSummary & { description?: string }`

### Cart

There is **no server-side cart** — the cart lives client-side only
(`frontend/src/context/CartContext.tsx`, persisted to `localStorage`, holds
`{ productId, name, price, image, storeId, storeName, quantity }[]`). The server
never trusts client-sent prices: checkout below re-derives everything from the
live `Product` documents.

### Orders / Checkout

- `POST /api/shop/orders` — auth. Body `{ items: [{ productId, quantity }], shippingAddress, shippingProvince?, contactName?, contactPhone? }`.
  Server re-reads each `Product` fresh, 400s if any item's `quantity` exceeds
  current `stock`, computes `totalAmount` server-side (never trusts a client
  price), **reserves stock immediately with an atomic conditional decrement** (no overselling under concurrency; duplicate lines for one product are merged; quantity must be a positive integer), and snapshots each line item's
  name/price/store at purchase time (so later store/price edits don't rewrite
  order history). Creates `Order` with `status: "pending_payment"` →
  `201 { order }`. Checkout continues through the shared
  `POST /api/payments/checkout` (`type: "shop_order"`, `refId: order.id`) +
  `POST /api/payments/:id/confirm` flow — confirming sets `order.status = "paid"`.
- `GET /api/my/orders` — auth, buyer's own order history → `200 { orders: [OrderSummary] }`
- `GET /api/shop/stores/:id/orders` — store owner only. Every order containing at
  least one of their products, with `items` filtered down to just that store's
  line items → `200 { orders: [OrderSummary] }` (used by the seller dashboard)

`OrderItem`: `{ product: string | null, store: { id, name }, name, price, quantity, image: string | null }`
(`product` is the id at time of purchase — may point at a since-deleted product, hence nullable in spirit even though it's stored as an id)
`OrderSummary`: `{ id, items: OrderItem[], totalAmount, status, shippingAddress, shippingProvince?, createdAt, payment: PaymentSummary | null }`

`status` values: `pending_payment | paid | cancelled`. An unpaid order is cancelled and its stock restored when its payment fails, or automatically after `ORDER_HOLD_MINUTES` (30).

## Admin API (staff only)

All routes are under `/api/admin`, require `Authorization`, and return 403 to anyone who isn't staff (`role: "admin"`). Permissions are read from the database on every request; the catalogue is in `backend/src/config/permissions.ts`.

- A **Super Admin** holds every permission. Other staff hold their `StaffRole`'s permissions, plus `permissionOverrides.grant`, minus `permissionOverrides.revoke`.
- `staff.manage` and `settings.manage` are **reserved**: they can't be put in a role or granted, so only Super Admins manage staff.
- Nobody can change their own staff access or status. The last active Super Admin can't be removed, demoted or blocked. Staff accounts can only be suspended/banned by a Super Admin.

| Route | Needs | Notes |
|---|---|---|
| `GET /me/permissions` | any staff | `{ isSuperAdmin, permissions[], catalogue: [{ key, label }] }` |
| `GET /users?search&status&role&premium&page&limit` | `users.read` | `{ users[], total, page, pages, limit }` |
| `PATCH /users/:id/status` | `users.suspend` (+ `users.blacklist` to ban or unban) | body `{ status: active|suspended|banned, reason }` (reason required unless active) |
| `PATCH /users/:id/role` | Super Admin | body `{ role, reason? }`. Promoting gives staff with no permissions; demoting clears all staff fields |
| `GET /audit-logs?action&actor&targetId&page&limit` | `audit.read` | |
| `GET /staff?page&limit` | Super Admin | `{ staff: [StaffMember], ...page }` |
| `POST /staff` | Super Admin | body `{ userId, staffRoleId?, grant?, revoke?, reason? }` → `201 { staff }` |
| `PATCH /staff/:id` | Super Admin | body `{ staffRoleId?, grant?, revoke?, reason? }` (`staffRoleId: null` removes the role) |
| `DELETE /staff/:id` | Super Admin | back to player → `{ user }` |
| `PATCH /staff/:id/super-admin` | Super Admin | body `{ value: boolean, reason? }` |
| `GET /staff-roles` | Super Admin | `{ roles: [StaffRole & { memberCount }] }` |
| `POST /staff-roles` | Super Admin | body `{ key, name, description?, permissions[] }` → `201 { role }` |
| `PATCH /staff-roles/:id` | Super Admin | `key` can't change |
| `DELETE /staff-roles/:id` | Super Admin | 400 for built-in roles, 409 while assigned |

`StaffMember`: admin user fields + `{ staffRole: { id, key, name } | null, permissionOverrides: { grant[], revoke[] }, effectivePermissions[] }`
`StaffRole`: `{ id, key, name, description, permissions[], isSystem, createdAt, updatedAt }`

Built-in role templates (editable, not deletable; created by `npm run migrate:rbac`, `npm run seed` and `npm run create-admin`): HR Manager, Tournament Manager, Merchant Manager, Ground Manager, Support Manager, Finance Manager, Content Manager.

## Added in the master-plan phases (docs/MASTER_PLAN.md)

The sections above describe the original endpoints; they still work. Everything below was added since. All list endpoints accept `?page&limit` and return `{ <items>, page, limit, total, pages }`. "Manager" of a team = its owner or captain.

### Accounts, profiles, discovery (Phase 1)
- `PATCH /api/auth/me` also takes `bio, dateOfBirth, gender, district, municipality, lat, lng, sportProfiles[{sport, position, experienceLevel}], privacy{showEmail, showPhone, showLocation, showAge, discoverable, emailNotifications}`. District decides the province.
- `PATCH /api/auth/me/password` `{ currentPassword, newPassword }` → `{ token }` (other sessions signed out). `PATCH /api/auth/me/username` `{ username }`. `GET /api/auth/username-available?u=`.
- Register accepts optional `username` and `district`; a username is generated when omitted (unique, case-insensitive).
- `/auth/me` includes `entitlements`; staff also get `isSuperAdmin, permissions[]`.
- `GET /api/players?sport&search&province&district&lat&lng&radiusKm&experience&position&page` — only active, discoverable players; experience/position and radius > 10 km are Premium. `GET /api/players/:idOrUsername` respects privacy. `GET /api/players/:id/stats`, `/matches`.
- `GET /api/meta/locations` (7 provinces → 77 districts), `/api/meta/profile-options`, `/api/meta/announcements`.
- `GET /api/notifications?unread&page`, `GET /api/notifications/unread-count`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`.
- `POST /api/reports` `{ targetType: user|team|store|product|review|match|tournament|ground, targetId, reason, details? }`.

### Teams (Phase 2)
- Team names are unique ignoring case/spacing; teams have `slug`, `description`, `coverImage`, location, `captainId`, `viceCaptainId`, `viewerRole`. `GET /api/teams/:idOrSlug`, `GET /api/teams/name-available?name=`, `GET /api/teams?sport&search&province&district&lat&lng&radiusKm&page`.
- `POST/PATCH /api/teams` multipart fields `logo`, `cover`. Sport is locked once the team has a match or tournament entry.
- Join requests: `POST/DELETE /api/teams/:id/join-requests`, `PATCH .../join-requests/:userId {action}` (manager).
- Invitations: `POST /api/teams/:id/invitations {username|userId}` (manager), `DELETE .../invitations/:userId`, `POST .../invitations/respond {action: accept|decline}`, `GET /api/my/invitations`.
- `POST /api/teams/:id/leave`, `POST /api/teams/:id/transfer-ownership {userId}`, `PATCH /api/teams/:id/members/:userId/role {role: captain|vice_captain|player}` (owner). `GET /api/teams/:id/stats`, `/matches`.

### Challenges and matches (Phases 3–4)
- Challenges: statuses `open, pending, countered, accepted, declined, cancelled, completed, expired`; fields `awaiting, viewerSide, counterProposals[], matchId, bookingId, format`. Managers (owner or captain) act for teams.
- `POST /api/challenges/:id/counter {date, startTime, endTime, groundId?, venueNote?, message?}` (the awaited side; limit from settings). Accepting creates a Match.
- A ground named on a challenge does not hold the slot. `GET /api/challenges/:id/nearby-grounds?lat&lng&radiusKm`, `POST /api/challenges/:id/book-ground {groundId}` (normal booking flow).
- Matches: `GET /api/matches?status=upcoming|results|awaiting&sport&source&page`, `GET /api/my/matches`, `GET /api/matches/:id` → `{ match, reports, viewerAuthority, statDefinitions, autoVerifyHours }`.
- Results: `POST /api/matches/:id/reports {scoreA, scoreB, outcome?, detail?, players?[{user, side, stats}], notes?}`; `POST /api/matches/reports/:rid/confirm | dispute {reason} | withdraw`. Unanswered reports verify after `reportAutoVerifyHours`. Records and stats change only on verification.

### Tournaments (Phase 5)
- Statuses `open → under_review → approved | rejected → ongoing → completed | cancelled`. Formats `knockout, round_robin, league, group_stage, group_knockout`. Create needs Premium.
- `POST /api/tournaments/:id/registrations {teamId}` (manager), `PATCH .../registrations/:rid {action: approve|reject}` (organizer), `DELETE .../registrations/:rid`.
- `POST /api/tournaments/:id/submit-review` — needs ≥ 4 eligible approved teams from ≥ 2 owners besides the organizer. Staff: `GET /api/admin/tournaments`, `POST /api/admin/tournaments/:id/review {decision, note}`.
- `POST /:id/start` (approved only) generates fixtures; `PATCH /:id/matches/:mid` files the organizer's result report; `PATCH /:id/matches/:mid/schedule`; `POST /:id/cancel {reason}`; `GET /:id` returns `{ tournament, registrations, eligibility, standings, isOrganizer, viewerTeams }`. `GET /api/my/tournaments`.

### Grounds (Phase 6)
- Grounds have `owner, slug, sports[], images[], openingHours[7], slotMinutes, status (pending|approved|rejected|suspended)`. `GET /api/grounds?sport&district&province&minPrice&maxPrice&lat&lng&radiusKm&sort&page`, `GET /api/grounds/:id/slots?date`.
- Bookings: `POST /api/ground-bookings {…, paymentMethod: online|pay_at_venue}`, `POST /api/ground-bookings/:id/cancel` (before `bookingCancelCutoffHours`).
- Owners: `GET/POST /api/owner/grounds`, `PATCH /api/owner/grounds/:id`, `POST /api/owner/grounds/:id/blocks`, `GET /api/owner/bookings`, `POST /api/owner/bookings/:id/action {action: mark_paid|complete|no_show|cancel, reason?}`.

### Shop (Phase 8)
- Shops apply (`status: pending`) and are approved by staff; products need approval too (`draft, pending_review, active, rejected, archived`). Products have `slug, brand, sku, discountPrice, unitPrice, variants[{id,size,color,sku,stock}], rating`.
- Orders: `POST /api/shop/orders {items[{productId, variantId?, quantity}], paymentMethod: cod|online, …}` → one SellerOrder per shop. `GET /api/shop/orders/:id`, `POST /api/shop/seller-orders/:id/cancel` (buyer, before shipping), `PATCH /api/shop/seller-orders/:id/status {status, note?, carrier?, trackingCode?}` (merchant).
- `GET /api/shop/stores/:id/orders` now returns that shop's seller orders only. `GET /api/shop/stores/:id/sales`, `/reviews`. `GET/POST /api/shop/products/:id/reviews` (delivered buyers, once), `POST /api/shop/reviews/:id/reply`. Wishlist: `GET /api/shop/wishlist`, `POST/DELETE /api/shop/wishlist/:productId`. `GET /api/shop/categories`.

### Subscriptions and manual payments (Phase 7 — on hold)
Built but not exposed in the UI until a gateway is connected: `GET /api/plans`, `POST /api/subscriptions {planCode, subscriberId?, method: manual|test}`, `POST /api/subscriptions/:id/cancel`, `GET /api/my/subscriptions`, `GET /api/my/payments`, `POST /api/payments/:id/manual-proof {reference, proof?}`. Payment status `success` is now `paid`; new statuses `cancelled`, `refunded`.

### More admin endpoints
Each needs the permission shown (Super Admins hold all): users `GET /users/:id`, `PATCH /users/:id` (users.edit); `GET /blacklist`, `DELETE /blacklist/:id` (users.blacklist); announcements CRUD (announcements.manage); `GET/POST/PATCH /sports`, shop categories (categories.manage); teams list/status/delete (teams.moderate); `GET /match-reports` (reports.verify), `POST /match-reports/:id/resolve {decision: verify|amend|void, note}` (disputes.resolve); grounds review (grounds.review) and create/edit (grounds.manage); merchants (merchants.review); products and review visibility (products.review); `GET /orders` (orders.manage); plans (plans.manage); subscriptions (subscriptions.manage); payments read/verify/reject/refund (payments.*); `GET /overview` (analytics.read); reports (moderation.reports); `GET/PATCH /settings` (Super Admin). The full route→permission table is in `backend/tests/rbac.test.ts`.

## Error shape

Every error response: `{ message: string }`, appropriate HTTP status (400/401/403/404/409/429/500/503). 500 responses never include internal details or stack traces.

## Health

- `GET /api/health` → `200 { ok: true, db: "connected", paymentMode, uptimeSeconds }`, or `503` with `db: "disconnected"` while MongoDB is unreachable. Not rate-limited. Used as Render's health check path.

## Environment (backend/.env — already created, see backend/.env.example)

See `backend/.env.example` for the full, commented list. Required: `MONGO_URI`, `JWT_SECRET` (32+ chars in production), `CLIENT_URL` (comma-separated allowed origins; required in production), `MEMBERSHIP_MONTHLY_PRICE`, `MEMBERSHIP_YEARLY_PRICE`. Optional: `PAYMENT_MODE`, `SMTP_*`, `UPLOADS_DIR`, `BOOKING_HOLD_MINUTES`, `ORDER_HOLD_MINUTES`, rate-limit and seed settings.
