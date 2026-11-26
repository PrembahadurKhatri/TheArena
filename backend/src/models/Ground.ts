import { Schema, model, Document, Types } from "mongoose";
import { sportValidator } from "../utils/sports";
import { PROVINCES } from "../utils/provinces";
import { pointSchema } from "../utils/locations";

// A bookable ground. Listed by its owner (any player can list one) and
// visible to the public only once staff approve it. Grounds without an owner
// are managed by The Arena (seeded or created by staff).
export const GROUND_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type GroundStatus = (typeof GROUND_STATUSES)[number];

export interface IOpeningDay {
  closed: boolean;
  open: string; // HH:MM
  close: string; // HH:MM
}

export interface IGround extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId | null;
  name: string;
  slug?: string;
  sport: string; // primary sport (kept for older clients)
  sports: string[];
  description?: string;
  location: string; // short area label, e.g. "Lakeside, Pokhara"
  address?: string;
  province?: string;
  district?: string;
  municipality?: string;
  geo?: { type: "Point"; coordinates: [number, number] } | null;
  pricePerHour: number;
  image?: string | null; // cover
  images: string[];
  amenities: string[]; // facilities
  openingHours: IOpeningDay[]; // index 0 = Sunday … 6 = Saturday (Nepal time)
  slotMinutes: number;
  contactPhone?: string;
  status: GroundStatus;
  review: { by: Types.ObjectId | null; note?: string | null; at: Date | null };
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_OPENING_HOURS: IOpeningDay[] = Array.from({ length: 7 }, () => ({ closed: false, open: "06:00", close: "21:00" }));

const groundSchema = new Schema<IGround>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    slug: { type: String },
    sport: { type: String, required: true, validate: sportValidator },
    sports: [{ type: String, validate: sportValidator }],
    description: { type: String, trim: true, maxlength: 2000 },
    location: { type: String, required: true },
    address: { type: String, trim: true, maxlength: 200 },
    province: { type: String, enum: PROVINCES },
    district: { type: String, trim: true },
    municipality: { type: String, trim: true, maxlength: 80 },
    geo: { type: pointSchema, default: undefined },
    pricePerHour: { type: Number, required: true, min: 0 },
    image: { type: String, default: null },
    images: [{ type: String }],
    amenities: [{ type: String }],
    openingHours: {
      type: [
        {
          _id: false,
          closed: { type: Boolean, default: false },
          open: { type: String, default: "06:00" },
          close: { type: String, default: "21:00" },
        },
      ],
      default: () => DEFAULT_OPENING_HOURS.map((d) => ({ ...d })),
    },
    slotMinutes: { type: Number, default: 60, enum: [30, 60, 90, 120] },
    contactPhone: { type: String, trim: true, maxlength: 30 },
    // Existing grounds (seeded) default to approved; new listings start pending.
    status: { type: String, enum: GROUND_STATUSES, default: "approved" },
    review: {
      by: { type: Schema.Types.ObjectId, ref: "User", default: null },
      note: { type: String, default: null, maxlength: 1000 },
      at: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

groundSchema.index({ status: 1, sport: 1 });
groundSchema.index({ status: 1, sports: 1, province: 1, district: 1 });
groundSchema.index({ owner: 1 });
groundSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } });
groundSchema.index({ geo: "2dsphere" }, { sparse: true });

export const Ground = model<IGround>("Ground", groundSchema);
