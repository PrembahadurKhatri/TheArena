import { IUser } from "../models/User";

// All shaper functions accept loosely-typed (possibly populated) mongoose
// documents/lean objects and return plain JSON-safe objects matching
// API_CONTRACT.md exactly. Using `any` here deliberately — populated
// mongoose documents don't type-check cleanly against the base interfaces.

export function toUserJSON(user: any) {
  if (!user) return null;
  return {
    id: user._id?.toString() ?? user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? undefined,
    photo: user.photo ?? null,
    location: user.location ?? undefined,
    province: user.province ?? undefined,
    isPremium: !!user.isPremium,
    membershipExpiresAt: user.membershipExpiresAt ? new Date(user.membershipExpiresAt).toISOString() : null,
    role: user.role,
    sportPreferences: user.sportPreferences ?? [],
  };
}

export function toPlayerSummary(user: any) {
  return {
    id: user._id?.toString() ?? user.id,
    name: user.name,
    photo: user.photo ?? null,
    sportPreferences: user.sportPreferences ?? [],
    isPremium: !!user.isPremium,
  };
}

export function toPlayerProfile(user: any) {
  return {
    ...toPlayerSummary(user),
    email: user.email,
    phone: user.phone ?? undefined,
  };
}

export function toOwnerRef(owner: any) {
  return {
    id: owner._id?.toString() ?? owner.id ?? owner.toString(),
    name: owner.name,
  };
}

export function toTeamSummary(team: any) {
  return {
    id: team._id?.toString() ?? team.id,
    name: team.name,
    sport: team.sport,
    logo: team.logo ?? null,
    memberCount: Array.isArray(team.members) ? team.members.length : 0,
    owner: toOwnerRef(team.owner),
  };
}

export function toTeamDetail(team: any, isOwnerViewing: boolean) {
  const detail: any = {
    ...toTeamSummary(team),
    members: (team.members ?? []).map((m: any) => ({
      id: m._id?.toString() ?? m.id ?? m.toString(),
      name: m.name,
      photo: m.photo ?? null,
    })),
  };
  if (isOwnerViewing) {
    detail.pendingRequests = (team.pendingRequests ?? []).map((p: any) => ({
      id: p._id?.toString() ?? p.id ?? p.toString(),
      name: p.name,
    }));
  }
  return detail;
}

export function toTournamentSummary(t: any) {
  return {
    id: t._id?.toString() ?? t.id,
    name: t.name,
    sport: t.sport,
    status: t.status,
    maxTeams: t.maxTeams,
    teamsCount: Array.isArray(t.teams) ? t.teams.length : 0,
    startDate: t.startDate ? new Date(t.startDate).toISOString() : null,
    organizer: toOwnerRef(t.organizer),
    province: t.province,
    location: t.location ?? undefined,
  };
}

export function toTournamentDetail(t: any) {
  return {
    ...toTournamentSummary(t),
    teams: (t.teams ?? []).map((team: any) => toTeamSummary(team)),
    matches: (t.matches ?? []).map((m: any) => toMatchJSON(m)),
    description: t.description ?? undefined,
  };
}

function toMatchTeamRef(team: any) {
  if (!team) return null;
  if (team.name) {
    return { id: team._id?.toString() ?? team.id, name: team.name, logo: team.logo ?? null };
  }
  return team.toString();
}

export function toMatchJSON(m: any) {
  return {
    id: m._id?.toString() ?? m.id,
    round: m.round,
    teamA: toMatchTeamRef(m.teamA),
    teamB: toMatchTeamRef(m.teamB),
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winner: toMatchTeamRef(m.winner),
    status: m.status,
  };
}

export function toGroundSummary(g: any) {
  return {
    id: g._id?.toString() ?? g.id,
    name: g.name,
    sport: g.sport,
    location: g.location,
    pricePerHour: g.pricePerHour,
    image: g.image ?? null,
  };
}

export function toGroundDetail(g: any) {
  return {
    ...toGroundSummary(g),
    amenities: g.amenities ?? [],
  };
}

export function toPaymentSummary(p: any) {
  return {
    id: p._id?.toString() ?? p.id,
    type: p.type,
    amount: p.amount,
    status: p.status,
    provider: p.provider,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
  };
}

export function toBookingSummary(b: any) {
  return {
    id: b._id?.toString() ?? b.id,
    ground: toGroundSummary(b.ground),
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    totalAmount: b.totalAmount,
    status: b.status,
    payment: b.payment ? toPaymentSummary(b.payment) : null,
  };
}

export function toMembershipSummary(m: any) {
  return {
    id: m._id?.toString() ?? m.id,
    plan: m.plan,
    startedAt: m.startedAt ? new Date(m.startedAt).toISOString() : null,
    expiresAt: m.expiresAt ? new Date(m.expiresAt).toISOString() : null,
  };
}
