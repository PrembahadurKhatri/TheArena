import { Types } from "mongoose";
import { Team, ITeam, TeamRole } from "../models/Team";
import { IUser, User } from "../models/User";
import { Sport } from "../models/Sport";
import { Tournament } from "../models/Tournament";
import { Challenge } from "../models/Challenge";
import { AppError } from "../utils/AppError";
import { isActiveSportSlug, isValidSportSlug } from "../utils/sports";
import { isValidProvince } from "../utils/provinces";
import { isValidDistrict, nearFilter, parseGeo, provinceOfDistrict } from "../utils/locations";
import { escapeRegex, isObjectIdString, optionalString, queryString, requireString } from "../utils/validation";
import { nameKey, uniqueSlug } from "../utils/names";
import { withLock } from "../utils/lock";
import { Page, pageMeta } from "../utils/pagination";
import { getEntitlements } from "./entitlementsService";
import { notify } from "./notificationService";
import { audit } from "./auditService";

const TEAM_SUMMARY_POPULATE = { path: "owner", select: "name username" };
const TEAM_DETAIL_POPULATE = [
  { path: "owner", select: "name username photo" },
  { path: "members", select: "name username photo" },
  { path: "pendingRequests", select: "name username photo" },
  { path: "invitations.user", select: "name username photo" },
];

const idStr = (v: unknown) => (v && typeof v === "object" && "_id" in (v as any) ? String((v as any)._id) : String(v));

// ---------------------------------------------------------------- roles

/** The user's role in this team, or null if they aren't on it. */
export function roleIn(team: Pick<ITeam, "owner" | "captain" | "viceCaptain" | "members">, userId: unknown): TeamRole | null {
  if (!userId) return null;
  const id = String(userId);
  if (idStr(team.owner) === id) return "owner";
  if (team.captain && idStr(team.captain) === id) return "captain";
  if (team.viceCaptain && idStr(team.viceCaptain) === id) return "vice_captain";
  if ((team.members ?? []).some((m) => idStr(m) === id)) return "player";
  return null;
}

/** Owner and captain run the roster day to day (invites, join requests, challenges). */
export function canManageRoster(role: TeamRole | null) {
  return role === "owner" || role === "captain";
}

async function getTeamOrThrow(teamId: string) {
  if (!isObjectIdString(teamId)) throw new AppError(404, "Team not found");
  const team = await Team.findById(teamId);
  if (!team) throw new AppError(404, "Team not found");
  return team;
}

async function getOwnedTeamOrThrow(teamId: string, userId: Types.ObjectId) {
  const team = await getTeamOrThrow(teamId);
  if (roleIn(team, userId) !== "owner") throw new AppError(403, "Only the team owner can perform this action");
  return team;
}

async function getManagedTeamOrThrow(teamId: string, userId: Types.ObjectId) {
  const team = await getTeamOrThrow(teamId);
  if (!canManageRoster(roleIn(team, userId))) throw new AppError(403, "Only the team owner or captain can do this");
  if (team.status !== "active") throw new AppError(403, "This team is suspended");
  return team;
}

async function rosterLimit(sport: string): Promise<number> {
  const s = await Sport.findOne({ slug: sport }).select("maxPlayers").lean();
  return s?.maxPlayers ?? 30;
}

const detail = (id: Types.ObjectId) => Team.findById(id).populate(TEAM_DETAIL_POPULATE);

// ---------------------------------------------------------------- discovery

export async function listTeams(filters: Record<string, unknown>, p: Page) {
  const query: any = { status: { $ne: "suspended" } };
  const sport = queryString(filters.sport);
  if (sport) query.sport = sport;
  const search = queryString(filters.search);
  if (search) query.name = { $regex: escapeRegex(search), $options: "i" };
  const province = queryString(filters.province);
  if (province) {
    if (!isValidProvince(province)) throw new AppError(400, `Invalid province: ${province}`);
    query.province = province;
  }
  const district = queryString(filters.district);
  if (district) {
    if (!isValidDistrict(district)) throw new AppError(400, `Invalid district: ${district}`);
    query.district = district;
  }
  const near = nearFilter(queryString(filters.lat), queryString(filters.lng), queryString(filters.radiusKm), 100);
  if (near) query.geo = near;

  const [teams, total] = await Promise.all([
    Team.find(query).populate(TEAM_SUMMARY_POPULATE).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    Team.countDocuments(query),
  ]);
  return { teams, ...pageMeta(p, total) };
}

