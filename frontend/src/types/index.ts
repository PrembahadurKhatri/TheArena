// Shared TypeScript shapes mirroring API_CONTRACT.md exactly. Keep field
// names/casing identical to the backend response — do not rename.

export interface ApiUserRef {
  id: string;
  name: string;
}

export type TeamRole = "owner" | "captain" | "vice_captain" | "player";

export interface TeamSummary {
  id: string;
  name: string;
  slug?: string | null;
  sport: string;
  logo: string | null;
  memberCount: number;
  owner: ApiUserRef;
  province?: string | null;
  district?: string | null;
  status?: "active" | "suspended";
  /** Only on /my/teams: the viewer's role in the team. */
  role?: TeamRole | null;
}

export interface TeamMember {
  id: string;
  name: string;
  username?: string | null;
  photo: string | null;
  role?: TeamRole;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  invitedAt?: string | null;
}

export interface TeamDetail extends TeamSummary {
  description?: string | null;
  coverImage?: string | null;
  municipality?: string | null;
  captainId?: string | null;
  viceCaptainId?: string | null;
  members: TeamMember[];
  viewerRole?: TeamRole | null;
  viewerHasRequested?: boolean;
  viewerIsInvited?: boolean;
  /** Owner and captain only. */
  pendingRequests?: TeamMember[];
  invitations?: TeamMember[];
  createdAt?: string | null;
}

export const TEAM_ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  captain: "Captain",
  vice_captain: "Vice-captain",
  player: "Player",
};

/** Link path for a team: its slug when it has one. */
export const teamPath = (t: { id: string; slug?: string | null }) => `/teams/${t.slug || t.id}`;

export interface PlayerSportProfile {
  sport: string;
  position: string | null;
  experienceLevel: string | null;
}

export interface PlayerSummary {
  id: string;
  name: string;
  username?: string | null;
  photo: string | null;
  sportPreferences: string[];
  sportProfiles?: PlayerSportProfile[];
  isPremium: boolean;
  province?: string | null;
  district?: string | null;
}

export interface PlayerProfile extends PlayerSummary {
  email?: string;
  phone?: string;
  bio?: string | null;
  municipality?: string | null;
  location?: string | null;
  age?: number | null;
  memberSince?: string | null;
}

export type TournamentStatus = "upcoming" | "ongoing" | "completed";

export interface TournamentSummary {
  id: string;
  name: string;
  sport: string;
  status: TournamentStatus;
  maxTeams: number;
  teamsCount: number;
  startDate: string;
  organizer: ApiUserRef;
  province: string;
  location?: string;
}

// The subset of team fields the backend actually populates onto a Match
// (see backend's `toMatchTeamRef` — populated with "name logo" only).
export interface MatchTeamRef {
  id: string;
  name: string;
  logo: string | null;
}

export interface TournamentMatch {
  id: string;
  round: number;
  teamA: MatchTeamRef | null;
  teamB: MatchTeamRef | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: MatchTeamRef | null;
  status: "pending" | "completed" | string;
}

export interface MatchUserRef {
  id: string;
  name: string;
  username: string | null;
  photo: string | null;
}

/** A match from /api/matches (challenge or tournament). */
export interface MatchRow {
  id: string;
  source: "tournament" | "challenge";
  tournament: { id: string; name: string } | string | null;
  challenge: string | null;
  sport: string | null;
  mode: "team" | "player";
  round: number;
  stage?: string;
  group?: string | null;
  matchNumber?: number | null;
  teamA: (MatchTeamRef & { slug?: string | null }) | string | null;
  teamB: (MatchTeamRef & { slug?: string | null }) | string | null;
  userA: MatchUserRef | string | null;
  userB: MatchUserRef | string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  ground: { id: string; name: string; location: string | null } | null;
  venueNote: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: MatchTeamRef | string | null;
  winnerUser: MatchUserRef | string | null;
  isDraw: boolean;
  status: "pending" | "reported" | "disputed" | "completed" | "cancelled";
  verifiedAt: string | null;
}

export interface TournamentDetail extends TournamentSummary {
  teams: TeamSummary[];
  matches: TournamentMatch[];
  description?: string;
}

