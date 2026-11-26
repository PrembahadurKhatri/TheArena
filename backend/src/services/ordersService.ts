import { Types } from "mongoose";
import { Order } from "../models/Order";
import { Product, PUBLIC_PRODUCT, unitPrice } from "../models/Product";
import { Store } from "../models/Store";
import { SellerOrder, ISellerOrder, SellerOrderStatus } from "../models/SellerOrder";
import { Payment } from "../models/Payment";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isValidProvince } from "../utils/provinces";
import { isObjectIdString, optionalString, queryString, requireString } from "../utils/validation";
import { Page, pageMeta } from "../utils/pagination";
import { notify } from "./notificationService";
import { storeEntitlements } from "./entitlementsService";

const ORDER_POPULATE = [
  { path: "items.store", select: "name slug" },
  { path: "payment" },
  { path: "sellerOrders", populate: { path: "store", select: "name slug" } },
];

interface Reserved {
  productId: Types.ObjectId;
  variantId: Types.ObjectId | null;
  quantity: number;
}

/** Take stock atomically: the product (or its variant) must have enough left. */
async function reserve(productId: string, variantId: string | null, quantity: number) {
  if (variantId) {
    return Product.findOneAndUpdate(
      { _id: productId, ...PUBLIC_PRODUCT, variants: { $elemMatch: { _id: variantId, stock: { $gte: quantity } } } },
      { $inc: { "variants.$.stock": -quantity, stock: -quantity } },
      { new: true }
    );
  }
  return Product.findOneAndUpdate(
    { _id: productId, ...PUBLIC_PRODUCT, "variants.0": { $exists: false }, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { new: true }
  );
}

async function restock(lines: { productId: Types.ObjectId | null; variantId?: Types.ObjectId | null; quantity: number }[]) {
  for (const line of lines) {
    if (!line.productId) continue;
    if (line.variantId) {
      await Product.updateOne({ _id: line.productId, "variants._id": line.variantId }, { $inc: { "variants.$.stock": line.quantity, stock: line.quantity } });
    } else {
      await Product.updateOne({ _id: line.productId }, { $inc: { stock: line.quantity } });
    }
  }
}

export async function createOrder(
  user: IUser,
  input: {
    items?: { productId: string; variantId?: string; quantity: number }[];
    shippingAddress?: string;
    shippingProvince?: string;
    contactName?: string;
    contactPhone?: string;
    paymentMethod?: string;
  }
) {
  const { items, shippingProvince } = input;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, "items must be a non-empty array");
  }
  if (items.length > 50) throw new AppError(400, "Too many items in one order");
  const paymentMethod = input.paymentMethod ?? "online";
  if (paymentMethod !== "online" && paymentMethod !== "cod") throw new AppError(400, 'paymentMethod must be "cod" or "online"');
  const shippingAddress = requireString(input.shippingAddress, "shippingAddress", { min: 5, max: 300 });
  const contactName = optionalString(input.contactName, "contactName", 100);
  const contactPhone = optionalString(input.contactPhone, "contactPhone", 30);
  if (paymentMethod === "cod" && !contactPhone) throw new AppError(400, "A contact phone is needed for cash on delivery");
  if (shippingProvince && !isValidProvince(shippingProvince)) {
    throw new AppError(400, `Invalid province: ${shippingProvince}`);
  }

  // Merge repeated lines so listing a product twice can't bypass the stock check.
  const quantities = new Map<string, number>();
  for (const line of items) {
    const productId = line?.productId;
    const variantId = line?.variantId || null;
    const quantity = Number(line?.quantity);
    if (!isObjectIdString(productId) || (variantId && !isObjectIdString(variantId)) || !Number.isInteger(quantity) || quantity <= 0 || quantity > 1000) {
      throw new AppError(400, "Each item requires a valid productId and a positive whole-number quantity");
    }
    const key = `${productId}:${variantId ?? ""}`;
    quantities.set(key, (quantities.get(key) ?? 0) + quantity);
  }

  const reserved: Reserved[] = [];
  const lines: any[] = [];
  try {
    for (const [key, quantity] of quantities) {
      const [productId, variantRaw] = key.split(":");
      const variantId = variantRaw || null;
      const existing = await Product.findById(productId).populate("store", "status owner name");
      if (!existing) throw new AppError(404, `Product not found: ${productId}`);
      const store: any = existing.store;
      if (store?.status && store.status !== "approved") throw new AppError(400, `"${existing.name}" isn't available right now`);
      if (store?.owner?.equals(user._id)) throw new AppError(400, "You can't order from your own shop");
      if (existing.variants.length && !variantId) throw new AppError(400, `Choose a size or colour for "${existing.name}"`);
      const variant = variantId ? existing.variants.find((v) => v._id.toString() === variantId) : null;
      if (variantId && !variant) throw new AppError(400, `That option of "${existing.name}" no longer exists`);

      const product = await reserve(productId, variantId, quantity);
      if (!product) {
        if (existing.status && existing.status !== "active") throw new AppError(400, `"${existing.name}" isn't on sale`);
        const available = variant ? variant.stock : existing.stock;
        throw new AppError(400, `Not enough stock for "${existing.name}" (requested ${quantity}, available ${available})`);
      }
      reserved.push({ productId: product._id, variantId: variant?._id ?? null, quantity });
      lines.push({
        product: product._id,
        store: product.store,
        variant: variant?._id ?? null,
        size: variant?.size ?? null,
        color: variant?.color ?? null,
        sku: variant?.sku ?? product.sku ?? null,
        // Price always from the database, never from the request.
        price: unitPrice(product),
        quantity,
        name: product.name,
        image: product.images && product.images.length > 0 ? product.images[0] : null,
      });
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    const totalAmount = round(lines.reduce((n, l) => n + l.price * l.quantity, 0));
    const order = await Order.create({
      buyer: user._id,
      items: lines.map(({ sku: _sku, ...l }) => l),
      totalAmount,
      status: paymentMethod === "cod" ? "placed" : "pending_payment",
      paymentMethod,
      shippingAddress,
      shippingProvince: shippingProvince || undefined,
      contactName,
      contactPhone,
      payment: null,
    });

    // One seller order per shop.
    const byStore = new Map<string, any[]>();
    for (const l of lines) byStore.set(l.store.toString(), [...(byStore.get(l.store.toString()) ?? []), l]);
    const status: SellerOrderStatus = paymentMethod === "cod" ? "placed" : "pending_payment";
    const sellerOrders = await SellerOrder.insertMany(
      [...byStore.entries()].map(([storeId, storeLines]) => ({
        order: order._id,
        store: new Types.ObjectId(storeId),
        buyer: user._id,
        items: storeLines.map(({ store: _s, ...l }) => l),
        subtotal: round(storeLines.reduce((n, l) => n + l.price * l.quantity, 0)),
        paymentMethod,
        status,
        statusHistory: [{ status, at: new Date(), by: user._id }],
        shipping: { address: shippingAddress, province: shippingProvince, contactName, contactPhone },
      }))
    );
    await Order.updateOne({ _id: order._id }, { $set: { sellerOrders: sellerOrders.map((s) => s._id) } });
    if (paymentMethod === "cod") await notifyMerchants(sellerOrders);
    return Order.findById(order._id).populate(ORDER_POPULATE);
  } catch (err) {
    // Give back anything already reserved before the failure.
    await restock(reserved);
    throw err;
  }
}

