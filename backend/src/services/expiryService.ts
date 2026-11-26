import { Order } from "../models/Order";
import { GroundBooking } from "../models/GroundBooking";
import { Payment } from "../models/Payment";
import { cancelOrderAndRestock } from "./ordersService";
import { BOOKING_HOLD_MINUTES } from "./groundBookingsService";
import { User } from "../models/User";
import { getSetting } from "./settingsService";
import { expireStaleChallenges } from "./challengesService";
import { autoVerifyReports } from "./matchReportsService";
import { sweepSubscriptions } from "./subscriptionsService";

// Unpaid shop orders reserve stock and unpaid bookings hold a slot. If the
// buyer abandons checkout, release them after a while so the stock/slot
// becomes available again.
const ORDER_HOLD_MINUTES = () => getSetting("orderHoldMinutes");
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

export async function sweepExpired() {
  const orderCutoff = new Date(Date.now() - ORDER_HOLD_MINUTES() * 60 * 1000);
  const bookingCutoff = new Date(Date.now() - BOOKING_HOLD_MINUTES() * 60 * 1000);

  const staleOrders = await Order.find({ status: "pending_payment", createdAt: { $lt: orderCutoff } }).select("_id");
  let ordersReleased = 0;
  for (const o of staleOrders) {
    if (await cancelOrderAndRestock(o._id)) {
      ordersReleased += 1;
      await Payment.updateMany({ type: "shop_order", refId: o._id, status: "pending" }, { $set: { status: "failed" } });
    }
  }

  const staleBookings = await GroundBooking.find({ status: "pending_payment", createdAt: { $lt: bookingCutoff } }).select("_id");
  for (const b of staleBookings) {
    const res = await GroundBooking.updateOne({ _id: b._id, status: "pending_payment" }, { $set: { status: "cancelled" } });
    if (res.modifiedCount) {
      await Payment.updateMany({ type: "ground_booking", refId: b._id, status: "pending" }, { $set: { status: "failed" } });
    }
  }

  // Expired premium memberships: refresh the cached flag so badges and
  // listings are right even for users who haven't made a request since.
  const lapsed = await User.updateMany(
    { isPremium: true, membershipExpiresAt: { $ne: null, $lt: new Date() } },
    { $set: { isPremium: false } }
  );
  if (lapsed.modifiedCount) console.log(`[expiry] ${lapsed.modifiedCount} premium membership(s) expired`);

  const endedSubs = await sweepSubscriptions();
  if (endedSubs) console.log(`[expiry] ${endedSubs} subscription(s) ended`);
  const autoVerified = await autoVerifyReports();
  if (autoVerified) console.log(`[expiry] ${autoVerified} match result(s) verified automatically`);
  const expiredChallenges = await expireStaleChallenges();
  if (expiredChallenges) console.log(`[expiry] ${expiredChallenges} unanswered challenge(s) expired`);

  if (ordersReleased || staleBookings.length) {
    console.log(`[expiry] released ${ordersReleased} unpaid order(s), ${staleBookings.length} unpaid booking(s)`);
  }
}

// Runs in-process. With more than one backend instance every instance runs
// it, which is safe: each cancellation is an atomic status transition.
export function startExpirySweeper() {
  const run = () => sweepExpired().catch((err) => console.error("[expiry] sweep failed:", err?.message ?? err));
  run();
  timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref();
}

export function stopExpirySweeper() {
  if (timer) clearInterval(timer);
  timer = null;
}
