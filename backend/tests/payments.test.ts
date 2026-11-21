
import { api, auth, futureDate, makeGround, makeStoreWithProduct, registerUser } from "./helpers";
import { Order } from "../src/models/Order";
import { User } from "../src/models/User";
import { AuditLog } from "../src/models/AuditLog";

const ADDRESS = { shippingAddress: "Lakeside-6, Pokhara", shippingProvince: "Gandaki Province" };

async function pendingOrderPayment() {
  const seller = await registerUser();
  const buyer = await registerUser();
  const { productId } = await makeStoreWithProduct(seller.token);
  const order = await api().post("/api/shop/orders").set(auth(buyer.token)).send({ items: [{ productId, quantity: 1 }], ...ADDRESS });
  const checkout = await api().post("/api/payments/checkout").set(auth(buyer.token)).send({ type: "shop_order", refId: order.body.order.id });
  expect(checkout.status).toBe(201);
  return { buyer, orderId: order.body.order.id as string, paymentId: checkout.body.payment.id as string };
}

afterEach(() => {
  delete process.env.PAYMENT_MODE;
});

describe("payments", () => {
  it("with test payments disabled, a user can't mark their own payment as paid (#6)", async () => {
    process.env.PAYMENT_MODE = "disabled";
    const { buyer, orderId, paymentId } = await pendingOrderPayment();
    const res = await api().post(`/api/payments/${paymentId}/confirm`).set(auth(buyer.token));
    expect(res.status).toBe(503);
    expect((await Order.findById(orderId))!.status).toBe("pending_payment");
  });

  it("there's no endpoint to set an order's status directly", async () => {
    const { buyer, orderId } = await pendingOrderPayment();
    const res = await api().patch(`/api/shop/orders/${orderId}`).set(auth(buyer.token)).send({ status: "paid" });
    expect(res.status).toBe(404);
    expect((await Order.findById(orderId))!.status).toBe("pending_payment");
  });

  it("a user can't confirm someone else's payment", async () => {
    const { paymentId } = await pendingOrderPayment();
    const stranger = await registerUser();
    expect((await api().post(`/api/payments/${paymentId}/confirm`).set(auth(stranger.token))).status).toBe(403);
  });

  it("a confirmed payment can't be confirmed again (idempotent)", async () => {
    const { buyer, orderId, paymentId } = await pendingOrderPayment();
    const results = await Promise.all([1, 2, 3].map(() => api().post(`/api/payments/${paymentId}/confirm`).set(auth(buyer.token))));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect((await Order.findById(orderId))!.status).toBe("paid");
    expect(await AuditLog.countDocuments({ action: "payment.confirmed" })).toBe(1);
  });

  it("a membership is granted exactly once for one payment", async () => {
    const u = await registerUser();
    const checkout = await api().post("/api/payments/checkout").set(auth(u.token)).send({ type: "membership", plan: "monthly" });
    const id = checkout.body.payment.id;
    await Promise.all([1, 2, 3].map(() => api().post(`/api/payments/${id}/confirm`).set(auth(u.token))));
    const user = await User.findById(u.id);
    const days = (user!.membershipExpiresAt!.getTime() - Date.now()) / 86_400_000;
    expect(user!.isPremium).toBe(true);
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });

  it("the checkout amount comes from the server", async () => {
    const ground = await makeGround(1000);
    const u = await registerUser();
    const booking = await api()
      .post("/api/ground-bookings")
      .set(auth(u.token))
      .send({ groundId: ground._id.toString(), date: futureDate(), startTime: "07:00", endTime: "08:00" });
    const checkout = await api()
      .post("/api/payments/checkout")
      .set(auth(u.token))
      .send({ type: "ground_booking", refId: booking.body.booking.id, amount: 1 });
    expect(checkout.body.payment.amount).toBe(1000);
  });
});
