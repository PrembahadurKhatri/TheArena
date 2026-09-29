// Mirrors backend/src/utils/provinces.ts exactly — keep both lists in sync.
export const PROVINCES = [
  "Koshi Province",
  "Madhesh Province",
  "Bagmati Province",
  "Gandaki Province",
  "Lumbini Province",
  "Karnali Province",
  "Sudurpashchim Province",
] as const;

export const PROVINCE_OPTIONS = PROVINCES.map((p) => ({ value: p, label: p }));
