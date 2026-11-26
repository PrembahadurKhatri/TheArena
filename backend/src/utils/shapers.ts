import { IUser } from "../models/User";

// All shaper functions accept loosely-typed (possibly populated) mongoose
// documents/lean objects and return plain JSON-safe objects matching
// API_CONTRACT.md exactly. Using `any` here deliberately — populated
// mongoose documents don't type-check cleanly against the base interfaces.

const DEFAULT_PRIVACY = { showEmail: false, showPhone: false, showLocation: true, showAge: false, discoverable: true, emailNotifications: true };

function privacyOf(user: any) {
  return { ...DEFAULT_PRIVACY, ...(user?.privacy?.toObject ? user.privacy.toObject() : user?.privacy ?? {}) };
}

function ageFrom(dob: unknown): number | null {
  if (!dob) return null;
  const d = new Date(dob as string);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age -= 1;
  return age;
}

function sportProfilesOf(user: any) {
  return (user.sportProfiles ?? []).map((p: any) => ({
    sport: p.sport,
    position: p.position ?? null,
    experienceLevel: p.experienceLevel ?? null,
  }));
}

/** The signed-in user's own account: everything except secrets. */
export function toUserJSON(user: any) {
  if (!user) return null;
  return {
    id: user._id?.toString() ?? user.id,
    name: user.name,
    username: user.username ?? null,
    email: user.email,
    phone: user.phone ?? undefined,
    photo: user.photo ?? null,
    location: user.location ?? undefined,
    province: user.province ?? undefined,
    district: user.district ?? undefined,
    municipality: user.municipality ?? undefined,
    hasGeo: !!user.geo?.coordinates?.length,
    bio: user.bio ?? undefined,
    dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : null,
    gender: user.gender ?? null,
    sportProfiles: sportProfilesOf(user),
    privacy: privacyOf(user),
    isPremium: !!user.isPremium,
    membershipExpiresAt: user.membershipExpiresAt ? new Date(user.membershipExpiresAt).toISOString() : null,
    role: user.role,
    sportPreferences: user.sportPreferences ?? [],
  };
}

/** What anyone can see about a player in lists. Location only if the player allows it. */
export function toPlayerSummary(user: any) {
  const privacy = privacyOf(user);
  return {
    id: user._id?.toString() ?? user.id,
    name: user.name,
    username: user.username ?? null,
    photo: user.photo ?? null,
    sportPreferences: user.sportPreferences ?? [],
    sportProfiles: sportProfilesOf(user),
    isPremium: !!user.isPremium,
    province: privacy.showLocation ? user.province ?? null : null,
    district: privacy.showLocation ? user.district ?? null : null,
  };
}

/**
 * A player's profile page. The owner sees everything; others see what the
 * player's privacy settings allow.
 */
export function toPlayerProfile(user: any, isSelf = false) {
  const privacy = privacyOf(user);
  const show = (flag: boolean) => isSelf || flag;
  return {
    ...toPlayerSummary(user),
    bio: user.bio ?? null,
    municipality: show(privacy.showLocation) ? user.municipality ?? null : null,
    location: show(privacy.showLocation) ? user.location ?? null : null,
    age: show(privacy.showAge) ? ageFrom(user.dateOfBirth) : null,
    email: show(privacy.showEmail) ? user.email : undefined,
    phone: show(privacy.showPhone) ? user.phone ?? undefined : undefined,
    memberSince: user.createdAt ?? null,
  };
}

export function toOwnerRef(owner: any) {
  return {
    id: owner._id?.toString() ?? owner.id ?? owner.toString(),
    name: owner.name,
  };
}

const refId = (v: any) => (v ? v._id?.toString() ?? v.toString() : null);

export function toTeamSummary(team: any) {
  return {
    id: team._id?.toString() ?? team.id,
    name: team.name,
    slug: team.slug ?? null,
    sport: team.sport,
    logo: team.logo ?? null,
    memberCount: Array.isArray(team.members) ? team.members.length : 0,
    owner: toOwnerRef(team.owner),
    province: team.province ?? null,
    district: team.district ?? null,
    status: team.status ?? "active",
  };
}

