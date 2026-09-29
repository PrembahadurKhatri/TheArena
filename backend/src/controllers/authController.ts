import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { toUserJSON } from "../utils/shapers";
import { fileToUrlPath } from "../utils/upload";
import * as authService from "../services/authService";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, phone, location, province } = req.body;
  const { token, user } = await authService.registerUser({ name, email, password, phone, location, province });
  res.status(201).json({ token, user: toUserJSON(user) });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { token, user } = await authService.loginUser({ email, password });
  res.status(200).json({ token, user: toUserJSON(user) });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  res.status(200).json({ user: toUserJSON(req.user) });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");

  const updates: any = { ...req.body };
  if (req.file) {
    updates.photo = fileToUrlPath(req.file.filename);
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
  res.status(200).json({ user: toUserJSON(user) });
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