export interface GroundSummary {
  id: string;
  name: string;
  slug?: string | null;
  sport: string;
  sports?: string[];
  province?: string | null;
  district?: string | null;
  status?: string;
  location: string;
  pricePerHour: number;
  image: string | null;
}

export interface GroundDetail extends GroundSummary {
  description?: string;
}

export type PaymentType = "ground_booking" | "membership" | "shop_order";
export type PaymentStatus = "pending" | "success" | "failed";

export interface PaymentSummary {
  id: string;
  type: PaymentType;
  amount: number;
  status: PaymentStatus;
  provider: string;
  createdAt: string;
}

export type BookingStatus = "pending_payment" | "confirmed" | "cancelled";

export interface BookingSummary {
  id: string;
  ground: GroundSummary;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: BookingStatus;
  payment: PaymentSummary | null;
}

export interface SportRow {
  slug: string;
  name: string;
  order: number;
}

export interface MembershipSummary {
  id: string;
  plan: "monthly" | "yearly";
  startedAt?: string;
  expiresAt?: string;
  status?: string;
}

export interface MembershipMe {
  isPremium: boolean;
  membershipExpiresAt: string | null;
  activeMembership: MembershipSummary | null;
}

// --- Shop (multi-vendor marketplace) — mirrors API_CONTRACT.md "## Shop" exactly ---

export interface StoreSummary {
  id: string;
  name: string;
  description?: string;
  logo: string | null;
  owner: ApiUserRef;
  productCount: number;
}

export interface StoreDetail extends StoreSummary {
  products: ProductSummary[];
}

export interface ProductVariant {
  id: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  stock: number;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug?: string | null;
  brand?: string | null;
  price: number;
  /** Sale price when the product is discounted. */
  discountPrice?: number | null;
  /** What a buyer pays per unit. */
  unitPrice?: number;
  stock: number;
  images: string[];
  category: string;
  sport?: string;
  status?: string;
  featured?: boolean;
  rating?: { avg: number; count: number };
  hasVariants?: boolean;
  store: { id: string; name: string; slug?: string | null };
}

export interface ProductDetail extends ProductSummary {
  sku?: string | null;
  variants?: ProductVariant[];
  review?: { note: string | null; at: string } | null;
  description?: string;
}

export interface OrderItem {
  product: string | null;
  store: { id: string; name: string };
  name: string;
  price: number;
  quantity: number;
  image: string | null;
}

export type OrderStatus = "pending_payment" | "paid" | "cancelled";

export interface OrderSummary {
  id: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress: string;
  shippingProvince?: string;
  contactName?: string;
  contactPhone?: string;
  createdAt: string;
  payment: PaymentSummary | null;
}

export function apiError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message || fallback;
}

export type ChallengeMode = "team" | "player";
export type ChallengeStatus = "open" | "pending" | "countered" | "accepted" | "declined" | "cancelled" | "completed" | "expired";

export interface CounterProposal {
  side: "challenger" | "opponent";
  by: string | null;
  date: string;
  startTime: string;
  endTime: string;
  ground: GroundSummary | null;
  venueNote: string | null;
  message: string | null;
  createdAt: string;
}

export interface ChallengeSide {
  kind: "team" | "player";
  id: string;
  name: string;
  image: string | null;
  /** For a team: its owner's user id. For a player: the player's own id. */
  ownerId: string | null;
  memberCount?: number;
}

export interface Challenge {
  id: string;
  sport: string;
  mode: ChallengeMode;
  status: ChallengeStatus;
  format?: "friendly" | "competitive";
  /** Whose answer the challenge is waiting for (pending/countered). */
  awaiting?: "challenger" | "opponent" | null;
  /** Which side the signed-in viewer speaks for, from the server. */
  viewerSide?: "challenger" | "opponent" | null;
  counterProposals?: CounterProposal[];
  matchId?: string | null;
  bookingId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  challenger: ChallengeSide | null;
  challengerUserId: string | null;
  opponent: ChallengeSide | null;
  acceptedBy: ChallengeSide | null;
  acceptedByUserId: string | null;
  ground: GroundSummary | null;
  province?: string;
  venueNote?: string;
  message?: string;
  createdAt: string | null;
}

export interface GroundAvailability {
  date: string;
  taken: { startTime: string; endTime: string; kind: "booking" | "match" }[];
}