const ROLE_ORDER: Record<string, number> = { owner: 0, captain: 1, vice_captain: 2, player: 3 };

/**
 * Team page. Everyone sees the roster with roles; the owner and captain also
 * see pending join requests and invitations.
 */
export function toTeamDetail(team: any, viewerId?: string | null) {
  const ownerId = refId(team.owner);
  const captainId = refId(team.captain);
  const viceId = refId(team.viceCaptain);
  const roleOf = (id: string | null) =>
    !id ? null : id === ownerId ? "owner" : id === captainId ? "captain" : id === viceId ? "vice_captain" : null;
  const members = (team.members ?? []).map((m: any) => {
    const id = m._id?.toString() ?? m.id ?? m.toString();
    return {
      id,
      name: m.name,
      username: m.username ?? null,
      photo: m.photo ?? null,
      role: roleOf(id) ?? "player",
      // A member can be owner and captain at once.
      isCaptain: id === captainId,
      isViceCaptain: id === viceId,
    };
  });
  members.sort((a: any, b: any) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));
  const viewerRole = viewerId
    ? viewerId === ownerId
      ? "owner"
      : viewerId === captainId
        ? "captain"
        : viewerId === viceId
          ? "vice_captain"
          : members.some((m: any) => m.id === viewerId)
            ? "player"
            : null
    : null;
  const detail: any = {
    ...toTeamSummary(team),
    description: team.description ?? null,
    coverImage: team.coverImage ?? null,
    municipality: team.municipality ?? null,
    captainId,
    viceCaptainId: viceId,
    members,
    viewerRole,
    viewerHasRequested: !!viewerId && (team.pendingRequests ?? []).some((p: any) => refId(p) === viewerId),
    viewerIsInvited: !!viewerId && (team.invitations ?? []).some((i: any) => refId(i.user) === viewerId),
    createdAt: team.createdAt ?? null,
  };
  if (viewerRole === "owner" || viewerRole === "captain") {
    detail.pendingRequests = (team.pendingRequests ?? []).map((p: any) => ({
      id: p._id?.toString() ?? p.id ?? p.toString(),
      name: p.name,
      username: p.username ?? null,
      photo: p.photo ?? null,
    }));
    detail.invitations = (team.invitations ?? []).map((i: any) => ({
      id: refId(i.user),
      name: i.user?.name ?? null,
      username: i.user?.username ?? null,
      photo: i.user?.photo ?? null,
      invitedAt: i.createdAt ?? null,
    }));
  }
  return detail;
}

const iso = (d: any) => (d ? new Date(d).toISOString() : null);

export function toTournamentSummary(t: any) {
  return {
    id: t._id?.toString() ?? t.id,
    name: t.name,
    slug: t.slug ?? null,
    sport: t.sport,
    // Legacy "upcoming" tournaments behave as approved.
    status: t.status === "upcoming" ? "approved" : t.status,
    format: t.format ?? "knockout",
    minTeams: t.minTeams ?? 4,
    maxTeams: t.maxTeams,
    teamsCount: Array.isArray(t.teams) ? t.teams.length : 0,
    startDate: iso(t.startDate),
    endDate: iso(t.endDate),
    registrationClosesAt: iso(t.registrationClosesAt),
    entryFee: t.entryFee ?? 0,
    poster: t.poster ?? null,
    organizer: toOwnerRef(t.organizer),
    province: t.province,
    district: t.district ?? null,
    location: t.location ?? undefined,
    winner: t.winner && t.winner.name ? { id: t.winner._id.toString(), name: t.winner.name, slug: t.winner.slug ?? null, logo: t.winner.logo ?? null } : null,
  };
}

