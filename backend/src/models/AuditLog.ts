import { Schema, model, Document, Types } from "mongoose";

// Append-only record of privileged and security-relevant actions. Written
// only through services/auditService.ts; no route updates or deletes it.
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor: Types.ObjectId | null; // null = system (sweeper, script)
  actorRole?: string;
  action: string; // e.g. "user.suspended", "payment.confirmed"
  target?: { type: string; id?: Types.ObjectId | string | null };
  before?: unknown;
  after?: unknown;
  reason?: string;
  requestId?: string;
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String },
    action: { type: String, required: true },
    target: {
      type: { type: String },
      id: { type: Schema.Types.Mixed, default: null },
    },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    reason: { type: String, maxlength: 500 },
    requestId: { type: String },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ "target.type": 1, "target.id": 1, createdAt: -1 });

// Block accidental edits through Mongoose: the log is append-only.
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  auditLogSchema.pre(op, function () {
    throw new Error("Audit log entries are immutable");
  });
}

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
