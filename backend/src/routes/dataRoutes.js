import { Router } from "express";
import { bootstrapUserData, clearAttempts, clearDashboard, createFlashDeck, createSavedQuestion, generateTeacherExplanation, listGlobalQuizzes, publishGlobalQuiz, startGlobalQuiz, teacherDashboardData, updateMiniGameStats, updateFlashDeck, deleteFlashDeck } from "../controllers/quizController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/bootstrap", requireAuth, asyncHandler(bootstrapUserData));
router.get("/teacher-dashboard", requireAuth, asyncHandler(teacherDashboardData));
router.get("/global-quizzes", asyncHandler(listGlobalQuizzes));
router.post("/global-quizzes", requireAuth, asyncHandler(publishGlobalQuiz));
router.post("/global-quizzes/explain", requireAuth, asyncHandler(generateTeacherExplanation));
router.post("/global-quizzes/:id/start", requireAuth, asyncHandler(startGlobalQuiz));
router.delete("/attempts", requireAuth, asyncHandler(clearAttempts));
router.delete("/dashboard", requireAuth, asyncHandler(clearDashboard));
router.post("/saved-questions", requireAuth, asyncHandler(createSavedQuestion));
router.post("/flash-decks", requireAuth, asyncHandler(createFlashDeck));
router.put("/flash-decks/:id", requireAuth, asyncHandler(updateFlashDeck));
router.delete("/flash-decks/:id", requireAuth, asyncHandler(deleteFlashDeck));
router.post("/mini-games", requireAuth, asyncHandler(updateMiniGameStats));

export default router;
