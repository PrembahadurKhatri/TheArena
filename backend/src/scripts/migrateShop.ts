// Shop migration (master plan Phase 8). Idempotent.
//
//   npm run migrate:shop -- --dry-run
//   npm run migrate:shop
//
//  - Shops and products from before approval existed become approved/active.
//  - Shops and products get slugs.
//  - Each existing order gets its per-shop SellerOrders (status from the order:
//    paid -> placed, pending_payment -> pending_payment, cancelled -> cancelled).
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db";
import { Store } from "../models/Store";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { SellerOrder } from "../models/SellerOrder";
import { ShopCategory } from "../models/ShopCategory";
import { Review, WishlistItem } from "../models/Review";
import { audit } from "../services/auditService";
import { uniqueSlug } from "../utils/names";

async function main() {
  await connectDB();
  const dryRun = process.argv.includes("--dry-run");
  const stores = await Store.find({ $or: [{ status: { $exists: false } }, { slug: { $exists: false } }] });
  const products = await Product.find({ $or: [{ status: { $exists: false } }, { slug: { $exists: false } }] });
  const orders = await Order.find({ $or: [{ sellerOrders: { $exists: false } }, { sellerOrders: { $size: 0 } }] });
  console.log(`[migrate:shop] stores: ${stores.length}, products: ${products.length}, orders without seller orders: ${orders.length}${dryRun ? " (dry run)" : ""}`);
  if (dryRun) return;

  await Promise.all([Store.syncIndexes(), Product.syncIndexes(), SellerOrder.syncIndexes(), ShopCategory.syncIndexes(), Review.syncIndexes(), WishlistItem.syncIndexes(), Order.syncIndexes()]);
  for (const s of stores) {
    await Store.updateOne({ _id: s._id }, { $set: { status: s.status ?? "approved", slug: s.slug ?? (await uniqueSlug(Store, s.name, s._id)) } });
  }
  for (const p of products) {
    await Product.updateOne({ _id: p._id }, { $set: { status: p.status ?? "active", slug: p.slug ?? (await uniqueSlug(Product, p.name, p._id)) } });
  }
  for (const o of orders) {
    const byStore = new Map<string, any[]>();
    for (const i of o.items) byStore.set(i.store.toString(), [...(byStore.get(i.store.toString()) ?? []), i]);
    const status = o.status === "paid" ? "placed" : o.status === "cancelled" ? "cancelled" : "pending_payment";
    const created = await SellerOrder.insertMany(
      [...byStore.entries()].map(([store, items]) => ({
        order: o._id,
        store,
        buyer: o.buyer,
        items: items.map((i) => ({ product: i.product, variant: null, name: i.name, price: i.price, quantity: i.quantity, image: i.image })),
        subtotal: Math.round(items.reduce((n, i) => n + i.price * i.quantity, 0) * 100) / 100,
        paymentMethod: "online",
        status,
        statusHistory: [{ status, at: o.createdAt, by: null, note: "Migrated" }],
        shipping: { address: o.shippingAddress, province: o.shippingProvince, contactName: o.contactName, contactPhone: o.contactPhone },
      }))
    );
    await Order.updateOne({ _id: o._id }, { $set: { sellerOrders: created.map((c) => c._id), paymentMethod: "online" } });
  }
  await audit({ actor: null, action: "system.migration", target: { type: "migration", id: "shop" }, after: { stores: stores.length, products: products.length, orders: orders.length } });
  console.log("[migrate:shop] done");
}

main()
  .catch((err) => {
    console.error("[migrate:shop] failed:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
