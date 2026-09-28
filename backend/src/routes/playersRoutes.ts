import { Router } from "express";
import * as playersController from "../controllers/playersController";

const router = Router();

router.get("/", playersController.listPlayers);
router.get("/:id", playersController.getPlayer);

export default router;
