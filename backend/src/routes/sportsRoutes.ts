import { Router } from "express";
import { listSports } from "../controllers/sportsController";

const router = Router();

router.get("/", listSports);

export default router;
