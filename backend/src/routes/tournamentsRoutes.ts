import { Router } from "express";
import * as tournamentsController from "../controllers/tournamentsController";
import { verifyToken } from "../middleware/verifyToken";
import { requirePremium } from "../middleware/requirePremium";

const router = Router();

router.get("/", tournamentsController.listTournaments);
router.get("/:id", tournamentsController.getTournament);
router.post("/", verifyToken, requirePremium, tournamentsController.createTournament);
router.post("/:id/register-team", verifyToken, tournamentsController.registerTeam);
router.post("/:id/start", verifyToken, tournamentsController.startTournament);
router.patch("/:id/matches/:matchId", verifyToken, tournamentsController.completeMatch);
router.get("/:id/standings", tournamentsController.getStandings);

export default router;
