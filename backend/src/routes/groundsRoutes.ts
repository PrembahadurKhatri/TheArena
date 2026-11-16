import { Router } from "express";
import * as groundsController from "../controllers/groundsController";
import * as challengesController from "../controllers/challengesController";

const router = Router();

router.get("/", groundsController.listGrounds);
router.get("/:id/availability", challengesController.groundAvailability);
router.get("/:id", groundsController.getGround);

export default router;
