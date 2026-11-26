import { Router } from "express";
import * as tournamentsController from "../controllers/tournamentsController";
import { verifyToken, optionalAuth } from "../middleware/verifyToken";
import { requirePremium } from "../middleware/requirePremium";
import { upload } from "../utils/upload";

const router = Router();

router.get("/", tournamentsController.listTournaments);
router.get("/:id", optionalAuth, tournamentsController.getTournament);
router.post("/", verifyToken, requirePremium, upload.single("poster"), tournamentsController.createTournament);
router.patch("/:id", verifyToken, upload.single("poster"), tournamentsController.updateTournament);

router.post("/:id/registrations", verifyToken, tournamentsController.requestRegistration);
router.patch("/:id/registrations/:rid", verifyToken, tournamentsController.respondToRegistration);
router.delete("/:id/registrations/:rid", verifyToken, tournamentsController.withdrawRegistration);
router.post("/:id/register-team", verifyToken, tournamentsController.registerTeam);

router.post("/:id/submit-review", verifyToken, tournamentsController.submitForReview);
router.post("/:id/start", verifyToken, tournamentsController.startTournament);
router.post("/:id/cancel", verifyToken, tournamentsController.cancelTournament);
router.patch("/:id/matches/:matchId", verifyToken, tournamentsController.completeMatch);
router.patch("/:id/matches/:matchId/schedule", verifyToken, tournamentsController.scheduleMatch);
router.get("/:id/standings", optionalAuth, tournamentsController.getStandings);

export default router;
