import { Router } from "express";
import * as playersController from "../controllers/playersController";
import { optionalAuth } from "../middleware/verifyToken";

const router = Router();

router.get("/", playersController.listPlayers);
router.get("/:id", optionalAuth, playersController.getPlayer);

export default router;
