import { Types } from "mongoose";
import { Payment, IPayment, MembershipPlan } from "../models/Payment";
import { GroundBooking } from "../models/GroundBooking";
import { Membership } from "../models/Membership";
import { Order } from "../models/Order";
import { User, IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isObjectIdString } from "../utils/validation";
import { isTestPaymentsEnabled } from "../config/env";
import { cancelOrderAndRestock, markOrderPaid } from "./ordersService";
import { findBookingConflict } from "./groundBookingsService";
import { withLock, groundDayLockKey } from "../utils/lock";
import { audit } from "./auditService";
import { notify } from "./notificationService";
import { activateMembershipPayment, activateSubscription, endSubscriptionNow } from "./subscriptionsService";
import { Subscription } from "../models/Subscription";
import { PAID_STATUSES } from "../models/Payment";
import { optionalString, queryString } from "../utils/validation";
import { Page, pageMeta } from "../utils/pagination";

const PLAN_DURATIONS_MS: Record<MembershipPlan, number> = {
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

/** Price of the older monthly/yearly Premium checkout: the plan catalogue's price, else the env setting. */
async function getPlanPrice(plan: MembershipPlan): Promise<number> {
  const { Plan } = await import("../models/Plan");
  const p = await Plan.findOne({ code: plan === "monthly" ? "player_premium_monthly" : "player_premium_yearly", active: true }).lean();
  if (p && p.price > 0) return p.price;
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
 *   confirm   -> "pending" -> "paid"     (atomic, once)   then fulfil: booking confirmed /
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
  if (payment.provider === "MANUAL") {
    // Money paid outside The Arena: only Finance staff can mark it received.
    throw new AppError(403, "Manual payments are verified by The Arena's staff after you submit the reference");
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
    const amount = await getPlanPrice(plan);

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
async function transitionFromPending(paymentId: Types.ObjectId, status: "paid" | "failed") {
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

// Ground-booking payments re-check the slot and confirm it under the same
// per-ground-per-day lock as new bookings, so two overlapping holds can't
// both be confirmed at the same moment.
async function exclusiveForPayment<T>(payment: IPayment, fn: () => Promise<T>): Promise<T> {
  if (payment.type !== "ground_booking") return fn();
  const booking = await GroundBooking.findById(payment.refId).select("ground date");
  if (!booking) return fn();
  return withLock(groundDayLockKey(booking.ground, booking.date), fn);
}

export async function confirm(paymentId: string, user: IUser) {
  const payment = await getOwnedPaymentOrThrow(paymentId, user);
  if (payment.status !== "pending") {
    throw new AppError(400, `Payment is already ${payment.status}`);
  }

  await verifyWithGateway(payment);

  const updated = await exclusiveForPayment(payment, () => confirmVerified(paymentId, payment, user));
  await audit({
    actor: user._id,
    action: "payment.confirmed",
    target: { type: "payment", id: updated._id },
    after: { type: updated.type, amount: updated.amount, provider: updated.provider },
  });
  return updated;
}

async function confirmVerified(paymentId: string, payment: IPayment, user: IUser) {
  try {
    await assertFulfillable(payment);
  } catch (err) {
    // Can't deliver — close this payment as failed so it can't be retried.
    await fail(paymentId, user).catch(() => undefined);
    throw err;
  }

  const updated = await transitionFromPending(payment._id, "paid");
  if (!updated) {
    throw new AppError(409, "This payment is already being processed");
  }

  if (updated.type === "ground_booking") {
    await GroundBooking.updateOne(
      { _id: updated.refId, status: "pending_payment" },
      { $set: { status: "confirmed", payment: updated._id } }
    );
  } else if (updated.type === "membership" && updated.plan) {
    // Older monthly/yearly checkout: it becomes a Premium subscription
    // (renewals stack), with a Membership row kept for history.
    const dbUser = await User.findById(updated.user);
    if (!dbUser) throw new AppError(404, "User not found");
    const sub = await activateMembershipPayment(dbUser, updated.plan, updated);
    await Membership.create({
      user: dbUser._id,
      plan: updated.plan,
      startedAt: new Date(),
      expiresAt: sub?.endAt ?? new Date(Date.now() + PLAN_DURATIONS_MS[updated.plan]),
      payment: updated._id,
    });
  } else if (updated.type === "subscription" && updated.refId) {
    await activateSubscription(updated.refId);
  } else if (updated.type === "shop_order" && updated.refId) {
    await markOrderPaid(updated.refId, updated._id);
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
  } else if (updated.type === "subscription" && updated.refId) {
    await Subscription.updateOne({ _id: updated.refId, status: "pending" }, { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: "Payment failed" } });
  }

  return updated;
}

// ---------------------------------------------------------------- manual payments

/** The payer submits the transaction reference (and optionally a screenshot) for a MANUAL payment. */
export async function submitManualProof(user: IUser, paymentId: string, input: { reference?: unknown; proofImage?: string | null }) {
  const payment = await getOwnedPaymentOrThrow(paymentId, user);
  if (payment.provider !== "MANUAL") throw new AppError(400, "This payment isn't a manual payment");
  if (payment.status !== "pending") throw new AppError(400, `Payment is already ${payment.status}`);
  const reference = optionalString(input.reference, "reference", 100);
  if (!reference || reference.length < 4) throw new AppError(400, "Enter the transaction reference from your bank or wallet");
  await Payment.updateOne(
    { _id: payment._id, status: "pending" },
    { $set: { reference, proofImage: input.proofImage ?? payment.proofImage ?? null, submittedAt: new Date() } }
  );
  return Payment.findById(payment._id);
}

export async function listMyPayments(user: IUser) {
  return Payment.find({ user: user._id }).sort({ createdAt: -1 }).limit(100);
}

export async function adminListPayments(query: Record<string, unknown>, p: Page) {
  const filter: any = {};
  const status = queryString(query.status);
  if (status === "awaiting_verification") Object.assign(filter, { status: "pending", provider: "MANUAL", submittedAt: { $ne: null } });
  else if (status === "paid") filter.status = { $in: PAID_STATUSES };
  else if (status) filter.status = status;
  const provider = queryString(query.provider);
  if (provider) filter.provider = provider;
  const type = queryString(query.type);
  if (type) filter.type = type;
  if (query.refundRequested === "true") Object.assign(filter, { refundRequested: true, status: { $in: PAID_STATUSES } });
  const [items, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate("user", "name email phone").populate("verifiedBy", "name"),
    Payment.countDocuments(filter),
  ]);
  return { payments: items, ...pageMeta(p, total) };
}

async function loadForStaff(id: string) {
  if (!isObjectIdString(id)) throw new AppError(404, "Payment not found");
  const payment = await Payment.findById(id);
  if (!payment) throw new AppError(404, "Payment not found");
  const owner = await User.findById(payment.user);
  if (!owner) throw new AppError(404, "The payer's account no longer exists");
  return { payment, owner };
}

/** Finance staff confirm a manual payment arrived, which fulfils it. */
export async function adminVerify(actor: IUser, id: string) {
  const { payment, owner } = await loadForStaff(id);
  if (payment.provider !== "MANUAL") throw new AppError(400, "Only manual payments are verified by staff");
  if (payment.status !== "pending") throw new AppError(400, `Payment is already ${payment.status}`);
  if (!payment.reference) throw new AppError(400, "The payer hasn't submitted a reference yet");
  const updated = await confirmVerified(payment._id.toString(), payment, owner);
  await Payment.updateOne({ _id: payment._id }, { $set: { verifiedBy: actor._id, verifiedAt: new Date() } });
  await audit({ actor: actor._id, actorRole: actor.role, action: "payment.verified", target: { type: "payment", id: payment._id }, after: { amount: payment.amount, reference: payment.reference } });
  await notify(owner._id, { type: "payment.status", title: `Your payment of Rs ${payment.amount} was received`, link: "/membership", entity: { type: "payment", id: payment._id } });
  return Payment.findById(updated._id);
}

export async function adminReject(actor: IUser, id: string, reasonInput: unknown) {
  const { payment, owner } = await loadForStaff(id);
  if (payment.provider !== "MANUAL") throw new AppError(400, "Only manual payments are rejected by staff");
  const reason = optionalString(reasonInput, "reason", 500);
  if (!reason) throw new AppError(400, "Tell the payer why");
  await fail(payment._id.toString(), owner);
  await Payment.updateOne({ _id: payment._id }, { $set: { rejectionReason: reason, verifiedBy: actor._id, verifiedAt: new Date() } });
  await audit({ actor: actor._id, actorRole: actor.role, action: "payment.rejected", target: { type: "payment", id: payment._id }, reason });
  await notify(owner._id, { type: "payment.status", title: `Your payment of Rs ${payment.amount} couldn't be confirmed`, body: reason, link: "/membership", entity: { type: "payment", id: payment._id } });
  return Payment.findById(payment._id);
}

/** Mark a paid payment as refunded (money returned outside The Arena). Ends what it paid for. */
export async function adminRefund(actor: IUser, id: string, noteInput: unknown) {
  const { payment, owner } = await loadForStaff(id);
  if (!PAID_STATUSES.includes(payment.status)) throw new AppError(400, "Only paid payments can be refunded");
  const note = optionalString(noteInput, "note", 500);
  if (!note) throw new AppError(400, "Add a note (how and when the money was returned)");
  const res = await Payment.updateOne(
    { _id: payment._id, status: { $in: PAID_STATUSES } },
    { $set: { status: "refunded", refundRequested: false, refundedBy: actor._id, refundedAt: new Date(), refundNote: note } }
  );
  if (!res.modifiedCount) throw new AppError(409, "This payment changed in the meantime");
  if (payment.type === "subscription" && payment.refId) await endSubscriptionNow(actor, payment.refId, "Refunded");
  if (payment.type === "ground_booking" && payment.refId) {
    await GroundBooking.updateOne({ _id: payment.refId, status: { $in: ["confirmed", "pending_payment"] } }, { $set: { status: "cancelled", cancelReason: "Refunded" } });
  }
  await audit({ actor: actor._id, actorRole: actor.role, action: "payment.refunded", target: { type: "payment", id: payment._id }, after: { amount: payment.amount }, reason: note });
  await notify(owner._id, { type: "payment.status", title: `Rs ${payment.amount} has been refunded`, body: note, entity: { type: "payment", id: payment._id } });
  return Payment.findById(payment._id);
}
