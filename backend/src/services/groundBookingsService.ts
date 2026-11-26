import { Types } from "mongoose";
import { GroundBooking, HOLDING_STATUSES } from "../models/GroundBooking";
import { Ground } from "../models/Ground";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isObjectIdString } from "../utils/validation";
import { withLock, groundDayLockKey } from "../utils/lock";
import { Payment } from "../models/Payment";
import { getEntitlements } from "./entitlementsService";
import { notify } from "./notificationService";
import { getSetting } from "./settingsService";


export function parseTimeToMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) throw new AppError(400, `Invalid time format: ${value}. Expected HH:MM`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new AppError(400, `Invalid time value: ${value}`);
  }
  return hours * 60 + minutes;
}

function computeHours(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end <= start) {
    throw new AppError(400, "endTime must be after startTime");
  }
  return (end - start) / 60;
}

// How long an unpaid booking holds its slot before another user may take
// it. The expiry sweeper cancels holds older than this.
/** Minutes an unpaid online booking holds its slot (platform setting). */
export const BOOKING_HOLD_MINUTES = () => getSetting("bookingHoldMinutes");
const MAX_BOOKING_HOURS = 12;
export const MAX_DAYS_AHEAD = 90;

// Grounds are in Nepal, so a slot's date/time is Nepal time (UTC+05:45).
export function slotStart(date: string, startTime: string): Date {
  return new Date(`${date}T${startTime.padStart(5, "0")}:00+05:45`);
}

export function validateDate(date: unknown): string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
    throw new AppError(400, "date must be in YYYY-MM-DD format");
  }
  return date;
}

// Finds a booking on the same ground and date whose time range overlaps
// [startTime, endTime). Confirmed bookings always block; unpaid bookings
// block only while their hold is still fresh.
export async function findBookingConflict(params: {
  groundId: Types.ObjectId | string;
  date: string;
  startTime: string;
  endTime: string;
  excludeBookingId?: Types.ObjectId;
  confirmedOnly?: boolean;
}) {
  const start = parseTimeToMinutes(params.startTime);
  const end = parseTimeToMinutes(params.endTime);
  const holdCutoff = new Date(Date.now() - BOOKING_HOLD_MINUTES() * 60 * 1000);

  // "Confirmed" here means anything that firmly holds the slot: paid,
  // pay-at-venue, or blocked by the owner.
  const statusFilter = params.confirmedOnly
    ? { status: { $in: HOLDING_STATUSES } }
    : { $or: [{ status: { $in: HOLDING_STATUSES } }, { status: "pending_payment", createdAt: { $gt: holdCutoff } }] };

  const sameDay = await GroundBooking.find({
    ground: params.groundId,
    date: params.date,
    ...(params.excludeBookingId ? { _id: { $ne: params.excludeBookingId } } : {}),
    ...statusFilter,
  });

  return (
    sameDay.find((b) => {
      const bStart = parseTimeToMinutes(b.startTime);
      const bEnd = parseTimeToMinutes(b.endTime);
      return start < bEnd && bStart < end;
    }) ?? null
  );
}

export const CANCEL_CUTOFF_HOURS = () => getSetting("bookingCancelCutoffHours");

export async function createBooking(
  user: IUser,
  input: { groundId: string; date: string; startTime: string; endTime: string; paymentMethod?: string; note?: string }
) {
  const { groundId, startTime, endTime } = input;
  if (!groundId || !input.date || typeof startTime !== "string" || typeof endTime !== "string") {
    throw new AppError(400, "groundId, date, startTime and endTime are required");
  }
  if (!isObjectIdString(groundId)) throw new AppError(400, "Invalid groundId");
  const date = validateDate(input.date);
  const paymentMethod = input.paymentMethod ?? "online";
  if (paymentMethod !== "online" && paymentMethod !== "pay_at_venue") throw new AppError(400, 'paymentMethod must be "online" or "pay_at_venue"');

  const ground = await Ground.findById(groundId);
  if (!ground || (ground.status && ground.status !== "approved")) throw new AppError(404, "Ground not found");
  if (ground.owner?.equals(user._id)) throw new AppError(400, "Owners block their own slots from the owner dashboard");

  const hours = computeHours(startTime, endTime);
  if (hours > MAX_BOOKING_HOURS) throw new AppError(400, `A booking can be at most ${MAX_BOOKING_HOURS} hours`);

  const start = slotStart(date, startTime);
  if (start.getTime() < Date.now()) {
    throw new AppError(400, "You can't book a time slot in the past");
  }
  if (start.getTime() > Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    throw new AppError(400, `Bookings can be made at most ${MAX_DAYS_AHEAD} days ahead`);
  }
  const { assertWithinHours } = await import("./groundsService");
  assertWithinHours(ground, date, startTime, endTime);

  // Price is always computed here from the ground's stored rate; the
  // member discount comes from the user's plan.
  const discount = getEntitlements(user).bookingDiscountPct / 100;
  const totalAmount = Math.round(ground.pricePerHour * hours * (1 - discount) * 100) / 100;

  // Check-then-insert under a per-ground-per-day lock: without it, two
  // requests for the same slot at the same moment could both find it free.
  const booking = await withLock(groundDayLockKey(ground._id, date), async () => {
    const conflict = await findBookingConflict({ groundId: ground._id, date, startTime, endTime });
    if (conflict) {
      throw new AppError(
        409,
        `This ground is already booked from ${conflict.startTime} to ${conflict.endTime} on ${date}. Please choose another time.`
      );
    }
    return GroundBooking.create({
      ground: ground._id,
      user: user._id,
      date,
      startTime,
      endTime,
      totalAmount,
      // Pay at the venue holds the slot right away; the owner marks it paid.
      status: paymentMethod === "pay_at_venue" ? "confirmed_unpaid" : "pending_payment",
      paymentMethod,
      note: typeof input.note === "string" ? input.note.slice(0, 300) : undefined,
      payment: null,
    });
  });

  if (paymentMethod === "pay_at_venue" && ground.owner) {
    await notify(ground.owner, {
      type: "booking.confirmed",
      title: `New booking at ${ground.name}: ${date}, ${startTime}–${endTime}`,
      body: `${user.name} will pay Rs ${totalAmount} at the venue.`,
      link: "/owner?tab=bookings",
      entity: { type: "booking", id: booking._id },
      actor: user._id,
    });
  }
  return GroundBooking.findById(booking._id).populate("ground");
}