export async function listMyTeams(userId: string) {
  return Team.find({ $or: [{ owner: userId }, { members: userId }] })
    .populate(TEAM_SUMMARY_POPULATE)
    .sort({ createdAt: -1 });
}

/** By id or slug. */
export async function getTeamById(idOrSlug: string) {
  const team = isObjectIdString(idOrSlug)
    ? await Team.findById(idOrSlug).populate(TEAM_DETAIL_POPULATE)
    : await Team.findOne({ slug: String(idOrSlug).toLowerCase() }).populate(TEAM_DETAIL_POPULATE);
  if (!team) throw new AppError(404, "Team not found");
  return team;
}

export async function nameAvailable(value: unknown, exceptTeamId?: string) {
  if (typeof value !== "string" || value.trim().length < 2) return { available: false, reason: "Name must be at least 2 characters" };
  const q: any = { nameKey: nameKey(value) };
  if (exceptTeamId && isObjectIdString(exceptTeamId)) q._id = { $ne: exceptTeamId };
  return { name: value.trim(), available: !(await Team.exists(q)) };
}

// ---------------------------------------------------------------- create / edit / delete

interface TeamInput {
  name?: string;
  sport?: string;
  logo?: string | null;
  coverImage?: string | null;
  description?: string;
  province?: string;
  district?: string;
  municipality?: string;
  lat?: unknown;
  lng?: unknown;
}

function applyLocation(target: any, input: TeamInput) {
  if (input.province !== undefined) {
    if (input.province && !isValidProvince(input.province)) throw new AppError(400, `Invalid province: ${input.province}`);
    target.province = input.province || undefined;
  }
  if (input.district !== undefined) {
    if (input.district && !isValidDistrict(input.district)) throw new AppError(400, `Invalid district: ${input.district}`);
    target.district = input.district || undefined;
    if (target.district) target.province = provinceOfDistrict(target.district) ?? target.province;
  }
  if (input.municipality !== undefined) target.municipality = optionalString(input.municipality, "municipality", 80);
  if (input.lat !== undefined || input.lng !== undefined) {
    const geo = parseGeo(input.lat, input.lng);
    if (geo !== undefined) target.geo = geo ?? undefined;
  }
}

function duplicateName(err: any) {
  return err?.code === 11000 && (err?.keyPattern?.nameKey || /nameKey/.test(String(err?.message)));
}

export async function createTeam(owner: IUser, input: TeamInput) {
  const { sport } = input;
  if (!input.name || !sport) throw new AppError(400, "name and sport are required");
  const name = requireString(input.name, "name", { min: 2, max: 60 });
  if (!isActiveSportSlug(sport)) throw new AppError(400, `Invalid sport slug: ${sport}`);
  const description = optionalString(input.description, "description", 1000);

  // One lock per owner, so two parallel requests can't both pass the free
  // plan's team limit.
  return withLock(`team-create:${owner._id}`, async () => {
    const limit = getEntitlements(owner).maxOwnedTeams;
    if (Number.isFinite(limit)) {
      const ownedCount = await Team.countDocuments({ owner: owner._id });
      if (ownedCount >= limit) {
        throw new AppError(403, `Free plan is limited to ${limit} team. Upgrade to Premium for unlimited teams.`);
      }
    }
    const key = nameKey(name);
    if (await Team.exists({ nameKey: key })) throw new AppError(409, "A team with this name already exists");

    const doc: any = {
      name,
      nameKey: key,
      slug: await uniqueSlug(Team, name),
      sport,
      description,
      logo: input.logo ?? null,
      coverImage: input.coverImage ?? null,
      owner: owner._id,
      members: [owner._id],
      pendingRequests: [],
      invitations: [],
    };
    applyLocation(doc, input);
    if (!doc.province && !doc.district && owner.district) {
      // Default the team's home to the owner's district.
      doc.district = owner.district;
      doc.province = owner.province;
    }
    let team;
    try {
      team = await Team.create(doc);
    } catch (err) {
      if (duplicateName(err)) throw new AppError(409, "A team with this name already exists");
      throw err;
    }
    return detail(team._id);
  });
}

/** A team's sport is fixed once it has played or entered anything in that sport. */
async function sportLocked(teamId: Types.ObjectId) {
  const [inTournament, inChallenge] = await Promise.all([
    Tournament.exists({ teams: teamId }),
    Challenge.exists({ $or: [{ challengerTeam: teamId }, { opponentTeam: teamId }, { acceptedTeam: teamId }] }),
  ]);
  return !!(inTournament || inChallenge);
}

