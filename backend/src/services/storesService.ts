import { Store } from "../models/Store";
import { Product } from "../models/Product";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";

const STORE_OWNER_POPULATE = { path: "owner", select: "name" };

async function attachProducts(store: any) {
  const products = await Product.find({ store: store._id }).populate({ path: "store", select: "name" }).sort({ createdAt: -1 });
  const plain = store.toObject ? store.toObject() : store;
  plain.products = products;
  return plain;
}

export async function listStores() {
  const stores = await Store.find().populate(STORE_OWNER_POPULATE).sort({ createdAt: -1 });
  const withCounts = await Promise.all(
    stores.map(async (s) => {
      const productCount = await Product.countDocuments({ store: s._id });
      const plain: any = s.toObject();
      plain.productCount = productCount;
      return plain;
    })
  );
  return withCounts;
}

export async function getStoreWithProducts(id: string) {
  const store = await Store.findById(id).populate(STORE_OWNER_POPULATE);
  if (!store) throw new AppError(404, "Store not found");
  return attachProducts(store);
}

export async function getMyStore(userId: string) {
  const store = await Store.findOne({ owner: userId }).populate(STORE_OWNER_POPULATE);
  if (!store) return null;
  return attachProducts(store);
}

export async function createStore(user: IUser, input: { name?: string; description?: string; logo?: string | null }) {
  const { name, description, logo } = input;
  if (!name) throw new AppError(400, "name is required");

  const existing = await Store.findOne({ owner: user._id });
  if (existing) {
    throw new AppError(409, "You already own a store. Only one store per user is allowed.");
  }

  const store = await Store.create({
    owner: user._id,
    name,
    description,
    logo: logo ?? null,
  });

  return getStoreWithProducts(store._id.toString());
}

async function getOwnedStoreOrThrow(storeId: string, userId: string) {
  const store = await Store.findById(storeId);
  if (!store) throw new AppError(404, "Store not found");
  if (store.owner.toString() !== userId.toString()) {
    throw new AppError(403, "Only the store owner can perform this action");
  }
  return store;
}

export async function updateStore(
  storeId: string,
  user: IUser,
  updates: { name?: string; description?: string; logo?: string }
) {
  const store = await getOwnedStoreOrThrow(storeId, user._id.toString());
  if (updates.name !== undefined) store.name = updates.name;
  if (updates.description !== undefined) store.description = updates.description;
  if (updates.logo !== undefined) store.logo = updates.logo;
  await store.save();
  return getStoreWithProducts(store._id.toString());
}

export { getOwnedStoreOrThrow };
