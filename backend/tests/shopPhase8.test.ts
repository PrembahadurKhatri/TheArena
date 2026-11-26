import { api, auth, makeStoreWithProduct, registerStaff, registerUser } from "./helpers";
import { Product } from "../src/models/Product";
import { Store } from "../src/models/Store";
import { SellerOrder } from "../src/models/SellerOrder";
import { Notification } from "../src/models/Notification";

const ADDRESS = { shippingAddress: "Lakeside-6, Pokhara", shippingProvince: "Gandaki Province", contactPhone: "9800000000", contactName: "Buyer" };

async function cod(token: string, items: object[]) {
  return api().post("/api/shop/orders").set(auth(token)).send({ items, paymentMethod: "cod", ...ADDRESS });
}

describe("merchant approval", () => {
  it("a new shop and its products stay private until staff approve them", async () => {
    const merchant = await registerUser();
    const store = await api().post("/api/shop/stores").set(auth(merchant.token)).send({ name: "Himal Sports", phone: "9811111111", district: "Kathmandu" });
    expect(store.status).toBe(201);
    expect(store.body.store).toMatchObject({ status: "pending", slug: "himal-sports", province: "Bagmati Province" });
    const sid = store.body.store.id;
    const product = await api().post("/api/shop/products").set(auth(merchant.token)).send({ name: "Kashmir Willow Bat", category: "Bats", sport: "cricket", price: 4500, stock: 5 });
    expect(product.body.product.status).toBe("pending_review");
    const pid = product.body.product.id;

    expect((await api().get("/api/shop/stores")).body.stores).toHaveLength(0);
    expect((await api().get(`/api/shop/stores/${sid}`)).status).toBe(404);
    expect((await api().get(`/api/shop/products/${pid}`)).status).toBe(404);
    expect((await api().get(`/api/shop/products/${pid}`).set(auth(merchant.token))).status).toBe(200);

    const buyer = await registerUser();
    expect((await cod(buyer.token, [{ productId: pid, quantity: 1 }])).status).toBe(400);

    const nobody = await registerStaff([]);
    expect((await api().post(`/api/admin/merchants/${sid}/review`).set(auth(nobody.token)).send({ decision: "approve" })).status).toBe(403);
    const mm = await registerStaff(["merchants.review", "products.review"]);
    expect((await api().get("/api/admin/merchants").set(auth(mm.token))).body.stores.map((s: any) => s.id)).toContain(sid);
    await api().post(`/api/admin/merchants/${sid}/review`).set(auth(mm.token)).send({ decision: "approve" });
    // The shop is open, but the product still needs its own approval.
    expect((await api().get(`/api/shop/stores/${sid}`)).body.store.products).toHaveLength(0);
    expect((await api().post(`/api/admin/products/${pid}/review`).set(auth(mm.token)).send({ decision: "reject" })).status).toBe(400);
    await api().post(`/api/admin/products/${pid}/review`).set(auth(mm.token)).send({ decision: "approve" });
    expect((await api().get("/api/shop/products")).body.products.map((p: any) => p.id)).toEqual([pid]);
    expect(await Notification.countDocuments({ recipient: merchant.id, type: { $in: ["merchant.review", "product.review"] } })).toBe(2);
  });

  it("merchants can't approve their own products", async () => {
    const merchant = await registerUser();
    const { productId } = await makeStoreWithProduct(merchant.token);
    await Product.updateOne({ _id: productId }, { $set: { status: "pending_review" } });
    expect((await api().patch(`/api/shop/products/${productId}`).set(auth(merchant.token)).send({ status: "active" })).status).toBe(400);
    expect((await Product.findById(productId))!.status).toBe("pending_review");
  });

  it("the plan's product limit applies", async () => {
    const merchant = await registerUser();
    const { storeId } = await makeStoreWithProduct(merchant.token);
    await Store.updateOne({ _id: storeId }, { $set: { planEntitlements: { maxProducts: 1 }, premiumUntil: new Date(Date.now() + 86_400_000) } });
    expect((await api().post("/api/shop/products").set(auth(merchant.token)).send({ name: "Second", category: "Balls", price: 100, stock: 1 })).status).toBe(403);
  });
});

