// The 7 provinces of Nepal — used to tag a user's home province (set at
// registration) and a tournament's province (set by its organizer), so the
// "Near Me" filter on the Tournaments page can match one against the other.
export const PROVINCES = [
  "Koshi Province",
  "Madhesh Province",
  "Bagmati Province",
  "Gandaki Province",
  "Lumbini Province",
  "Karnali Province",
  "Sudurpashchim Province",
] as const;

export type Province = (typeof PROVINCES)[number];

export function isValidProvince(value: unknown): value is Province {
  return typeof value === "string" && (PROVINCES as readonly string[]).includes(value);
}
