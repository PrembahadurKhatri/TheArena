import { Schema, model, Document } from "mongoose";
import { SPORT_SLUG_RE } from "../utils/sports";

export interface ISport extends Document {
  slug: string;
  name: string;
  order: number;
  active: boolean; // inactive = hidden from pickers; existing data keeps working
  minPlayers: number; // per side, used for roster/eligibility checks
  maxPlayers: number;
  positions: string[];
  image?: string | null;
  // Player stat keys for match reports; empty = the built-in defaults (utils/sportStats.ts).
  statDefinitions: { key: string; label: string }[];
}

const sportSchema = new Schema<ISport>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: SPORT_SLUG_RE },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    order: { type: Number, required: true, default: 0 },
    active: { type: Boolean, default: true },
    minPlayers: { type: Number, default: 1, min: 1, max: 50 },
    maxPlayers: { type: Number, default: 30, min: 1, max: 100 },
    positions: [{ type: String, trim: true, maxlength: 40 }],
    image: { type: String, default: null },
    statDefinitions: [
      {
        _id: false,
        key: { type: String, required: true, match: /^[a-z][a-z0-9_]{0,29}$/ },
        label: { type: String, required: true, maxlength: 40 },
      },
    ],
  },
  { timestamps: true }
);

export const Sport = model<ISport>("Sport", sportSchema);
