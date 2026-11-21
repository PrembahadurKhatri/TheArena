import request from "supertest";
import app from "../src/app";
import { User } from "../src/models/User";
import { Ground } from "../src/models/Ground";

export const api = () => request(app);

let counter = 0;

/** Register a real account through the API and return its token and id. */
export async function registerUser(overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  counter += 1;
  const body = {
    name: overrides.name ?? `Player ${counter}`,
    email: overrides.email ?? `player${counter}-${Date.now()}@example.com`,
    password: overrides.password ?? "CorrectHorse9!",
  };
  const res = await api().post("/api/auth/register").send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, id: res.body.user.id as string, email: body.email, password: body.password };
}

export async function registerAdmin() {
  const u = await registerUser({ name: "Admin" });
  await User.updateOne({ _id: u.id }, { $set: { role: "admin" } });
  return u;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function makeGround(pricePerHour = 1000) {
  return Ground.create({ sport: "football", name: "Test Ground", location: "Pokhara", pricePerHour });
}

/** A date a few days ahead (YYYY-MM-DD), so bookings are never "in the past". */
export function futureDate(daysAhead = 3) {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

export async function makeStoreWithProduct(token: string, product: { price?: number; stock?: number } = {}) {
  const store = await api().post("/api/shop/stores").set(auth(token)).send({ name: "Test Store" });
  if (store.status !== 201) throw new Error(`store failed: ${store.status} ${JSON.stringify(store.body)}`);
  const prod = await api()
    .post("/api/shop/products")
    .set(auth(token))
    .send({ name: "Cricket Bat", category: "Bats", sport: "cricket", price: product.price ?? 5000, stock: product.stock ?? 10 });
  if (prod.status !== 201) throw new Error(`product failed: ${prod.status} ${JSON.stringify(prod.body)}`);
  return { storeId: store.body.store.id as string, productId: prod.body.product.id as string };
}
