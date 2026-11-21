import { Types } from "mongoose";
import { User, IUser, ACCOUNT_STATUSES, AccountStatus, USER_ROLES, UserRole } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { AppError } from "../utils/AppError";
import { isObjectIdString, optionalString, queryString, searchRegex } from "../utils/validation";
import { Page, pageMeta } from "../utils/pagination";
import { audit } from "./auditService";

/** What an admin sees about a user (never the password hash or tokens). */
export function toAdminUser(u: any) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    phone: u.phone ?? undefined,
    photo: u.photo ?? null,
    province: u.province ?? undefined,
    location: u.location ?? undefined,
    role: u.role,
    status: u.status ?? "active",
    statusReason: u.statusReason ?? null,
    statusChangedAt: u.statusChangedAt ?? null,
    isPremium: !!u.isPremium,
    membershipExpiresAt: u.membershipExpiresAt ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt,
  };
}

export async function listUsers(query: Record<string, unknown>, p: Page) {
  const filter: any = {};
  const search = queryString(query.search);
  if (search) {
    const rx = searchRegex(search);
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const status = queryString(query.status);
  if (status && (ACCOUNT_STATUSES as readonly string[]).includes(status)) filter.status = status;
  const role = queryString(query.role);
  if (role && (USER_ROLES as readonly string[]).includes(role)) filter.role = role;
  const premium = queryString(query.premium);
  if (premium === "true") filter.isPremium = true;
  if (premium === "false") filter.isPremium = false;

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
    User.countDocuments(filter),
  ]);
  return { users: items.map(toAdminUser), ...pageMeta(p, total) };
}

async function getTargetUser(id: string, admin: IUser) {
  if (!isObjectIdString(id)) throw new AppError(400, "Invalid id");
  const user = await User.findById(id);
  if (!user) throw new AppError(404, "User not found");
  // An admin can't lock themselves out or demote themselves; another admin
  // has to do it. This also stops the last admin removing the only access.
  if (user._id.equals(admin._id)) throw new AppError(400, "You can't change your own account here");
  return user;
}

export async function setUserStatus(id: string, admin: IUser, input: { status?: unknown; reason?: unknown }) {
  const status = input.status as AccountStatus;
  if (!(ACCOUNT_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(400, `status must be one of: ${ACCOUNT_STATUSES.join(", ")}`);
  }
  const reason = optionalString(input.reason, "reason", 500) ?? null;
  if (status !== "active" && !reason) throw new AppError(400, "A reason is required to suspend or ban an account");

  const user = await getTargetUser(id, admin);
  const before = { status: user.status, statusReason: user.statusReason ?? null };
  if (before.status === status && before.statusReason === reason) return toAdminUser(user);

  const update: any = { $set: { status, statusReason: reason, statusChangedAt: new Date() } };
  // Blocking an account ends all its sessions immediately.
  if (status !== "active") update.$inc = { tokenVersion: 1 };
  const updated = await User.findByIdAndUpdate(user._id, update, { new: true });

  await audit({
    actor: admin._id,
    actorRole: admin.role,
    action: status === "active" ? "user.reactivated" : status === "banned" ? "user.banned" : "user.suspended",
    target: { type: "user", id: user._id },
    before,
    after: { status, statusReason: reason },
    reason: reason ?? undefined,
  });
  return toAdminUser(updated);
}

export async function setUserRole(id: string, admin: IUser, input: { role?: unknown; reason?: unknown }) {
  const role = input.role as UserRole;
  if (!(USER_ROLES as readonly string[]).includes(role)) {
    throw new AppError(400, `role must be one of: ${USER_ROLES.join(", ")}`);
  }
  const reason = optionalString(input.reason, "reason", 500);
  const user = await getTargetUser(id, admin);
  if (user.role === role) return toAdminUser(user);

  const before = { role: user.role };
  const updated = await User.findByIdAndUpdate(user._id, { $set: { role } }, { new: true });
  await audit({
    actor: admin._id,
    actorRole: admin.role,
    action: "user.role_changed",
    target: { type: "user", id: user._id },
    before,
    after: { role },
    reason,
  });
  return toAdminUser(updated);
}

export async function listAuditLogs(query: Record<string, unknown>, p: Page) {
  const filter: any = {};
  const action = queryString(query.action, 64);
  if (action) filter.action = action;
  const actor = queryString(query.actor);
  if (actor) {
    if (!isObjectIdString(actor)) throw new AppError(400, "Invalid actor id");
    filter.actor = new Types.ObjectId(actor);
  }
  const targetId = queryString(query.targetId);
  if (targetId) filter["target.id"] = isObjectIdString(targetId) ? new Types.ObjectId(targetId) : targetId;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate("actor", "name email").lean(),
    AuditLog.countDocuments(filter),
  ]);
  return {
    logs: items.map((l: any) => ({
      id: l._id.toString(),
      actor: l.actor ? { id: l.actor._id.toString(), name: l.actor.name, email: l.actor.email } : null,
      actorRole: l.actorRole ?? null,
      action: l.action,
      target: l.target ?? null,
      before: l.before,
      after: l.after,
      reason: l.reason ?? null,
      requestId: l.requestId ?? null,
      createdAt: l.createdAt,
    })),
    ...pageMeta(p, total),
  };
}
