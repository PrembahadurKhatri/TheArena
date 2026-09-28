import { Types } from "mongoose";
import { Team } from "../models/Team";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isValidSportSlug } from "../utils/sports";

const TEAM_SUMMARY_POPULATE = { path: "owner", select: "name" };
const TEAM_DETAIL_POPULATE = [
  { path: "owner", select: "name" },
  { path: "members", select: "name photo" },
  { path: "pendingRequests", select: "name" },
];

export async function listTeams(filters: { sport?: string; search?: string }) {
  const query: any = {};
  if (filters.sport) query.sport = filters.sport;
  if (filters.search) query.name = { $regex: filters.search, $options: "i" };

  return Team.find(query).populate(TEAM_SUMMARY_POPULATE).sort({ createdAt: -1 });
}

export async function listMyTeams(userId: string) {
  return Team.find({ $or: [{ owner: userId }, { members: userId }] })
    .populate(TEAM_SUMMARY_POPULATE)
    .sort({ createdAt: -1 });
}

export async function getTeamById(id: string) {
  const team = await Team.findById(id).populate(TEAM_DETAIL_POPULATE);
  if (!team) throw new AppError(404, "Team not found");
  return team;
}

export async function createTeam(
  owner: IUser,
  input: { name: string; sport: string; logo?: string | null }
) {
  const { name, sport, logo } = input;
  if (!name || !sport) throw new AppError(400, "name and sport are required");
  if (!isValidSportSlug(sport)) throw new AppError(400, `Invalid sport slug: ${sport}`);

  if (!owner.isPremium) {
    const ownedCount = await Team.countDocuments({ owner: owner._id });
    if (ownedCount >= 1) {
      throw new AppError(403, "Free plan is limited to 1 team. Upgrade to Premium for unlimited teams.");
    }
  }

  const team = await Team.create({
    name,
    sport,
    logo: logo ?? null,
    owner: owner._id,
    members: [owner._id],
    pendingRequests: [],
  });

  return Team.findById(team._id).populate(TEAM_DETAIL_POPULATE);
}

async function getOwnedTeamOrThrow(teamId: string, userId: Types.ObjectId) {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError(404, "Team not found");
  if (team.owner.toString() !== userId.toString()) {
    throw new AppError(403, "Only the team owner can perform this action");
  }
  return team;
}

export async function updateTeam(
  teamId: string,
  user: IUser,
  updates: { name?: string; sport?: string; logo?: string }
) {
  const team = await getOwnedTeamOrThrow(teamId, user._id);
  if (updates.name !== undefined) team.name = updates.name;
  if (updates.sport !== undefined) {
    if (!isValidSportSlug(updates.sport)) throw new AppError(400, `Invalid sport slug: ${updates.sport}`);
    team.sport = updates.sport;
  }
  if (updates.logo !== undefined) team.logo = updates.logo;
  await team.save();
  return Team.findById(team._id).populate(TEAM_DETAIL_POPULATE);
}

export async function deleteTeam(teamId: string, user: IUser) {
  const team = await getOwnedTeamOrThrow(teamId, user._id);
  await team.deleteOne();
  return { message: "Team deleted successfully" };
}

export async function requestToJoin(teamId: string, user: IUser) {
  const team = await Team.findById(teamId);
  if (!team) throw new AppError(404, "Team not found");

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

  team.pendingRequests.push(user._id);
  await team.save();
  return Team.findById(team._id).populate(TEAM_DETAIL_POPULATE);
}

export async function respondToJoinRequest(
  teamId: string,
  requesterId: string,
  action: "accept" | "reject",
  user: IUser
) {
  const team = await getOwnedTeamOrThrow(teamId, user._id);

  const idx = team.pendingRequests.findIndex((p) => p.toString() === requesterId);
  if (idx === -1) throw new AppError(404, "Join request not found");

  team.pendingRequests.splice(idx, 1);
  if (action === "accept") {
    if (!team.members.some((m) => m.toString() === requesterId)) {
      team.members.push(new Types.ObjectId(requesterId));
    }
  } else if (action !== "reject") {
    throw new AppError(400, 'action must be "accept" or "reject"');
  }

  await team.save();
  return Team.findById(team._id).populate(TEAM_DETAIL_POPULATE);
}

export async function removeMember(teamId: string, memberId: string, user: IUser) {
  const team = await getOwnedTeamOrThrow(teamId, user._id);
  if (memberId === user._id.toString()) {
    throw new AppError(400, "Owner cannot remove themselves from the team");
  }
  team.members = team.members.filter((m) => m.toString() !== memberId) as any;
  await team.save();
  return Team.findById(team._id).populate(TEAM_DETAIL_POPULATE);
}
