import { Schema, model, Document, Types } from "mongoose";

// A product review. Only buyers with a delivered order containing the
// product can write one, once per product.
export interface IReview extends Document {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  store: Types.ObjectId;
  user: Types.ObjectId;
  sellerOrder: Types.ObjectId;
  rating: number;
  text?: string;
  status: "visible" | "hidden";
  merchantReply?: string | null;
  repliedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sellerOrder: { type: Schema.Types.ObjectId, ref: "SellerOrder", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: ["visible", "hidden"], default: "visible" },
    merchantReply: { type: String, trim: true, maxlength: 1000, default: null },
    repliedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ store: 1, createdAt: -1 });

export const Review = model<IReview>("Review", reviewSchema);

export interface IWishlistItem extends Document {
  user: Types.ObjectId;
  product: Types.ObjectId;
  createdAt: Date;
}

const wishlistSchema = new Schema<IWishlistItem>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
wishlistSchema.index({ user: 1, product: 1 }, { unique: true });

export const WishlistItem = model<IWishlistItem>("WishlistItem", wishlistSchema);
