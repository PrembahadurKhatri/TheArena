import { Product } from "../models/Product";
import { Store } from "../models/Store";
import { IUser } from "../models/User";
import { AppError } from "../utils/AppError";
import { isValidSportSlug } from "../utils/sports";
import { isValidShopCategory } from "../utils/shopCategories";

const PRODUCT_STORE_POPULATE = { path: "store", select: "name" };

export async function listProducts(filters: { sport?: string; category?: string; search?: string; storeId?: string }) {
  const query: any = {};
  if (filters.sport) query.sport = filters.sport;
  if (filters.category) query.category = filters.category;
  if (filters.search) query.name = { $regex: filters.search, $options: "i" };
  if (filters.storeId) query.store = filters.storeId;

  return Product.find(query).populate(PRODUCT_STORE_POPULATE).sort({ createdAt: -1 });
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
  const { name, description, category, sport, images } = input;
  if (!name || !category) throw new AppError(400, "name and category are required");
  if (!isValidShopCategory(category)) throw new AppError(400, `Invalid category: ${category}`);
  if (sport && !isValidSportSlug(sport)) throw new AppError(400, `Invalid sport slug: ${sport}`);

  const price = Number(input.price);
  const stock = Number(input.stock);
  if (!Number.isFinite(price) || price <= 0) throw new AppError(400, "price must be a number greater than 0");
  if (!Number.isFinite(stock) || stock < 0) throw new AppError(400, "stock must be a number >= 0");

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

  if (updates.name !== undefined) product.name = updates.name;
  if (updates.description !== undefined) product.description = updates.description;
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
    if (!Number.isFinite(stock) || stock < 0) throw new AppError(400, "stock must be a number >= 0");
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