export async function updateTeam(teamId: string, user: IUser, updates: TeamInput) {
  const team = await getOwnedTeamOrThrow(teamId, user._id);
  if (team.status !== "active") throw new AppError(403, "This team is suspended");
  if (updates.name !== undefined) {
    const name = requireString(updates.name, "name", { min: 2, max: 60 });
    const key = nameKey(name);
    if (key !== team.nameKey) {
      if (await Team.exists({ nameKey: key, _id: { $ne: team._id } })) throw new AppError(409, "A team with this name already exists");
      team.slug = await uniqueSlug(Team, name, team._id);
    }
    team.name = name;
    team.nameKey = key;
  }
  if (updates.sport !== undefined && updates.sport !== team.sport) {
    if (!isActiveSportSlug(updates.sport)) throw new AppError(400, `Invalid sport slug: ${updates.sport}`);
    if (await sportLocked(team._id)) {
      throw new AppError(400, "This team has matches or tournament entries, so its sport can't change. Create a new team instead.");
    }
    team.sport = updates.sport;
  }
  if (updates.description !== undefined) team.description = optionalString(updates.description, "description", 1000);
  if (updates.logo !== undefined) team.logo = updates.logo;
  if (updates.coverImage !== undefined) team.coverImage = updates.coverImage;
  applyLocation(team, updates);
  try {
    await team.save();
  } catch (err) {
    if (duplicateName(err)) throw new AppError(409, "A team with this name already exists");
    throw err;
  }
  return detail(team._id);
}

export async function deleteTeam(teamId: string, user: IUser) {
  const team = await getOwnedTeamOrThrow(teamId, user._id);
  // Deleting a team mid-tournament would leave the bracket pointing at a
  // team that no longer exists.
  const active = await Tournament.exists({ teams: team._id, status: { $nin: ["completed", "cancelled", "rejected"] } });
  if (active) {
    throw new AppError(400, "This team is registered in an upcoming or ongoing tournament and can't be deleted");
  }
  await removeTeamEverywhere(team, user._id);
  return { message: "Team deleted successfully" };
}

/** Delete a team and call off its open challenges (also used by admin moderation). */
export async function removeTeamEverywhere(team: ITeam, actorId: Types.ObjectId | null) {
  const affected = await Challenge.find({
    status: { $in: ["open", "pending", "accepted", "countered"] },
    $or: [{ challengerTeam: team._id }, { opponentTeam: team._id }, { acceptedTeam: team._id }],
  }).select("challenger acceptedBy opponentUser opponentTeam");
  if (affected.length) {
    await Challenge.updateMany({ _id: { $in: affected.map((c) => c._id) } }, { $set: { status: "cancelled", respondedAt: new Date() } });
    await notify(
      affected.flatMap((c) => [c.challenger, c.acceptedBy]),
      { type: "challenge.cancelled", title: `${team.name} was deleted, so its match was called off`, actor: actorId }
    );
  }
  await team.deleteOne();
  await notify(team.members, { type: "team.removed", title: `${team.name} has been deleted`, actor: actorId });
}

// ---------------------------------------------------------------- join requests

export async function requestToJoin(teamId: string, user: IUser) {
  const team = await getTeamOrThrow(teamId);
  if (team.status !== "active") throw new AppError(403, "This team is suspended");
  const userId = user._id.toString();
  if (team.owner.toString() === userId) {
    throw new AppError(400, "Owner is already a member of the team");
  }
  if (team.members.some((m) => m.toString() === userId)) {
    throw new AppError(400, "You are already a member of this team");
  }
  if (team.pendingRequests.some((p) => p.toString() === userId)) {
    throw new AppError(400, "You already have a pending request for this team");
  }
  // Invited already? Joining is just accepting the invitation.
  if (team.invitations.some((i) => i.user.toString() === userId)) {
    return respondToInvitation(teamId, user, "accept");
  }
  const updated = await Team.updateOne(
    { _id: team._id, members: { $ne: user._id }, pendingRequests: { $ne: user._id } },
    { $push: { pendingRequests: user._id } }
  );
  if (!updated.modifiedCount) throw new AppError(409, "You already asked to join this team");
  await notify([team.owner, team.captain], {
    type: "team.join_request",
    title: `${user.name} wants to join ${team.name}`,
    link: `/team-dashboard?team=${team._id}`,
    entity: { type: "team", id: team._id },
    actor: user._id,
  });
  return detail(team._id);
}

