import { Router } from "express";
import * as paymentsController from "../controllers/paymentsController";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

router.post("/checkout", verifyToken, paymentsController.checkout);
router.post("/:id/confirm", verifyToken, paymentsController.confirm);
router.post("/:id/fail", verifyToken, paymentsController.fail);

export default router;
