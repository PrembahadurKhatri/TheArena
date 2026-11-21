import { Router } from "express";
import * as authController from "../controllers/authController";
import { verifyToken } from "../middleware/verifyToken";
import { authLimiter, passwordResetLimiter } from "../middleware/security";
import { upload } from "../utils/upload";

const router = Router();

router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.get("/me", verifyToken, authController.getMe);
router.patch("/me", verifyToken, upload.single("photo"), authController.updateMe);
router.post("/logout-all", verifyToken, authController.logoutAll);
router.post("/forgot-password", passwordResetLimiter, authController.forgotPassword);
router.post("/reset-password/:token", authLimiter, authController.resetPassword);

export default router;
