import { Router } from "express";
import * as groundsController from "../controllers/groundsController";
import * as teamsController from "../controllers/teamsController";
import * as ordersController from "../controllers/ordersController";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

router.get("/bookings", verifyToken, groundsController.listMyBookings);
router.get("/teams", verifyToken, teamsController.listMyTeams);
router.get("/orders", verifyToken, ordersController.listMyOrders);

export default router;
