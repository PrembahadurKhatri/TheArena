// Sports are data: the Sport collection is the source of truth, so a new
// sport can be added through the admin API without a code change.
//
// The 10 launch sports are always valid (documents created before any sport
// was configured must keep validating). Sports added in the database join
// them when the registry is loaded at startup or changed through the admin API.
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

export type SportSlug = string;

/** @deprecated kept for older imports; use isValidSportSlug, which also knows sports added later. */
export const SPORT_SLUG_ENUM: string[] = [...SPORT_SLUGS];

const registry = new Set<string>(SPORT_SLUGS);
const inactive = new Set<string>();

export const SPORT_SLUG_RE = /^[a-z][a-z0-9-]{1,39}$/;

/** Any known sport (active or not): what stored documents may reference. */
export function isValidSportSlug(value: unknown): value is string {
  return typeof value === "string" && registry.has(value);
}

/** A sport new teams, tournaments, challenges and grounds may be created for. */
export function isActiveSportSlug(value: unknown): value is string {
  return isValidSportSlug(value) && !inactive.has(value);
}

export function registerSport(slug: string, active = true) {
  registry.add(slug);
  if (active) inactive.delete(slug);
  else inactive.add(slug);
}

/** Mongoose validator for `sport` fields. Accepts null/undefined (use `required` for those). */
export const sportValidator = {
  validator: (v: unknown) => v === null || v === undefined || isValidSportSlug(v),
  message: (props: { value: unknown }) => `\`${String(props.value)}\` is not a known sport`,
};

/** Load sports added in the database. Called at startup. */
export async function loadSportRegistry() {
  // Imported lazily: the Sport model imports this file.
  const { Sport } = await import("../models/Sport");
  const sports = await Sport.find().select("slug active").lean();
  for (const s of sports) registerSport(s.slug, s.active !== false);
  return sports.length;
}