export function toTournamentDetail(t: any) {
  return {
    ...toTournamentSummary(t),
    teams: (t.teams ?? []).map((team: any) => toTeamSummary(team)),
    matches: (t.matches ?? []).map((m: any) => toMatchJSON(m)),
    description: t.description ?? undefined,
    prizes: t.prizes ?? null,
    rules: t.rules ?? null,
    groups: t.groups ?? 2,
    advancePerGroup: t.advancePerGroup ?? 2,
    points: t.points ?? { win: 3, draw: 1, loss: 0 },
    review: t.review?.decision ? { decision: t.review.decision, note: t.review.note ?? null, at: t.review.at } : null,
    submittedAt: iso(t.submittedAt),
    cancelReason: t.cancelReason ?? null,
    legacy: !!t.legacy,
  };
}

export function toRegistrationJSON(r: any, includePrivate = false) {
  return {
    id: r._id.toString(),
    team: r.team && r.team.name ? toTeamSummary(r.team) : null,
    status: r.status,
    rosterSize: r.rosterSize ?? 0,
    eligibility: r.eligibility ?? { ok: true, reasons: [] },
    createdAt: r.createdAt,
    ...(includePrivate
      ? { requestedBy: r.requestedBy?.name ? { id: r.requestedBy._id.toString(), name: r.requestedBy.name } : null, note: r.note ?? null, responseReason: r.responseReason ?? null }
      : {}),
  };
}

function toMatchTeamRef(team: any) {
  if (!team) return null;
  if (team.name) {
    return { id: team._id?.toString() ?? team.id, name: team.name, slug: team.slug ?? null, logo: team.logo ?? null };
  }
  return team.toString();
}

function toMatchUserRef(user: any) {
  if (!user) return null;
  if (user.name) return { id: user._id?.toString() ?? user.id, name: user.name, username: user.username ?? null, photo: user.photo ?? null };
  return user.toString();
}

export function toMatchJSON(m: any) {
  return {
    id: m._id?.toString() ?? m.id,
    source: m.source ?? "tournament",
    tournament: m.tournament ? (m.tournament.name ? { id: m.tournament._id.toString(), name: m.tournament.name } : m.tournament.toString()) : null,
    challenge: m.challenge ? m.challenge._id?.toString() ?? m.challenge.toString() : null,
    sport: m.sport ?? m.tournament?.sport ?? null,
    mode: m.mode ?? "team",
    round: m.round,
    stage: m.stage ?? "knockout",
    group: m.group ?? null,
    matchNumber: m.matchNumber ?? null,
    teamA: toMatchTeamRef(m.teamA),
    teamB: toMatchTeamRef(m.teamB),
    userA: toMatchUserRef(m.userA),
    userB: toMatchUserRef(m.userB),
    date: m.date ?? null,
    startTime: m.startTime ?? null,
    endTime: m.endTime ?? null,
    ground: m.ground && m.ground.name ? { id: m.ground._id.toString(), name: m.ground.name, location: m.ground.location ?? null } : null,
    venueNote: m.venueNote ?? null,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winner: toMatchTeamRef(m.winner),
    winnerUser: toMatchUserRef(m.winnerUser),
    isDraw: !!m.isDraw,
    status: m.status,
    verifiedAt: m.verifiedAt ?? null,
  };
}

export function toGroundSummary(g: any) {
  return {
    id: g._id?.toString() ?? g.id,
    name: g.name,
    slug: g.slug ?? null,
    sport: g.sport ?? g.sports?.[0] ?? null,
    sports: g.sports?.length ? g.sports : g.sport ? [g.sport] : [],
    province: g.province ?? null,
    district: g.district ?? null,
    status: g.status ?? "approved",
    location: g.location,
    pricePerHour: g.pricePerHour,
    image: g.image ?? null,
  };
}

