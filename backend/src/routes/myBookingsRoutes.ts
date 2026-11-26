import { Router } from "express";
import * as groundsController from "../controllers/groundsController";
import * as teamsController from "../controllers/teamsController";
import * as ordersController from "../controllers/ordersController";
import { verifyToken } from "../middleware/verifyToken";
import { asyncHandler } from "../utils/asyncHandler";
import { parsePage } from "../utils/pagination";
import { toMatchJSON } from "../utils/shapers";
import * as matchesService from "../services/matchesService";
import * as tournamentsController from "../controllers/tournamentsController";

const router = Router();

router.get("/bookings", verifyToken, groundsController.listMyBookings);
router.get("/teams", verifyToken, teamsController.listMyTeams);
router.get("/invitations", verifyToken, teamsController.listMyInvitations);
router.get("/orders", verifyToken, ordersController.listMyOrders);

router.get("/tournaments", verifyToken, tournamentsController.listMine);
router.get(
  "/matches",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { matches, ...meta } = await matchesService.listMyMatches(req.user!, req.query, parsePage(req.query));
    res.json({ matches: matches.map(toMatchJSON), ...meta });
  })
);

export default router;
