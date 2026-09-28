// Shared TypeScript shapes mirroring API_CONTRACT.md exactly. Keep field
// names/casing identical to the backend response — do not rename.

export interface ApiUserRef {
  id: string;
  name: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  sport: string;
  logo: string | null;
  memberCount: number;
  owner: ApiUserRef;
}

export interface TeamMember {
  id: string;
  name: string;
  photo: string | null;
}

export interface TeamDetail extends TeamSummary {
  members: TeamMember[];
  pendingRequests?: TeamMember[];
}

export interface PlayerSummary {
  id: string;
  name: string;
  photo: string | null;
  sportPreferences: string[];
  isPremium: boolean;
}

export interface PlayerProfile extends PlayerSummary {
  email?: string;
  phone?: string;
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

export interface TournamentDetail extends TournamentSummary {
  teams: TeamSummary[];
  matches: TournamentMatch[];
  description?: string;
}

export interface GroundSummary {
  id: string;
  name: string;
  sport: string;
  location: string;
  pricePerHour: number;
  image: string | null;
}

export interface GroundDetail extends GroundSummary {
  description?: string;
}

export type PaymentType = "ground_booking" | "membership";
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

export interface RankingEntry<T> {
  rank: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  player?: PlayerSummary;
  team?: TeamSummary;
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

export function apiError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message || fallback;
}
