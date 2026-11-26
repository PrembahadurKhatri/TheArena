import { Schema, model, Document, Types } from "mongoose";
import { sportValidator } from "../utils/sports";
import { shopCategoryValidator } from "../utils/shopCategories";

// Product statuses:
//   draft           – the merchant is still working on it (never public)
//   pending_review  – waiting for staff (products.review)
//   active          – on sale (public when the shop is approved)
//   rejected        – staff rejected it (reason in review.note)
//   archived        – taken off sale by the merchant
// Products created before moderation existed have no status: they count as active.
export const PRODUCT_STATUSES = ["draft", "pending_review", "active", "rejected", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface IVariant {
  _id: Types.ObjectId;
  sku?: string;
  size?: string;
  color?: string;
  stock: number;
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  store: Types.ObjectId;
  name: string;
  slug?: string;
  description?: string;
  category: string;
  sport?: string | null;
  brand?: string;
  sku?: string;
  price: number; // regular price
  discountPrice?: number | null; // sale price, when lower than price
  // Total stock. With variants it is the sum of the variants' stock and is
  // kept in step on every write.
  stock: number;
  variants: IVariant[];
  images: string[];
  status?: ProductStatus;
  featured: boolean;
  review: { by: Types.ObjectId | null; note?: string | null; at: Date | null };
  rating: { avg: number; count: number };
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String },
    description: { type: String, trim: true },
    category: { type: String, required: true, validate: shopCategoryValidator },
    sport: { type: String, validate: sportValidator, default: null },
    brand: { type: String, trim: true, maxlength: 60 },
    sku: { type: String, trim: true, maxlength: 60 },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, min: 0, default: null },
    stock: { type: Number, required: true, min: 0 },
    variants: [
      {
        sku: { type: String, trim: true, maxlength: 60 },
        size: { type: String, trim: true, maxlength: 30 },
        color: { type: String, trim: true, maxlength: 30 },
        stock: { type: Number, required: true, min: 0 },
      },
    ],
    images: [{ type: String }],
    status: { type: String, enum: PRODUCT_STATUSES },
    featured: { type: Boolean, default: false },
    review: {
      by: { type: Schema.Types.ObjectId, ref: "User", default: null },
      note: { type: String, default: null, maxlength: 1000 },
      at: { type: Date, default: null },
    },
    rating: {
      avg: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

productSchema.index({ store: 1, createdAt: -1 });
productSchema.index({ sport: 1, category: 1 });
productSchema.index({ status: 1, featured: -1, createdAt: -1 });
productSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } });
productSchema.index({ store: 1, sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: "string" } } });
productSchema.index({ name: "text", brand: "text", description: "text" });

/** Products visible to the public (the shop must also be approved). */
export const PUBLIC_PRODUCT = { status: { $in: ["active", null] } };

/** The price a buyer pays. */
export function unitPrice(p: { price: number; discountPrice?: number | null }) {
  return p.discountPrice != null && p.discountPrice < p.price ? p.discountPrice : p.price;
}

export const Product = model<IProduct>("Product", productSchema);