export function toGroundDetail(g: any) {
  return {
    ...toGroundSummary(g),
    amenities: g.amenities ?? [],
    description: g.description ?? null,
    address: g.address ?? null,
    municipality: g.municipality ?? null,
    images: g.images?.length ? g.images : g.image ? [g.image] : [],
    hasGeo: !!g.geo?.coordinates?.length,
    openingHours: g.openingHours ?? [],
    slotMinutes: g.slotMinutes ?? 60,
    contactPhone: g.contactPhone ?? null,
    status: g.status ?? "approved",
    ownerId: g.owner ? g.owner._id?.toString() ?? g.owner.toString() : null,
    owner: g.owner && g.owner.name ? { id: g.owner._id.toString(), name: g.owner.name, email: g.owner.email ?? undefined, phone: g.owner.phone ?? undefined } : undefined,
    review: g.review?.at ? { note: g.review.note ?? null, at: g.review.at } : null,
  };
}

export function toPaymentSummary(p: any, staffView = false) {
  return {
    id: p._id?.toString() ?? p.id,
    type: p.type,
    refId: p.refId ? p.refId.toString() : null,
    amount: p.amount,
    // "success" is the older name for paid.
    status: p.status === "success" ? "paid" : p.status,
    provider: p.provider,
    reference: p.reference ?? null,
    submittedAt: p.submittedAt ?? null,
    rejectionReason: p.rejectionReason ?? null,
    refundRequested: !!p.refundRequested,
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    ...(staffView
      ? {
          user: p.user && p.user.name ? { id: p.user._id.toString(), name: p.user.name, email: p.user.email, phone: p.user.phone ?? null } : null,
          proofImage: p.proofImage ?? null,
          verifiedBy: p.verifiedBy && p.verifiedBy.name ? p.verifiedBy.name : null,
          verifiedAt: p.verifiedAt ?? null,
          refundNote: p.refundNote ?? null,
        }
      : {}),
  };
}

export function toBookingSummary(b: any, ownerView = false) {
  return {
    id: b._id?.toString() ?? b.id,
    ground: b.ground && b.ground.name ? toGroundSummary(b.ground) : null,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    totalAmount: b.totalAmount,
    status: b.status,
    paymentMethod: b.paymentMethod ?? "online",
    source: b.source ?? "direct",
    challengeId: b.challenge ? b.challenge.toString() : null,
    note: b.note ?? null,
    cancelReason: b.cancelReason ?? null,
    payment: b.payment && b.payment._id ? toPaymentSummary(b.payment) : null,
    createdAt: b.createdAt ?? null,
    // The owner needs to know who booked; the booker's phone helps reach them.
    ...(ownerView && b.user && b.user.name ? { bookedBy: { id: b.user._id.toString(), name: b.user.name, username: b.user.username ?? null, phone: b.user.phone ?? null } } : {}),
  };
}

export function toStoreSummary(s: any) {
  return {
    id: s._id?.toString() ?? s.id,
    name: s.name,
    slug: s.slug ?? null,
    description: s.description ?? undefined,
    logo: s.logo ?? null,
    banner: s.banner ?? null,
    owner: toOwnerRef(s.owner),
    status: s.status ?? "approved",
    province: s.province ?? null,
    district: s.district ?? null,
    rating: s.rating ?? { avg: 0, count: 0 },
    featured: !!(s.premiumUntil && new Date(s.premiumUntil) > new Date() && s.planEntitlements?.featuredStore),
    productCount: typeof s.productCount === "number" ? s.productCount : Array.isArray(s.products) ? s.products.length : 0,
  };
}

/** Shop page. The owner (and staff) also see contact details, documents and the review note. */
export function toStoreDetail(s: any, includePrivate = false) {
  return {
    ...toStoreSummary(s),
    address: s.address ?? null,
    products: (s.products ?? []).map((p: any) => toProductSummary(p)),
    ...(includePrivate
      ? {
          ownerName: s.ownerName ?? null,
          email: s.email ?? null,
          phone: s.phone ?? null,
          documents: s.documents ?? [],
          review: s.review?.at ? { note: s.review.note ?? null, at: s.review.at } : null,
          planCode: s.planCode ?? null,
        }
      : {}),
  };
}