async function notifyMerchants(sellerOrders: ISellerOrder[]) {
  const stores = await Store.find({ _id: { $in: sellerOrders.map((s) => s.store) } }).select("owner name");
  for (const so of sellerOrders) {
    const store = stores.find((s) => s._id.equals(so.store));
    if (!store) continue;
    await notify(store.owner, {
      type: "order.placed",
      title: `New order for ${store.name}: Rs ${so.subtotal}`,
      body: `${so.items.reduce((n, i) => n + i.quantity, 0)} item(s), ${so.paymentMethod === "cod" ? "cash on delivery" : "paid online"}`,
      link: "/shop/my-store?tab=orders",
      entity: { type: "seller_order", id: so._id },
    });
  }
}

/** Online payment received: the shops can start. Called by paymentsService. */
export async function markOrderPaid(orderId: Types.ObjectId | string, paymentId: Types.ObjectId) {
  const res = await Order.updateOne({ _id: orderId, status: "pending_payment" }, { $set: { status: "paid", payment: paymentId } });
  if (!res.modifiedCount) return;
  await SellerOrder.updateMany(
    { order: orderId, status: "pending_payment" },
    { $set: { status: "placed" }, $push: { statusHistory: { status: "placed", at: new Date(), by: null, note: "Paid online" } } }
  );
  await notifyMerchants(await SellerOrder.find({ order: orderId }));
}

