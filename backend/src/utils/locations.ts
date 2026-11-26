import { Schema } from "mongoose";
import { PROVINCES, Province } from "./provinces";
import { AppError } from "./AppError";

// Nepal's 77 districts by province (2015 constitution). Municipality (one of
// 753 local levels) is free text for now; see docs/MASTER_PLAN.md (Q5).
export const DISTRICTS_BY_PROVINCE: Record<Province, string[]> = {
  "Koshi Province": [
    "Bhojpur", "Dhankuta", "Ilam", "Jhapa", "Khotang", "Morang", "Okhaldhunga",
    "Panchthar", "Sankhuwasabha", "Solukhumbu", "Sunsari", "Taplejung", "Terhathum", "Udayapur",
  ],
  "Madhesh Province": ["Bara", "Dhanusha", "Mahottari", "Parsa", "Rautahat", "Saptari", "Sarlahi", "Siraha"],
  "Bagmati Province": [
    "Bhaktapur", "Chitwan", "Dhading", "Dolakha", "Kathmandu", "Kavrepalanchok", "Lalitpur",
    "Makwanpur", "Nuwakot", "Ramechhap", "Rasuwa", "Sindhuli", "Sindhupalchok",
  ],
  "Gandaki Province": [
    "Baglung", "Gorkha", "Kaski", "Lamjung", "Manang", "Mustang", "Myagdi", "Nawalpur",
    "Parbat", "Syangja", "Tanahun",
  ],
  "Lumbini Province": [
    "Arghakhanchi", "Banke", "Bardiya", "Dang", "Eastern Rukum", "Gulmi", "Kapilvastu",
    "Palpa", "Parasi", "Pyuthan", "Rolpa", "Rupandehi",
  ],
  "Karnali Province": [
    "Dailekh", "Dolpa", "Humla", "Jajarkot", "Jumla", "Kalikot", "Mugu", "Salyan", "Surkhet", "Western Rukum",
  ],
  "Sudurpashchim Province": [
    "Achham", "Baitadi", "Bajhang", "Bajura", "Dadeldhura", "Darchula", "Doti", "Kailali", "Kanchanpur",
  ],
};

export const ALL_DISTRICTS: string[] = PROVINCES.flatMap((p) => DISTRICTS_BY_PROVINCE[p]);

export function provinceOfDistrict(district: string): Province | null {
  for (const p of PROVINCES) if (DISTRICTS_BY_PROVINCE[p].includes(district)) return p;
  return null;
}

export function isValidDistrict(value: unknown): value is string {
  return typeof value === "string" && ALL_DISTRICTS.includes(value);
}

/** A GeoJSON point from lat/lng input, or undefined when neither is given. */
export function parseGeo(lat: unknown, lng: unknown): { type: "Point"; coordinates: [number, number] } | null | undefined {
  if ((lat === undefined || lat === "") && (lng === undefined || lng === "")) return undefined;
  if (lat === null && lng === null) return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
    throw new AppError(400, "lat and lng must be valid coordinates");
  }
  return { type: "Point", coordinates: [ln, la] };
}

/**
 * Query fragment for "within radiusKm of lat/lng". Uses $geoWithin (not
 * $near) so it combines with other filters, sorting and counts.
 */
export function nearFilter(lat: unknown, lng: unknown, radiusKm: unknown, maxKm = 200) {
  const point = parseGeo(lat, lng);
  if (!point) return undefined;
  const r = Math.min(maxKm, Math.max(1, Number(radiusKm) || 10));
  return { $geoWithin: { $centerSphere: [point.coordinates, r / 6378.1] } };
}

// GeoJSON point sub-document. Optional on every model that uses it; give the
// parent path `default: undefined` so documents without one store nothing
// (a 2dsphere index rejects half-built points).
export const pointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);