describe("variants and discounts", () => {
  it("stock is per variant, the total follows, and a size must be chosen", async () => {
    const merchant = await registerUser();
    const { productId } = await makeStoreWithProduct(merchant.token);
    const res = await api()
      .patch(`/api/shop/products/${productId}`)
      .set(auth(merchant.token))
      .send({ variants: [{ size: "M", stock: 1 }, { size: "L", stock: 3 }], discountPrice: 4000 });
    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({ stock: 4, unitPrice: 4000, discountPrice: 4000 });
    const [m] = res.body.product.variants;

    const buyers = await Promise.all([registerUser(), registerUser(), registerUser()]);
    expect((await cod(buyers[0].token, [{ productId, quantity: 1 }])).status).toBe(400);
    const results = await Promise.all(buyers.map((b) => cod(b.token, [{ productId, variantId: m.id, quantity: 1 }])));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const ok = results.find((r) => r.status === 201)!;
    expect(ok.body.order.totalAmount).toBe(4000);
    expect(ok.body.order.items[0]).toMatchObject({ size: "M", price: 4000 });
    const p = await Product.findById(productId);
    expect([p!.variants[0].stock, p!.variants[1].stock, p!.stock]).toEqual([0, 3, 3]);
  });

  it("a discount can't exceed the price", async () => {
    const merchant = await registerUser();
    const { productId } = await makeStoreWithProduct(merchant.token, { price: 1000 });
    expect((await api().patch(`/api/shop/products/${productId}`).set(auth(merchant.token)).send({ discountPrice: 1200 })).status).toBe(400);
  });
});

describe("multi-shop orders", () => {
  it("one checkout becomes one seller order per shop; each merchant sees only theirs", async () => {
    const a = await registerUser();
    const b = await registerUser();
    const shopA = await makeStoreWithProduct(a.token, { price: 1000, stock: 5 });
    const shopB = await makeStoreWithProduct(b.token, { price: 300, stock: 5 });
    const buyer = await registerUser();
    const res = await cod(buyer.token, [
      { productId: shopA.productId, quantity: 2 },
      { productId: shopB.productId, quantity: 1 },
    ]);
    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({ status: "placed", paymentMethod: "cod", totalAmount: 2300 });
    expect(res.body.order.sellerOrders).toHaveLength(2);
    expect(await Notification.countDocuments({ type: "order.placed" })).toBe(2);

    const listA = await api().get(`/api/shop/stores/${shopA.storeId}/orders`).set(auth(a.token));
    expect(listA.body.orders).toHaveLength(1);
    expect(listA.body.orders[0].subtotal).toBe(2000);
    expect(JSON.stringify(listA.body)).not.toContain("2300");

    const soB = res.body.order.sellerOrders.find((s: any) => s.store.id === shopB.storeId).id;
    expect((await api().patch(`/api/shop/seller-orders/${soB}/status`).set(auth(a.token)).send({ status: "confirmed" })).status).toBe(404);
  });

  it("merchants move orders through fulfilment; skipping steps is refused", async () => {
    const m = await registerUser();
    const { productId } = await makeStoreWithProduct(m.token);
    const buyer = await registerUser();
    const so = (await cod(buyer.token, [{ productId, quantity: 1 }])).body.order.sellerOrders[0].id;
    const step = (status: string, extra: object = {}) => api().patch(`/api/shop/seller-orders/${so}/status`).set(auth(m.token)).send({ status, ...extra });
    expect((await step("delivered")).status).toBe(400);
    expect((await step("confirmed")).status).toBe(200);
    expect((await step("shipped", { carrier: "Pathao", trackingCode: "PX123" })).body.order.tracking).toEqual({ carrier: "Pathao", code: "PX123" });
    expect((await step("delivered")).body.order.status).toBe("delivered");
    expect(await Notification.countDocuments({ recipient: buyer.id, type: "order.status" })).toBe(3);
  });

  it("buyers cancel before shipping (stock returns), not after", async () => {
    const m = await registerUser();
    const { productId } = await makeStoreWithProduct(m.token, { stock: 2 });
    const buyer = await registerUser();
    const first = (await cod(buyer.token, [{ productId, quantity: 2 }])).body.order;
    expect((await Product.findById(productId))!.stock).toBe(0);
    const cancelled = await api().post(`/api/shop/seller-orders/${first.sellerOrders[0].id}/cancel`).set(auth(buyer.token)).send({ reason: "Ordered by mistake" });
    expect(cancelled.body.order.status).toBe("cancelled");
    expect((await Product.findById(productId))!.stock).toBe(2);

    const second = (await cod(buyer.token, [{ productId, quantity: 1 }])).body.order.sellerOrders[0].id;
    await api().patch(`/api/shop/seller-orders/${second}/status`).set(auth(m.token)).send({ status: "confirmed" });
    await api().patch(`/api/shop/seller-orders/${second}/status`).set(auth(m.token)).send({ status: "shipped" });
    expect((await api().post(`/api/shop/seller-orders/${second}/cancel`).set(auth(buyer.token))).status).toBe(400);
  });

  it("paying online releases the seller orders to the shops", async () => {
    const m = await registerUser();
    const { productId } = await makeStoreWithProduct(m.token);
    const buyer = await registerUser();
    const order = (await api().post("/api/shop/orders").set(auth(buyer.token)).send({ items: [{ productId, quantity: 1 }], paymentMethod: "online", ...ADDRESS })).body.order;
    expect(order.sellerOrders[0].status).toBe("pending_payment");
    const pay = await api().post("/api/payments/checkout").set(auth(buyer.token)).send({ type: "shop_order", refId: order.id });
    process.env.PAYMENT_MODE = "test";
    try {
      expect((await api().post(`/api/payments/${pay.body.payment.id}/confirm`).set(auth(buyer.token))).status).toBe(200);
    } finally {
      delete process.env.PAYMENT_MODE;
    }
    expect((await SellerOrder.findOne({ order: order.id }))!.status).toBe("placed");
  });

  it("you can't buy from your own shop", async () => {
    const m = await registerUser();
    const { productId } = await makeStoreWithProduct(m.token);
    expect((await cod(m.token, [{ productId, quantity: 1 }])).status).toBe(400);
  });
});

