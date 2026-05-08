import { getFlashDecks, getMiniGameStats, getSavedQuizHistory } from "./shared.js";

export const BADGE_LEDGER_BASE = "quizzy-badge-ledger-v1";
export const BONUS_XP_BASE = "quizzy-bonus-xp-v1";
export const CHALLENGE_BASE = "quizzy-challenges-v1";
export const SESSION_ACTIVITY_BASE = "quizzy-session-activity-v1";

const badgeAssets = {
  starter: ["bronze", "first_spark.png"],
  streak: ["silver", "hot_streak.png"],
  scholar: ["gold", "quiz_boss.png"],
  "perfect-shot": ["gold", "perfect_shot.png"],
  grinder: ["silver", "consistency_champ.png"],
  legend: ["gold", "quiz_legend.png"],
  "flash-fan": ["bronze", "flash_fan.png"],
  "memory-master": ["gold", "memory_master.png"],
  speedster: ["silver", "speedster.png"],
  "xp-hunter": ["silver", "xp_hunter.png"],
  "challenge-crusher": ["gold", "challenge_crusher.png"],
  "comeback-kid": ["silver", "comeback_kid.png"],
  "night-owl": ["bronze", "night_owl.png"],
  "brain-blaster": ["gold", "brain_blaster.png"],
  "study-ninja": ["special", "study_ninja.png"]
};

const serverAchievementMap = {
  first_quiz: "starter",
  streak_3: "streak",
  perfect_score: "perfect-shot",
  quiz_master: "scholar",
  xp_500: "xp-hunter",
  flash_fan: "flash-fan",
  memory_master: "memory-master",
  speedster: "speedster"
};

export function getScopeId() {
  try {
    const raw = localStorage.getItem("quizzy-session-v2");
    const session = raw ? JSON.parse(raw) : null;
    return session?.user?.email || session?.email || "guest";
  } catch {
    return "guest";
  }
}

export function getAttemptXp(entry) {
  if (!entry) return 0;
  const difficultyBonusMap = { easy: 8, moderate: 14, tough: 22, super: 32 };
  const modeBonusMap = { mcq: 8, mixed: 14, short: 18 };
  const perfectBonus = Number(entry.percentage || 0) === 100 ? 30 : 0;
  return 20 + Math.round(Number(entry.percentage || 0)) + (difficultyBonusMap[entry.settings?.difficulty] || 10) + (modeBonusMap[entry.settings?.questionMode] || 8) + perfectBonus;
}

export function getLevelFromXp(totalXp) {
  return Math.max(1, Math.floor(Number(totalXp || 0) / 180) + 1);
}

export function getLevelProgress(totalXp) {
  return Math.round(((Number(totalXp || 0) % 180) / 180) * 100);
}

export function getStreak(entries) {
  let streak = 0;
  for (const item of Array.isArray(entries) ? entries : []) {
    if (Number(item?.percentage || 0) >= 70) streak += 1;
    else break;
  }
  return streak;
}

export function getBonusXp() {
  try {
    const raw = localStorage.getItem(`${BONUS_XP_BASE}-${getScopeId()}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return Math.max(0, Number(parsed?.total || 0));
  } catch {
    return 0;
  }
}

export function getChallengeProgress() {
  try {
    const raw = localStorage.getItem(`${CHALLENGE_BASE}-${getScopeId()}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      completed: Array.isArray(parsed?.completed) ? parsed.completed : [],
      rewards: Array.isArray(parsed?.rewards) ? parsed.rewards : []
    };
  } catch {
    return { completed: [], rewards: [] };
  }
}

