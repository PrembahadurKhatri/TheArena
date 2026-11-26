import { Schema, model, Document, Types } from "mongoose";

// One shop's part of a customer's order. A checkout with products from three
// shops makes one Order (what the buyer sees and pays) and three
// SellerOrders, each fulfilled by its own merchant, who sees only theirs.
//
// Status:
//   pending_payment – online payment not made yet
//   placed          – ready for the merchant (cash on delivery, or paid online)
//   confirmed → processing → shipped → delivered
//   cancelled       – by the buyer (before shipping) or the merchant; stock goes back
//   returned        – sent back after delivery; stock goes back
export const SELLER_ORDER_STATUSES = ["pending_payment", "placed", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned"] as const;
export type SellerOrderStatus = (typeof SELLER_ORDER_STATUSES)[number];

export interface ISellerOrderItem {
  product: Types.ObjectId | null;
  variant: Types.ObjectId | null;
  name: string;
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  price: number; // unit price paid
  quantity: number;
  image: string | null;
}

export interface ISellerOrder extends Document {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  store: Types.ObjectId;
  buyer: Types.ObjectId;
  items: ISellerOrderItem[];
  subtotal: number;
  paymentMethod: "cod" | "online";
  status: SellerOrderStatus;
  statusHistory: { status: SellerOrderStatus; at: Date; by: Types.ObjectId | null; note?: string }[];
  tracking: { carrier?: string | null; code?: string | null };
  shipping: { address: string; province?: string; contactName?: string; contactPhone?: string };
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<ISellerOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    variant: { type: Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    size: { type: String, default: null },
    color: { type: String, default: null },
    sku: { type: String, default: null },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    image: { type: String, default: null },
  },
  { _id: false }
);

const sellerOrderSchema = new Schema<ISellerOrder>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [itemSchema],
    subtotal: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["cod", "online"], default: "cod" },
    status: { type: String, enum: SELLER_ORDER_STATUSES, default: "placed" },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: SELLER_ORDER_STATUSES, required: true },
        at: { type: Date, default: () => new Date() },
        by: { type: Schema.Types.ObjectId, ref: "User", default: null },
        note: { type: String, maxlength: 300 },
      },
    ],
    tracking: {
      carrier: { type: String, default: null, maxlength: 60 },
      code: { type: String, default: null, maxlength: 80 },
    },
    shipping: {
      address: { type: String, required: true },
      province: { type: String },
      contactName: { type: String },
      contactPhone: { type: String },
    },
  },
  { timestamps: true }
);

sellerOrderSchema.index({ store: 1, status: 1, createdAt: -1 });
sellerOrderSchema.index({ order: 1 });
sellerOrderSchema.index({ buyer: 1, createdAt: -1 });
sellerOrderSchema.index({ buyer: 1, status: 1, "items.product": 1 });

export const SellerOrder = model<ISellerOrder>("SellerOrder", sellerOrderSchema);