export function toProductStoreRef(store: any) {
  return {
    id: store._id?.toString() ?? store.id ?? store.toString(),
    name: store.name,
    slug: store.slug ?? null,
  };
}

export function toProductSummary(p: any) {
  const discounted = p.discountPrice != null && p.discountPrice < p.price;
  return {
    id: p._id?.toString() ?? p.id,
    name: p.name,
    slug: p.slug ?? null,
    brand: p.brand ?? null,
    price: p.price,
    discountPrice: discounted ? p.discountPrice : null,
    unitPrice: discounted ? p.discountPrice : p.price,
    stock: p.stock,
    images: p.images ?? [],
    category: p.category,
    sport: p.sport ?? undefined,
    status: p.status ?? "active",
    featured: !!p.featured,
    rating: p.rating ?? { avg: 0, count: 0 },
    hasVariants: Array.isArray(p.variants) && p.variants.length > 0,
    store: toProductStoreRef(p.store),
  };
}

export function toProductDetail(p: any) {
  return {
    ...toProductSummary(p),
    description: p.description ?? undefined,
    sku: p.sku ?? null,
    variants: (p.variants ?? []).map((v: any) => ({ id: v._id.toString(), sku: v.sku ?? null, size: v.size ?? null, color: v.color ?? null, stock: v.stock })),
    review: p.review?.at ? { note: p.review.note ?? null, at: p.review.at } : null,
  };
}

export function toOrderItemJSON(item: any) {
  return {
    product: item.product ? item.product.toString() : null,
    store: item.store ? toProductStoreRef(item.store) : null,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    image: item.image ?? null,
    variant: item.variant ? item.variant.toString() : null,
    size: item.size ?? null,
    color: item.color ?? null,
  };
}

export function toSellerOrderJSON(so: any) {
  return {
    id: so._id.toString(),
    order: so.order?._id?.toString() ?? so.order?.toString() ?? null,
    store: so.store && so.store.name ? toProductStoreRef(so.store) : so.store ? { id: so.store.toString(), name: null, slug: null } : null,
    buyer: so.buyer && so.buyer.name ? { id: so.buyer._id.toString(), name: so.buyer.name } : undefined,
    items: (so.items ?? []).map((i: any) => toOrderItemJSON(i)),
    subtotal: so.subtotal,
    paymentMethod: so.paymentMethod,
    status: so.status,
    statusHistory: (so.statusHistory ?? []).map((h: any) => ({ status: h.status, at: h.at, note: h.note ?? null })),
    tracking: so.tracking?.code || so.tracking?.carrier ? { carrier: so.tracking.carrier ?? null, code: so.tracking.code ?? null } : null,
    shipping: so.shipping ?? null,
    createdAt: so.createdAt,
  };
}

export function toOrderSummary(o: any) {
  return {
    id: o._id?.toString() ?? o.id,
    items: (o.items ?? []).map((i: any) => toOrderItemJSON(i)),
    totalAmount: o.totalAmount,
    status: o.status,
    paymentMethod: o.paymentMethod ?? "online",
    shippingAddress: o.shippingAddress,
    shippingProvince: o.shippingProvince ?? undefined,
    contactName: o.contactName ?? undefined,
    contactPhone: o.contactPhone ?? undefined,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    payment: o.payment && o.payment._id ? toPaymentSummary(o.payment) : null,
    sellerOrders: (o.sellerOrders ?? []).filter((so: any) => so && so._id && so.items).map((so: any) => toSellerOrderJSON(so)),
  };
}