describe("reviews, wishlist and sales", () => {
  it("only delivered buyers review, once; the rating is averaged", async () => {
    const m = await registerUser();
    const { productId, storeId } = await makeStoreWithProduct(m.token);
    const buyer = await registerUser();
    expect((await api().post(`/api/shop/products/${productId}/reviews`).set(auth(buyer.token)).send({ rating: 5 })).status).toBe(403);
    const so = (await cod(buyer.token, [{ productId, quantity: 1 }])).body.order.sellerOrders[0].id;
    for (const s of ["confirmed", "shipped", "delivered"]) await api().patch(`/api/shop/seller-orders/${so}/status`).set(auth(m.token)).send({ status: s });

    expect((await api().post(`/api/shop/products/${productId}/reviews`).set(auth(buyer.token)).send({ rating: 7 })).status).toBe(400);
    const r = await api().post(`/api/shop/products/${productId}/reviews`).set(auth(buyer.token)).send({ rating: 4, text: "Good grip" });
    expect(r.status).toBe(201);
    expect((await api().post(`/api/shop/products/${productId}/reviews`).set(auth(buyer.token)).send({ rating: 1 })).status).toBe(409);
    expect((await Product.findById(productId))!.rating).toMatchObject({ avg: 4, count: 1 });

    const reply = await api().post(`/api/shop/reviews/${r.body.review.id}/reply`).set(auth(m.token)).send({ reply: "Thanks!" });
    expect(reply.body.review.merchantReply).toBe("Thanks!");
    expect((await api().post(`/api/shop/reviews/${r.body.review.id}/reply`).set(auth(buyer.token)).send({ reply: "x" })).status).toBe(403);

    const sales = await api().get(`/api/shop/stores/${storeId}/sales`).set(auth(m.token));
    expect(sales.body.allTime).toEqual({ revenue: 5000, deliveredOrders: 1 });
    expect(sales.body.last30Days.topProducts[0].quantity).toBe(1);
    expect((await api().get(`/api/shop/stores/${storeId}/sales`).set(auth(buyer.token))).status).toBe(403);
  });

  it("wishlist add, list and remove", async () => {
    const m = await registerUser();
    const { productId } = await makeStoreWithProduct(m.token);
    const u = await registerUser();
    await api().post(`/api/shop/wishlist/${productId}`).set(auth(u.token));
    await api().post(`/api/shop/wishlist/${productId}`).set(auth(u.token));
    expect((await api().get("/api/shop/wishlist").set(auth(u.token))).body.products).toHaveLength(1);
    await api().delete(`/api/shop/wishlist/${productId}`).set(auth(u.token));
    expect((await api().get("/api/shop/wishlist").set(auth(u.token))).body.products).toHaveLength(0);
  });

  it("staff add categories that merchants can then use", async () => {
    const cm = await registerStaff(["categories.manage"]);
    const m = await registerUser();
    await makeStoreWithProduct(m.token);
    expect((await api().post("/api/shop/products").set(auth(m.token)).send({ name: "Yoga Mat", category: "Yoga", price: 900, stock: 2 })).status).toBe(400);
    expect((await api().post("/api/admin/shop-categories").set(auth(cm.token)).send({ name: "Yoga" })).status).toBe(201);
    expect((await api().post("/api/shop/products").set(auth(m.token)).send({ name: "Yoga Mat", category: "Yoga", price: 900, stock: 2 })).status).toBe(201);
    expect((await api().get("/api/shop/categories")).body.categories).toContain("Yoga");
  });
});
