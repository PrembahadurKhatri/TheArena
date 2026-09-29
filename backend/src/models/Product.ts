import { Schema, model, Document, Types } from "mongoose";
import { SPORT_SLUG_ENUM } from "../utils/sports";
import { SHOP_CATEGORIES } from "../utils/shopCategories";

export interface IProduct extends Document {
  _id: Types.ObjectId;
  store: Types.ObjectId;
  name: string;
  description?: string;
  category: string;
  sport?: string | null;
  price: number;
  stock: number;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, required: true, enum: SHOP_CATEGORIES },
    sport: { type: String, enum: SPORT_SLUG_ENUM, default: null },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    images: [{ type: String }],
  },
  { timestamps: true }
);

export const Product = model<IProduct>("Product", productSchema);
