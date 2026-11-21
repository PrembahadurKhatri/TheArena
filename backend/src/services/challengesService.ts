import { Types } from "mongoose";
import { Challenge, IChallenge } from "../models/Challenge";
import { Team } from "../models/Team";
import { User, IUser } from "../models/User";
import { Ground } from "../models/Ground";
import { GroundBooking } from "../models/GroundBooking";
import { AppError } from "../utils/AppError";
import { isValidProvince } from "../utils/provinces";
import { SPORT_SLUG_ENUM } from "../utils/sports";
import { isObjectIdString, optionalString } from "../utils/validation";
import {
  BOOKING_HOLD_MINUTES,
  MAX_DAYS_AHEAD,
  findBookingConflict,
  parseTimeToMinutes,
  slotStart,
  validateDate,
} from "./groundBookingsService";
import { withLock, groundDayLockKey } from "../utils/lock";

const MAX_MATCH_HOURS = 12;

export const CHALLENGE_POPULATE = [
  { path: "challenger", select: "name photo" },
  { path: "challengerTeam", select: "name logo sport owner members" },
  { path: "opponentUser", select: "name photo" },
  { path: "opponentTeam", select: "name logo sport owner members" },
  { path: "acceptedBy", select: "name photo" },
  { path: "acceptedTeam", select: "name logo sport owner members" },
  { path: "ground", select: "name location sport pricePerHour image" },
];

// Today in Nepal time (UTC+05:45), as YYYY-MM-DD.
function todayInNepal() {
  return new Date(Date.now() + (5 * 60 + 45) * 60 * 1000).toISOString().slice(0, 10);
}

function idOf(ref: any): string | null {
  if (!ref) return null;
  return ref._id ? ref._id.toString() : ref.toString();
}

function validateSlot(dateInput: unknown, startTime: unknown, endTime: unknown) {
  const date = validateDate(dateInput);
  if (typeof startTime !== "string" || typeof endTime !== "string") {
    throw new AppError(400, "startTime and endTime are required (HH:MM)");
  }
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end <= start) throw new AppError(400, "endTime must be after startTime");
  if ((end - start) / 60 > MAX_MATCH_HOURS) throw new AppError(400, `A match can be at most ${MAX_MATCH_HOURS} hours`);
  const startsAt = slotStart(date, startTime).getTime();
  if (startsAt < Date.now()) throw new AppError(400, "You can't set a match in the past");
  if (startsAt > Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    throw new AppError(400, `Matches can be set at most ${MAX_DAYS_AHEAD} days ahead`);
  }
  return { date, startTime, endTime };
}

// A ground slot is taken if a booking holds it, or another accepted
// challenge already plans to play there at an overlapping time.
async function findGroundClash(params: {
  groundId: Types.ObjectId | string;
  date: string;
  startTime: string;
  endTime: string;
  excludeChallengeId?: Types.ObjectId;
}) {
  const booking = await findBookingConflict(params);
  if (booking) return { startTime: booking.startTime, endTime: booking.endTime, kind: "booking" as const };

  const start = parseTimeToMinutes(params.startTime);
  const end = parseTimeToMinutes(params.endTime);
  const sameDay = await Challenge.find({
    ground: params.groundId,
    date: params.date,
    status: "accepted",
    ...(params.excludeChallengeId ? { _id: { $ne: params.excludeChallengeId } } : {}),
  });
  const clash = sameDay.find((c) => start < parseTimeToMinutes(c.endTime) && parseTimeToMinutes(c.startTime) < end);
  return clash ? { startTime: clash.startTime, endTime: clash.endTime, kind: "match" as const } : null;
}

async function requireOwnedTeam(user: IUser, teamId: unknown, sport: string, label: string) {
  if (!isObjectIdString(teamId)) throw new AppError(400, `${label} is required for a team match`);
  const team = await Team.findById(teamId);
  if (!team) throw new AppError(404, "Team not found");
  if (team.owner.toString() !== user._id.toString()) {
    throw new AppError(403, "Only the team owner can arrange matches for this team");
  }
  if (team.sport !== sport) throw new AppError(400, `${team.name} doesn't play this sport`);
  return team;
}

