import { Router } from "express";
import * as groundsController from "../controllers/groundsController";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

router.post("/", verifyToken, groundsController.createBooking);
router.post("/:id/cancel", verifyToken, groundsController.cancelBooking);

export default router;