export function toReviewJSON(r: any) {
  return {
    id: r._id.toString(),
    rating: r.rating,
    text: r.text ?? null,
    user: r.user && r.user.name ? { id: r.user._id.toString(), name: r.user.name, username: r.user.username ?? null, photo: r.user.photo ?? null } : null,
    product: r.product && r.product.name ? { id: r.product._id.toString(), name: r.product.name, slug: r.product.slug ?? null } : undefined,
    status: r.status,
    merchantReply: r.merchantReply ?? null,
    createdAt: r.createdAt,
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

function toChallengeSide(user: any, team: any) {
  if (team && team.name) {
    return {
      kind: "team" as const,
      id: team._id?.toString() ?? team.id,
      name: team.name,
      image: team.logo ?? null,
      ownerId: team.owner ? team.owner._id?.toString() ?? team.owner.toString() : null,
      memberCount: Array.isArray(team.members) ? team.members.length : undefined,
    };
  }
  if (user && user.name) {
    return {
      kind: "player" as const,
      id: user._id?.toString() ?? user.id,
      name: user.name,
      image: user.photo ?? null,
      ownerId: user._id?.toString() ?? user.id,
    };
  }
  return null;
}

export function toChallengeJSON(c: any, viewerSide: "challenger" | "opponent" | null = null) {
  return {
    id: c._id?.toString() ?? c.id,
    sport: c.sport,
    mode: c.mode,
    status: c.status,
    format: c.format ?? "friendly",
    awaiting: c.awaiting ?? null,
    viewerSide,
    counterProposals: (c.counterProposals ?? []).map((p: any) => ({
      side: p.side,
      by: p.by?._id?.toString() ?? p.by?.toString() ?? null,
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      ground: p.ground && p.ground.name ? toGroundSummary(p.ground) : null,
      venueNote: p.venueNote ?? null,
      message: p.message ?? null,
      createdAt: p.createdAt,
    })),
    matchId: c.match ? c.match._id?.toString() ?? c.match.toString() : null,
    bookingId: c.booking ? c.booking._id?.toString() ?? c.booking.toString() : null,
    date: c.date,
    startTime: c.startTime,
    endTime: c.endTime,
    challenger: toChallengeSide(c.challenger, c.challengerTeam),
    challengerUserId: c.challenger?._id?.toString() ?? c.challenger?.toString() ?? null,
    opponent: toChallengeSide(c.opponentUser, c.opponentTeam),
    acceptedBy: toChallengeSide(c.acceptedBy, c.acceptedTeam),
    acceptedByUserId: c.acceptedBy?._id?.toString() ?? (c.acceptedBy ? c.acceptedBy.toString() : null),
    ground: c.ground && c.ground.name ? toGroundSummary(c.ground) : null,
    province: c.province ?? undefined,
    venueNote: c.venueNote ?? undefined,
    message: c.message ?? undefined,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
  };
}

export function toMatchReportJSON(r: any) {
  const ref = (u: any) => (u && u.name ? { id: u._id.toString(), name: u.name } : u ? { id: u.toString(), name: null } : null);
  const match = r.match && r.match.teamA !== undefined && typeof r.match === "object" && r.match._id ? r.match : null;
  return {
    id: r._id.toString(),
    match: match ? toMatchJSON(match) : r.match?.toString() ?? null,
    submittedBy: ref(r.submittedBy),
    submittedFor: r.submittedFor,
    scoreA: r.scoreA,
    scoreB: r.scoreB,
    outcome: r.outcome,
    detail: r.detail ?? null,
    players: (r.players ?? []).map((p: any) => ({
      user: p.user && p.user.name ? { id: p.user._id.toString(), name: p.user.name, username: p.user.username ?? null, photo: p.user.photo ?? null } : { id: p.user?.toString() },
      side: p.side,
      stats: p.stats instanceof Map ? Object.fromEntries(p.stats) : p.stats ?? {},
    })),
    evidence: r.evidence ?? [],
    notes: r.notes ?? null,
    status: r.status,
    response: r.response?.action ? { by: ref(r.response.by), action: r.response.action, reason: r.response.reason ?? null, at: r.response.at } : null,
    review: r.review?.decision ? { by: ref(r.review.by), decision: r.review.decision, note: r.review.note ?? null, at: r.review.at } : null,
    verifiedHow: r.verifiedHow ?? null,
    verifiedAt: r.verifiedAt ?? null,
    createdAt: r.createdAt,
  };
}