export async function getGroundAvailability(groundId: string, dateInput: unknown) {
  if (!isObjectIdString(groundId)) throw new AppError(400, "Invalid id");
  const date = validateDate(dateInput);
  const ground = await Ground.findById(groundId);
  if (!ground) throw new AppError(404, "Ground not found");

  const holdCutoff = new Date(Date.now() - BOOKING_HOLD_MINUTES * 60 * 1000);
  const [bookings, matches] = await Promise.all([
    GroundBooking.find({
      ground: ground._id,
      date,
      $or: [{ status: "confirmed" }, { status: "pending_payment", createdAt: { $gt: holdCutoff } }],
    }),
    Challenge.find({ ground: ground._id, date, status: "accepted" }),
  ]);

  const taken = [
    ...bookings.map((b) => ({ startTime: b.startTime, endTime: b.endTime, kind: "booking" })),
    ...matches.map((c) => ({ startTime: c.startTime, endTime: c.endTime, kind: "match" })),
  ].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  return { date, taken };
}

export async function listOpenChallenges(filters: { sport?: string; mode?: string; province?: string }) {
  const query: any = { status: "open", date: { $gte: todayInNepal() } };
  if (filters.sport) query.sport = filters.sport;
  if (filters.mode === "team" || filters.mode === "player") query.mode = filters.mode;
  if (filters.province) query.province = filters.province;
  return Challenge.find(query).populate(CHALLENGE_POPULATE).sort({ date: 1, startTime: 1 }).limit(200);
}

export async function listMyChallenges(user: IUser) {
  const ownedTeams = await Team.find({ owner: user._id }).select("_id");
  const teamIds = ownedTeams.map((t) => t._id);
  return Challenge.find({
    $or: [
      { challenger: user._id },
      { opponentUser: user._id },
      { opponentTeam: { $in: teamIds } },
      { acceptedBy: user._id },
    ],
  })
    .populate(CHALLENGE_POPULATE)
    .sort({ date: 1, startTime: 1 })
    .limit(300);
}

export async function getChallengeById(id: string) {
  if (!isObjectIdString(id)) throw new AppError(400, "Invalid id");
  const challenge = await Challenge.findById(id).populate(CHALLENGE_POPULATE);
  if (!challenge) throw new AppError(404, "Challenge not found");
  return challenge;
}

export async function createChallenge(
  user: IUser,
  input: {
    sport?: string;
    mode?: string;
    teamId?: string;
    opponentUserId?: string;
    opponentTeamId?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    groundId?: string;
    province?: string;
    venueNote?: string;
    message?: string;
  }
) {
  const sport = input.sport;
  if (!sport || !SPORT_SLUG_ENUM.includes(sport)) throw new AppError(400, "A valid sport is required");
  const mode = input.mode;
  if (mode !== "team" && mode !== "player") throw new AppError(400, 'mode must be "team" or "player"');
  const slot = validateSlot(input.date, input.startTime, input.endTime);

  if (input.province && !isValidProvince(input.province)) throw new AppError(400, `Invalid province: ${input.province}`);
  const venueNote = optionalString(input.venueNote, "venueNote", 200);
  const message = optionalString(input.message, "message", 500);

  let challengerTeam = null;
  let opponentUser = null;
  let opponentTeam = null;

  if (mode === "team") {
    challengerTeam = await requireOwnedTeam(user, input.teamId, sport, "Your team");
    if (input.opponentTeamId) {
      if (!isObjectIdString(input.opponentTeamId)) throw new AppError(400, "Invalid opponent team");
      opponentTeam = await Team.findById(input.opponentTeamId);
      if (!opponentTeam) throw new AppError(404, "Opponent team not found");
      if (opponentTeam.sport !== sport) throw new AppError(400, `${opponentTeam.name} doesn't play this sport`);
      if (opponentTeam._id.equals(challengerTeam._id)) throw new AppError(400, "A team can't challenge itself");
      if (opponentTeam.owner.toString() === user._id.toString()) {
        throw new AppError(400, "You own both teams; pick a team run by someone else");
      }
    }
  } else if (input.opponentUserId) {
    if (!isObjectIdString(input.opponentUserId)) throw new AppError(400, "Invalid opponent");
    if (input.opponentUserId === user._id.toString()) throw new AppError(400, "You can't challenge yourself");
    opponentUser = await User.findById(input.opponentUserId).select("_id");
    if (!opponentUser) throw new AppError(404, "Opponent not found");
  }

  let ground = null;
  if (input.groundId) {
    if (!isObjectIdString(input.groundId)) throw new AppError(400, "Invalid ground");
    ground = await Ground.findById(input.groundId);
    if (!ground) throw new AppError(404, "Ground not found");
    if (ground.sport !== sport) throw new AppError(400, `${ground.name} isn't a ${sport} ground`);
    const clash = await findGroundClash({ groundId: ground._id, ...slot });
    if (clash) {
      throw new AppError(
        409,
        `${ground.name} is taken from ${clash.startTime} to ${clash.endTime} on ${slot.date}. Pick another time or ground.`
      );
    }
  }

  const challenge = await Challenge.create({
    sport,
    mode,
    challenger: user._id,
    challengerTeam: challengerTeam?._id ?? null,
    opponentUser: opponentUser?._id ?? null,
    opponentTeam: opponentTeam?._id ?? null,
    ...slot,
    ground: ground?._id ?? null,
    province: input.province || undefined,
    venueNote,
    message,
    status: opponentUser || opponentTeam ? "pending" : "open",
  });

  return getChallengeById(challenge._id.toString());
}

