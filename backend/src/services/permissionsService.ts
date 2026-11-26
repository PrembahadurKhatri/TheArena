import { IUser, User } from "../models/User";
import { StaffRole } from "../models/StaffRole";
import { ALL_PERMISSIONS, Permission, RESERVED_PERMISSIONS, isPermission } from "../config/permissions";
import { AppError } from "../utils/AppError";

/** Staff = a user with role "admin". Players never hold permissions. */
export function isStaff(user: Pick<IUser, "role">): boolean {
  return user.role === "admin";
}

export function isSuperAdmin(user: Pick<IUser, "role" | "isSuperAdmin">): boolean {
  return isStaff(user) && user.isSuperAdmin === true;
}

/**
 * The permissions this user holds right now, read from the database (never
 * from the token), so a change takes effect on the user's next request.
 * Fails closed: a missing or deleted role means no role permissions.
 */
export async function getEffectivePermissions(user: IUser): Promise<Set<Permission>> {
  if (!isStaff(user)) return new Set();
  if (isSuperAdmin(user)) return new Set(ALL_PERMISSIONS);

  const perms = new Set<Permission>();
  if (user.staffRole) {
    const role = await StaffRole.findById(user.staffRole).select("permissions").lean();
    for (const p of role?.permissions ?? []) if (isPermission(p)) perms.add(p);
  }
  for (const p of user.permissionOverrides?.grant ?? []) if (isPermission(p)) perms.add(p);
  for (const p of user.permissionOverrides?.revoke ?? []) perms.delete(p);
  // Reserved permissions belong to Super Admins only, whatever the data says.
  for (const p of RESERVED_PERMISSIONS) perms.delete(p);
  return perms;
}

export async function hasPermission(user: IUser, permission: Permission): Promise<boolean> {
  return (await getEffectivePermissions(user)).has(permission);
}

/**
 * Validates a list of permissions someone wants to put in a role or grant to
 * a user. Rejects unknown and reserved permissions, and anything the actor
 * doesn't hold themselves, so nobody can hand out more than they have.
 */
export async function assertGrantable(actor: IUser, input: unknown, field: string): Promise<Permission[]> {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new AppError(400, `${field} must be an array of permissions`);
  const held = await getEffectivePermissions(actor);
  const out = new Set<Permission>();
  for (const p of input) {
    if (!isPermission(p)) throw new AppError(400, `Unknown permission: ${String(p)}`);
    if (RESERVED_PERMISSIONS.includes(p)) {
      throw new AppError(400, `${p} is reserved for Super Admins and can't be assigned`);
    }
    if (!held.has(p)) throw new AppError(403, `You can't grant ${p}, because you don't hold it`);
    out.add(p);
  }
  return [...out];
}

/** Fields that turn a staff account back into a plain player. */
export const STAFF_RESET = { role: "player", isSuperAdmin: false, staffRole: null, permissionOverrides: { grant: [], revoke: [] } };

/**
 * Re-reads the actor inside a lock: their Super Admin status may have been
 * removed by a concurrent request after the route check passed.
 */
export async function assertStillSuperAdmin(actor: IUser) {
  const fresh = await User.findById(actor._id).select("role isSuperAdmin status").lean();
  if (!fresh || fresh.status !== "active" || !isSuperAdmin(fresh as any)) {
    throw new AppError(403, "Only a Super Admin can do this");
  }
}

export async function countActiveSuperAdmins(): Promise<number> {
  return User.countDocuments({ role: "admin", isSuperAdmin: true, status: "active" });
}
