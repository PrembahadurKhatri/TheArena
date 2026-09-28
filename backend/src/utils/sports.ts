// The fixed list of 10 sport slugs used across the whole API.
// Must exactly match `frontend/src/data/sports.ts` — do not change.
export const SPORT_SLUGS = [
  "cricket",
  "football",
  "tennis",
  "table-tennis",
  "volleyball",
  "hockey",
  "badminton",
  "basketball",
  "kabaddi",
  "futsal",
] as const;

export type SportSlug = (typeof SPORT_SLUGS)[number];

// Mongoose-friendly enum array for schema `enum:` options.
export const SPORT_SLUG_ENUM: string[] = [...SPORT_SLUGS];

export function isValidSportSlug(value: unknown): value is SportSlug {
  return typeof value === "string" && (SPORT_SLUGS as readonly string[]).includes(value);
}
