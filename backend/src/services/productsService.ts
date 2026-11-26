import { Types } from "mongoose";
import { Product, IProduct, IVariant, PUBLIC_PRODUCT } from "../models/Product";
import { Store, PUBLIC_STORE } from "../models/Store";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isValidSportSlug } from "../utils/sports";
import { isActiveShopCategory } from "../utils/shopCategories";
import { escapeRegex, isObjectIdString, optionalString, queryString, requireString } from "../utils/validation";
import { uniqueSlug } from "../utils/names";
import { Page, pageMeta } from "../utils/pagination";
import { notify } from "./notificationService";
import { audit } from "./auditService";
import { productLimit } from "./storesService";

const PRODUCT_STORE_POPULATE = { path: "store", select: "name slug status" };

const PRODUCT_SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { featured: -1, createdAt: -1 },
  price_asc: { price: 1, createdAt: -1 },
  price_desc: { price: -1, createdAt: -1 },
  name_asc: { name: 1 },
  rating: { "rating.avg": -1, "rating.count": -1 },
};

function priceBound(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new AppError(400, `${field} must be a non-negative number`);
  return n;
}

async function publicStoreIds() {
  return (await Store.find(PUBLIC_STORE).select("_id").lean()).map((s) => s._id);
}

/** Public catalogue: active products of approved shops. */
export async function listProducts(filters: Record<string, unknown>, p?: Page) {
  const query: any = { ...PUBLIC_PRODUCT };
  const sport = queryString(filters.sport);
  if (sport) query.sport = sport;
  const category = queryString(filters.category);
  if (category) query.category = category;
  const brand = queryString(filters.brand);
  if (brand) query.brand = { $regex: `^${escapeRegex(brand)}$`, $options: "i" };
  const search = queryString(filters.search);
  if (search) query.$or = [{ name: { $regex: escapeRegex(search), $options: "i" } }, { brand: { $regex: escapeRegex(search), $options: "i" } }];
  const storeId = queryString(filters.storeId);
  const visible = await publicStoreIds();
  if (storeId) {
    if (!isObjectIdString(storeId)) return { products: [], page: 1, limit: 0, total: 0, pages: 1 };
    query.store = visible.some((v) => v.toString() === storeId) ? storeId : null;
  } else {
    query.store = { $in: visible };
  }
  const min = priceBound(filters.minPrice, "minPrice");
  const max = priceBound(filters.maxPrice, "maxPrice");
  if (min !== undefined || max !== undefined) {
    query.price = {};
    if (min !== undefined) query.price.$gte = min;
    if (max !== undefined) query.price.$lte = max;
  }
  if (filters.inStock === "1" || filters.inStock === "true") query.stock = { $gt: 0 };
  if (filters.featured === "true") query.featured = true;
  const sort = PRODUCT_SORTS[queryString(filters.sort) ?? ""] ?? PRODUCT_SORTS.newest;
  const cursor = Product.find(query).populate(PRODUCT_STORE_POPULATE).sort(sort);
  if (!p) return { products: await cursor.limit(500), page: 1, limit: 500, total: 0, pages: 1 };
  const [products, total] = await Promise.all([cursor.skip(p.skip).limit(p.limit), Product.countDocuments(query)]);
  return { products, ...pageMeta(p, total) };
}

const isPublicProduct = (p: any) => (!p.status || p.status === "active") && (!p.store?.status || p.store.status === "approved");

/** By id or slug. Non-public products are visible only to their shop's owner. */
export async function getProductById(idOrSlug: string, viewer?: IUser) {
  const product = isObjectIdString(idOrSlug)
    ? await Product.findById(idOrSlug).populate({ path: "store", select: "name slug status owner" })
    : await Product.findOne({ slug: String(idOrSlug).toLowerCase() }).populate({ path: "store", select: "name slug status owner" });
  if (!product) throw new AppError(404, "Product not found");
  const isOwner = !!viewer && (product.store as any)?.owner?.equals(viewer._id);
  if (!isPublicProduct(product) && !isOwner) throw new AppError(404, "Product not found");
  return product;
}

async function getCallerStoreOrThrow(userId: string) {
  const store = await Store.findOne({ owner: userId });
  if (!store) {
    throw new AppError(403, "You need a store before you can list products");
  }
  if (store.status === "suspended" || store.status === "rejected") throw new AppError(403, "Your store can't list products right now");
  return store;
}

