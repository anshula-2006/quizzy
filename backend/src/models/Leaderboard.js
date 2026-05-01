import mongoose from "mongoose";

const leaderboardSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, index: true },
    score: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

leaderboardSchema.index({ score: -1, createdAt: 1 });

export const Leaderboard = mongoose.models.Leaderboard || mongoose.model("Leaderboard", leaderboardSchema);
