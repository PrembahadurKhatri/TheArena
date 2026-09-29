import { Schema, model, Document, Types } from "mongoose";

export interface IStore extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  name: string;
  description?: string;
  logo?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<IStore>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    logo: { type: String, default: null },
  },
  { timestamps: true }
);

export const Store = model<IStore>("Store", storeSchema);