export async function withdrawJoinRequest(teamId: string, user: IUser) {
  const team = await getTeamOrThrow(teamId);
  await Team.updateOne({ _id: team._id }, { $pull: { pendingRequests: user._id } });
  return detail(team._id);
}

async function addMember(team: ITeam, userId: Types.ObjectId) {
  const limit = await rosterLimit(team.sport);
  // Atomic: only adds if not already a member and the roster has room.
  const res = await Team.updateOne(
    { _id: team._id, members: { $ne: userId }, $expr: { $lt: [{ $size: "$members" }, limit] } },
    { $push: { members: userId }, $pull: { pendingRequests: userId, invitations: { user: userId } } }
  );
  if (!res.modifiedCount) {
    const fresh = await Team.findById(team._id).select("members");
    if (fresh?.members.some((m) => m.equals(userId))) {
      await Team.updateOne({ _id: team._id }, { $pull: { pendingRequests: userId, invitations: { user: userId } } });
      return;
    }
    throw new AppError(409, `The roster is full (${limit} players for this sport)`);
  }
}

export async function respondToJoinRequest(teamId: string, requesterId: string, action: "accept" | "reject", user: IUser) {
  const team = await getManagedTeamOrThrow(teamId, user._id);
  if (action !== "accept" && action !== "reject") throw new AppError(400, 'action must be "accept" or "reject"');
  if (!team.pendingRequests.some((p) => p.toString() === requesterId)) throw new AppError(404, "Join request not found");
  const requester = new Types.ObjectId(requesterId);
  if (action === "accept") await addMember(team, requester);
  else await Team.updateOne({ _id: team._id }, { $pull: { pendingRequests: requester } });
  await notify(requester, {
    type: "team.join_response",
    title: action === "accept" ? `You're now on ${team.name}` : `${team.name} declined your request`,
    link: `/teams/${team.slug ?? team._id}`,
    entity: { type: "team", id: team._id },
    actor: user._id,
  });
  return detail(team._id);
}

// ---------------------------------------------------------------- invitations

export async function invitePlayer(teamId: string, user: IUser, input: { username?: unknown; userId?: unknown }) {
  const team = await getManagedTeamOrThrow(teamId, user._id);
  let invitee;
  if (isObjectIdString(input.userId)) invitee = await User.findById(input.userId);
  else if (typeof input.username === "string" && input.username.trim()) {
    invitee = await User.findOne({ usernameKey: input.username.trim().replace(/^@/, "").toLowerCase() });
  } else throw new AppError(400, "username or userId is required");
  if (!invitee || invitee.status !== "active" || invitee.role !== "player") throw new AppError(404, "Player not found");
  if (team.members.some((m) => m.equals(invitee._id))) throw new AppError(400, `${invitee.name} is already on the team`);
  if (team.invitations.some((i) => i.user.equals(invitee._id))) throw new AppError(400, `${invitee.name} has already been invited`);
  if (team.members.length + team.invitations.length >= (await rosterLimit(team.sport))) {
    throw new AppError(409, "The roster is full, counting pending invitations");
  }
  // They asked to join already: inviting them is accepting their request.
  if (team.pendingRequests.some((p) => p.equals(invitee._id))) {
    return respondToJoinRequest(teamId, invitee._id.toString(), "accept", user);
  }
  const res = await Team.updateOne(
    { _id: team._id, "invitations.user": { $ne: invitee._id }, members: { $ne: invitee._id } },
    { $push: { invitations: { user: invitee._id, invitedBy: user._id, createdAt: new Date() } } }
  );
  if (!res.modifiedCount) throw new AppError(409, "Already invited");
  await notify(invitee._id, {
    type: "team.invitation",
    title: `${user.name} invited you to join ${team.name}`,
    link: "/team-dashboard?tab=invitations",
    entity: { type: "team", id: team._id },
    actor: user._id,
  });
  return detail(team._id);
}

export async function cancelInvitation(teamId: string, user: IUser, inviteeId: string) {
  const team = await getManagedTeamOrThrow(teamId, user._id);
  if (!isObjectIdString(inviteeId)) throw new AppError(400, "Invalid id");
  await Team.updateOne({ _id: team._id }, { $pull: { invitations: { user: new Types.ObjectId(inviteeId) } } });
  return detail(team._id);
}

