import { Router } from "express";
import { bootstrapUserData, clearAttempts, createFlashDeck, createSavedQuestion } from "../controllers/quizController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/bootstrap", requireAuth, asyncHandler(bootstrapUserData));
router.delete("/attempts", requireAuth, asyncHandler(clearAttempts));
router.post("/saved-questions", requireAuth, asyncHandler(createSavedQuestion));
router.post("/flash-decks", requireAuth, asyncHandler(createFlashDeck));

export default router;
