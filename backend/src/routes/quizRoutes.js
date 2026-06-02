import { Router } from "express";
import { extractContent, extractionStatus, generateFlashcardsController, generateQuiz, submitQuiz } from "../controllers/quizController.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { upload } from "../services/contentExtractionService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/extract", requireAuth, upload.single("pdf"), asyncHandler(extractContent));
router.get("/extract/status", requireAuth, asyncHandler(extractionStatus));
router.post("/generate", requireAuth, rateLimit({ windowMs: 60_000, max: 8, label: "api-quizzes-generate" }), asyncHandler(generateQuiz));
router.post("/submit", requireAuth, asyncHandler(submitQuiz));
router.post("/flashcards", requireAuth, rateLimit({ windowMs: 60_000, max: 8, label: "api-quizzes-flashcards" }), asyncHandler(generateFlashcardsController));

export default router;