export function getSessionActivity() {
  try {
    const raw = localStorage.getItem(`${SESSION_ACTIVITY_BASE}-${getScopeId()}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      quizDone: Boolean(parsed?.quizDone),
      flashcardsDone: Boolean(parsed?.flashcardsDone),
      miniGameDone: Boolean(parsed?.miniGameDone)
    };
  } catch {
    return { quizDone: false, flashcardsDone: false, miniGameDone: false };
  }
}

function badgeIcon(id) {
  const asset = badgeAssets[id] || ["bronze", "first_spark.png"];
  return new URL(`../assets/badges/${asset[0]}/${asset[1]}`, import.meta.url).href;
}

function hasComeback(entries) {
  const list = Array.isArray(entries) ? entries : [];
  for (let i = 0; i < list.length - 1; i += 1) {
    if (Number(list[i]?.percentage || 0) - Number(list[i + 1]?.percentage || 0) >= 20) return true;
  }
  return false;
}

function getNightOwlCount(entries) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const dt = new Date(entry?.createdAt);
    const hour = dt.getHours();
    return !Number.isNaN(dt.getTime()) && (hour >= 21 || hour < 5);
  }).length;
}

export function getBadgeCatalog(entries = getSavedQuizHistory(), profile = null) {
  const list = Array.isArray(entries) ? entries : [];
  const stats = profile || {};
  const bonusXp = Math.max(getBonusXp(), Number(stats.bonusXp || 0));
  const gameStats = { ...getMiniGameStats(), ...(stats.miniGameStats || {}) };
  const totalXp = Math.max(
    list.reduce((sum, entry) => sum + getAttemptXp(entry), 0) + bonusXp,
    Number(stats.totalXp || 0)
  );
  const streak = Math.max(getStreak(list), Number(stats.currentStreak || 0));
  const best = Math.max(
    list.length ? Math.max(...list.map((entry) => Number(entry.percentage || 0))) : 0,
    Number(stats.bestPercentage || 0)
  );
  const perfectCount = list.filter((entry) => Number(entry.percentage || 0) === 100).length;
  const superCount = list.filter((entry) => entry?.settings?.difficulty === "super").length;
  const completedChallenges = getChallengeProgress().completed.length;
  const sessionActivity = getSessionActivity();

  const catalog = [
    { id: "starter", label: "First Spark", rarity: "bronze", unlocked: list.length >= 1 || Number(stats.totalQuizzes || 0) >= 1, hint: "Finish your first quiz.", progress: Math.min(1, list.length || Number(stats.totalQuizzes || 0)) },
    { id: "streak", label: "Hot Streak", rarity: "silver", unlocked: streak >= 3, hint: "Win 3 quizzes in a row.", progress: Math.min(3, streak), target: 3 },
    { id: "scholar", label: "Quiz Boss", rarity: "gold", unlocked: best >= 90, hint: "Reach 90% on a quiz.", progress: Math.min(90, best), target: 90 },
    { id: "perfect-shot", label: "Perfect Shot", rarity: "gold", unlocked: perfectCount >= 1, hint: "Score 100% on a quiz.", progress: Math.min(1, perfectCount), target: 1 },
    { id: "grinder", label: "Consistency Champ", rarity: "silver", unlocked: list.length >= 5 || Number(stats.totalQuizzes || 0) >= 5, hint: "Complete 5 quizzes.", progress: Math.min(5, Math.max(list.length, Number(stats.totalQuizzes || 0))), target: 5 },
    { id: "legend", label: "Quiz Legend", rarity: "gold", unlocked: totalXp >= 600, hint: "Earn 600 total XP.", progress: Math.min(600, totalXp), target: 600 },
    { id: "flash-fan", label: "Flash Fan", rarity: "bronze", unlocked: getFlashDecks().length >= 1, hint: "Generate one flashcard deck.", progress: Math.min(1, getFlashDecks().length), target: 1 },
    { id: "memory-master", label: "Memory Master", rarity: "gold", unlocked: Number(gameStats.memoryWins || 0) >= 1, hint: "Win one Memory Match game.", progress: Math.min(1, Number(gameStats.memoryWins || 0)), target: 1 },
    { id: "speedster", label: "Speedster", rarity: "silver", unlocked: Number(gameStats.reactionBest || 0) > 0 && Number(gameStats.reactionBest || 0) <= 350, hint: "Hit 350 ms or faster in Reaction Tap.", progress: Number(gameStats.reactionBest || 0) ? Math.max(0, 350 - Number(gameStats.reactionBest || 0)) : 0, target: 350 },
    { id: "xp-hunter", label: "XP Hunter", rarity: "silver", unlocked: totalXp >= 500 || bonusXp >= 300, hint: "Earn 500 total XP or 300 bonus XP.", progress: Math.min(500, totalXp), target: 500 },
    { id: "challenge-crusher", label: "Challenge Crusher", rarity: "gold", unlocked: completedChallenges >= 3, hint: "Complete 3 XP missions.", progress: Math.min(3, completedChallenges), target: 3 },
    { id: "comeback-kid", label: "Comeback Kid", rarity: "silver", unlocked: hasComeback(list), hint: "Improve by 20% from one quiz to the next.", progress: hasComeback(list) ? 1 : 0, target: 1 },
    { id: "night-owl", label: "Night Owl", rarity: "bronze", unlocked: getNightOwlCount(list) >= 3, hint: "Complete 3 quizzes late at night.", progress: Math.min(3, getNightOwlCount(list)), target: 3 },
    { id: "brain-blaster", label: "Brain Blaster", rarity: "gold", unlocked: superCount >= 1, hint: "Finish a Super difficulty quiz.", progress: Math.min(1, superCount), target: 1 },
    { id: "study-ninja", label: "Study Ninja", rarity: "special", unlocked: sessionActivity.quizDone && sessionActivity.flashcardsDone && sessionActivity.miniGameDone, hint: "Do a quiz, flashcards, and a mini-game in one session.", progress: [sessionActivity.quizDone, sessionActivity.flashcardsDone, sessionActivity.miniGameDone].filter(Boolean).length, target: 3 }
  ];

  return catalog.map((badge) => ({ ...badge, icon: badgeIcon(badge.id) }));
}

function ledgerKey(scope = getScopeId()) {
  return `${BADGE_LEDGER_BASE}-${scope || "guest"}`;
}

export function readBadgeLedger(scope = getScopeId()) {
  try {
    const raw = localStorage.getItem(ledgerKey(scope));
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      unlocked: Array.isArray(parsed?.unlocked) ? parsed.unlocked : [],
      updatedAt: parsed?.updatedAt || null
    };
  } catch {
    return { unlocked: [], updatedAt: null };
  }
}

export function persistBadgeLedger(ids, scope = getScopeId(), source = "unknown") {
  const previous = readBadgeLedger(scope);
  const merged = [...new Set([...previous.unlocked, ...(Array.isArray(ids) ? ids : [])].filter(Boolean))];
  const payload = { unlocked: merged, updatedAt: new Date().toISOString(), source };
  localStorage.setItem(ledgerKey(scope), JSON.stringify(payload));
  console.debug("[Quizzy badges] persistence save", { scope, source, count: merged.length, ids: merged });
  return payload;
}

export function mergeBadgesFromSources(entries = getSavedQuizHistory(), profile = null, serverAchievements = []) {
  const computedIds = getBadgeCatalog(entries, profile).filter((badge) => badge.unlocked).map((badge) => badge.id);
  const serverIds = (Array.isArray(serverAchievements) ? serverAchievements : [])
    .map((id) => serverAchievementMap[id] || id)
    .filter(Boolean);
  const ledger = persistBadgeLedger([...computedIds, ...serverIds], getScopeId(), "merge");
  console.debug("[Quizzy badges] state merge", { computedIds, serverIds, ledger: ledger.unlocked });
  return ledger.unlocked;
}

export function getResolvedBadges(entries = getSavedQuizHistory(), profile = null) {
  const unlockedIds = new Set(mergeBadgesFromSources(entries, profile, profile?.achievements || []));
  return getBadgeCatalog(entries, profile).map((badge) => ({ ...badge, unlocked: badge.unlocked || unlockedIds.has(badge.id) }));
}

export function getGamificationSummary(entries = getSavedQuizHistory(), profile = null) {
  const list = Array.isArray(entries) ? entries : [];
  const quizXp = list.reduce((sum, entry) => sum + getAttemptXp(entry), 0);
  const totalXp = Math.max(quizXp + getBonusXp(), Number(profile?.totalXp || 0));
  const badges = getResolvedBadges(list, profile).filter((badge) => badge.unlocked);
  const best = Math.max(list.length ? Math.max(...list.map((entry) => Number(entry.percentage || 0))) : 0, Number(profile?.bestPercentage || 0));
  return {
    totalXp,
    quizXp,
    bonusXp: getBonusXp(),
    level: getLevelFromXp(totalXp),
    progress: getLevelProgress(totalXp),
    streak: Math.max(getStreak(list), Number(profile?.currentStreak || 0)),
    best,
    gameStats: { ...getMiniGameStats(), ...(profile?.miniGameStats || {}) },
    badges,
    latestXp: list[0] ? getAttemptXp(list[0]) : 0
  };
}
