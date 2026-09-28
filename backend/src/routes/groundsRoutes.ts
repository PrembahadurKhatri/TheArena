import { Router } from "express";
import * as groundsController from "../controllers/groundsController";

const router = Router();

router.get("/", groundsController.listGrounds);
router.get("/:id", groundsController.getGround);

export default router;
