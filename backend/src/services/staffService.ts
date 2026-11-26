import { Types } from "mongoose";
import { User, IUser } from "../models/User";
import { StaffRole } from "../models/StaffRole";
import { DEFAULT_STAFF_ROLES } from "../config/permissions";
import { AppError } from "../utils/AppError";
import { withLock } from "../utils/lock";
import { isObjectIdString, optionalString, requireString } from "../utils/validation";
import { Page, pageMeta } from "../utils/pagination";
import { audit } from "./auditService";
import { STAFF_RESET, assertGrantable, assertStillSuperAdmin, countActiveSuperAdmins, getEffectivePermissions, isStaff } from "./permissionsService";
import { toAdminUser } from "./adminService";

// Every change that could remove a Super Admin runs under this lock, so two
// Super Admins demoting each other at the same moment can't leave none.
const SUPER_ADMIN_LOCK = "rbac:super-admins";

/** Create the default role templates that don't exist yet. Never edits existing roles. */
export async function ensureDefaultStaffRoles() {
  let created = 0;
  for (const r of DEFAULT_STAFF_ROLES) {
    const res = await StaffRole.updateOne(
      { key: r.key },
      { $setOnInsert: { ...r, isSystem: true, createdBy: null } },
      { upsert: true }
    );
    created += res.upsertedCount;
  }
  return created;
}