export async function listMyInvitations(user: IUser) {
  const teams = await Team.find({ "invitations.user": user._id, status: "active" })
    .populate([{ path: "owner", select: "name username" }, { path: "invitations.invitedBy", select: "name" }])
    .sort({ updatedAt: -1 });
  return teams.map((t) => {
    const inv: any = t.invitations.find((i) => idStr(i.user) === user._id.toString());
    return { team: t, invitedBy: inv?.invitedBy ? { id: idStr(inv.invitedBy), name: inv.invitedBy.name } : null, invitedAt: inv?.createdAt ?? null };
  });
}

export async function respondToInvitation(teamId: string, user: IUser, action: "accept" | "decline") {
  const team = await getTeamOrThrow(teamId);
  const inv = team.invitations.find((i) => i.user.equals(user._id));
  if (!inv) throw new AppError(404, "Invitation not found");
  if (action === "accept") {
    if (team.status !== "active") throw new AppError(403, "This team is suspended");
    await addMember(team, user._id);
  } else if (action === "decline") {
    await Team.updateOne({ _id: team._id }, { $pull: { invitations: { user: user._id } } });
  } else throw new AppError(400, 'action must be "accept" or "decline"');
  await notify([team.owner, team.captain, inv.invitedBy], {
    type: "team.join_response",
    title: action === "accept" ? `${user.name} joined ${team.name}` : `${user.name} declined the invitation to ${team.name}`,
    link: `/team-dashboard?team=${team._id}`,
    entity: { type: "team", id: team._id },
    actor: user._id,
  });
  return detail(team._id);
}

// ---------------------------------------------------------------- roster

export async function removeMember(teamId: string, memberId: string, user: IUser) {
  const team = await getOwnedTeamOrThrow(teamId, user._id);
  if (memberId === user._id.toString()) {
    throw new AppError(400, "Owner cannot remove themselves from the team");
  }
  if (!isObjectIdString(memberId)) throw new AppError(400, "Invalid id");
  const member = new Types.ObjectId(memberId);
  const $set: any = {};
  if (team.captain?.equals(member)) $set.captain = null;
  if (team.viceCaptain?.equals(member)) $set.viceCaptain = null;
  await Team.updateOne({ _id: team._id }, { $pull: { members: member }, ...(Object.keys($set).length ? { $set } : {}) });
  await notify(member, { type: "team.removed", title: `You were removed from ${team.name}`, entity: { type: "team", id: team._id }, actor: user._id });
  return detail(team._id);
}

export async function leaveTeam(teamId: string, user: IUser) {
  const team = await getTeamOrThrow(teamId);
  const role = roleIn(team, user._id);
  if (!role) throw new AppError(400, "You aren't on this team");
  if (role === "owner") throw new AppError(400, "Transfer ownership to another member before leaving");
  const $set: any = {};
  if (role === "captain") $set.captain = null;
  if (role === "vice_captain") $set.viceCaptain = null;
  await Team.updateOne({ _id: team._id }, { $pull: { members: user._id }, ...(Object.keys($set).length ? { $set } : {}) });
  await notify([team.owner, team.captain], { type: "team.removed", title: `${user.name} left ${team.name}`, entity: { type: "team", id: team._id }, actor: user._id });
  return { message: `You left ${team.name}` };
}

export async function setMemberRole(teamId: string, memberId: string, user: IUser, roleInput: unknown) {
  const team = await getOwnedTeamOrThrow(teamId, user._id);
  if (!["captain", "vice_captain", "player"].includes(String(roleInput))) {
    throw new AppError(400, 'role must be "captain", "vice_captain" or "player"');
  }
  const role = roleInput as "captain" | "vice_captain" | "player";
  if (!isObjectIdString(memberId) || !team.members.some((m) => m.toString() === memberId)) {
    throw new AppError(404, "That player isn't on the team");
  }
  const member = new Types.ObjectId(memberId);
  const $set: any = {};
  // Moving someone into a role clears it from whoever had it, and from their old role.
  if (team.captain?.equals(member)) $set.captain = null;
  if (team.viceCaptain?.equals(member)) $set.viceCaptain = null;
  if (role === "captain") $set.captain = member;
  if (role === "vice_captain") $set.viceCaptain = member;
  await Team.updateOne({ _id: team._id }, { $set });
  await notify(member, {
    type: "team.role_changed",
    title: role === "player" ? `You're now a player in ${team.name}` : `You're now ${role === "captain" ? "captain" : "vice-captain"} of ${team.name}`,
    link: `/teams/${team.slug ?? team._id}`,
    entity: { type: "team", id: team._id },
    actor: user._id,
  });
  return detail(team._id);
}

