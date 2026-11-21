
import { api, auth, makeStoreWithProduct, registerUser } from "./helpers";
import { Product } from "../src/models/Product";

const ADDRESS = { shippingAddress: "Lakeside-6, Pokhara", shippingProvince: "Gandaki Province", contactPhone: "9800000000" };

describe("inventory", () => {
  it("two customers can't buy the last item at the same time (#8)", async () => {
    const seller = await registerUser();
    const { productId } = await makeStoreWithProduct(seller.token, { stock: 1 });
    const buyers = await Promise.all(Array.from({ length: 5 }, () => registerUser()));

    const results = await Promise.all(
      buyers.map((b) => api().post("/api/shop/orders").set(auth(b.token)).send({ items: [{ productId, quantity: 1 }], ...ADDRESS }))
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 400)).toHaveLength(4);
    expect((await Product.findById(productId))!.stock).toBe(0);
  });

  it("listing a product twice in one order can't bypass the stock check", async () => {
    const seller = await registerUser();
    const buyer = await registerUser();
    const { productId } = await makeStoreWithProduct(seller.token, { stock: 3 });
    const res = await api()
      .post("/api/shop/orders")
      .set(auth(buyer.token))
      .send({ items: [{ productId, quantity: 2 }, { productId, quantity: 2 }], ...ADDRESS });
    expect(res.status).toBe(400);
    expect((await Product.findById(productId))!.stock).toBe(3);
  });

  it("prices come from the database, not the request (#5)", async () => {
    const seller = await registerUser();
    const buyer = await registerUser();
    const { productId } = await makeStoreWithProduct(seller.token, { price: 5000 });
    const res = await api()
      .post("/api/shop/orders")
      .set(auth(buyer.token))
      .send({ items: [{ productId, quantity: 2, price: 1 }], totalAmount: 1, ...ADDRESS });
    expect(res.status).toBe(201);
    expect(res.body.order.totalAmount).toBe(10000);
  });
});

describe("shop isolation", () => {
  it("a shop owner can't edit or delete another shop's product (#2)", async () => {
    const owner = await registerUser();
    const rival = await registerUser();
    const { productId } = await makeStoreWithProduct(owner.token, { price: 5000 });
    await makeStoreWithProduct(rival.token);

    expect((await api().patch(`/api/shop/products/${productId}`).set(auth(rival.token)).send({ price: 1 })).status).toBe(403);
    expect((await api().delete(`/api/shop/products/${productId}`).set(auth(rival.token))).status).toBe(403);
    expect((await Product.findById(productId))!.price).toBe(5000);
  });

  it("a shop owner can't read another shop's orders (#3)", async () => {
    const owner = await registerUser();
    const rival = await registerUser();
    const { storeId } = await makeStoreWithProduct(owner.token);
    await makeStoreWithProduct(rival.token);
    expect((await api().get(`/api/shop/stores/${storeId}/orders`).set(auth(rival.token))).status).toBe(403);
    expect((await api().get(`/api/shop/stores/${storeId}/orders`).set(auth(owner.token))).status).toBe(200);
  });

  it("a user can't edit another user's store", async () => {
    const owner = await registerUser();
    const rival = await registerUser();
    const { storeId } = await makeStoreWithProduct(owner.token);
    expect((await api().patch(`/api/shop/stores/${storeId}`).set(auth(rival.token)).send({ name: "Hijacked" })).status).toBe(403);
  });

  it("store names are length-checked", async () => {
    const u = await registerUser();
    expect((await api().post("/api/shop/stores").set(auth(u.token)).send({ name: "x".repeat(81) })).status).toBe(400);
  });
});
