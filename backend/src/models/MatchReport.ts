import { Schema, model, Document, Types } from "mongoose";

// A result submitted for a match. Workflow:
//   submitted -> confirmed by the other side      -> verified
//             -> disputed by the other side       -> staff verify / amend (verified) or void (rejected)
//             -> no answer within the window      -> verified automatically
//             -> withdrawn by the submitter        -> withdrawn
// Only verified reports change official records (see statsService).
export type ReportStatus = "submitted" | "disputed" | "verified" | "rejected" | "withdrawn";

export interface IPlayerLine {
  user: Types.ObjectId;
  side: "A" | "B";
  stats: Map<string, number>;
}

export interface IMatchReport extends Document {
  _id: Types.ObjectId;
  match: Types.ObjectId;
  submittedBy: Types.ObjectId;
  submittedFor: "A" | "B" | "organizer";
  scoreA: number;
  scoreB: number;
  outcome: "A" | "B" | "draw";
  detail?: string; // e.g. "145/6 (20) vs 120/9 (20)"
  players: IPlayerLine[];
  evidence: string[];
  notes?: string;
  status: ReportStatus;
  response: { by: Types.ObjectId | null; action: "confirmed" | "disputed" | null; reason?: string | null; at: Date | null };
  review: { by: Types.ObjectId | null; decision: "verified" | "amended" | "voided" | null; note?: string | null; at: Date | null };
  verifiedHow: "confirmed" | "auto" | "staff" | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IMatchReport>(
  {
    match: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedFor: { type: String, enum: ["A", "B", "organizer"], required: true },
    scoreA: { type: Number, required: true, min: 0 },
    scoreB: { type: Number, required: true, min: 0 },
    outcome: { type: String, enum: ["A", "B", "draw"], required: true },
    detail: { type: String, trim: true, maxlength: 200 },
    players: [
      {
        _id: false,
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        side: { type: String, enum: ["A", "B"], required: true },
        stats: { type: Map, of: Number, default: {} },
      },
    ],
    evidence: [{ type: String }],
    notes: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ["submitted", "disputed", "verified", "rejected", "withdrawn"], default: "submitted" },
    response: {
      by: { type: Schema.Types.ObjectId, ref: "User", default: null },
      action: { type: String, enum: ["confirmed", "disputed", null], default: null },
      reason: { type: String, default: null, maxlength: 1000 },
      at: { type: Date, default: null },
    },
    review: {
      by: { type: Schema.Types.ObjectId, ref: "User", default: null },
      decision: { type: String, enum: ["verified", "amended", "voided", null], default: null },
      note: { type: String, default: null, maxlength: 1000 },
      at: { type: Date, default: null },
    },
    verifiedHow: { type: String, enum: ["confirmed", "auto", "staff", null], default: null },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// At most one live (submitted or disputed) report per match.
reportSchema.index({ match: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["submitted", "disputed"] } } });
reportSchema.index({ status: 1, createdAt: 1 });
reportSchema.index({ match: 1, createdAt: -1 });

export const MatchReport = model<IMatchReport>("MatchReport", reportSchema);
