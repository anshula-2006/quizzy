import { User } from "../models/User.js";
import { QuizAttempt } from "../models/QuizAttempt.js";
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

function toAttemptLeaderboardRow(item, index) {
  const totalQuestions = Number(item.totalQuestions || 0);
  const totalPoints = Number(item.totalPoints || 0);
  const totalXp = Number(item.totalXp || 0);
  const bestStreak = Number(item.bestStreak || 0);
  return {
    rank: index + 1,
    name: String(item.user?.name || "Learner"),
    email: String(item.user?.email || ""),
    totalPoints,
    totalXp,
    totalQuizzes: Number(item.totalQuizzes || 0),
    accuracy: totalQuestions
      ? Math.round((Number(item.totalCorrectAnswers || 0) / totalQuestions) * 100)
      : 0,
    currentStreak: Number(item.currentStreak || 0),
    bestStreak,
    bestPercentage: Number(item.bestPercentage || 0),
    leaderboardScore: totalPoints + Math.round(totalXp / 5) + (bestStreak * 10),
    achievements: Array.isArray(item.user?.stats?.achievements) ? item.user.stats.achievements : []
  };
}

async function getLeaderboardFromAttempts(limit) {
  const rows = await QuizAttempt.aggregate([
    {
      $group: {
        _id: "$user",
        totalQuizzes: { $sum: 1 },
        totalQuestions: { $sum: "$total" },
        totalCorrectAnswers: { $sum: "$score" },
        totalPoints: { $sum: "$pointsEarned" },
        totalXp: { $sum: "$xpEarned" },
        bestPercentage: { $max: "$percentage" },
        bestStreak: { $max: "$streakAfterAttempt" },
        lastAttemptAt: { $max: "$createdAt" }
      }
    },
    { $match: { _id: { $ne: null } } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user"
      }
    },
    { $unwind: "$user" },
    {
      $match: {
        "user.name": { $not: /dummy|fake/i },
        "user.email": { $not: /dummy|fake/i }
      }
    },
    {
      $addFields: {
        leaderboardScore: {
          $add: [
            { $ifNull: ["$totalPoints", 0] },
            { $round: [{ $divide: [{ $ifNull: ["$totalXp", 0] }, 5] }, 0] },
            { $multiply: [{ $ifNull: ["$bestStreak", 0] }, 10] }
          ]
        }
      }
    },
    { $sort: { leaderboardScore: -1, totalXp: -1, lastAttemptAt: 1 } },
    { $limit: limit }
  ]);

  return rows.map(toAttemptLeaderboardRow);
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

  const leaderboard = users.filter(hasRealProgress).map(toLeaderboardRow);
  res.json({
    leaderboard: leaderboard.length ? leaderboard : await getLeaderboardFromAttempts(limit)
  });
}

export async function getMyProgress(req, res) {
  res.json({ profile: buildProfileSummary(req.user) });
}
