import mongoose from "mongoose";
import { env } from "../config/env.js";

const quizSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    sourceType: { type: String, default: "text" },
    sourceInput: { type: String, default: "" },
    topic: { type: String, default: "" },
    extractedText: { type: String, default: "" },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    questions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + env.quizSessionTtlHours * 60 * 60 * 1000),
      expires: 0
    }
  },
  { timestamps: true }
);

export const QuizSession = mongoose.models.QuizSession || mongoose.model("QuizSession", quizSessionSchema);
