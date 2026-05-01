import mongoose from "mongoose";

const userStatsSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, unique: true, index: true },
    totalScore: { type: Number, default: 0, min: 0 },
    totalQuizzes: { type: Number, default: 0, min: 0 },
    streak: { type: Number, default: 0, min: 0 },
    accuracy: { type: Number, default: 0, min: 0, max: 100 }
  },
  { timestamps: true }
);

export const UserStats = mongoose.models.UserStats || mongoose.model("UserStats", userStatsSchema);
