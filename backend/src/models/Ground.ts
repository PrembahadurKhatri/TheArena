import { Schema, model, Document, Types } from "mongoose";
import { SPORT_SLUG_ENUM } from "../utils/sports";

export interface IGround extends Document {
  _id: Types.ObjectId;
  sport: string;
  name: string;
  location: string;
  pricePerHour: number;
  image?: string | null;
  amenities: string[];
  createdAt: Date;
  updatedAt: Date;
}

const groundSchema = new Schema<IGround>(
  {
    sport: { type: String, required: true, enum: SPORT_SLUG_ENUM },
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true },
    pricePerHour: { type: Number, required: true },
    image: { type: String, default: null },
    amenities: [{ type: String }],
  },
  { timestamps: true }
);

export const Ground = model<IGround>("Ground", groundSchema);