/** Unpaid order abandoned or its payment failed: cancel everything and put stock back. */
export async function cancelOrderAndRestock(orderId: Types.ObjectId | string) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "pending_payment" },
    { $set: { status: "cancelled" } },
    { new: true }
  );
  if (!order) return false;
  await SellerOrder.updateMany(
    { order: order._id, status: "pending_payment" },
    { $set: { status: "cancelled" }, $push: { statusHistory: { status: "cancelled", at: new Date(), by: null, note: "Not paid" } } }
  );
  await restock(order.items.map((i) => ({ productId: i.product, variantId: i.variant ?? null, quantity: i.quantity })));
  return true;
}

export async function listMyOrders(userId: string) {
  return Order.find({ buyer: userId }).populate(ORDER_POPULATE).sort({ createdAt: -1 }).limit(100);
}

export async function getMyOrder(user: IUser, orderId: string) {
  if (!isObjectIdString(orderId)) throw new AppError(404, "Order not found");
  const order = await Order.findOne({ _id: orderId, buyer: user._id }).populate(ORDER_POPULATE);
  if (!order) throw new AppError(404, "Order not found");
  return order;
}

// ---------------------------------------------------------------- fulfilment

// Merchant transitions. Cancelling or returning puts the stock back.
const MERCHANT_NEXT: Record<string, SellerOrderStatus[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["processing", "shipped", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
};
const BUYER_CANCELLABLE: SellerOrderStatus[] = ["pending_payment", "placed", "confirmed", "processing"];

const STATUS_WORDS: Record<string, string> = {
  confirmed: "was confirmed",
  processing: "is being packed",
  shipped: "is on its way",
  delivered: "was delivered",
  cancelled: "was cancelled",
  returned: "was returned",
};

async function afterSellerOrderChange(so: ISellerOrder, status: SellerOrderStatus) {
  if (status === "cancelled" || status === "returned") {
    await restock(so.items.map((i) => ({ productId: i.product, variantId: i.variant, quantity: i.quantity })));
    const order = await Order.findById(so.order);
    if (order) {
      const rest = await SellerOrder.find({ order: order._id });
      if (rest.every((r) => r.status === "cancelled" || r.status === "returned")) await Order.updateOne({ _id: order._id }, { $set: { status: "cancelled" } });
      // A cancelled part of an order paid online needs its money returned by staff.
      if (order.payment && order.paymentMethod === "online") await Payment.updateOne({ _id: order.payment }, { $set: { refundRequested: true } });
    }
  }
}

async function getStoreOwnedSellerOrder(user: IUser, id: string) {
  if (!isObjectIdString(id)) throw new AppError(404, "Order not found");
  const so = await SellerOrder.findById(id);
  if (!so) throw new AppError(404, "Order not found");
  const store = await Store.findById(so.store).select("owner name");
  if (!store || !store.owner.equals(user._id)) throw new AppError(404, "Order not found");
  return { so, store };
}

export async function updateSellerOrderStatus(user: IUser, id: string, input: { status?: unknown; note?: unknown; carrier?: unknown; trackingCode?: unknown }) {
  const { so, store } = await getStoreOwnedSellerOrder(user, id);
  const next = String(input.status) as SellerOrderStatus;
  if (!(MERCHANT_NEXT[so.status] ?? []).includes(next)) {
    throw new AppError(400, `A ${so.status.replace("_", " ")} order can't be marked ${next.replace("_", " ")}`);
  }
  const note = optionalString(input.note, "note", 300);
  if (next === "cancelled" && !note) throw new AppError(400, "Tell the buyer why you're cancelling");
  const $set: Record<string, unknown> = { status: next };
  if (next === "shipped") {
    $set["tracking.carrier"] = optionalString(input.carrier, "carrier", 60) ?? null;
    $set["tracking.code"] = optionalString(input.trackingCode, "trackingCode", 80) ?? null;
  }
  const updated = await SellerOrder.findOneAndUpdate(
    { _id: so._id, status: so.status },
    { $set, $push: { statusHistory: { status: next, at: new Date(), by: user._id, note } } },
    { new: true }
  );
  if (!updated) throw new AppError(409, "The order changed in the meantime");
  await afterSellerOrderChange(updated, next);
  await notify(so.buyer, {
    type: "order.status",
    title: `Your order from ${store.name} ${STATUS_WORDS[next] ?? next}`,
    body: note ?? (next === "shipped" && $set["tracking.code"] ? `Tracking: ${$set["tracking.carrier"] ?? ""} ${$set["tracking.code"]}` : undefined),
    link: "/shop/orders",
    entity: { type: "seller_order", id: so._id },
    actor: user._id,
  });
  return SellerOrder.findById(so._id).populate("store", "name slug").populate("buyer", "name");
}

/** The buyer cancels one shop's part of their order, before it ships. */
export async function cancelSellerOrderByBuyer(user: IUser, id: string, reasonInput?: unknown) {
  if (!isObjectIdString(id)) throw new AppError(404, "Order not found");
  const so = await SellerOrder.findOne({ _id: id, buyer: user._id });
  if (!so) throw new AppError(404, "Order not found");
  if (!BUYER_CANCELLABLE.includes(so.status)) throw new AppError(400, `This order is already ${so.status.replace("_", " ")} and can't be cancelled`);
  const note = optionalString(reasonInput, "reason", 300) ?? "Cancelled by the buyer";
  const updated = await SellerOrder.findOneAndUpdate(
    { _id: so._id, status: so.status },
    { $set: { status: "cancelled" }, $push: { statusHistory: { status: "cancelled", at: new Date(), by: user._id, note } } },
    { new: true }
  );
  if (!updated) throw new AppError(409, "The order changed in the meantime");
  await afterSellerOrderChange(updated, "cancelled");
  const store = await Store.findById(so.store).select("owner name");
  if (store) {
    await notify(store.owner, { type: "order.status", title: `An order for ${store.name} was cancelled by the buyer`, body: note, link: "/shop/my-store?tab=orders", entity: { type: "seller_order", id: so._id }, actor: user._id });
  }
  return getMyOrder(user, so.order.toString());
}

/** A merchant's orders: only their own shop's part of each checkout. */
export async function listStoreOrders(storeId: string, user: IUser, query: Record<string, unknown> = {}) {
  if (!isObjectIdString(storeId)) throw new AppError(400, "Invalid id");
  const store = await Store.findById(storeId);
  if (!store) throw new AppError(404, "Store not found");
  if (store.owner.toString() !== user._id.toString()) {
    throw new AppError(403, "Only the store owner can view this store's orders");
  }
  const filter: any = { store: store._id };
  const status = queryString(query.status);
  if (status) filter.status = status;
  return SellerOrder.find(filter).populate("buyer", "name").sort({ createdAt: -1 }).limit(300);
}

/** Last 30 days for a merchant: revenue by day, status counts, best sellers. Revenue = delivered orders. */
export async function salesReport(storeId: string, user: IUser) {
  if (!isObjectIdString(storeId)) throw new AppError(400, "Invalid id");
  const store = await Store.findById(storeId);
  if (!store || !store.owner.equals(user._id)) throw new AppError(403, "Only the store owner can view its sales");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const id = store._id;
  const [byDay, byStatus, top, totals] = await Promise.all([
    SellerOrder.aggregate([
      { $match: { store: id, status: "delivered", updatedAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt", timezone: "+05:45" } }, revenue: { $sum: "$subtotal" }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    SellerOrder.aggregate([{ $match: { store: id, createdAt: { $gte: since } } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    SellerOrder.aggregate([
      { $match: { store: id, status: { $nin: ["cancelled", "returned", "pending_payment"] }, createdAt: { $gte: since } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", name: { $first: "$items.name" }, quantity: { $sum: "$items.quantity" }, revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } } } },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
    ]),
    SellerOrder.aggregate([{ $match: { store: id, status: "delivered" } }, { $group: { _id: null, revenue: { $sum: "$subtotal" }, orders: { $sum: 1 } } }]),
  ]);
  const ent = storeEntitlements(store);
  return {
    // Revenue figures are records of delivered orders, not money settled to you.
    last30Days: {
      revenue: byDay.reduce((n: number, d: any) => n + d.revenue, 0),
      deliveredOrders: byDay.reduce((n: number, d: any) => n + d.orders, 0),
      byDay: byDay.map((d: any) => ({ date: d._id, revenue: d.revenue, orders: d.orders })),
      byStatus: Object.fromEntries(byStatus.map((s: any) => [s._id, s.n])),
      topProducts: top.map((t: any) => ({ productId: t._id?.toString() ?? null, name: t.name, quantity: t.quantity, revenue: t.revenue })),
    },
    allTime: { revenue: totals[0]?.revenue ?? 0, deliveredOrders: totals[0]?.orders ?? 0 },
    detailedReports: ent.salesReports,
  };
}

export async function adminListSellerOrders(query: Record<string, unknown>, p: Page) {
  const filter: any = {};
  const status = queryString(query.status);
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    SellerOrder.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate("store", "name").populate("buyer", "name email"),
    SellerOrder.countDocuments(filter),
  ]);
  return { orders: items, ...pageMeta(p, total) };
}
