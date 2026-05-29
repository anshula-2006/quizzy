import { User } from "../models/User.js";
import { buildProfileSummary } from "../services/gamificationService.js";

function hasRealProgress(user) {
  const stats = user?.stats || {};
  return Number(stats.totalXp || 0) > 0
    || Number(stats.leaderboardScore || 0) > 0
    || Number(stats.totalQuizzes || 0) > 0
    || (Array.isArray(stats.achievements) && stats.achievements.length > 0);
}

function toLeaderboardRow(user, index) {
  const stats = user?.stats || {};
  const totalQuestions = Number(stats.totalQuestions || 0);
  return {
    rank: index + 1,
    name: String(user?.name || "Learner"),
    email: String(user?.email || ""),
    totalPoints: Number(stats.totalPoints || 0),
    totalXp: Number(stats.totalXp || 0),
    totalQuizzes: Number(stats.totalQuizzes || 0),
    accuracy: totalQuestions
      ? Math.round((Number(stats.totalCorrectAnswers || 0) / totalQuestions) * 100)
      : 0,
    currentStreak: Number(stats.currentStreak || 0),
    bestStreak: Number(stats.bestStreak || 0),
    bestPercentage: Number(stats.bestPercentage || 0),
    leaderboardScore: Number(stats.leaderboardScore || 0),
    achievements: Array.isArray(stats.achievements) ? stats.achievements : []
  };
}

export async function getLeaderboard(req, res) {
  const limit = Math.max(1, Math.min(50, Number(req.query?.limit || 10)));
  const users = await User.find({
    name: { $not: /dummy|fake/i },
    email: { $not: /dummy|fake/i },
    $or: [
      { "stats.totalXp": { $gt: 0 } },
      { "stats.leaderboardScore": { $gt: 0 } },
      { "stats.totalQuizzes": { $gt: 0 } },
      { "stats.achievements.0": { $exists: true } }
    ]
  })
    .sort({ "stats.leaderboardScore": -1, "stats.totalXp": -1, createdAt: 1 })
    .limit(limit)
    .select("name email stats")
    .lean();

  res.json({
    leaderboard: users.filter(hasRealProgress).map(toLeaderboardRow)
  });
}

export async function getMyProgress(req, res) {
  res.json({ profile: buildProfileSummary(req.user) });
}
