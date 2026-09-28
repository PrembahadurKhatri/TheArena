import { Router } from "express";
import * as groundsController from "../controllers/groundsController";
import * as teamsController from "../controllers/teamsController";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

router.get("/bookings", verifyToken, groundsController.listMyBookings);
router.get("/teams", verifyToken, teamsController.listMyTeams);

export default router;
