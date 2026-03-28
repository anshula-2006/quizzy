import cors from "cors";
import express from "express";
import { extractContent, extractionStatus, generateFlashcardsController, generateQuiz, submitQuiz } from "./controllers/quizController.js";
import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import dataRoutes from "./routes/dataRoutes.js";
import gamificationRoutes from "./routes/gamificationRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import { requireAuth } from "./middleware/auth.js";
import { upload } from "./services/contentExtractionService.js";
import { asyncHandler } from "./utils/asyncHandler.js";

export const app = express();

app.use(cors({ origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",") }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Quizzy backend is running");
});

app.use("/auth", authRoutes);
app.use("/data", dataRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/gamification", gamificationRoutes);

// Legacy compatibility routes for the existing frontend.
app.post("/extract-content", upload.single("pdf"), asyncHandler(extractContent));
app.get("/extract-content-status", asyncHandler(extractionStatus));
app.post("/generate-quiz", asyncHandler(generateQuiz));
app.post("/submit-quiz", requireAuth, asyncHandler(submitQuiz));
app.post("/generate-flashcards", asyncHandler(generateFlashcardsController));

app.use((err, req, res, next) => {
  if (err?.name === "MulterError" && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `PDF is too large. Maximum size is ${Math.floor(env.maxPdfUploadBytes / (1024 * 1024))}MB.`
    });
  }

  return res.status(Number(err?.statusCode || 500)).json({
    error: err?.message || "Internal server error",
    details: err?.details || null
  });
});
