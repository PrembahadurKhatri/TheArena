import { Router } from "express";
import * as teamsController from "../controllers/teamsController";
import { verifyToken } from "../middleware/verifyToken";
import { upload } from "../utils/upload";

const router = Router();

router.get("/", teamsController.listTeams);
router.get("/:id", teamsController.getTeam);
router.post("/", verifyToken, upload.single("logo"), teamsController.createTeam);
router.patch("/:id", verifyToken, upload.single("logo"), teamsController.updateTeam);
router.delete("/:id", verifyToken, teamsController.deleteTeam);
router.post("/:id/join-requests", verifyToken, teamsController.requestToJoin);
router.patch("/:id/join-requests/:userId", verifyToken, teamsController.respondToJoinRequest);
router.delete("/:id/members/:userId", verifyToken, teamsController.removeMember);

export default router;
