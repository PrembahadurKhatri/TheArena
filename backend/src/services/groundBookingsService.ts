import { GroundBooking } from "../models/GroundBooking";
import { Ground } from "../models/Ground";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";

const PREMIUM_DISCOUNT = 0.1;

function parseTimeToMinutes(value: string): number {
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

export async function createBooking(
  user: IUser,
  input: { groundId: string; date: string; startTime: string; endTime: string }
) {
  const { groundId, date, startTime, endTime } = input;
  if (!groundId || !date || !startTime || !endTime) {
    throw new AppError(400, "groundId, date, startTime and endTime are required");
  }

  const ground = await Ground.findById(groundId);
  if (!ground) throw new AppError(404, "Ground not found");

  const hours = computeHours(startTime, endTime);
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
