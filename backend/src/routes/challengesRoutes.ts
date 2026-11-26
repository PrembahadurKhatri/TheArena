import { Router } from "express";
import { actionLimiter } from "../middleware/security";
import * as challengesController from "../controllers/challengesController";
import { verifyToken, optionalAuth } from "../middleware/verifyToken";

const router = Router();

router.get("/", optionalAuth, challengesController.listOpen);
router.get("/mine", verifyToken, challengesController.listMine);
router.post("/", verifyToken, actionLimiter, challengesController.create);
router.get("/:id", optionalAuth, challengesController.getOne);
router.post("/:id/accept", verifyToken, challengesController.accept);
router.post("/:id/counter", verifyToken, actionLimiter, challengesController.counter);
router.post("/:id/decline", verifyToken, challengesController.decline);
router.post("/:id/cancel", verifyToken, challengesController.cancel);
router.get("/:id/nearby-grounds", challengesController.nearbyGrounds);
router.post("/:id/book-ground", verifyToken, challengesController.bookGround);

export default router;
