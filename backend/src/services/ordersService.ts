import { Types } from "mongoose";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Store } from "../models/Store";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isValidProvince } from "../utils/provinces";
import { isObjectIdString, optionalString, requireString } from "../utils/validation";

const ORDER_POPULATE = [
  { path: "items.store", select: "name" },
  { path: "payment" },
];

export async function createOrder(
  user: IUser,
  input: { items?: { productId: string; quantity: number }[]; shippingAddress?: string; shippingProvince?: string; contactName?: string; contactPhone?: string }
) {
  const { items, shippingProvince } = input;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, "items must be a non-empty array");
  }
  if (items.length > 50) throw new AppError(400, "Too many items in one order");
  const shippingAddress = requireString(input.shippingAddress, "shippingAddress", { min: 5, max: 300 });
  const contactName = optionalString(input.contactName, "contactName", 100);
  const contactPhone = optionalString(input.contactPhone, "contactPhone", 30);
  if (shippingProvince && !isValidProvince(shippingProvince)) {
    throw new AppError(400, `Invalid province: ${shippingProvince}`);
  }

  // Validate and merge duplicate lines for the same product, so one order
  // can't bypass the stock check by listing a product twice.
  const quantities = new Map<string, number>();
  for (const line of items) {
    const productId = line?.productId;
    const quantity = Number(line?.quantity);
    if (!isObjectIdString(productId) || !Number.isInteger(quantity) || quantity <= 0 || quantity > 1000) {
      throw new AppError(400, "Each item requires a valid productId and a positive whole-number quantity");
    }
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  // Reserve stock atomically: the decrement only happens if enough stock is
  // left at that instant, so concurrent buyers can never oversell. Prices
  // and names are read from the database, never from the client.
  const reserved: { productId: Types.ObjectId; quantity: number }[] = [];
  const orderItems: any[] = [];
  let totalAmount = 0;

  try {
    for (const [productId, quantity] of quantities) {
      const product = await Product.findOneAndUpdate(
        { _id: productId, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true }
      );

      if (!product) {
        const existing = await Product.findById(productId);
        if (!existing) throw new AppError(404, `Product not found: ${productId}`);
        throw new AppError(
          400,
          `Not enough stock for "${existing.name}" (requested ${quantity}, available ${existing.stock})`
        );
      }
      reserved.push({ productId: product._id, quantity });

      totalAmount += product.price * quantity;
      orderItems.push({
        product: product._id,
        store: product.store,
        name: product.name,
        price: product.price,
        quantity,
        image: product.images && product.images.length > 0 ? product.images[0] : null,
      });
    }

    totalAmount = Math.round(totalAmount * 100) / 100;

    const order = await Order.create({
      buyer: user._id,
      items: orderItems,
      totalAmount,
      status: "pending_payment",
      shippingAddress,
      shippingProvince: shippingProvince || undefined,
      contactName,
      contactPhone,
      payment: null,
    });

    return Order.findById(order._id).populate(ORDER_POPULATE);
  } catch (err) {
    // Give back anything already reserved before the failure.
    await restock(reserved);
    throw err;
  }
}

async function restock(lines: { productId: Types.ObjectId | null; quantity: number }[]) {
  for (const line of lines) {
    if (!line.productId) continue;
    await Product.updateOne({ _id: line.productId }, { $inc: { stock: line.quantity } });
  }
}

// Cancels an unpaid order and returns its stock. Atomic on the status, so a
// payment failure and the expiry sweeper can't both restock the same order.
export async function cancelOrderAndRestock(orderId: Types.ObjectId | string) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "pending_payment" },
    { $set: { status: "cancelled" } },
    { new: true }
  );
  if (!order) return false;
  await restock(order.items.map((i) => ({ productId: i.product, quantity: i.quantity })));
  return true;
}

export async function listMyOrders(userId: string) {
  return Order.find({ buyer: userId }).populate(ORDER_POPULATE).sort({ createdAt: -1 });
}

export async function listStoreOrders(storeId: string, user: IUser) {
  if (!isObjectIdString(storeId)) throw new AppError(400, "Invalid id");
  const store = await Store.findById(storeId);
  if (!store) throw new AppError(404, "Store not found");
  if (store.owner.toString() !== user._id.toString()) {
    throw new AppError(403, "Only the store owner can view this store's orders");
  }

  const orders = await Order.find({ "items.store": store._id }).populate(ORDER_POPULATE).sort({ createdAt: -1 });

  // A buyer's order can span multiple stores — filter each order's items
  // down to just this store's line items before handing them to the seller.
  return orders.map((order) => {
    const plain: any = order.toObject();
    plain.items = plain.items.filter((item: any) => {
      const itemStoreId = item.store && item.store._id ? item.store._id.toString() : item.store?.toString();
      return itemStoreId === store._id.toString();
    });
    return plain;
  });
}
