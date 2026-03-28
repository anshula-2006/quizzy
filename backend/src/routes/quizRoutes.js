import { Router } from "express";
import { extractContent, extractionStatus, generateFlashcardsController, generateQuiz, submitQuiz } from "../controllers/quizController.js";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../services/contentExtractionService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/extract", upload.single("pdf"), asyncHandler(extractContent));
router.get("/extract/status", asyncHandler(extractionStatus));
router.post("/generate", asyncHandler(generateQuiz));
router.post("/submit", requireAuth, asyncHandler(submitQuiz));
router.post("/flashcards", asyncHandler(generateFlashcardsController));

export default router;
