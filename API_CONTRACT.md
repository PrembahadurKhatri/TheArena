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
OTHER model (`Team`, `Tournament`, `Ground`, `PlayerRanking`, etc.) stores `sport` as a
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

- `POST /api/auth/register` — body `{ name, email, password, phone?, location?, province? }` → `201 { token, user }`
- `POST /api/auth/login` — body `{ email, password }` → `200 { token, user }`
- `GET /api/auth/me` — Bearer token → `200 { user }`
- `PATCH /api/auth/me` — Bearer token, multipart if `photo` file included, else JSON. Body: any of `{ name, phone, photo, location, province, sportPreferences[] }` → `200 { user }`
- `POST /api/auth/forgot-password` — body `{ email }` → `200 { message }` (emails a reset link if SMTP configured, else logs the link to console — see `backend/src/utils/sendEmail.ts` pattern)
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
- `GET /api/players/:id` → `200 { player: PlayerProfile } }` (public profile)

`PlayerSummary`: `{ id, name, photo, sportPreferences, isPremium }`

## Tournaments

- `GET /api/tournaments?sport=<slug>&status=<upcoming|ongoing|completed>&province=<province>` → `200 { tournaments: [TournamentSummary] }`. The frontend's "Near Me" toggle passes the logged-in user's own `province` as this param — it's a plain equality filter, nothing geo/coordinate-based.
- `GET /api/tournaments/:id` → `200 { tournament: TournamentDetail }` (includes `matches[]`)
- `POST /api/tournaments` — auth + **premium required** (`requirePremium` middleware). Body `{ name, sport, maxTeams, startDate, province, description?, location? }` → `201 { tournament }`. `province` is required (one of the 7 provinces); `location` is optional free text (e.g. a venue name).
- `POST /api/tournaments/:id/register-team` — auth, caller must own the team. Body `{ teamId }` → `200 { tournament }`. 400 if already full or already started.
- `POST /api/tournaments/:id/start` — organizer only. Generates a single-elimination bracket from registered teams (shuffle, create round-1 `Match` docs with `round: 1`) and sets `status: "ongoing"` → `200 { tournament, matches }`
- `PATCH /api/tournaments/:id/matches/:matchId` — organizer only. Body `{ scoreA, scoreB, winnerTeamId }`. Marks the match `completed`, and if every match in the current round is complete, auto-generates the next round's matches (`round: currentRound + 1`) pairing winners, until a final winner exists (then `tournament.status = "completed"`, `tournament.winner = teamId`). **Also updates `TeamRanking`/`PlayerRanking` win/loss points for that sport** on every match completion. → `200 { tournament, matches }`
- `GET /api/tournaments/:id/standings` → `200 { standings: [{ team, wins, losses }] }`

`TournamentSummary`: `{ id, name, sport, status, maxTeams, teamsCount, startDate, organizer: { id, name }, province, location? }`
`TournamentDetail`: `TournamentSummary & { teams: [TeamSummary], matches: [{ id, round, teamA, teamB, scoreA, scoreB, winner, status }], description }`

## Grounds & bookings

- `GET /api/grounds?sport=<slug>&search=<q>` → `200 { grounds: [GroundSummary] }` (public)
- `GET /api/grounds/:id` → `200 { ground: GroundDetail }`
- `POST /api/ground-bookings` — auth. Body `{ groundId, date, startTime, endTime }`. Server computes `hours` and `totalAmount = ground.pricePerHour * hours`, applying a **10% discount if `req.user.isPremium`**. Creates booking `status: "pending_payment"` → `201 { booking }`
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
- `POST /api/payments/:id/confirm` — auth, must own the payment. Simulates the gateway
  callback: sets `payment.status = "success"`, and:
  - if `type === "ground_booking"`: sets that `GroundBooking.status = "confirmed"`
  - if `type === "membership"`: creates/extends a `Membership` doc and sets
    `user.isPremium = true`, `user.membershipExpiresAt` (+30 days for monthly, +365 for yearly)
  - if `type === "shop_order"`: sets that `Order.status = "paid"`
  → `200 { payment, redirect: "/dashboard" }`
- `POST /api/payments/:id/fail` — auth. Sets `payment.status = "failed"` → `200 { payment }`

`PaymentSummary`: `{ id, type, amount, status, provider, createdAt }`

## Membership

- `GET /api/membership/me` — auth → `200 { isPremium, membershipExpiresAt, activeMembership: MembershipSummary | null }`

Checkout for membership goes through the shared `/api/payments/checkout` + `/confirm`
flow above with `type: "membership"`.

## Rankings

- `GET /api/rankings/players?sport=<slug>` → `200 { rankings: [{ rank, player: PlayerSummary, points, wins, losses, draws }] }`
- `GET /api/rankings/teams?sport=<slug>` → `200 { rankings: [{ rank, team: TeamSummary, points, wins, losses, draws }] }`

Rankings are NOT manually editable — they're recomputed/incremented only as a side
effect of `PATCH /api/tournaments/:id/matches/:matchId` marking a match complete.

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

- `GET /api/shop/products?sport=<slug>&category=<name>&search=<q>&storeId=<id>` → `200 { products: [ProductSummary] }` (public — all filters optional and combinable)
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

- `POST /api/shop/orders` — auth. Body `{ items: [{ productId, quantity }], shippingAddress, shippingProvince? }`.
  Server re-reads each `Product` fresh, 400s if any item's `quantity` exceeds
  current `stock`, computes `totalAmount` server-side (never trusts a client
  price), **decrements stock immediately**, and snapshots each line item's
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

`status` values: `pending_payment | paid | cancelled`

## Error shape

Every error response: `{ message: string }`, appropriate HTTP status (400/401/403/404/409/500).

## Environment (backend/.env — already created, see backend/.env.example)

`PORT`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `SMTP_*` (optional), `MEMBERSHIP_MONTHLY_PRICE`, `MEMBERSHIP_YEARLY_PRICE`.
