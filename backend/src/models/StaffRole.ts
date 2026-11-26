import { Schema, model, Document, Types } from "mongoose";
import { ALL_PERMISSIONS, Permission } from "../config/permissions";

// A named bundle of permissions assigned to staff accounts. Reserved
// permissions (staff.manage, settings.manage) are rejected by the service.
export interface IStaffRole extends Document {
  _id: Types.ObjectId;
  key: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean; // created from DEFAULT_STAFF_ROLES; editable, not deletable
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const staffRoleSchema = new Schema<IStaffRole>(
  {
    key: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9_]{1,39}$/ },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 300 },
    permissions: [{ type: String, enum: ALL_PERMISSIONS }],
    isSystem: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const StaffRole = model<IStaffRole>("StaffRole", staffRoleSchema);