function assertStillUpcoming(c: IChallenge) {
  if (slotStart(c.date, c.startTime).getTime() < Date.now()) {
    throw new AppError(400, "This match time has already passed");
  }
}

export async function acceptChallenge(user: IUser, id: string, input: { teamId?: string }) {
  const challenge = await getChallengeById(id);
  if (challenge.status !== "open" && challenge.status !== "pending") {
    throw new AppError(400, `This challenge is already ${challenge.status}`);
  }
  assertStillUpcoming(challenge);
  if (idOf(challenge.challenger) === user._id.toString()) throw new AppError(400, "You can't accept your own challenge");

  let acceptedTeam = null;
  if (challenge.status === "pending") {
    if (challenge.mode === "player") {
      if (idOf(challenge.opponentUser) !== user._id.toString()) {
        throw new AppError(403, "This challenge was sent to someone else");
      }
    } else {
      const opp: any = challenge.opponentTeam;
      if (!opp || idOf(opp.owner) !== user._id.toString()) {
        throw new AppError(403, "Only the challenged team's owner can accept");
      }
      acceptedTeam = opp;
    }
  } else if (challenge.mode === "team") {
    acceptedTeam = await requireOwnedTeam(user, input.teamId, challenge.sport, "Your team");
    if (challenge.challengerTeam && acceptedTeam._id.equals(idOf(challenge.challengerTeam)!)) {
      throw new AppError(400, "A team can't play itself");
    }
  }

  const takeChallenge = async () => {
    if (challenge.ground) {
      const clash = await findGroundClash({
        groundId: idOf(challenge.ground)!,
        date: challenge.date,
        startTime: challenge.startTime,
        endTime: challenge.endTime,
        excludeChallengeId: challenge._id,
      });
      if (clash) {
        throw new AppError(409, `The ground has been taken from ${clash.startTime} to ${clash.endTime}. Ask the challenger to change it.`);
      }
    }

    // Atomic on status so two people can't both take an open challenge.
    return Challenge.findOneAndUpdate(
      { _id: challenge._id, status: challenge.status },
      {
        $set: {
          status: "accepted",
          acceptedBy: user._id,
          acceptedTeam: acceptedTeam ? acceptedTeam._id : null,
          respondedAt: new Date(),
        },
      },
      { new: true }
    );
  };
  // With a ground, the clash check and the accept run under the same lock as
  // ground bookings, so a booking and an accepted match can't claim one slot.
  const updated = challenge.ground
    ? await withLock(groundDayLockKey(idOf(challenge.ground), challenge.date), takeChallenge)
    : await takeChallenge();
  if (!updated) throw new AppError(409, "Someone else just took this challenge");
  return getChallengeById(id);
}

export async function declineChallenge(user: IUser, id: string) {
  const challenge = await getChallengeById(id);
  if (challenge.status !== "pending") throw new AppError(400, "Only a challenge sent to you can be declined");
  const isTarget =
    challenge.mode === "player"
      ? idOf(challenge.opponentUser) === user._id.toString()
      : idOf((challenge.opponentTeam as any)?.owner) === user._id.toString();
  if (!isTarget) throw new AppError(403, "This challenge was sent to someone else");
  challenge.status = "declined";
  challenge.respondedAt = new Date();
  await challenge.save();
  return getChallengeById(id);
}

export async function cancelChallenge(user: IUser, id: string) {
  const challenge = await getChallengeById(id);
  const isChallenger = idOf(challenge.challenger) === user._id.toString();
  const isAcceptor = idOf(challenge.acceptedBy) === user._id.toString();
  if (!isChallenger && !(challenge.status === "accepted" && isAcceptor)) {
    throw new AppError(403, "Only the people in this match can call it off");
  }
  if (!["open", "pending", "accepted"].includes(challenge.status)) {
    throw new AppError(400, `This challenge is already ${challenge.status}`);
  }
  challenge.status = "cancelled";
  await challenge.save();
  return getChallengeById(id);
}
