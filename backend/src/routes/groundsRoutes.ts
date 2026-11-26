import { Router } from "express";
import * as groundsController from "../controllers/groundsController";
import * as challengesController from "../controllers/challengesController";
import { optionalAuth } from "../middleware/verifyToken";

const router = Router();

router.get("/", groundsController.listGrounds);
router.get("/:id/availability", challengesController.groundAvailability);
router.get("/:id/slots", optionalAuth, groundsController.slots);
router.get("/:id", optionalAuth, groundsController.getGround);

export default router;
