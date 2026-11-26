// Product categories for the Shop. Categories are data (the ShopCategory
// collection, managed by staff with categories.manage); these built-in ones
// are always valid so existing products keep validating. The sport a product
// is for is a separate field, so "cricket equipment" = category + sport.
// Mirrored in frontend/src/data/shopCategories.ts.
export const SHOP_CATEGORIES = [
  "Bats",
  "Balls",
  "Rackets",
  "Equipment",
  "Protective Gear",
  "Jerseys",
  "Sports Clothing",
  "Footwear",
  "Accessories",
  "Fitness Equipment",
  "Other",
] as const;

export type ShopCategory = string;

const registry = new Set<string>(SHOP_CATEGORIES);
const inactive = new Set<string>();

/** Any known category (what stored products may reference). */
export function isValidShopCategory(value: unknown): value is string {
  return typeof value === "string" && registry.has(value);
}

/** A category new products may use. */
export function isActiveShopCategory(value: unknown): value is string {
  return isValidShopCategory(value) && !inactive.has(value);
}

export function registerShopCategory(name: string, active = true) {
  registry.add(name);
  if (active) inactive.delete(name);
  else inactive.add(name);
}

export const shopCategoryValidator = {
  validator: (v: unknown) => isValidShopCategory(v),
  message: (props: { value: unknown }) => `\`${String(props.value)}\` is not a shop category`,
};

export async function loadShopCategories() {
  const { ShopCategory } = await import("../models/ShopCategory");
  const rows = await ShopCategory.find().select("name active").lean();
  for (const r of rows) registerShopCategory(r.name, r.active !== false);
  return rows.length;
}
