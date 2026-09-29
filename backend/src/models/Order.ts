import { Schema, model, Document, Types } from "mongoose";
import { PROVINCES } from "../utils/provinces";

export type OrderStatus = "pending_payment" | "paid" | "cancelled";

export interface IOrderItem {
  product: Types.ObjectId | null;
  store: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  buyer: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  status: OrderStatus;
  shippingAddress: string;
  shippingProvince?: string;
  payment: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    store: { type: Schema.Types.ObjectId, ref: "Store", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    image: { type: String, default: null },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ["pending_payment", "paid", "cancelled"], default: "pending_payment" },
    shippingAddress: { type: String, required: true },
    shippingProvince: { type: String, enum: PROVINCES },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
  },
  { timestamps: true }
);

export const Order = model<IOrder>("Order", orderSchema);