export async function listMyBookings(user: IUser) {
  return GroundBooking.find({ user: user._id, source: { $ne: "owner" } })
    .sort({ createdAt: -1 })
    .populate("ground")
    .populate("payment");
}

/** The booker cancels, up to CANCEL_CUTOFF_HOURS before the start. */
export async function cancelMyBooking(user: IUser, bookingId: string, reasonInput?: unknown) {
  if (!isObjectIdString(bookingId)) throw new AppError(404, "Booking not found");
  const b = await GroundBooking.findById(bookingId).populate("ground");
  if (!b || !b.user.equals(user._id)) throw new AppError(404, "Booking not found");
  if (!["pending_payment", "confirmed", "confirmed_unpaid"].includes(b.status)) throw new AppError(400, `This booking is already ${b.status.replace("_", " ")}`);
  const startsIn = slotStart(b.date, b.startTime).getTime() - Date.now();
  if (startsIn < CANCEL_CUTOFF_HOURS() * 3600_000) {
    throw new AppError(400, `Bookings can be cancelled up to ${CANCEL_CUTOFF_HOURS()} hours before the start. Contact the ground.`);
  }
  const reason = typeof reasonInput === "string" ? reasonInput.trim().slice(0, 300) : null;
  const res = await GroundBooking.updateOne(
    { _id: b._id, status: b.status },
    { $set: { status: "cancelled", cancelledAt: new Date(), cancelledBy: user._id, cancelReason: reason || "Cancelled by the booker" } }
  );
  if (!res.modifiedCount) throw new AppError(409, "The booking changed in the meantime");
  // A paid booking's money is returned by staff (payments are manual for now).
  if (b.payment) await Payment.updateOne({ _id: b.payment, status: { $in: ["success", "paid"] } }, { $set: { refundRequested: true } });
  else await Payment.updateMany({ type: "ground_booking", refId: b._id, status: "pending" }, { $set: { status: "cancelled" } });
  const ground: any = b.ground;
  if (ground?.owner) {
    await notify(ground.owner, {
      type: "booking.cancelled",
      title: `Booking cancelled at ${ground.name}: ${b.date}, ${b.startTime}–${b.endTime}`,
      body: reason ?? undefined,
      link: "/owner?tab=bookings",
      entity: { type: "booking", id: b._id },
      actor: user._id,
    });
  }
  return GroundBooking.findById(b._id).populate("ground").populate("payment");
}

// ---------------------------------------------------------------- ground owner

async function ownedGroundIds(owner: IUser) {
  return (await Ground.find({ owner: owner._id }).select("_id")).map((g) => g._id);
}

export async function listOwnerBookings(owner: IUser, query: Record<string, unknown>) {
  const ids = await ownedGroundIds(owner);
  const filter: any = { ground: { $in: ids } };
  const groundId = typeof query.groundId === "string" ? query.groundId : undefined;
  if (groundId) {
    if (!ids.some((id) => id.toString() === groundId)) throw new AppError(404, "Ground not found");
    filter.ground = groundId;
  }
  if (typeof query.date === "string" && query.date) filter.date = validateDate(query.date);
  else if (query.upcoming !== "false") filter.date = { $gte: new Date(Date.now() + 5.75 * 3600_000).toISOString().slice(0, 10) };
  if (typeof query.status === "string" && query.status) filter.status = query.status;
  return GroundBooking.find(filter).sort({ date: 1, startTime: 1 }).limit(500).populate("ground", "name").populate("user", "name username phone");
}

