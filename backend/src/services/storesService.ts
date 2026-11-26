import { Store, IStore, PUBLIC_STORE } from "../models/Store";
import { Product, PUBLIC_PRODUCT } from "../models/Product";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isObjectIdString, optionalString, requireEmail, requireString } from "../utils/validation";
import { isValidProvince } from "../utils/provinces";
import { isValidDistrict, provinceOfDistrict } from "../utils/locations";
import { uniqueSlug } from "../utils/names";
import { Page, pageMeta } from "../utils/pagination";
import { notify } from "./notificationService";
import { audit } from "./auditService";
import { storeEntitlements } from "./entitlementsService";

const STORE_OWNER_POPULATE = { path: "owner", select: "name" };

const isPublic = (s: { status?: string | null }) => !s.status || s.status === "approved";

async function attachProducts(store: any, viewerIsOwner: boolean) {
  const filter: any = { store: store._id };
  if (!viewerIsOwner) Object.assign(filter, PUBLIC_PRODUCT);
  const products = await Product.find(filter).populate({ path: "store", select: "name slug" }).sort({ featured: -1, createdAt: -1 });
  const plain = store.toObject ? store.toObject() : store;
  plain.products = products;
  return plain;
}

/** Public shop directory: approved shops, featured (Pro) first, with product counts in one query. */
export async function listStores(query: Record<string, unknown> = {}, p?: Page) {
  const filter: any = { ...PUBLIC_STORE };
  if (typeof query.search === "string" && query.search.trim()) filter.name = { $regex: query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const cursor = Store.find(filter).populate(STORE_OWNER_POPULATE).sort({ premiumUntil: -1, createdAt: -1 });
  const stores = p ? await cursor.skip(p.skip).limit(p.limit) : await cursor.limit(200);
  const counts = await Product.aggregate([
    { $match: { store: { $in: stores.map((s) => s._id) }, ...PUBLIC_PRODUCT } },
    { $group: { _id: "$store", n: { $sum: 1 } } },
  ]);
  const byStore = new Map(counts.map((c: any) => [c._id.toString(), c.n as number]));
  const items = stores.map((s) => ({ ...s.toObject(), productCount: byStore.get(s._id.toString()) ?? 0 }));
  if (!p) return { stores: items, page: 1, limit: 200, total: items.length, pages: 1 };
  return { stores: items, ...pageMeta(p, await Store.countDocuments(filter)) };
}

async function findStore(idOrSlug: string) {
  return isObjectIdString(idOrSlug) ? Store.findById(idOrSlug).populate(STORE_OWNER_POPULATE) : Store.findOne({ slug: String(idOrSlug).toLowerCase() }).populate(STORE_OWNER_POPULATE);
}

export async function getStoreWithProducts(idOrSlug: string, viewer?: IUser) {
  const store = await findStore(idOrSlug);
  if (!store) throw new AppError(404, "Store not found");
  const isOwner = !!viewer && (store.owner as any)._id.equals(viewer._id);
  if (!isPublic(store) && !isOwner) throw new AppError(404, "Store not found");
  return attachProducts(store, isOwner);
}

export async function getMyStore(userId: string) {
  const store = await Store.findOne({ owner: userId }).populate(STORE_OWNER_POPULATE);
  if (!store) return null;
  return attachProducts(store, true);
}

function applyProfile(store: any, input: Record<string, any>, creating: boolean) {
  if (creating || input.name !== undefined) store.name = requireString(input.name, "name", { min: 2, max: 80 });
  if (input.description !== undefined) store.description = optionalString(input.description, "description", 2000);
  if (input.ownerName !== undefined) store.ownerName = optionalString(input.ownerName, "ownerName", 100);
  if (input.email !== undefined) store.email = input.email ? requireEmail(input.email) : undefined;
  if (input.phone !== undefined) store.phone = optionalString(input.phone, "phone", 30);
  if (input.address !== undefined) store.address = optionalString(input.address, "address", 300);
  if (input.province !== undefined) {
    if (input.province && !isValidProvince(input.province)) throw new AppError(400, `Invalid province: ${input.province}`);
    store.province = input.province || undefined;
  }
  if (input.district !== undefined) {
    if (input.district && !isValidDistrict(input.district)) throw new AppError(400, `Invalid district: ${input.district}`);
    store.district = input.district || undefined;
    if (store.district) store.province = provinceOfDistrict(store.district) ?? store.province;
  }
  if (input.logo !== undefined) store.logo = input.logo;
  if (input.banner !== undefined) store.banner = input.banner;
}

/** Apply to become a merchant: the shop starts pending until staff approve it. */
export async function createStore(user: IUser, input: Record<string, any>) {
  const existing = await Store.findOne({ owner: user._id });
  if (existing) {
    throw new AppError(409, "You already own a store. Only one store per user is allowed.");
  }
  const store: any = new Store({ owner: user._id, status: "pending", documents: input.documents ?? [] });
  applyProfile(store, { ownerName: user.name, email: user.email, phone: user.phone, ...input }, true);
  store.slug = await uniqueSlug(Store, store.name);
  try {
    await store.save();
  } catch (err: any) {
    if (err?.code === 11000) throw new AppError(409, "You already own a store. Only one store per user is allowed.");
    throw err;
  }
  return getStoreWithProducts(store._id.toString(), user);
}

async function getOwnedStoreOrThrow(storeId: string, userId: string) {
  if (!isObjectIdString(storeId)) throw new AppError(404, "Store not found");
  const store = await Store.findById(storeId);
  if (!store) throw new AppError(404, "Store not found");
  if (store.owner.toString() !== userId.toString()) {
    throw new AppError(403, "Only the store owner can perform this action");
  }
  return store;
}

export async function updateStore(storeId: string, user: IUser, updates: Record<string, any>) {
  const store = await getOwnedStoreOrThrow(storeId, user._id.toString());
  if (store.status === "suspended") throw new AppError(403, "This store is suspended; contact support");
  applyProfile(store, updates, false);
  if (updates.name !== undefined) store.slug = await uniqueSlug(Store, store.name, store._id);
  if (Array.isArray(updates.documents) && updates.documents.length) store.documents = [...store.documents, ...updates.documents].slice(0, 10);
  // A rejected application goes back for review once updated.
  if (store.status === "rejected") store.status = "pending";
  await store.save();
  return getStoreWithProducts(store._id.toString(), user);
}

export { getOwnedStoreOrThrow };

/** Whether a store may sell (approved, not suspended). */
export function canSell(store: Pick<IStore, "status">) {
  return isPublic(store);
}

export function productLimit(store: IStore) {
  return storeEntitlements(store).maxProducts;
}

// ---------------------------------------------------------------- staff

export async function adminListStores(query: Record<string, unknown>, p: Page) {
  const status = typeof query.status === "string" ? query.status : "pending";
  const filter: any = status === "all" ? {} : status === "approved" ? PUBLIC_STORE : { status };
  const [items, total] = await Promise.all([
    Store.find(filter).populate("owner", "name email phone").sort({ createdAt: 1 }).skip(p.skip).limit(p.limit),
    Store.countDocuments(filter),
  ]);
  return { stores: items, ...pageMeta(p, total) };
}

export async function adminReviewStore(actor: IUser, id: string, input: { decision?: unknown; note?: unknown }) {
  if (!isObjectIdString(id)) throw new AppError(404, "Store not found");
  const store = await Store.findById(id);
  if (!store) throw new AppError(404, "Store not found");
  const decision = String(input.decision);
  if (!["approve", "reject", "suspend", "reinstate"].includes(decision)) throw new AppError(400, 'decision must be "approve", "reject", "suspend" or "reinstate"');
  const note = optionalString(input.note, "note", 1000) ?? null;
  if ((decision === "reject" || decision === "suspend") && !note) throw new AppError(400, "Give the merchant a reason");
  if (decision === "approve" && store.status !== "pending") throw new AppError(400, "Only pending applications can be approved");
  const status = decision === "approve" || decision === "reinstate" ? "approved" : decision === "reject" ? "rejected" : "suspended";
  const before = store.status ?? "approved";
  store.status = status;
  store.review = { by: actor._id, note, at: new Date() };
  await store.save();
  await audit({ actor: actor._id, actorRole: actor.role, action: `store.${status}`, target: { type: "store", id: store._id }, before: { status: before }, after: { status }, reason: note ?? undefined });
  await notify(store.owner, {
    type: "merchant.review",
    title: status === "approved" ? `${store.name} is open on The Arena Shop` : status === "rejected" ? `${store.name} wasn't approved` : `${store.name} has been suspended`,
    body: note ?? undefined,
    link: "/shop/my-store",
    entity: { type: "store", id: store._id },
    actor: actor._id,
  });
  return store;
}
