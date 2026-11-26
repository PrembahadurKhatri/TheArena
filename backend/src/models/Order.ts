import { Schema, model, Document, Types } from "mongoose";
import { PROVINCES } from "../utils/provinces";

// The buyer's order (one checkout). Fulfilment is per shop, in SellerOrder.
//   pending_payment – online payment not made yet
//   placed          – cash on delivery: the shops can start
//   paid            – paid online: the shops can start
//   cancelled       – nothing will be delivered
export type OrderStatus = "pending_payment" | "placed" | "paid" | "cancelled";

export interface IOrderItem {
  product: Types.ObjectId | null;
  store: Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  image: string | null;
  variant?: Types.ObjectId | null;
  size?: string | null;
  color?: string | null;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  buyer: Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: "cod" | "online";
  sellerOrders: Types.ObjectId[];
  shippingAddress: string;
  shippingProvince?: string;
  contactName?: string;
  contactPhone?: string;
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
    variant: { type: Schema.Types.ObjectId, default: null },
    size: { type: String, default: null },
    color: { type: String, default: null },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    buyer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ["pending_payment", "placed", "paid", "cancelled"], default: "pending_payment" },
    paymentMethod: { type: String, enum: ["cod", "online"], default: "online" },
    sellerOrders: [{ type: Schema.Types.ObjectId, ref: "SellerOrder" }],
    shippingAddress: { type: String, required: true },
    shippingProvince: { type: String, enum: PROVINCES },
    contactName: { type: String, trim: true, maxlength: 100 },
    contactPhone: { type: String, trim: true, maxlength: 30 },
    payment: { type: Schema.Types.ObjectId, ref: "Payment", default: null },
  },
  { timestamps: true }
);

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ "items.store": 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: 1 });

export const Order = model<IOrder>("Order", orderSchema);
