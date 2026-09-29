import { Payment, MembershipPlan } from "../models/Payment";
import { GroundBooking } from "../models/GroundBooking";
import { Membership } from "../models/Membership";
import { Order } from "../models/Order";
import { User, IUser } from "../models/User";
import { AppError } from "../utils/AppError";

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

export async function checkout(
  user: IUser,
  input: { type: "ground_booking" | "membership" | "shop_order"; refId?: string; plan?: MembershipPlan }
) {
  const { type, refId, plan } = input;

  if (type === "ground_booking") {
    if (!refId) throw new AppError(400, "refId is required for ground_booking payments");
    const booking = await GroundBooking.findById(refId);
    if (!booking) throw new AppError(404, "Booking not found");
    if (booking.user.toString() !== user._id.toString()) {
      throw new AppError(403, "You do not own this booking");
    }
    if (booking.status !== "pending_payment") {
      throw new AppError(400, "This booking is not awaiting payment");
    }

    const payment = await Payment.create({
      user: user._id,
      type: "ground_booking",
      refId: booking._id,
      amount: booking.totalAmount,
      status: "pending",
      provider: "TEST",
    });

    booking.payment = payment._id;
    await booking.save();

    return payment;
  }

  if (type === "membership") {
    if (plan !== "monthly" && plan !== "yearly") {
      throw new AppError(400, 'plan must be "monthly" or "yearly"');
    }
    const amount = getPlanPrice(plan);

    const payment = await Payment.create({
      user: user._id,
      type: "membership",
      refId: null,
      plan,
      amount,
      status: "pending",
      provider: "TEST",
    });

    return payment;
  }

  if (type === "shop_order") {
    if (!refId) throw new AppError(400, "refId is required for shop_order payments");
    const order = await Order.findById(refId);
    if (!order) throw new AppError(404, "Order not found");
    if (order.buyer.toString() !== user._id.toString()) {
      throw new AppError(403, "You do not own this order");
    }
    if (order.status !== "pending_payment") {
      throw new AppError(400, "This order is not awaiting payment");
    }

    const payment = await Payment.create({
      user: user._id,
      type: "shop_order",
      refId: order._id,
      amount: order.totalAmount,
      status: "pending",
      provider: "TEST",
    });

    order.payment = payment._id;
    await order.save();

    return payment;
  }

  throw new AppError(400, 'type must be "ground_booking", "membership" or "shop_order"');
}

async function getOwnedPaymentOrThrow(paymentId: string, user: IUser) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new AppError(404, "Payment not found");
  if (payment.user.toString() !== user._id.toString()) {
    throw new AppError(403, "You do not own this payment");
  }
  return payment;
}

export async function confirm(paymentId: string, user: IUser) {
  const payment = await getOwnedPaymentOrThrow(paymentId, user);
  if (payment.status !== "pending") {
    throw new AppError(400, `Payment is already ${payment.status}`);
  }

  payment.status = "success";
  await payment.save();

  if (payment.type === "ground_booking") {
    const booking = await GroundBooking.findById(payment.refId);
    if (booking) {
      booking.status = "confirmed";
      await booking.save();
    }
  } else if (payment.type === "membership" && payment.plan) {
    const now = new Date();
    const duration = PLAN_DURATIONS_MS[payment.plan];

    // Extend from the later of "now" or the user's current expiry, so
    // renewals stack instead of overwriting remaining time.
    const dbUser = await User.findById(user._id);
    if (!dbUser) throw new AppError(404, "User not found");

    const base = dbUser.membershipExpiresAt && dbUser.membershipExpiresAt > now ? dbUser.membershipExpiresAt : now;
    const expiresAt = new Date(base.getTime() + duration);

    await Membership.create({
      user: dbUser._id,
      plan: payment.plan,
      startedAt: now,
      expiresAt,
      payment: payment._id,
    });

    dbUser.isPremium = true;
    dbUser.membershipExpiresAt = expiresAt;
    await dbUser.save();
  } else if (payment.type === "shop_order") {
    const order = await Order.findById(payment.refId);
    if (order) {
      order.status = "paid";
      await order.save();
    }
  }

  return payment;
}

export async function fail(paymentId: string, user: IUser) {
  const payment = await getOwnedPaymentOrThrow(paymentId, user);
  if (payment.status !== "pending") {
    throw new AppError(400, `Payment is already ${payment.status}`);
  }
  payment.status = "failed";
  await payment.save();
  return payment;
}
