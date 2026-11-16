import { Types } from "mongoose";
import { Payment, IPayment, MembershipPlan } from "../models/Payment";
import { GroundBooking } from "../models/GroundBooking";
import { Membership } from "../models/Membership";
import { Order } from "../models/Order";
import { User, IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isObjectIdString } from "../utils/validation";
import { isTestPaymentsEnabled } from "../config/env";
import { cancelOrderAndRestock } from "./ordersService";
import { findBookingConflict } from "./groundBookingsService";

const PLAN_DURATIONS_MS: Record<MembershipPlan, number> = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

function getPlanPrice(plan: MembershipPlan): number {
  const raw = plan === "monthly" ? process.env.MEMBERSHIP_MONTHLY_PRICE : process.env.MEMBERSHIP_YEARLY_PRICE;
  const price = Number(raw);
  if (!price || Number.isNaN(price)) {
    throw new AppError(500, `Membership price for plan "${plan}" is not configured`);
  }
  return price;
}

/*
 * Payment lifecycle
 * -----------------
 *   checkout  -> Payment { status: "pending" }           (amount always computed server-side)
 *   confirm   -> "pending" -> "success"  (atomic, once)   then fulfil: booking confirmed /
 *                                                         order paid / membership extended
 *   fail      -> "pending" -> "failed"   (atomic, once)   then release: booking cancelled /
 *                                                         order cancelled + stock restored
 *
 * Gateway verification
 * --------------------
 * `verifyWithGateway` is the single place that decides whether money was
 * really received. Today only the TEST provider exists and it is allowed
 * only when PAYMENT_MODE=test. When Khalti/eSewa are added, their
 * server-to-server verification (Khalti lookup API / eSewa status check)
 * goes here — the client's "payment succeeded" redirect must never be
 * trusted on its own.
 */
async function verifyWithGateway(payment: IPayment): Promise<boolean> {
  if (payment.provider === "TEST") {
    if (!isTestPaymentsEnabled()) {
      throw new AppError(503, "Online payments are not enabled yet. Please try again later.");
    }
    return true;
  }
  throw new AppError(501, `Payment provider ${payment.provider} is not supported`);
}

// Reuse an existing pending payment for the same booking/order instead of
// creating a second one (double-click, page refresh, retry).
async function findOrCreatePending(input: {
  user: Types.ObjectId;
  type: "ground_booking" | "shop_order";
  refId: Types.ObjectId;
  amount: number;
}) {
  const existing = await Payment.findOne({ type: input.type, refId: input.refId, status: "pending" });
  if (existing) return existing;
  try {
    return await Payment.create({ ...input, status: "pending", provider: "TEST" });
  } catch (err: any) {
    // Lost a race with a concurrent checkout — the unique partial index
    // guarantees there's exactly one pending payment; return it.
    if (err?.code === 11000) {
      const winner = await Payment.findOne({ type: input.type, refId: input.refId, status: "pending" });
      if (winner) return winner;
    }
    throw err;
  }
}

export async function checkout(
  user: IUser,
  input: { type: "ground_booking" | "membership" | "shop_order"; refId?: string; plan?: MembershipPlan }
) {
  const { type, refId, plan } = input;

  if (type === "ground_booking") {
    if (!isObjectIdString(refId)) throw new AppError(400, "A valid refId is required for ground_booking payments");
    const booking = await GroundBooking.findById(refId);
    if (!booking) throw new AppError(404, "Booking not found");
    if (booking.user.toString() !== user._id.toString()) {
      throw new AppError(403, "You do not own this booking");
    }
    if (booking.status !== "pending_payment") {
      throw new AppError(400, "This booking is not awaiting payment");
    }

    const payment = await findOrCreatePending({
      user: user._id,
      type: "ground_booking",
      refId: booking._id,
      amount: booking.totalAmount,
    });
    if (!booking.payment || booking.payment.toString() !== payment._id.toString()) {
      booking.payment = payment._id;
      await booking.save();
    }
    return payment;
  }

  if (type === "membership") {
    if (plan !== "monthly" && plan !== "yearly") {
      throw new AppError(400, 'plan must be "monthly" or "yearly"');
    }
    const amount = getPlanPrice(plan);

    // One open membership checkout per user at a time.
    const existing = await Payment.findOne({ user: user._id, type: "membership", status: "pending", plan });
    if (existing) return existing;

    return Payment.create({
      user: user._id,
      type: "membership",
      refId: null,
      plan,
      amount,
      status: "pending",
      provider: "TEST",
    });
  }

  if (type === "shop_order") {
    if (!isObjectIdString(refId)) throw new AppError(400, "A valid refId is required for shop_order payments");
    const order = await Order.findById(refId);
    if (!order) throw new AppError(404, "Order not found");
    if (order.buyer.toString() !== user._id.toString()) {
      throw new AppError(403, "You do not own this order");
    }
    if (order.status !== "pending_payment") {
      throw new AppError(400, "This order is not awaiting payment");
    }

    const payment = await findOrCreatePending({
      user: user._id,
      type: "shop_order",
      refId: order._id,
      amount: order.totalAmount,
    });
    if (!order.payment || order.payment.toString() !== payment._id.toString()) {
      order.payment = payment._id;
      await order.save();
    }
    return payment;
  }

  throw new AppError(400, 'type must be "ground_booking", "membership" or "shop_order"');
}

