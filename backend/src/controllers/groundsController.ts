import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { parsePage } from "../utils/pagination";
import { fileUrl } from "../utils/upload";
import { toGroundSummary, toGroundDetail, toBookingSummary } from "../utils/shapers";
import * as groundsService from "../services/groundsService";
import * as groundBookingsService from "../services/groundBookingsService";

const images = (req: Request) => (Array.isArray(req.files) ? req.files.map(fileUrl) : []);

export const listGrounds = asyncHandler(async (req: Request, res: Response) => {
  const { grounds, ...meta } = await groundsService.listGrounds(req.query, parsePage(req.query, { defaultLimit: 24 }));
  res.status(200).json({ grounds: grounds.map(toGroundSummary), ...meta });
});

export const getGround = asyncHandler(async (req: Request, res: Response) => {
  const ground = await groundsService.getGroundById(param(req, "id"), req.user);
  res.status(200).json({ ground: toGroundDetail(ground) });
});

export const slots = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await groundsService.slotsFor(param(req, "id"), req.query.date, req.user));
});

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { groundId, date, startTime, endTime, paymentMethod, note } = req.body;
  const booking = await groundBookingsService.createBooking(req.user, { groundId, date, startTime, endTime, paymentMethod, note });
  res.status(201).json({ booking: toBookingSummary(booking) });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const booking = await groundBookingsService.cancelMyBooking(req.user, param(req, "id"), req.body?.reason);
  res.status(200).json({ booking: toBookingSummary(booking) });
});

export const listMyBookings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const bookings = await groundBookingsService.listMyBookings(req.user);
  res.status(200).json({ bookings: bookings.map((b) => toBookingSummary(b)) });
});

// ---------------------------------------------------------------- owner

export const ownerListGrounds = asyncHandler(async (req: Request, res: Response) => {
  const grounds = await groundsService.listMyGrounds(req.user!);
  res.status(200).json({ grounds: grounds.map(toGroundDetail) });
});

export const ownerCreateGround = asyncHandler(async (req: Request, res: Response) => {
  const ground = await groundsService.createOwnedGround(req.user!, req.body ?? {}, images(req));
  res.status(201).json({ ground: toGroundDetail(ground) });
});

export const ownerUpdateGround = asyncHandler(async (req: Request, res: Response) => {
  const ground = await groundsService.updateOwnedGround(param(req, "id"), req.user!, req.body ?? {}, images(req));
  res.status(200).json({ ground: toGroundDetail(ground) });
});

export const ownerBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await groundBookingsService.listOwnerBookings(req.user!, req.query as Record<string, unknown>);
  res.status(200).json({ bookings: bookings.map((b) => toBookingSummary(b, true)) });
});

export const ownerBookingAction = asyncHandler(async (req: Request, res: Response) => {
  const b = await groundBookingsService.ownerBookingAction(req.user!, param(req, "id"), req.body?.action, req.body?.reason);
  res.status(200).json({ booking: toBookingSummary(b, true) });
});

export const ownerBlock = asyncHandler(async (req: Request, res: Response) => {
  const b = await groundBookingsService.blockSlot(req.user!, param(req, "id"), req.body ?? {});
  res.status(201).json({ booking: toBookingSummary(b, true) });
});
