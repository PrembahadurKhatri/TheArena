import { Router } from "express";
import * as challengesController from "../controllers/challengesController";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

router.get("/", challengesController.listOpen);
router.get("/mine", verifyToken, challengesController.listMine);
router.post("/", verifyToken, challengesController.create);
router.get("/:id", challengesController.getOne);
router.post("/:id/accept", verifyToken, challengesController.accept);
router.post("/:id/decline", verifyToken, challengesController.decline);
router.post("/:id/cancel", verifyToken, challengesController.cancel);

export default router;
