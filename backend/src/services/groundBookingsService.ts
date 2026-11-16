import { Types } from "mongoose";
import { GroundBooking } from "../models/GroundBooking";
import { Ground } from "../models/Ground";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isObjectIdString } from "../utils/validation";

const PREMIUM_DISCOUNT = 0.1;

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
export const BOOKING_HOLD_MINUTES = Number(process.env.BOOKING_HOLD_MINUTES) || 15;
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
  const holdCutoff = new Date(Date.now() - BOOKING_HOLD_MINUTES * 60 * 1000);

  const statusFilter = params.confirmedOnly
    ? { status: "confirmed" }
    : { $or: [{ status: "confirmed" }, { status: "pending_payment", createdAt: { $gt: holdCutoff } }] };

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

export async function createBooking(
  user: IUser,
  input: { groundId: string; date: string; startTime: string; endTime: string }
) {
  const { groundId, startTime, endTime } = input;
  if (!groundId || !input.date || typeof startTime !== "string" || typeof endTime !== "string") {
    throw new AppError(400, "groundId, date, startTime and endTime are required");
  }
  if (!isObjectIdString(groundId)) throw new AppError(400, "Invalid groundId");
  const date = validateDate(input.date);

  const ground = await Ground.findById(groundId);
  if (!ground) throw new AppError(404, "Ground not found");

  const hours = computeHours(startTime, endTime);
  if (hours > MAX_BOOKING_HOURS) throw new AppError(400, `A booking can be at most ${MAX_BOOKING_HOURS} hours`);

  const start = slotStart(date, startTime);
  if (start.getTime() < Date.now()) {
    throw new AppError(400, "You can't book a time slot in the past");
  }
  if (start.getTime() > Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
    throw new AppError(400, `Bookings can be made at most ${MAX_DAYS_AHEAD} days ahead`);
  }

  const conflict = await findBookingConflict({ groundId: ground._id, date, startTime, endTime });
  if (conflict) {
    throw new AppError(
      409,
      `This ground is already booked from ${conflict.startTime} to ${conflict.endTime} on ${date}. Please choose another time.`
    );
  }

  // Price is always computed here from the ground's stored rate. The
  // premium discount applies only while membership is active (verifyToken
  // has already downgraded expired memberships).
  let totalAmount = ground.pricePerHour * hours;
  if (user.isPremium) {
    totalAmount = totalAmount * (1 - PREMIUM_DISCOUNT);
  }
  totalAmount = Math.round(totalAmount * 100) / 100;

  const booking = await GroundBooking.create({
    ground: ground._id,
    user: user._id,
    date,
    startTime,
    endTime,
    totalAmount,
    status: "pending_payment",
    payment: null,
  });

  return GroundBooking.findById(booking._id).populate("ground");
}

export async function listMyBookings(user: IUser) {
  return GroundBooking.find({ user: user._id })
    .sort({ createdAt: -1 })
    .populate("ground")
    .populate("payment");
}
