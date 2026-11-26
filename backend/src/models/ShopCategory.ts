import { Schema, model, Document } from "mongoose";

// Staff-managed shop categories (in addition to the built-in list in
// utils/shopCategories.ts). The shop sells sports-related products only:
// staff decide which categories exist; product review enforces the rest.
export interface IShopCategory extends Document {
  name: string;
  description?: string;
  active: boolean;
  order: number;
}

const shopCategorySchema = new Schema<IShopCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 200 },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const ShopCategory = model<IShopCategory>("ShopCategory", shopCategorySchema);
