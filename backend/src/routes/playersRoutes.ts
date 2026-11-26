import { Router } from "express";
import * as playersController from "../controllers/playersController";
import { optionalAuth } from "../middleware/verifyToken";
import { asyncHandler } from "../utils/asyncHandler";
import { param } from "../utils/params";
import { parsePage } from "../utils/pagination";
import { toMatchJSON } from "../utils/shapers";
import { playerStats } from "../services/statsService";
import { listPlayerMatches, resolvePlayerId } from "../services/matchesService";

const router = Router();

router.get("/", optionalAuth, playersController.listPlayers);
router.get("/:id", optionalAuth, playersController.getPlayer);
router.get(
  "/:id/stats",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const id = await resolvePlayerId(param(req, "id"));
    res.json(await playerStats(id, req.user?._id.toString()));
  })
);
router.get(
  "/:id/matches",
  asyncHandler(async (req, res) => {
    const id = await resolvePlayerId(param(req, "id"));
    const { matches, ...meta } = await listPlayerMatches(id, req.query, parsePage(req.query));
    res.json({ matches: matches.map(toMatchJSON), ...meta });
  })
);

export default router;
