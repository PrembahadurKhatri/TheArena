import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { param } from "../utils/params";
import { toGroundSummary, toGroundDetail, toBookingSummary } from "../utils/shapers";
import * as groundsService from "../services/groundsService";
import * as groundBookingsService from "../services/groundBookingsService";

export const listGrounds = asyncHandler(async (req: Request, res: Response) => {
  const { sport, search } = req.query as { sport?: string; search?: string };
  const grounds = await groundsService.listGrounds({ sport, search });
  res.status(200).json({ grounds: grounds.map(toGroundSummary) });
});

export const getGround = asyncHandler(async (req: Request, res: Response) => {
  const ground = await groundsService.getGroundById(param(req, "id"));
  res.status(200).json({ ground: toGroundDetail(ground) });
});

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const { groundId, date, startTime, endTime } = req.body;
  const booking = await groundBookingsService.createBooking(req.user, { groundId, date, startTime, endTime });
  res.status(201).json({ booking: toBookingSummary(booking) });
});

export const listMyBookings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, "Authentication required");
  const bookings = await groundBookingsService.listMyBookings(req.user);
  res.status(200).json({ bookings: bookings.map(toBookingSummary) });
});
