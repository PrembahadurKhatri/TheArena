// Built-in categories, mirroring backend/src/utils/shopCategories.ts. Staff
// can add more; forms that need the live list fetch /api/shop/categories.
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

export const SHOP_CATEGORY_OPTIONS = SHOP_CATEGORIES.map((c) => ({ value: c, label: c }));
