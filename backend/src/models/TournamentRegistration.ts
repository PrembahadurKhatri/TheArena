import { Schema, model, Document, Types } from "mongoose";

// A team's request to take part in a tournament. The organizer approves or
// rejects it; approved teams are mirrored into Tournament.teams.
export type RegistrationStatus = "requested" | "approved" | "rejected" | "withdrawn";

export interface ITournamentRegistration extends Document {
  _id: Types.ObjectId;
  tournament: Types.ObjectId;
  team: Types.ObjectId;
  requestedBy: Types.ObjectId;
  status: RegistrationStatus;
  // Checked when requested and again when approved.
  eligibility: { ok: boolean; reasons: string[] };
  rosterSize: number;
  note?: string;
  respondedBy: Types.ObjectId | null;
  responseReason?: string | null;
  respondedAt: Date | null;
  seed: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const registrationSchema = new Schema<ITournamentRegistration>(
  {
    tournament: { type: Schema.Types.ObjectId, ref: "Tournament", required: true },
    team: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["requested", "approved", "rejected", "withdrawn"], default: "requested" },
    eligibility: {
      ok: { type: Boolean, default: true },
      reasons: [{ type: String }],
    },
    rosterSize: { type: Number, default: 0 },
    note: { type: String, trim: true, maxlength: 500 },
    respondedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    responseReason: { type: String, default: null, maxlength: 500 },
    respondedAt: { type: Date, default: null },
    seed: { type: Number, default: null },
  },
  { timestamps: true }
);

registrationSchema.index({ tournament: 1, team: 1 }, { unique: true });
registrationSchema.index({ tournament: 1, status: 1 });
registrationSchema.index({ team: 1, status: 1 });

export const TournamentRegistration = model<ITournamentRegistration>("TournamentRegistration", registrationSchema);
