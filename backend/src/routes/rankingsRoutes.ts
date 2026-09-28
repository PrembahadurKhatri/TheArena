import { Router } from "express";
import * as rankingsController from "../controllers/rankingsController";

const router = Router();

router.get("/players", rankingsController.getPlayerRankings);
router.get("/teams", rankingsController.getTeamRankings);

export default router;
