import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { toUserJSON } from "../utils/shapers";
import { fileUrl } from "../utils/upload";
import * as authService from "../services/authService";
import { getEffectivePermissions, isStaff } from "../services/permissionsService";
import { entitlementsJSON, getEntitlements } from "../services/entitlementsService";

// The signed-in user, plus their staff access when they are staff. Permissions
// are for the UI only; every admin route re-checks them on the server.
async function toMeJSON(user: any) {
  const base = { ...toUserJSON(user), entitlements: entitlementsJSON(getEntitlements(user)) };
  if (!isStaff(user)) return base;
  const permissions = [...(await getEffectivePermissions(user))].sort();
  return { ...base, isSuperAdmin: !!user.isSuperAdmin, permissions };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, phone, location, province, district, username } = req.body;
  const { token, user } = await authService.registerUser({ name, email, password, phone, location, province, district, username });
  res.status(201).json({ token, user: await toMeJSON(user) });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { token, user } = await authService.loginUser({ email, password });
  res.status(200).json({ token, user: await toMeJSON(user) });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  res.status(200).json({ user: await toMeJSON(req.user) });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");

  const updates: any = { ...req.body };
  // The photo can only come from an uploaded (validated) file, never from a
  // URL in the body.
  delete updates.photo;
  if (req.file) {
    updates.photo = fileUrl(req.file);
  }
  if (typeof updates.sportPreferences === "string") {
    // multipart form fields arrive as strings; support both a single value
    // and a JSON-encoded array string.
    try {
      const parsed = JSON.parse(updates.sportPreferences);
      updates.sportPreferences = Array.isArray(parsed) ? parsed : [updates.sportPreferences];
    } catch {
      updates.sportPreferences = [updates.sportPreferences];
    }
  }

  const user = await authService.updateMe(req.user, updates);
  res.status(200).json({ user: await toMeJSON(user) });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  res.status(200).json(await authService.changePassword(req.user, req.body ?? {}));
});

export const changeUsername = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const user = await authService.changeUsername(req.user, req.body?.username);
  res.status(200).json({ user: await toMeJSON(user) });
});

export const usernameAvailable = asyncHandler(async (req: Request, res: Response) => {
  const u = Array.isArray(req.query.u) ? req.query.u[0] : req.query.u;
  res.status(200).json(await authService.usernameAvailable(u, req.user?._id));
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  res.status(200).json(await authService.logoutAllDevices(req.user));
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await authService.forgotPassword(email);
  res.status(200).json(result);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const token = param(req, "token");
  const { password } = req.body;
  const result = await authService.resetPassword(token, password);
  res.status(200).json(result);
});
