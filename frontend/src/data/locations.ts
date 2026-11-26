// Mirrors backend/src/utils/locations.ts. Keep both lists in sync.
import { PROVINCES } from "./provinces";

export const DISTRICTS_BY_PROVINCE: Record<string, string[]> = {
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

export function districtOptions(province?: string) {
  const list = province ? DISTRICTS_BY_PROVINCE[province] ?? [] : PROVINCES.flatMap((p) => DISTRICTS_BY_PROVINCE[p]);
  return [...list].sort().map((d) => ({ value: d, label: d }));
}

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced", "professional"] as const;
export const EXPERIENCE_OPTIONS = EXPERIENCE_LEVELS.map((e) => ({ value: e, label: e[0].toUpperCase() + e.slice(1) }));
