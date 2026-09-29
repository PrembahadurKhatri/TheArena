import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Store } from "../models/Store";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isValidProvince } from "../utils/provinces";

const ORDER_POPULATE = [
  { path: "items.store", select: "name" },
  { path: "payment" },
];

export async function createOrder(
  user: IUser,
  input: { items?: { productId: string; quantity: number }[]; shippingAddress?: string; shippingProvince?: string }
) {
  const { items, shippingAddress, shippingProvince } = input;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, "items must be a non-empty array");
  }
  if (!shippingAddress) {
    throw new AppError(400, "shippingAddress is required");
  }
  if (shippingProvince && !isValidProvince(shippingProvince)) {
    throw new AppError(400, `Invalid province: ${shippingProvince}`);
  }

  const orderItems: any[] = [];
  let totalAmount = 0;
  const productsToSave: any[] = [];

  for (const line of items) {
    const { productId, quantity } = line;
    if (!productId || !quantity || quantity <= 0) {
      throw new AppError(400, "Each item requires a productId and a positive quantity");
    }

    const product = await Product.findById(productId).populate("store");
    if (!product) throw new AppError(404, `Product not found: ${productId}`);

    if (quantity > product.stock) {
      throw new AppError(400, `Not enough stock for "${product.name}" (requested ${quantity}, available ${product.stock})`);
    }

    const lineTotal = product.price * quantity;
    totalAmount += lineTotal;

    const store: any = product.store;
    orderItems.push({
      product: product._id,
      store: store._id ?? store,
      name: product.name,
      price: product.price,
      quantity,
      image: product.images && product.images.length > 0 ? product.images[0] : null,
    });

    product.stock -= quantity;
    productsToSave.push(product);
  }

  // All validation passed — now persist the stock decrements.
  for (const product of productsToSave) {
    await product.save();
  }

  totalAmount = Math.round(totalAmount * 100) / 100;

  const order = await Order.create({
    buyer: user._id,
    items: orderItems,
    totalAmount,
    status: "pending_payment",
    shippingAddress,
    shippingProvince,
    payment: null,
  });

  return Order.findById(order._id).populate(ORDER_POPULATE);
}

export async function listMyOrders(userId: string) {
  return Order.find({ buyer: userId }).populate(ORDER_POPULATE).sort({ createdAt: -1 });
}

export async function listStoreOrders(storeId: string, user: IUser) {
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
