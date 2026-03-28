import mongoose from "mongoose";

const userStatsSchema = new mongoose.Schema(
  {
    totalQuizzes: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    totalCorrectAnswers: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    totalXp: { type: Number, default: 0 },
    leaderboardScore: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    bestPercentage: { type: Number, default: 0 },
    achievements: { type: [String], default: [] },
    lastAttemptAt: { type: Date, default: null }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    stats: { type: userStatsSchema, default: () => ({}) }
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
