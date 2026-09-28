import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { toPaymentSummary } from "../utils/shapers";
import * as paymentsService from "../services/paymentsService";

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { type, refId, plan } = req.body;
  const payment = await paymentsService.checkout(req.user, { type, refId, plan });
  res.status(201).json({ payment: toPaymentSummary(payment) });
});

export const confirm = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const payment = await paymentsService.confirm(param(req, "id"), req.user);
  res.status(200).json({ payment: toPaymentSummary(payment), redirect: "/dashboard" });
});

export const fail = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const payment = await paymentsService.fail(param(req, "id"), req.user);
  res.status(200).json({ payment: toPaymentSummary(payment) });
});
