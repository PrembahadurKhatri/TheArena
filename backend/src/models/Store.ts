import { Schema, model, Document, Types } from "mongoose";
import { PROVINCES } from "../utils/provinces";

// A merchant's shop. A user applies by creating one (status "pending");
// staff with merchants.review approve it before it and its products are
// public. Shops created before approval existed have no status and count as
// approved.
export const STORE_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

export interface IStore extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  slug?: string;
  description?: string;
  logo?: string | null;
  banner?: string | null;
  ownerName?: string;
  email?: string;
  phone?: string;
  address?: string;
  province?: string;
  district?: string;
  // Registration / PAN documents for verification. Only the owner and staff see them.
  documents: string[];
  status?: StoreStatus;
  review: { by: Types.ObjectId | null; note?: string | null; at: Date | null };
  rating: { avg: number; count: number };
  planCode?: string | null;
  planEntitlements?: Record<string, unknown> | null;
  premiumUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<IStore>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String },
    description: { type: String, trim: true },
    logo: { type: String, default: null },
    banner: { type: String, default: null },
    ownerName: { type: String, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 30 },
    address: { type: String, trim: true, maxlength: 300 },
    province: { type: String, enum: PROVINCES },
    district: { type: String, trim: true },
    documents: [{ type: String }],
    status: { type: String, enum: STORE_STATUSES },
    review: {
      by: { type: Schema.Types.ObjectId, ref: "User", default: null },
      note: { type: String, default: null, maxlength: 1000 },
      at: { type: Date, default: null },
    },
    rating: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    planCode: { type: String, default: null },
    planEntitlements: { type: Schema.Types.Mixed, default: null },
    premiumUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

storeSchema.index({ status: 1, createdAt: -1 });
storeSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } });

/** Shops visible to the public. */
export const PUBLIC_STORE = { status: { $in: ["approved", null] } };

export const Store = model<IStore>("Store", storeSchema);
