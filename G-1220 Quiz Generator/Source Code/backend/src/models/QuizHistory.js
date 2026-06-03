import mongoose from "mongoose";

const quizHistorySchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, index: true },
    quizTitle: { type: String, default: "Quiz", trim: true },
    score: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

export const QuizHistory = mongoose.models.QuizHistory || mongoose.model("QuizHistory", quizHistorySchema);
