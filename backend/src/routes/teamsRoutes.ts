import { Router } from "express";
import { actionLimiter } from "../middleware/security";
import * as teamsController from "../controllers/teamsController";
import { verifyToken, optionalAuth } from "../middleware/verifyToken";
import { upload } from "../utils/upload";
import { asyncHandler } from "../utils/asyncHandler";
import { param } from "../utils/params";
import { parsePage } from "../utils/pagination";
import { toMatchJSON } from "../utils/shapers";
import { teamStats } from "../services/statsService";
import { listTeamMatches } from "../services/matchesService";
import { getTeamById } from "../services/teamsService";

const router = Router();
const teamImages = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "cover", maxCount: 1 },
]);

router.get("/", teamsController.listTeams);
router.get("/name-available", teamsController.nameAvailable);
router.get("/:id", optionalAuth, teamsController.getTeam);
router.get(
  "/:id/stats",
  asyncHandler(async (req, res) => {
    const team = await getTeamById(param(req, "id"));
    res.json(await teamStats(team._id.toString()));
  })
);
router.get(
  "/:id/matches",
  asyncHandler(async (req, res) => {
    const team = await getTeamById(param(req, "id"));
    const { matches, ...meta } = await listTeamMatches(team._id.toString(), req.query, parsePage(req.query));
    res.json({ matches: matches.map(toMatchJSON), ...meta });
  })
);
router.post("/", verifyToken, actionLimiter, teamImages, teamsController.createTeam);
router.patch("/:id", verifyToken, teamImages, teamsController.updateTeam);
router.delete("/:id", verifyToken, teamsController.deleteTeam);

router.post("/:id/join-requests", verifyToken, actionLimiter, teamsController.requestToJoin);
router.delete("/:id/join-requests", verifyToken, teamsController.withdrawJoinRequest);
router.patch("/:id/join-requests/:userId", verifyToken, teamsController.respondToJoinRequest);

router.post("/:id/invitations", verifyToken, actionLimiter, teamsController.invite);
router.post("/:id/invitations/respond", verifyToken, teamsController.respondToInvitation);
router.delete("/:id/invitations/:userId", verifyToken, teamsController.cancelInvitation);

router.post("/:id/leave", verifyToken, teamsController.leave);
router.post("/:id/transfer-ownership", verifyToken, teamsController.transferOwnership);
router.patch("/:id/members/:userId/role", verifyToken, teamsController.setRole);
router.delete("/:id/members/:userId", verifyToken, teamsController.removeMember);

export default router;
