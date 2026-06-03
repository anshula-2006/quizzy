import { Router } from "express";
import { getLeaderboard, getMyProgress } from "../controllers/gamificationController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/leaderboard", asyncHandler(getLeaderboard));
router.get("/me", requireAuth, asyncHandler(getMyProgress));

export default router;
