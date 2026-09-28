import { Schema, model, Document } from "mongoose";
import { SPORT_SLUG_ENUM } from "../utils/sports";

export interface ISport extends Document {
  slug: string;
  name: string;
  order: number;
}

const sportSchema = new Schema<ISport>({
  slug: { type: String, required: true, unique: true, enum: SPORT_SLUG_ENUM },
  name: { type: String, required: true },
  order: { type: Number, required: true, default: 0 },
});

export const Sport = model<ISport>("Sport", sportSchema);
