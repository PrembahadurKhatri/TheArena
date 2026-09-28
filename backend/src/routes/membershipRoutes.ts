import { Router } from "express";
import * as membershipController from "../controllers/membershipController";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

router.get("/me", verifyToken, membershipController.getMyMembership);

export default router;
