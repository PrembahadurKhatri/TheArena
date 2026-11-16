import { Order } from "../models/Order";
import { GroundBooking } from "../models/GroundBooking";
import { Payment } from "../models/Payment";
import { cancelOrderAndRestock } from "./ordersService";
import { BOOKING_HOLD_MINUTES } from "./groundBookingsService";

// Unpaid shop orders reserve stock and unpaid bookings hold a slot. If the
// buyer abandons checkout, release them after a while so the stock/slot
// becomes available again.
const ORDER_HOLD_MINUTES = Number(process.env.ORDER_HOLD_MINUTES) || 30;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

export async function sweepExpired() {
  const orderCutoff = new Date(Date.now() - ORDER_HOLD_MINUTES * 60 * 1000);
  const bookingCutoff = new Date(Date.now() - BOOKING_HOLD_MINUTES * 60 * 1000);

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