async function getOwnedPaymentOrThrow(paymentId: string, user: IUser) {
  if (!isObjectIdString(paymentId)) throw new AppError(400, "Invalid id");
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new AppError(404, "Payment not found");
  if (payment.user.toString() !== user._id.toString()) {
    throw new AppError(403, "You do not own this payment");
  }
  return payment;
}

// Atomically move a payment out of "pending". Returns null if another
// request already did — that request owns fulfilment, so nothing is applied
// twice (no double premium extension, no double booking confirmation).
async function transitionFromPending(paymentId: Types.ObjectId, status: "success" | "failed") {
  return Payment.findOneAndUpdate({ _id: paymentId, status: "pending" }, { $set: { status } }, { new: true });
}

// Before taking the money, make sure the thing being paid for can still be
// delivered (the order/booking may have expired or been cancelled).
async function assertFulfillable(payment: IPayment) {
  if (payment.type === "ground_booking") {
    const booking = await GroundBooking.findById(payment.refId);
    if (!booking || booking.status !== "pending_payment") {
      throw new AppError(409, "This booking has expired or was cancelled. Please book again.");
    }
    const conflict = await findBookingConflict({
      groundId: booking.ground,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      excludeBookingId: booking._id,
      confirmedOnly: true,
    });
    if (conflict) {
      throw new AppError(409, "Sorry, this time slot was just booked by someone else. Please choose another slot.");
    }
  } else if (payment.type === "shop_order") {
    const order = await Order.findById(payment.refId);
    if (!order || order.status !== "pending_payment") {
      throw new AppError(409, "This order has expired or was cancelled. Please place it again.");
    }
  }
}

export async function confirm(paymentId: string, user: IUser) {
  const payment = await getOwnedPaymentOrThrow(paymentId, user);
  if (payment.status !== "pending") {
    throw new AppError(400, `Payment is already ${payment.status}`);
  }

  await verifyWithGateway(payment);

  try {
    await assertFulfillable(payment);
  } catch (err) {
    // Can't deliver — close this payment as failed so it can't be retried.
    await fail(paymentId, user).catch(() => undefined);
    throw err;
  }

  const updated = await transitionFromPending(payment._id, "success");
  if (!updated) {
    throw new AppError(409, "This payment is already being processed");
  }

  if (updated.type === "ground_booking") {
    await GroundBooking.updateOne(
      { _id: updated.refId, status: "pending_payment" },
      { $set: { status: "confirmed", payment: updated._id } }
    );
  } else if (updated.type === "membership" && updated.plan) {
    const now = new Date();
    const duration = PLAN_DURATIONS_MS[updated.plan];

    // Extend from the later of "now" or the user's current expiry, so
    // renewals stack instead of overwriting remaining time.
    const dbUser = await User.findById(user._id);
    if (!dbUser) throw new AppError(404, "User not found");

    const base = dbUser.membershipExpiresAt && dbUser.membershipExpiresAt > now ? dbUser.membershipExpiresAt : now;
    const expiresAt = new Date(base.getTime() + duration);

    await Membership.create({
      user: dbUser._id,
      plan: updated.plan,
      startedAt: now,
      expiresAt,
      payment: updated._id,
    });

    dbUser.isPremium = true;
    dbUser.membershipExpiresAt = expiresAt;
    await dbUser.save();
  } else if (updated.type === "shop_order") {
    await Order.updateOne(
      { _id: updated.refId, status: "pending_payment" },
      { $set: { status: "paid", payment: updated._id } }
    );
  }

  return updated;
}

export async function fail(paymentId: string, user: IUser) {
  const payment = await getOwnedPaymentOrThrow(paymentId, user);
  if (payment.status !== "pending") {
    throw new AppError(400, `Payment is already ${payment.status}`);
  }

  const updated = await transitionFromPending(payment._id, "failed");
  if (!updated) {
    throw new AppError(409, "This payment is already being processed");
  }

  // Release what the payment was holding.
  if (updated.type === "ground_booking") {
    await GroundBooking.updateOne({ _id: updated.refId, status: "pending_payment" }, { $set: { status: "cancelled" } });
  } else if (updated.type === "shop_order" && updated.refId) {
    await cancelOrderAndRestock(updated.refId);
  }

  return updated;
}
