import { Router } from "express";
import { actionLimiter } from "../middleware/security";
import * as groundsController from "../controllers/groundsController";
import { verifyToken } from "../middleware/verifyToken";
import { upload } from "../utils/upload";

// Ground owner tools. Any signed-in player can list a ground; every route
// checks the ground belongs to the caller.
const router = Router();
router.use(verifyToken);

router.get("/grounds", groundsController.ownerListGrounds);
router.post("/grounds", actionLimiter, upload.array("images", 8), groundsController.ownerCreateGround);
router.patch("/grounds/:id", upload.array("images", 8), groundsController.ownerUpdateGround);
router.post("/grounds/:id/blocks", groundsController.ownerBlock);
router.get("/bookings", groundsController.ownerBookings);
router.post("/bookings/:id/action", groundsController.ownerBookingAction);

export default router;