function parseJson(value: unknown, field: string) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new AppError(400, `${field} must be valid JSON`);
  }
}

/** Validates variants; keeps existing variant ids when the client sends them back. */
function parseVariants(value: unknown): IVariant[] {
  const list = parseJson(value, "variants");
  if (!Array.isArray(list)) throw new AppError(400, "variants must be a list");
  if (list.length > 50) throw new AppError(400, "At most 50 variants");
  const seen = new Set<string>();
  return list.map((v: any) => {
    const size = optionalString(v?.size, "size", 30);
    const color = optionalString(v?.color, "color", 30);
    if (!size && !color) throw new AppError(400, "Each variant needs a size or a colour");
    const key = `${size ?? ""}|${color ?? ""}`.toLowerCase();
    if (seen.has(key)) throw new AppError(400, `Duplicate variant: ${[size, color].filter(Boolean).join(" / ")}`);
    seen.add(key);
    const stock = Number(v?.stock);
    if (!Number.isInteger(stock) || stock < 0) throw new AppError(400, "Variant stock must be a whole number >= 0");
    return {
      _id: isObjectIdString(v?.id) ? new Types.ObjectId(v.id) : new Types.ObjectId(),
      sku: optionalString(v?.sku, "sku", 60),
      size,
      color,
      stock,
    } as IVariant;
  });
}

function applyInput(product: any, input: Record<string, any>, creating: boolean) {
  if (creating || input.name !== undefined) product.name = requireString(input.name, "name", { max: 120 });
  if (input.description !== undefined) product.description = optionalString(input.description, "description", 2000);
  if (creating || input.category !== undefined) {
    if (!isActiveShopCategory(input.category)) throw new AppError(400, `Invalid category: ${input.category}`);
    product.category = input.category;
  }
  if (input.sport !== undefined) {
    if (input.sport && !isValidSportSlug(input.sport)) throw new AppError(400, `Invalid sport slug: ${input.sport}`);
    product.sport = input.sport || null;
  }
  if (input.brand !== undefined) product.brand = optionalString(input.brand, "brand", 60);
  if (input.sku !== undefined) product.sku = optionalString(input.sku, "sku", 60) || undefined;
  if (creating || input.price !== undefined) {
    const price = Number(input.price);
    if (!Number.isFinite(price) || price <= 0) throw new AppError(400, "price must be a number greater than 0");
    product.price = price;
  }
  if (input.discountPrice !== undefined) {
    if (input.discountPrice === null || input.discountPrice === "") product.discountPrice = null;
    else {
      const d = Number(input.discountPrice);
      if (!Number.isFinite(d) || d <= 0) throw new AppError(400, "discountPrice must be a number greater than 0");
      product.discountPrice = d;
    }
  }
  if (product.discountPrice != null && product.discountPrice >= product.price) throw new AppError(400, "The discount price must be lower than the price");
  if (input.variants !== undefined) {
    product.variants = parseVariants(input.variants);
  }
  if (product.variants?.length) {
    // With variants, total stock is their sum.
    product.stock = product.variants.reduce((n: number, v: IVariant) => n + v.stock, 0);
  } else if (creating || input.stock !== undefined) {
    const stock = Number(input.stock);
    if (!Number.isInteger(stock) || stock < 0) throw new AppError(400, "stock must be a whole number >= 0");
    product.stock = stock;
  }
  if (input.images !== undefined) product.images = input.images;
}

export async function createProduct(user: IUser, input: Record<string, any>) {
  if (!input.name || !input.category) throw new AppError(400, "name and category are required");
  const store = await getCallerStoreOrThrow(user._id.toString());
  const limit = productLimit(store);
  const count = await Product.countDocuments({ store: store._id, status: { $ne: "archived" } });
  if (count >= limit) throw new AppError(403, `Your plan allows ${limit} products. Archive some, or upgrade to list more.`);

  const product: any = new Product({ store: store._id, images: [], variants: [] });
  applyInput(product, input, true);
  product.slug = await uniqueSlug(Product, product.name);
  // New products wait for staff review; a merchant may keep one as a draft.
  product.status = input.status === "draft" ? "draft" : "pending_review";
  try {
    await product.save();
  } catch (err: any) {
    if (err?.code === 11000 && err?.keyPattern?.sku) throw new AppError(409, "You already have a product with this SKU");
    throw err;
  }
  return Product.findById(product._id).populate(PRODUCT_STORE_POPULATE);
}