export async function transferOwnership(teamId: string, user: IUser, newOwnerId: unknown) {
  const team = await getOwnedTeamOrThrow(teamId, user._id);
  if (!isObjectIdString(newOwnerId) || !team.members.some((m) => m.toString() === newOwnerId)) {
    throw new AppError(400, "The new owner must be a member of the team");
  }
  if (newOwnerId === user._id.toString()) throw new AppError(400, "You already own this team");
  const newOwner = await User.findById(newOwnerId);
  if (!newOwner || newOwner.status !== "active") throw new AppError(400, "That account can't own a team");
  const limit = getEntitlements(newOwner).maxOwnedTeams;
  if (Number.isFinite(limit) && (await Team.countDocuments({ owner: newOwner._id })) >= limit) {
    throw new AppError(409, `${newOwner.name} already owns the most teams their plan allows`);
  }
  const $set: any = { owner: newOwner._id };
  if (team.captain?.equals(newOwner._id)) $set.captain = null;
  if (team.viceCaptain?.equals(newOwner._id)) $set.viceCaptain = null;
  const res = await Team.updateOne({ _id: team._id, owner: user._id }, { $set });
  if (!res.modifiedCount) throw new AppError(409, "Ownership changed in the meantime");
  await audit({
    actor: user._id,
    actorRole: user.role,
    action: "team.ownership_transferred",
    target: { type: "team", id: team._id },
    before: { owner: user._id.toString() },
    after: { owner: newOwner._id.toString() },
  });
  await notify(newOwner._id, {
    type: "team.role_changed",
    title: `You now own ${team.name}`,
    link: `/team-dashboard?team=${team._id}`,
    entity: { type: "team", id: team._id },
    actor: user._id,
  });
  return detail(team._id);
}

// ---------------------------------------------------------------- admin moderation

export async function adminListTeams(query: Record<string, unknown>, p: Page) {
  const filter: any = {};
  const search = queryString(query.search);
  if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };
  const status = queryString(query.status);
  if (status === "active" || status === "suspended") filter.status = status;
  const sport = queryString(query.sport);
  if (sport && isValidSportSlug(sport)) filter.sport = sport;
  const [teams, total] = await Promise.all([
    Team.find(filter).populate(TEAM_SUMMARY_POPULATE).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    Team.countDocuments(filter),
  ]);
  return { teams, ...pageMeta(p, total) };
}

export async function adminSetTeamStatus(actor: IUser, teamId: string, input: { status?: unknown; reason?: unknown }) {
  const team = await getTeamOrThrow(teamId);
  const status = input.status;
  if (status !== "active" && status !== "suspended") throw new AppError(400, 'status must be "active" or "suspended"');
  const reason = optionalString(input.reason, "reason", 500) ?? null;
  if (status === "suspended" && !reason) throw new AppError(400, "A reason is required to suspend a team");
  const before = { status: team.status, statusReason: team.statusReason ?? null };
  team.status = status;
  team.statusReason = reason;
  await team.save();
  await audit({
    actor: actor._id,
    actorRole: actor.role,
    action: status === "suspended" ? "team.suspended" : "team.reactivated",
    target: { type: "team", id: team._id },
    before,
    after: { status, statusReason: reason },
    reason: reason ?? undefined,
  });
  await notify([team.owner], {
    type: "account.status",
    title: status === "suspended" ? `${team.name} has been suspended` : `${team.name} is active again`,
    body: reason ?? undefined,
    entity: { type: "team", id: team._id },
  });
  return detail(team._id);
}

export async function adminDeleteTeam(actor: IUser, teamId: string, reasonInput: unknown) {
  const team = await getTeamOrThrow(teamId);
  const reason = optionalString(reasonInput, "reason", 500);
  if (!reason) throw new AppError(400, "A reason is required to delete a team");
  await audit({
    actor: actor._id,
    actorRole: actor.role,
    action: "team.deleted_by_admin",
    target: { type: "team", id: team._id },
    before: { name: team.name, sport: team.sport, owner: team.owner.toString(), members: team.members.length },
    reason,
  });
  await removeTeamEverywhere(team, actor._id);
  return { message: "Team deleted" };
}
