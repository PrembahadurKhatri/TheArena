import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { toOrderSummary } from "../utils/shapers";
import * as ordersService from "../services/ordersService";

// Order creation and fulfilment live in routes/shopRoutes.ts.
export const listMyOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const orders = await ordersService.listMyOrders(req.user._id.toString());
  res.status(200).json({ orders: orders.map(toOrderSummary) });
});