async function ownerBookingOrThrow(owner: IUser, bookingId: string) {
  if (!isObjectIdString(bookingId)) throw new AppError(404, "Booking not found");
  const b = await GroundBooking.findById(bookingId).populate("ground");
  const g: any = b?.ground;
  if (!b || !g?.owner?.equals(owner._id)) throw new AppError(404, "Booking not found");
  return b;
}

/**
 * Owner actions on a booking:
 *  - mark_paid   pay-at-venue booking paid           -> confirmed
 *  - complete    the slot was played                 -> completed
 *  - no_show     the booker didn't come              -> no_show
 *  - cancel      the owner can't host it (reason)    -> cancelled (booker notified)
 */
export async function ownerBookingAction(owner: IUser, bookingId: string, action: unknown, reasonInput?: unknown) {
  const b = await ownerBookingOrThrow(owner, bookingId);
  const reason = typeof reasonInput === "string" ? reasonInput.trim().slice(0, 300) : "";
  const started = slotStart(b.date, b.startTime).getTime() <= Date.now();
  const transitions: Record<string, { from: string[]; to: string; needsStart?: boolean }> = {
    mark_paid: { from: ["confirmed_unpaid"], to: "confirmed" },
    complete: { from: ["confirmed", "confirmed_unpaid"], to: "completed", needsStart: true },
    no_show: { from: ["confirmed", "confirmed_unpaid"], to: "no_show", needsStart: true },
    cancel: { from: ["pending_payment", "confirmed", "confirmed_unpaid", "blocked"], to: "cancelled" },
  };
  const t = transitions[String(action)];
  if (!t) throw new AppError(400, 'action must be "mark_paid", "complete", "no_show" or "cancel"');
  if (!t.from.includes(b.status)) throw new AppError(400, `Can't ${String(action).replace("_", " ")} a booking that is ${b.status.replace("_", " ")}`);
  if (t.needsStart && !started) throw new AppError(400, "That can only be recorded once the slot has started");
  if (action === "cancel" && b.status !== "blocked" && !reason) throw new AppError(400, "Tell the booker why you're cancelling");
  const $set: Record<string, unknown> = { status: t.to };
  if (action === "cancel") Object.assign($set, { cancelledAt: new Date(), cancelledBy: owner._id, cancelReason: reason || "Unblocked" });
  const res = await GroundBooking.updateOne({ _id: b._id, status: b.status }, { $set });
  if (!res.modifiedCount) throw new AppError(409, "The booking changed in the meantime");
  if (action === "cancel" && b.payment) await Payment.updateOne({ _id: b.payment }, { $set: { refundRequested: true } });
  const ground: any = b.ground;
  if (b.source !== "owner" && (action === "cancel" || action === "mark_paid")) {
    await notify(b.user, {
      type: action === "cancel" ? "booking.cancelled" : "booking.confirmed",
      title: action === "cancel" ? `${ground.name} cancelled your booking on ${b.date}` : `${ground.name} confirmed your payment for ${b.date}`,
      body: reason || undefined,
      link: "/dashboard",
      entity: { type: "booking", id: b._id },
      actor: owner._id,
    });
  }
  return GroundBooking.findById(b._id).populate("ground", "name").populate("user", "name username phone");
}

/** The owner closes a slot (maintenance, private event). Uses the same lock as bookings. */
export async function blockSlot(owner: IUser, groundId: string, input: { date?: unknown; startTime?: unknown; endTime?: unknown; note?: unknown }) {
  const { getOwnedGroundOrThrow } = await import("./groundsService");
  const ground = await getOwnedGroundOrThrow(groundId, owner);
  const date = validateDate(input.date);
  if (typeof input.startTime !== "string" || typeof input.endTime !== "string") throw new AppError(400, "startTime and endTime are required");
  computeHours(input.startTime, input.endTime);
  const startTime = input.startTime;
  const endTime = input.endTime;
  const block = await withLock(groundDayLockKey(ground._id, date), async () => {
    const conflict = await findBookingConflict({ groundId: ground._id, date, startTime, endTime });
    if (conflict) throw new AppError(409, `There's already a booking from ${conflict.startTime} to ${conflict.endTime}. Cancel it first if needed.`);
    return GroundBooking.create({
      ground: ground._id,
      user: owner._id,
      date,
      startTime,
      endTime,
      totalAmount: 0,
      status: "blocked",
      source: "owner",
      paymentMethod: "pay_at_venue",
      note: typeof input.note === "string" ? input.note.slice(0, 300) : undefined,
    });
  });
  return GroundBooking.findById(block._id).populate("ground", "name");
}