async function getOwnedProductOrThrow(productId: string, userId: string) {
  if (!isObjectIdString(productId)) throw new AppError(404, "Product not found");
  const product = await Product.findById(productId).populate({ path: "store" });
  if (!product) throw new AppError(404, "Product not found");
  const store: any = product.store;
  if (!store || store.owner.toString() !== userId.toString()) {
    throw new AppError(403, "Only the product's store owner can perform this action");
  }
  return product;
}

// What a merchant may set the status to. "active" is only set by staff approval.
const MERCHANT_STATUS: Record<string, string> = { draft: "draft", submit: "pending_review", archive: "archived", unarchive: "active" };

export async function updateProduct(productId: string, user: IUser, updates: Record<string, any>) {
  const product = await getOwnedProductOrThrow(productId, user._id.toString());
  const wasRejected = product.status === "rejected";
  applyInput(product, updates, false);
  if (updates.name !== undefined) product.slug = await uniqueSlug(Product, product.name, product._id);
  if (updates.status !== undefined) {
    const next = MERCHANT_STATUS[String(updates.status)];
    if (!next) throw new AppError(400, 'status must be "draft", "submit", "archive" or "unarchive"');
    // Unarchiving only brings back a product staff had already approved.
    if (updates.status === "unarchive" && product.status !== "archived") throw new AppError(400, "Only archived products can be unarchived");
    if (updates.status === "unarchive" && !product.review?.at) product.status = "pending_review";
    else product.status = next as IProduct["status"];
  } else if (wasRejected) {
    // Fixing a rejected product sends it back for review.
    product.status = "pending_review";
  }
  try {
    await product.save();
  } catch (err: any) {
    if (err?.code === 11000 && err?.keyPattern?.sku) throw new AppError(409, "You already have a product with this SKU");
    throw err;
  }
  return Product.findById(product._id).populate(PRODUCT_STORE_POPULATE);
}

export async function deleteProduct(productId: string, user: IUser) {
  const product = await getOwnedProductOrThrow(productId, user._id.toString());
  await product.deleteOne();
  return { message: "Product deleted successfully" };
}

// ---------------------------------------------------------------- staff

export async function adminListProducts(query: Record<string, unknown>, p: Page) {
  const status = queryString(query.status) ?? "pending_review";
  const filter: any = status === "all" ? {} : status === "active" ? PUBLIC_PRODUCT : { status };
  const search = queryString(query.search);
  if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };
  const [items, total] = await Promise.all([
    Product.find(filter).populate(PRODUCT_STORE_POPULATE).sort({ updatedAt: 1 }).skip(p.skip).limit(p.limit),
    Product.countDocuments(filter),
  ]);
  return { products: items, ...pageMeta(p, total) };
}

export async function adminReviewProduct(actor: IUser, id: string, input: { decision?: unknown; note?: unknown; featured?: unknown }) {
  if (!isObjectIdString(id)) throw new AppError(404, "Product not found");
  const product = await Product.findById(id).populate("store");
  if (!product) throw new AppError(404, "Product not found");
  const store: any = product.store;
  if (input.featured !== undefined) {
    product.featured = input.featured === true;
    await product.save();
    await audit({ actor: actor._id, actorRole: actor.role, action: product.featured ? "product.featured" : "product.unfeatured", target: { type: "product", id: product._id } });
    return Product.findById(product._id).populate(PRODUCT_STORE_POPULATE);
  }
  const decision = String(input.decision);
  if (!["approve", "reject"].includes(decision)) throw new AppError(400, 'decision must be "approve" or "reject"');
  const note = optionalString(input.note, "note", 1000) ?? null;
  if (decision === "reject" && !note) throw new AppError(400, "Tell the merchant why");
  const status = decision === "approve" ? "active" : "rejected";
  product.status = status;
  product.review = { by: actor._id, note, at: new Date() };
  await product.save();
  await audit({ actor: actor._id, actorRole: actor.role, action: `product.${status === "active" ? "approved" : "rejected"}`, target: { type: "product", id: product._id }, reason: note ?? undefined });
  await notify(store?.owner, {
    type: "product.review",
    title: decision === "approve" ? `${product.name} is on sale` : `${product.name} wasn't approved`,
    body: note ?? undefined,
    link: "/shop/my-store",
    entity: { type: "product", id: product._id },
    actor: actor._id,
  });
  return Product.findById(product._id).populate(PRODUCT_STORE_POPULATE);
}
