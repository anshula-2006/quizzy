import { User } from "../models/User.js";
import { buildProfileSummary } from "../services/gamificationService.js";

export async function getLeaderboard(req, res) {
  const limit = Math.max(1, Math.min(50, Number(req.query?.limit || 10)));
  const users = await User.find({
    name: { $not: /dummy|fake/i },
    email: { $not: /dummy|fake/i }
  })
    .sort({ "stats.leaderboardScore": -1, "stats.totalXp": -1, createdAt: 1 })
    .limit(limit)
    .select("name email stats")
    .lean();

  res.json({
    leaderboard: users.map((user, index) => ({
      rank: index + 1,
      name: user.name,
      email: user.email,
      totalPoints: Number(user.stats?.totalPoints || 0),
      totalXp: Number(user.stats?.totalXp || 0),
      totalQuizzes: Number(user.stats?.totalQuizzes || 0),
      accuracy: Number(user.stats?.totalQuestions || 0)
        ? Math.round((Number(user.stats?.totalCorrectAnswers || 0) / Number(user.stats?.totalQuestions || 0)) * 100)
        : 0,
      currentStreak: Number(user.stats?.currentStreak || 0),
      bestStreak: Number(user.stats?.bestStreak || 0),
      bestPercentage: Number(user.stats?.bestPercentage || 0),
      leaderboardScore: Number(user.stats?.leaderboardScore || 0),
      achievements: Array.isArray(user.stats?.achievements) ? user.stats.achievements : []
    }))
  });
}

export async function getMyProgress(req, res) {
  res.json({ profile: buildProfileSummary(req.user) });
}
