import { Router } from "express";
import * as authController from "../controllers/authController";
import { verifyToken } from "../middleware/verifyToken";
import { upload } from "../utils/upload";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", verifyToken, authController.getMe);
router.patch("/me", verifyToken, upload.single("photo"), authController.updateMe);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

export default router;
