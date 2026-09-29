import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { toStoreSummary, toStoreDetail } from "../utils/shapers";
import { fileToUrlPath } from "../utils/upload";
import * as storesService from "../services/storesService";

export const listStores = asyncHandler(async (_req: Request, res: Response) => {
  const stores = await storesService.listStores();
  res.status(200).json({ stores: stores.map(toStoreSummary) });
});

export const getStore = asyncHandler(async (req: Request, res: Response) => {
  const store = await storesService.getStoreWithProducts(param(req, "id"));
  res.status(200).json({ store: toStoreDetail(store) });
});

export const getMyStore = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const store = await storesService.getMyStore(req.user._id.toString());
  res.status(200).json({ store: store ? toStoreDetail(store) : null });
});

export const createStore = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { name, description } = req.body;
  const logo = req.file ? fileToUrlPath(req.file.filename) : undefined;
  const store = await storesService.createStore(req.user, { name, description, logo });
  res.status(201).json({ store: toStoreDetail(store) });
});

export const updateStore = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { name, description } = req.body;
  const logo = req.file ? fileToUrlPath(req.file.filename) : undefined;
  const store = await storesService.updateStore(param(req, "id"), req.user, { name, description, logo });
  res.status(200).json({ store: toStoreDetail(store) });
});
