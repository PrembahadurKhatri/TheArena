import { Schema, model, Document, Types } from "mongoose";

// A user's report of an account or content (abuse, fake team, counterfeit
// product...). Staff with moderation.reports handle them.
export const REPORT_TARGETS = ["user", "team", "store", "product", "review", "match", "tournament", "ground"] as const;
export const REPORT_REASONS = ["spam", "abuse", "fake", "inappropriate", "fraud", "cheating", "other"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export interface IReport extends Document {
  _id: Types.ObjectId;
  reporter: Types.ObjectId;
  targetType: ReportTarget;
  targetId: Types.ObjectId;
  reason: (typeof REPORT_REASONS)[number];
  details?: string;
  status: "open" | "in_review" | "actioned" | "dismissed";
  handledBy: Types.ObjectId | null;
  resolution?: string | null;
  handledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: REPORT_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ["open", "in_review", "actioned", "dismissed"], default: "open" },
    handledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolution: { type: String, default: null, maxlength: 1000 },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: 1 });
reportSchema.index({ targetType: 1, targetId: 1 });
// One open report per person per target (no spamming the queue).
reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["open", "in_review"] } } });

export const Report = model<IReport>("Report", reportSchema);
