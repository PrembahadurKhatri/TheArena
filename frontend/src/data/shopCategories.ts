// Mirrors backend/src/utils/shopCategories.ts exactly — keep both in sync.
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

export const SHOP_CATEGORY_OPTIONS = SHOP_CATEGORIES.map((c) => ({ value: c, label: c }));
