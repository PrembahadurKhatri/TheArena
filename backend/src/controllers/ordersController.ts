import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { toOrderSummary } from "../utils/shapers";
import * as ordersService from "../services/ordersService";

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { items, shippingAddress, shippingProvince } = req.body;
  const order = await ordersService.createOrder(req.user, { items, shippingAddress, shippingProvince });
  res.status(201).json({ order: toOrderSummary(order) });
});

export const listMyOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const orders = await ordersService.listMyOrders(req.user._id.toString());
  res.status(200).json({ orders: orders.map(toOrderSummary) });
});

export const listStoreOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const orders = await ordersService.listStoreOrders(param(req, "id"), req.user);
  res.status(200).json({ orders: orders.map(toOrderSummary) });
});
