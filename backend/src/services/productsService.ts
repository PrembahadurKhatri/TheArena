import { Product } from "../models/Product";
import { Store } from "../models/Store";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isValidSportSlug } from "../utils/sports";
import { isValidShopCategory } from "../utils/shopCategories";
import { searchRegex, isObjectIdString, requireString, optionalString } from "../utils/validation";

const PRODUCT_STORE_POPULATE = { path: "store", select: "name" };

const PRODUCT_SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  price_asc: { price: 1, createdAt: -1 },
  price_desc: { price: -1, createdAt: -1 },
  name_asc: { name: 1 },
};

function priceBound(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new AppError(400, `${field} must be a non-negative number`);
  return n;
}

export async function listProducts(filters: {
  sport?: string;
  category?: string;
  search?: string;
  storeId?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  sort?: string;
}) {
  const query: any = {};
  if (filters.sport) query.sport = filters.sport;
  if (filters.category) query.category = filters.category;
  const nameRegex = searchRegex(filters.search);
  if (nameRegex) query.name = nameRegex;
  if (filters.storeId) {
    if (!isObjectIdString(filters.storeId)) return [];
    query.store = filters.storeId;
  }

  const min = priceBound(filters.minPrice, "minPrice");
  const max = priceBound(filters.maxPrice, "maxPrice");
  if (min !== undefined || max !== undefined) {
    query.price = {};
    if (min !== undefined) query.price.$gte = min;
    if (max !== undefined) query.price.$lte = max;
  }
  if (filters.inStock === "1" || filters.inStock === "true") query.stock = { $gt: 0 };

  const sort = PRODUCT_SORTS[filters.sort ?? ""] ?? PRODUCT_SORTS.newest;
  return Product.find(query).populate(PRODUCT_STORE_POPULATE).sort(sort);
}

export async function getProductById(id: string) {
  const product = await Product.findById(id).populate(PRODUCT_STORE_POPULATE);
  if (!product) throw new AppError(404, "Product not found");
  return product;
}

async function getCallerStoreOrThrow(userId: string) {
  const store = await Store.findOne({ owner: userId });
  if (!store) {
    throw new AppError(403, "You need a store before you can list products");
  }
  return store;
}

export async function createProduct(
  user: IUser,
  input: {
    name?: string;
    description?: string;
    category?: string;
    sport?: string;
    price?: number | string;
    stock?: number | string;
    images?: string[];
  }
) {
  const { category, sport, images } = input;
  if (!input.name || !category) throw new AppError(400, "name and category are required");
  const name = requireString(input.name, "name", { max: 120 });
  const description = optionalString(input.description, "description", 2000);
  if (!isValidShopCategory(category)) throw new AppError(400, `Invalid category: ${category}`);
  if (sport && !isValidSportSlug(sport)) throw new AppError(400, `Invalid sport slug: ${sport}`);

  const price = Number(input.price);
  const stock = Number(input.stock);
  if (!Number.isFinite(price) || price <= 0) throw new AppError(400, "price must be a number greater than 0");
  if (!Number.isInteger(stock) || stock < 0) throw new AppError(400, "stock must be a whole number >= 0");

  const store = await getCallerStoreOrThrow(user._id.toString());

  const product = await Product.create({
    store: store._id,
    name,
    description,
    category,
    sport: sport || null,
    price,
    stock,
    images: images ?? [],
  });

  return Product.findById(product._id).populate(PRODUCT_STORE_POPULATE);
}

async function getOwnedProductOrThrow(productId: string, userId: string) {
  const product = await Product.findById(productId).populate({ path: "store" });
  if (!product) throw new AppError(404, "Product not found");
  const store: any = product.store;
  if (!store || store.owner.toString() !== userId.toString()) {
    throw new AppError(403, "Only the product's store owner can perform this action");
  }
  return product;
}

export async function updateProduct(
  productId: string,
  user: IUser,
  updates: {
    name?: string;
    description?: string;
    category?: string;
    sport?: string;
    price?: number | string;
    stock?: number | string;
    images?: string[];
  }
) {
  const product = await getOwnedProductOrThrow(productId, user._id.toString());

  if (updates.name !== undefined) product.name = requireString(updates.name, "name", { max: 120 });
  if (updates.description !== undefined) product.description = optionalString(updates.description, "description", 2000);
  if (updates.category !== undefined) {
    if (!isValidShopCategory(updates.category)) throw new AppError(400, `Invalid category: ${updates.category}`);
    product.category = updates.category;
  }
  if (updates.sport !== undefined) {
    if (updates.sport && !isValidSportSlug(updates.sport)) throw new AppError(400, `Invalid sport slug: ${updates.sport}`);
    product.sport = updates.sport || null;
  }
  if (updates.price !== undefined) {
    const price = Number(updates.price);
    if (!Number.isFinite(price) || price <= 0) throw new AppError(400, "price must be a number greater than 0");
    product.price = price;
  }
  if (updates.stock !== undefined) {
    const stock = Number(updates.stock);
    if (!Number.isInteger(stock) || stock < 0) throw new AppError(400, "stock must be a whole number >= 0");
    product.stock = stock;
  }
  if (updates.images !== undefined) product.images = updates.images;

  await product.save();
  return Product.findById(product._id).populate(PRODUCT_STORE_POPULATE);
}

export async function deleteProduct(productId: string, user: IUser) {
  const product = await getOwnedProductOrThrow(productId, user._id.toString());
  await product.deleteOne();
  return { message: "Product deleted successfully" };
}
