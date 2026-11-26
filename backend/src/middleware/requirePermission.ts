import { Request, Response, NextFunction } from "express";
import { Permission } from "../config/permissions";
import { getEffectivePermissions, isStaff, isSuperAdmin } from "../services/permissionsService";

/** Staff only (any permission). Must come after verifyToken. */
export function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  if (!isStaff(req.user)) {
    res.status(403).json({ message: "You don't have permission to do this" });
    return;
  }
  next();
}

/** Super Admin only. Must come after verifyToken. */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }
  if (!isSuperAdmin(req.user)) {
    res.status(403).json({ message: "Only a Super Admin can do this" });
    return;
  }
  next();
}

/**
 * Allow only users holding every listed permission. Permissions are computed
 * from the database on each request, so revoking one takes effect at once.
 */
export function requirePermission(...permissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    try {
      const held = await getEffectivePermissions(req.user);
      const missing = permissions.filter((p) => !held.has(p));
      if (missing.length > 0) {
        res.status(403).json({ message: "You don't have permission to do this", missing });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
