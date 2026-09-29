// Fixed product-category list for the Shop marketplace. Mirrored exactly in
// frontend/src/data/shopCategories.ts — keep both in sync.
export const SHOP_CATEGORIES = [
  "Bats",
  "Balls",
  "Jerseys",
  "Footwear",
  "Protective Gear",
  "Rackets",
  "Accessories",
  "Other",
] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export function isValidShopCategory(value: unknown): value is ShopCategory {
  return typeof value === "string" && (SHOP_CATEGORIES as readonly string[]).includes(value);
}
