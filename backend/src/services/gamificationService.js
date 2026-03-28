const difficultyBonusMap = { easy: 8, moderate: 14, tough: 22, super: 32 };
const modeBonusMap = { mcq: 8, mixed: 14, short: 18 };

const achievementRules = [
  { id: "first_quiz", label: "First Spark", when: (stats) => stats.totalQuizzes >= 1 },
  { id: "streak_3", label: "Hot Streak", when: (stats) => stats.currentStreak >= 3 },
  { id: "perfect_score", label: "Perfect Shot", when: (stats, attempt) => Number(attempt.percentage || 0) === 100 },
  { id: "quiz_master", label: "Quiz Boss", when: (stats) => stats.bestPercentage >= 90 },
  { id: "xp_500", label: "XP Hunter", when: (stats) => stats.totalXp >= 500 }
];

export function calculateAttemptRewards({ percentage = 0, score = 0, settings = {} }) {
  const basePoints = Number(score || 0) * 10;
  const difficultyBonus = difficultyBonusMap[settings?.difficulty] || 10;
  const modeBonus = modeBonusMap[settings?.questionMode] || 8;
  const perfectBonus = Number(percentage || 0) === 100 ? 30 : 0;
  const xpEarned = 20 + Math.round(Number(percentage || 0)) + difficultyBonus + modeBonus + perfectBonus;
  const pointsEarned = basePoints + difficultyBonus + modeBonus + perfectBonus;

  return { pointsEarned, xpEarned };
}

export function applyGamificationToUser(user, evaluatedAttempt) {
  const stats = user.stats || {};
  const previousStreak = Number(stats.currentStreak || 0);
  const nextStreak = Number(evaluatedAttempt.percentage || 0) >= 70 ? previousStreak + 1 : 0;
  const rewards = calculateAttemptRewards(evaluatedAttempt);

  const nextStats = {
    totalQuizzes: Number(stats.totalQuizzes || 0) + 1,
    totalQuestions: Number(stats.totalQuestions || 0) + Number(evaluatedAttempt.total || 0),
    totalCorrectAnswers: Number(stats.totalCorrectAnswers || 0) + Number(evaluatedAttempt.score || 0),
    totalPoints: Number(stats.totalPoints || 0) + rewards.pointsEarned,
    totalXp: Number(stats.totalXp || 0) + rewards.xpEarned,
    currentStreak: nextStreak,
    bestStreak: Math.max(Number(stats.bestStreak || 0), nextStreak),
    bestPercentage: Math.max(Number(stats.bestPercentage || 0), Number(evaluatedAttempt.percentage || 0)),
    achievements: Array.isArray(stats.achievements) ? [...stats.achievements] : [],
    lastAttemptAt: new Date()
  };

  nextStats.leaderboardScore = nextStats.totalPoints + Math.round(nextStats.totalXp / 5) + (nextStats.bestStreak * 10);

  const unlockedNow = [];
  for (const rule of achievementRules) {
    if (!nextStats.achievements.includes(rule.id) && rule.when(nextStats, evaluatedAttempt)) {
      nextStats.achievements.push(rule.id);
      unlockedNow.push({ id: rule.id, label: rule.label });
    }
  }

  user.stats = nextStats;

  return {
    updatedStats: nextStats,
    unlockedAchievements: unlockedNow,
    rewards
  };
}

export function buildProfileSummary(user) {
  const stats = user?.stats || {};
  return {
    totalQuizzes: Number(stats.totalQuizzes || 0),
    totalQuestions: Number(stats.totalQuestions || 0),
    totalCorrectAnswers: Number(stats.totalCorrectAnswers || 0),
    totalPoints: Number(stats.totalPoints || 0),
    totalXp: Number(stats.totalXp || 0),
    leaderboardScore: Number(stats.leaderboardScore || 0),
    currentStreak: Number(stats.currentStreak || 0),
    bestStreak: Number(stats.bestStreak || 0),
    bestPercentage: Number(stats.bestPercentage || 0),
    achievements: Array.isArray(stats.achievements) ? stats.achievements : []
  };
}
