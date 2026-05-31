import { apiRequest, getFlashDecks, getSession } from "./shared.js";

const HISTORY_BASE = "quizzy-history-v2";
const BONUS_XP_BASE = "quizzy-bonus-xp-v1";

function readJson(key, fallback) {
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getScopeId() {
  const session = getSession();
  return session?.user?.email || session?.email || "guest";
}

function getHistory() {
  const raw = readJson(`${HISTORY_BASE}-${getScopeId()}`, []);
  return Array.isArray(raw) ? raw : [];
}

function getBonusXp() {
  const raw = readJson(`${BONUS_XP_BASE}-${getScopeId()}`, null);
  return Math.max(0, Number(raw?.total || 0));
}

function normalizeAttemptEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const evaluatedAnswers = Array.isArray(entry.evaluatedAnswers) ? entry.evaluatedAnswers : [];
  const currentAnswers = Array.isArray(entry.answers) ? entry.answers : [];
  const answers = evaluatedAnswers.length ? evaluatedAnswers : currentAnswers;
  return { ...entry, answers };
}

function getAttemptXp(entry) {
  if (!entry) return 0;
  const difficultyBonusMap = { easy: 8, moderate: 14, tough: 22, super: 32, current_events: 20 };
  const modeBonusMap = { mcq: 8, mixed: 14, short: 18 };
  const base = 20;
  const accuracyBonus = Math.round(Number(entry.percentage || 0));
  const difficultyBonus = difficultyBonusMap[entry.settings?.difficulty] || 10;
  const modeBonus = modeBonusMap[entry.settings?.questionMode] || 8;
  const perfectBonus = Number(entry.percentage || 0) === 100 ? 30 : 0;
  return base + accuracyBonus + difficultyBonus + modeBonus + perfectBonus;
}

function getStreak(entries) {
  let streak = 0;
  for (const item of entries) {
    if ((item.percentage || 0) >= 70) streak += 1;
    else break;
  }
  return streak;
}

function getBadgeCount(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const bonusXp = getBonusXp();
  const totalXp = list.reduce((sum, entry) => sum + getAttemptXp(entry), 0) + bonusXp;
  const streak = getStreak(list);
  const best = list.length ? Math.max(...list.map((entry) => Number(entry.percentage || 0))) : 0;
  const perfectCount = list.filter((entry) => Number(entry.percentage || 0) === 100).length;
  const flashFan = getFlashDecks().length >= 1;
  const superCount = list.filter((entry) => entry?.settings?.difficulty === "super").length;
  return [
    list.length >= 1,
    streak >= 3,
    best >= 90,
    perfectCount >= 1,
    list.length >= 5,
    totalXp >= 600,
    flashFan,
    superCount >= 1
  ].filter(Boolean).length;
}

function getPerformance(entries) {
  if (!entries.length) return 0;
  return Math.round(entries[0].percentage || 0);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

async function personalizeHomepage() {
  const session = getSession();
  if (!session?.token) return;

  const heroWelcome = document.getElementById("heroWelcome");
  const heroSubtitle = document.getElementById("heroSubtitle");
  const profileName = session?.user?.name || session?.email || "learner";

  setText("heroWelcome", `Welcome back, ${profileName}`);

  const history = getHistory().map(normalizeAttemptEntry);
  const attempts = history.length ? history : [];
  const bonusXp = getBonusXp();
  const totalXp = attempts.reduce((sum, entry) => sum + getAttemptXp(entry), 0) + bonusXp;
  const streak = getStreak(attempts);
  const badges = getBadgeCount(attempts);
  const performance = getPerformance(attempts);

  if (heroSubtitle) {
    heroSubtitle.textContent = attempts.length
      ? "Your latest quiz performance and progress snapshot are ready."
      : "Generate a quiz to unlock your personalized learning dashboard.";
  }

  setText("heroPerformanceValue", attempts.length ? `${performance}%` : "--%");
  setText("heroTotalXpValue", `${totalXp} XP`);
  setText("heroStreakValue", attempts.length ? `${streak} days` : "0 days");
  setText("heroBadgesValue", `${badges}`);

  const email = String(session?.user?.email || session?.email || "").toLowerCase();
  let rankText = "--";

  const bootstrap = await apiRequest("/data/bootstrap");
  if (bootstrap?.leaderboard && Array.isArray(bootstrap.leaderboard)) {
    const ordered = bootstrap.leaderboard.filter((player) => player && !player.isDummy && player.email);
    const idx = ordered.findIndex((player) => String(player.email || "").toLowerCase() === email);
    if (idx >= 0) rankText = `#${idx + 1}`;
  }

  setText("heroRankValue", rankText);
}

window.addEventListener("DOMContentLoaded", personalizeHomepage);
