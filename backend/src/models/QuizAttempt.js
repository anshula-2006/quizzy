import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    quizSession: { type: mongoose.Schema.Types.ObjectId, ref: "QuizSession", default: null, index: true },
    sourceType: { type: String, default: "text" },
    sourceInput: { type: String, default: "" },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    answers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    evaluatedAnswers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    pointsEarned: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    streakAfterAttempt: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const QuizAttempt = mongoose.models.QuizAttempt || mongoose.model("QuizAttempt", quizAttemptSchema);
