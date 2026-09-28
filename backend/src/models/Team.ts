import { Schema, model, Document, Types } from "mongoose";
import { SPORT_SLUG_ENUM } from "../utils/sports";

export interface ITeam extends Document {
  _id: Types.ObjectId;
  name: string;
  sport: string;
  logo?: string | null;
  owner: Types.ObjectId;
  members: Types.ObjectId[];
  pendingRequests: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    sport: { type: String, required: true, enum: SPORT_SLUG_ENUM },
    logo: { type: String, default: null },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    pendingRequests: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export const Team = model<ITeam>("Team", teamSchema);