function toStaffRoleJSON(r: any, memberCount?: number) {
  return {
    id: r._id.toString(),
    key: r.key,
    name: r.name,
    description: r.description ?? null,
    permissions: r.permissions ?? [],
    isSystem: !!r.isSystem,
    ...(memberCount !== undefined ? { memberCount } : {}),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function toStaffJSON(u: any) {
  const role = u.staffRole && u.staffRole._id ? u.staffRole : null;
  return {
    ...toAdminUser(u),
    staffRole: role ? { id: role._id.toString(), key: role.key, name: role.name } : null,
    permissionOverrides: { grant: u.permissionOverrides?.grant ?? [], revoke: u.permissionOverrides?.revoke ?? [] },
    effectivePermissions: [...(await getEffectivePermissions(u))].sort(),
  };
}

// ---------------------------------------------------------------- roles

export async function listStaffRoles() {
  const [roles, counts] = await Promise.all([
    StaffRole.find().sort({ isSystem: -1, name: 1 }),
    User.aggregate([{ $match: { role: "admin", staffRole: { $ne: null } } }, { $group: { _id: "$staffRole", n: { $sum: 1 } } }]),
  ]);
  const byRole = new Map(counts.map((c: any) => [c._id.toString(), c.n as number]));
  return roles.map((r) => toStaffRoleJSON(r, byRole.get(r._id.toString()) ?? 0));
}

async function getRoleOrThrow(id: unknown) {
  if (!isObjectIdString(id)) throw new AppError(400, "Invalid staff role id");
  const role = await StaffRole.findById(id);
  if (!role) throw new AppError(404, "Staff role not found");
  return role;
}

export async function createStaffRole(actor: IUser, input: Record<string, unknown>) {
  const key = requireString(input.key, "key", { min: 2, max: 40 }).toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) {
    throw new AppError(400, "key must start with a letter and use only lowercase letters, digits and _");
  }
  const name = requireString(input.name, "name", { min: 2, max: 60 });
  const description = optionalString(input.description, "description", 300);
  const permissions = await assertGrantable(actor, input.permissions ?? [], "permissions");
  if (await StaffRole.exists({ key })) throw new AppError(409, "A staff role with this key already exists");

  const role = await StaffRole.create({ key, name, description, permissions, isSystem: false, createdBy: actor._id });
  await audit({
    actor: actor._id,
    actorRole: actor.role,
    action: "staff_role.created",
    target: { type: "staff_role", id: role._id },
    after: { key, name, permissions },
  });
  return toStaffRoleJSON(role, 0);
}

export async function updateStaffRole(actor: IUser, id: string, input: Record<string, unknown>) {
  const role = await getRoleOrThrow(id);
  const before = { name: role.name, description: role.description ?? null, permissions: [...role.permissions] };
  if (input.key !== undefined && input.key !== role.key) throw new AppError(400, "A role's key can't be changed");
  if (input.name !== undefined) role.name = requireString(input.name, "name", { min: 2, max: 60 });
  if (input.description !== undefined) role.description = optionalString(input.description, "description", 300);
  if (input.permissions !== undefined) role.permissions = await assertGrantable(actor, input.permissions, "permissions");
  await role.save();
  await audit({
    actor: actor._id,
    actorRole: actor.role,
    action: "staff_role.updated",
    target: { type: "staff_role", id: role._id },
    before,
    after: { name: role.name, description: role.description ?? null, permissions: [...role.permissions] },
  });
  return toStaffRoleJSON(role);
}

export async function deleteStaffRole(actor: IUser, id: string) {
  const role = await getRoleOrThrow(id);
  if (role.isSystem) throw new AppError(400, "Built-in roles can be edited but not deleted");
  const assigned = await User.countDocuments({ role: "admin", staffRole: role._id });
  if (assigned > 0) throw new AppError(409, `This role is assigned to ${assigned} staff member(s). Reassign them first.`);
  await role.deleteOne();
  await audit({
    actor: actor._id,
    actorRole: actor.role,
    action: "staff_role.deleted",
    target: { type: "staff_role", id: role._id },
    before: { key: role.key, name: role.name, permissions: [...role.permissions] },
  });
  return { message: "Staff role deleted" };
}

// ---------------------------------------------------------------- staff

export async function listStaff(p: Page) {
  const filter = { role: "admin" };
  const [items, total] = await Promise.all([
    User.find(filter).sort({ isSuperAdmin: -1, createdAt: 1 }).skip(p.skip).limit(p.limit).populate("staffRole", "key name"),
    User.countDocuments(filter),
  ]);
  return { staff: await Promise.all(items.map(toStaffJSON)), ...pageMeta(p, total) };
}

/** The target of a staff change: must exist and must not be the actor. */
async function getTargetOrThrow(actor: IUser, id: unknown) {
  if (!isObjectIdString(id)) throw new AppError(400, "Invalid user id");
  const user = await User.findById(id);
  if (!user) throw new AppError(404, "User not found");
  if (user._id.equals(actor._id)) throw new AppError(400, "You can't change your own staff access");
  return user;
}

async function resolveRoleId(input: unknown): Promise<Types.ObjectId | null> {
  if (input === null || input === "") return null;
  return (await getRoleOrThrow(input))._id;
}

function snapshot(u: IUser) {
  return {
    role: u.role,
    isSuperAdmin: !!u.isSuperAdmin,
    staffRole: u.staffRole ? u.staffRole.toString() : null,
    grant: [...(u.permissionOverrides?.grant ?? [])],
    revoke: [...(u.permissionOverrides?.revoke ?? [])],
  };
}

async function reloadStaff(id: Types.ObjectId) {
  const u = await User.findById(id).populate("staffRole", "key name");
  return toStaffJSON(u);
}

export async function addStaff(actor: IUser, input: Record<string, unknown>) {
  const target = await getTargetOrThrow(actor, input.userId);
  if (isStaff(target)) throw new AppError(409, "This user is already staff. Edit their access instead.");
  if (target.status !== "active") throw new AppError(400, "Only active accounts can be made staff");
  const staffRole = input.staffRoleId === undefined ? null : await resolveRoleId(input.staffRoleId);
  const grant = await assertGrantable(actor, input.grant, "grant");
  const revoke = await assertGrantable(actor, input.revoke, "revoke");
  const reason = optionalString(input.reason, "reason", 500);

  const before = snapshot(target);
  await User.updateOne(
    { _id: target._id, role: "player" },
    { $set: { role: "admin", isSuperAdmin: false, staffRole, permissionOverrides: { grant, revoke } } }
  );
  const after = await User.findById(target._id);
  await audit({
    actor: actor._id,
    actorRole: actor.role,
    action: "staff.added",
    target: { type: "user", id: target._id },
    before,
    after: snapshot(after!),
    reason,
  });
  return reloadStaff(target._id);
}

export async function updateStaff(actor: IUser, id: string, input: Record<string, unknown>) {
  const target = await getTargetOrThrow(actor, id);
  if (!isStaff(target)) throw new AppError(404, "This user is not staff");
  const $set: Record<string, unknown> = {};
  if (input.staffRoleId !== undefined) $set.staffRole = await resolveRoleId(input.staffRoleId);
  if (input.grant !== undefined) $set["permissionOverrides.grant"] = await assertGrantable(actor, input.grant, "grant");
  if (input.revoke !== undefined) $set["permissionOverrides.revoke"] = await assertGrantable(actor, input.revoke, "revoke");
  if (Object.keys($set).length === 0) throw new AppError(400, "Nothing to update: send staffRoleId, grant or revoke");
  const reason = optionalString(input.reason, "reason", 500);

  const before = snapshot(target);
  await User.updateOne({ _id: target._id, role: "admin" }, { $set });
  const after = await User.findById(target._id);
  await audit({
    actor: actor._id,
    actorRole: actor.role,
    action: "staff.updated",
    target: { type: "user", id: target._id },
    before,
    after: snapshot(after!),
    reason,
  });
  return reloadStaff(target._id);
}

export async function removeStaff(actor: IUser, id: string, input: Record<string, unknown> = {}) {
  const reason = optionalString(input.reason, "reason", 500);
  return withLock(SUPER_ADMIN_LOCK, async () => {
    await assertStillSuperAdmin(actor);
    const target = await getTargetOrThrow(actor, id);
    if (!isStaff(target)) throw new AppError(404, "This user is not staff");
    if (target.isSuperAdmin && (await countActiveSuperAdmins()) <= 1) {
      throw new AppError(400, "You can't remove the last Super Admin");
    }
    const before = snapshot(target);
    await User.updateOne({ _id: target._id }, { $set: STAFF_RESET });
    await audit({
      actor: actor._id,
      actorRole: actor.role,
      action: "staff.removed",
      target: { type: "user", id: target._id },
      before,
      after: { role: "player", isSuperAdmin: false, staffRole: null },
      reason,
    });
    return toAdminUser(await User.findById(target._id));
  });
}

export async function setSuperAdmin(actor: IUser, id: string, input: Record<string, unknown>) {
  if (typeof input.value !== "boolean") throw new AppError(400, "value must be true or false");
  const value = input.value;
  const reason = optionalString(input.reason, "reason", 500);
  return withLock(SUPER_ADMIN_LOCK, async () => {
    await assertStillSuperAdmin(actor);
    const target = await getTargetOrThrow(actor, id);
    if (!isStaff(target)) throw new AppError(400, "Make this user staff first");
    if (value && target.status !== "active") throw new AppError(400, "Only active accounts can be made Super Admin");
    if (!!target.isSuperAdmin === value) return reloadStaff(target._id);
    if (!value && (await countActiveSuperAdmins()) <= 1) {
      throw new AppError(400, "You can't remove the last Super Admin");
    }
    const before = snapshot(target);
    await User.updateOne({ _id: target._id, role: "admin" }, { $set: { isSuperAdmin: value } });
    await audit({
      actor: actor._id,
      actorRole: actor.role,
      action: value ? "staff.super_admin_granted" : "staff.super_admin_revoked",
      target: { type: "user", id: target._id },
      before,
      after: { ...before, isSuperAdmin: value },
      reason,
    });
    return reloadStaff(target._id);
  });
}
