import API_BASE from "./js/config.js";
import auth from "./auth.js";
import { getBadgeCatalog as getSharedBadgeCatalog, getResolvedBadges as resolvePersistentBadges, getGamificationSummary as getPersistentGamification, mergeBadgesFromSources } from "./js/gamification.js";

const authUser = document.getElementById("authUser");
const loginLink = document.getElementById("loginLink");
const registerLink = document.getElementById("registerLink");
const logoutBtn = document.getElementById("logoutBtn");
const scoreboardContent = document.getElementById("scoreboardContent");
const refreshBoardBtn = document.getElementById("refreshBoardBtn");
const clearBoardBtn = document.getElementById("clearBoardBtn");

const HISTORY_BASE = "quizzy-history-v2";
const SAVED_BASE = "quizzy-saved-v1";
const FLASH_BASE = "quizzy-flash-v1";
const BONUS_XP_BASE = "quizzy-bonus-xp-v1";
const CHALLENGE_BASE = "quizzy-challenges-v1";
const MINI_GAME_BASE = "quizzy-mini-games-v1";
const SESSION_ACTIVITY_BASE = "quizzy-session-activity-v1";
const THEME_KEY = "quizzy-theme";
const MAX_HISTORY_ITEMS = 20;
const MAX_SAVED_ITEMS = 60;
const MAX_FLASH_DECKS = 25;
let cloudProfile = null;
let cloudLeaderboard = [];
let activeReviewAttemptIndex = 0;
let currentLeaderboardPage = 1;
let leaderboardFilter = "all";
let leaderboardSort = "score";
let leaderboardSearch = "";
const LEADERBOARD_PAGE_SIZE = 10;

function getAttemptXp(entry) {
  if (!entry) return 0;
  const difficultyBonusMap = { easy: 8, moderate: 14, tough: 22, super: 32 };
  const modeBonusMap = { mcq: 8, mixed: 14, short: 18 };
  const base = 20;
  const accuracyBonus = Math.round(Number(entry.percentage || 0));
  const difficultyBonus = difficultyBonusMap[entry.settings?.difficulty] || 10;
  const modeBonus = modeBonusMap[entry.settings?.questionMode] || 8;
  const perfectBonus = Number(entry.percentage || 0) === 100 ? 30 : 0;
  return base + accuracyBonus + difficultyBonus + modeBonus + perfectBonus;
}

function getLevelFromXp(totalXp) {
  return Math.max(1, Math.floor(totalXp / 180) + 1);
}

function getLevelProgress(totalXp) {
  return Math.round(((totalXp % 180) / 180) * 100);
}

function getBadgeImagePath(rarity, filename) {
  return new URL(`./assets/badges/${rarity}/${filename}`, import.meta.url).href;
}

function hasComeback(entries) {
  for (let i = 0; i < entries.length - 1; i++) {
    const current = Number(entries[i]?.percentage || 0);
    const previous = Number(entries[i + 1]?.percentage || 0);
    if (current - previous >= 20) return true;
  }
  return false;
}

function getNightOwlCount(entries) {
  return entries.filter((entry) => {
    const dt = new Date(entry?.createdAt);
    const hour = dt.getHours();
    return !Number.isNaN(dt.getTime()) && (hour >= 21 || hour < 5);
  }).length;
}

function getBadgeCatalog(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const bonusXp = getBonusXp();
  const gameStats = getMiniGameStats();
  const totalXp = list.reduce((sum, entry) => sum + getAttemptXp(entry), 0) + bonusXp;
  const streak = getStreak(list);
  const best = list.length ? Math.max(...list.map((entry) => Number(entry.percentage || 0))) : 0;
  const perfectCount = list.filter((entry) => Number(entry.percentage || 0) === 100).length;
  const superCount = list.filter((entry) => entry?.settings?.difficulty === "super").length;
  const completedChallenges = getChallengeProgress().completed.length;
  const sessionActivity = getSessionActivity();

  return [
    { id: "starter", label: "First Spark", icon: getBadgeImagePath("bronze", "first_spark.png"), rarity: "bronze", unlocked: list.length >= 1, hint: "Finish your first quiz." },
    { id: "streak", label: "Hot Streak", icon: getBadgeImagePath("silver", "hot_streak.png"), rarity: "silver", unlocked: streak >= 3, hint: "Win 3 quizzes in a row." },
    { id: "scholar", label: "Quiz Boss", icon: getBadgeImagePath("gold", "quiz_boss.png"), rarity: "gold", unlocked: best >= 90, hint: "Reach 90% on a quiz." },
    { id: "perfect-shot", label: "Perfect Shot", icon: getBadgeImagePath("gold", "perfect_shot.png"), rarity: "gold", unlocked: perfectCount >= 1, hint: "Score 100% on a quiz." },
    { id: "grinder", label: "Consistency Champ", icon: getBadgeImagePath("silver", "consistency_champ.png"), rarity: "silver", unlocked: list.length >= 5, hint: "Complete 5 quizzes." },
    { id: "legend", label: "Quiz Legend", icon: getBadgeImagePath("gold", "quiz_legend.png"), rarity: "gold", unlocked: totalXp >= 600, hint: "Earn 600 total XP." },
    { id: "flash-fan", label: "Flash Fan", icon: getBadgeImagePath("bronze", "flash_fan.png"), rarity: "bronze", unlocked: getFlashDecks().length >= 1, hint: "Generate one flashcard deck." },
    { id: "memory-master", label: "Memory Master", icon: getBadgeImagePath("gold", "memory_master.png"), rarity: "gold", unlocked: Number(gameStats.memoryWins || 0) >= 1, hint: "Win one Memory Match game." },
    { id: "speedster", label: "Speedster", icon: getBadgeImagePath("silver", "speedster.png"), rarity: "silver", unlocked: Number(gameStats.reactionBest || 0) > 0 && Number(gameStats.reactionBest || 0) <= 350, hint: "Hit 350 ms or faster in Reaction Tap." },
    { id: "xp-hunter", label: "XP Hunter", icon: getBadgeImagePath("silver", "xp_hunter.png"), rarity: "silver", unlocked: bonusXp >= 300, hint: "Earn 300 bonus XP from games and missions." },
    { id: "challenge-crusher", label: "Challenge Crusher", icon: getBadgeImagePath("gold", "challenge_crusher.png"), rarity: "gold", unlocked: completedChallenges >= 3, hint: "Complete 3 XP missions." },
    { id: "comeback-kid", label: "Comeback Kid", icon: getBadgeImagePath("silver", "comeback_kid.png"), rarity: "silver", unlocked: hasComeback(list), hint: "Improve by 20% from one quiz to the next." },
    { id: "night-owl", label: "Night Owl", icon: getBadgeImagePath("bronze", "night_owl.png"), rarity: "bronze", unlocked: getNightOwlCount(list) >= 3, hint: "Complete 3 quizzes late at night." },
    { id: "brain-blaster", label: "Brain Blaster", icon: getBadgeImagePath("gold", "brain_blaster.png"), rarity: "gold", unlocked: superCount >= 1, hint: "Finish a Super difficulty quiz." },
    { id: "study-ninja", label: "Study Ninja", icon: getBadgeImagePath("special", "study_ninja.png"), rarity: "special", unlocked: sessionActivity.quizDone && sessionActivity.flashcardsDone && sessionActivity.miniGameDone, hint: "Do a quiz, flashcards, and a mini-game in one session." }
  ];
}

function getGamification(entries) {
  return getPersistentGamification(entries, cloudProfile);
}

function getScopeId() {
  const session = auth?.getSession?.();
  return session?.email || "guest";
}

function historyKey() {
  return `${HISTORY_BASE}-${getScopeId()}`;
}

function flashKey() {
  return `${FLASH_BASE}-${getScopeId()}`;
}

function savedKey() {
  return `${SAVED_BASE}-${getScopeId()}`;
}

function bonusXpKey() {
  return `${BONUS_XP_BASE}-${getScopeId()}`;
}

function challengeKey() {
  return `${CHALLENGE_BASE}-${getScopeId()}`;
}

function miniGameKey() {
  return `${MINI_GAME_BASE}-${getScopeId()}`;
}

function sessionActivityKey() {
  return `${SESSION_ACTIVITY_BASE}-${getScopeId()}`;
}

function getAuthToken() {
  try {
    const raw = localStorage.getItem("quizzy-session-v2");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.token || "";
  } catch {
    return "";
  }
}

function isLoggedIn() {
  return Boolean(getAuthToken());
}

function getHistory() {
  try {
    const raw = localStorage.getItem(historyKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeAttemptEntry) : [];
  } catch {
    return [];
  }
}

function normalizeAttemptEntry(entry) {
  if (!entry || typeof entry !== "object") return entry;
  const evaluatedAnswers = Array.isArray(entry.evaluatedAnswers) ? entry.evaluatedAnswers : [];
  const currentAnswers = Array.isArray(entry.answers) ? entry.answers : [];
  const answers = evaluatedAnswers.length ? evaluatedAnswers : currentAnswers;

  return {
    ...entry,
    answers
  };
}

function saveHistory(entries) {
  const normalized = (Array.isArray(entries) ? entries : []).map(normalizeAttemptEntry);
  localStorage.setItem(historyKey(), JSON.stringify(normalized.slice(0, MAX_HISTORY_ITEMS)));
}

function getFlashDecks() {
  try {
    const raw = localStorage.getItem(flashKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFlashDecks(items) {
  localStorage.setItem(flashKey(), JSON.stringify((Array.isArray(items) ? items : []).slice(0, MAX_FLASH_DECKS)));
}

function getSavedQuestions() {
  try {
    const raw = localStorage.getItem(savedKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSavedQuestions(items) {
  localStorage.setItem(savedKey(), JSON.stringify((Array.isArray(items) ? items : []).slice(0, MAX_SAVED_ITEMS)));
}

function addSavedQuestion(item) {
  if (!item?.question) return false;
  const list = getSavedQuestions();
  const exists = list.some((saved) => saved.question === item.question && saved.correct === item.correct);
  if (exists) return false;
  list.unshift({
    question: item.question,
    correct: item.correct || "",
    explanation: item.explanation || "",
    image: item.image || null,
    createdAt: new Date().toISOString()
  });
  saveSavedQuestions(list);
  if (isLoggedIn()) {
    cloudRequest("/data/saved-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
  }
  return true;
}

function getBonusXp() {
  try {
    const raw = localStorage.getItem(bonusXpKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return Math.max(0, Number(parsed?.total || 0));
  } catch {
    return 0;
  }
}

function getChallengeProgress() {
  try {
    const raw = localStorage.getItem(challengeKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      completed: Array.isArray(parsed?.completed) ? parsed.completed : [],
      rewards: Array.isArray(parsed?.rewards) ? parsed.rewards : []
    };
  } catch {
    return { completed: [], rewards: [] };
  }
}

function getMiniGameStats() {
  try {
    const raw = localStorage.getItem(miniGameKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      memoryWins: Math.max(0, Number(parsed?.memoryWins || 0)),
      memoryBestMoves: Math.max(0, Number(parsed?.memoryBestMoves || 0)),
      memoryBestTime: Math.max(0, Number(parsed?.memoryBestTime || 0)),
      reactionBest: Math.max(0, Number(parsed?.reactionBest || 0)),
      reactionRuns: Math.max(0, Number(parsed?.reactionRuns || 0)),
      recallBestLevel: Math.max(0, Number(parsed?.recallBestLevel || 0)),
      recallRuns: Math.max(0, Number(parsed?.recallRuns || 0))
    };
  } catch {
    return { memoryWins: 0, memoryBestMoves: 0, memoryBestTime: 0, reactionBest: 0, reactionRuns: 0, recallBestLevel: 0, recallRuns: 0 };
  }
}

function saveMiniGameStats(stats) {
  localStorage.setItem(miniGameKey(), JSON.stringify({
    memoryWins: Math.max(0, Number(stats?.memoryWins || 0)),
    memoryBestMoves: Math.max(0, Number(stats?.memoryBestMoves || 0)),
    memoryBestTime: Math.max(0, Number(stats?.memoryBestTime || 0)),
    reactionBest: Math.max(0, Number(stats?.reactionBest || 0)),
    reactionRuns: Math.max(0, Number(stats?.reactionRuns || 0)),
    recallBestLevel: Math.max(0, Number(stats?.recallBestLevel || 0)),
    recallRuns: Math.max(0, Number(stats?.recallRuns || 0))
  }));
}

function getSessionActivity() {
  try {
    const raw = localStorage.getItem(sessionActivityKey());
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

function formatShortDate(isoValue) {
  const dt = new Date(isoValue);
  if (Number.isNaN(dt.getTime())) return "Unknown time";
  return dt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getTrend(entries) {
  if (entries.length < 2) return { delta: 0, label: "No trend yet" };
  const latest = entries[0].percentage || 0;
  const previous = entries[1].percentage || 0;
  const delta = latest - previous;
  if (delta > 0) return { delta, label: `Up ${delta}% vs last attempt` };
  if (delta < 0) return { delta, label: `Down ${Math.abs(delta)}% vs last attempt` };
  return { delta: 0, label: "Stable vs last attempt" };
}

function getStreak(entries) {
  let streak = 0;
  for (const item of entries) {
    if ((item.percentage || 0) >= 70) streak += 1;
    else break;
  }
  return streak;
}

function getBandLabel(score) {
  if (score >= 90) return "Mastery";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Growing";
  return "Recovery";
}

function getFeedback(entries) {
  if (!entries.length) return "Start a quiz to unlock personalized feedback.";
  const latest = entries[0];
  const avg = Math.round(entries.reduce((sum, e) => sum + (e.percentage || 0), 0) / entries.length);
  const wrong = (latest.answers || []).filter((a) => !a.isCorrect);
  const shortWrong = wrong.filter((a) => a.type === "short").length;
  const mcqWrong = wrong.filter((a) => a.type === "mcq").length;

  if (avg >= 85) return "Great momentum. Try Super difficulty to keep stretching your recall and reasoning.";
  if (shortWrong > mcqWrong) return "Focus on short-answer precision and keyword recall with flashcards.";
  if (mcqWrong > shortWrong) return "Focus on option elimination and reviewing wrong-answer explanations.";
  return "Consistency is improving. Rotate mixed and short mode for better retention.";
}

async function cloudRequest(path, options = {}) {
  const token = getAuthToken();
  if (!token) return { ok: false, error: "No session token" };
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: data.error || "Cloud request failed" };
  return { ok: true, data };
}

async function syncFromCloud() {
  if (!isLoggedIn()) return;
  if (localStorage.getItem("quizzy-debug-badges") === "true") console.debug("[Quizzy badges] fetching scoreboard bootstrap");
  const result = await cloudRequest("/data/bootstrap");
  if (!result.ok) return;
  const attempts = Array.isArray(result.data?.attempts) ? result.data.attempts : [];
  const savedQuestions = Array.isArray(result.data?.savedQuestions) ? result.data.savedQuestions : [];
  const flashDecks = Array.isArray(result.data?.flashDecks) ? result.data.flashDecks : [];
  cloudProfile = result.data?.profile || null;
  cloudLeaderboard = Array.isArray(result.data?.leaderboard) ? result.data.leaderboard : [];
  if (localStorage.getItem("quizzy-debug-badges") === "true") console.debug("[Quizzy badges] scoreboard API response", { achievements: cloudProfile?.achievements, attempts: attempts.length });
  saveHistory(attempts);
  saveSavedQuestions(savedQuestions);
  saveFlashDecks(flashDecks);
  if (result.data?.miniGameStats) saveMiniGameStats(result.data.miniGameStats);
  mergeBadgesFromSources(attempts, cloudProfile, cloudProfile?.achievements || []);
}

function renderAuthNav() {
  const session = auth?.getSession?.();
  if (!session) {
    authUser?.classList.add("hidden");
    logoutBtn?.classList.add("hidden");
    loginLink?.classList.remove("hidden");
    registerLink?.classList.remove("hidden");
    return;
  }
  authUser.textContent = `Hi, ${session.name}`;
  authUser?.classList.remove("hidden");
  logoutBtn?.classList.remove("hidden");
  loginLink?.classList.add("hidden");
  registerLink?.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugifyFilePart(value, fallback = "review") {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || fallback;
}

function buildAttemptReviewText(entry) {
  const answers = Array.isArray(entry?.answers) ? entry.answers : [];
  const lines = [
    `Quizzy Review Export`,
    `Date: ${formatShortDate(entry?.createdAt)}`,
    `Source: ${entry?.sourceType || "quiz"}`,
    `Score: ${entry?.score || 0}/${entry?.total || 0} (${entry?.percentage || 0}%)`,
    ``
  ];

  answers.forEach((item, index) => {
    lines.push(`Q${index + 1}. ${item?.question || "Untitled question"}`);
    lines.push(`Your answer: ${item?.selected || "Not answered"}`);
    lines.push(`Correct answer: ${item?.correct || "-"}`);
    lines.push(`Explanation: ${item?.explanation || item?.wrongExplanation || "No explanation saved."}`);
    lines.push(``);
  });

  return lines.join("\n");
}

function getAttemptSourceStatus(entry) {
  const sourceType = String(entry?.sourceType || "").toLowerCase();
  const sourceText = String(entry?.sourceText || "").trim();
  const sourceTopic = String(entry?.sourceTopic || "").trim();
  const sourceInput = String(entry?.sourceInput || "").trim();

  if (sourceText.length >= 20) {
    return {
      level: "ready",
      label: "Source ready",
      message: sourceType === "pdf"
        ? "The original extracted PDF text is available, so flashcards can be generated from the source material."
        : "The original source text is available, so flashcards can be generated directly from the source material."
    };
  }

  if (sourceType === "topic" && sourceInput) {
    return {
      level: "ready",
      label: "Topic ready",
      message: "This attempt was topic-based, so flashcards can be regenerated from the saved topic prompt."
    };
  }

  if (sourceType === "url" && sourceInput) {
    return {
      level: "limited",
      label: "URL refetch",
      message: "This attempt only kept the original URL, so the scoreboard has to re-fetch the page. It will work unless the page changed, moved, or now blocks access."
    };
  }

  if (sourceType === "pdf") {
    return {
      level: "missing",
      label: "Source missing",
      message: "This PDF attempt does not have the original extracted text anymore. That usually means it was created before source snapshots were saved, or its temporary quiz session expired after 6 hours. In that case the reviewer should understand the PDF itself is not available to rebuild source-based flashcards from this attempt alone."
    };
  }

  if (sourceInput || sourceTopic) {
    return {
      level: "limited",
      label: "Partial source",
      message: "This attempt kept only part of the original source, so regeneration may be limited."
    };
  }

  return {
    level: "missing",
    label: "Source missing",
    message: "This attempt was saved without enough original source data, so source-based flashcards cannot be regenerated from it."
  };
}

async function buildFlashcardPayloadFromAttempt(entry) {
  const settings = entry?.settings || {};
  const outputLanguage = settings.outputLanguage || "English";
  const learnerMode = settings.learnerMode || "student";
  const difficulty = settings.difficulty || "moderate";
  const sourceText = String(entry?.sourceText || "").trim();
  const sourceTopic = String(entry?.sourceTopic || "").trim();
  const sourceInput = String(entry?.sourceInput || "").trim();
  const sourceType = String(entry?.sourceType || "").trim().toLowerCase();

  if (sourceText.length >= 20) {
    return {
      text: sourceText,
      topic: sourceTopic || sourceInput || "Study material",
      difficulty,
      learnerMode,
      outputLanguage
    };
  }

  if (sourceType === "topic" && sourceInput) {
    return {
      topic: sourceInput,
      difficulty,
      learnerMode,
      outputLanguage
    };
  }

  if (sourceType === "url" && sourceInput) {
    const response = await fetch(`${API_BASE}/extract-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceInput })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not re-read the original URL.");
    return {
      text: data.text || "",
      topic: sourceInput,
      difficulty,
      learnerMode,
      outputLanguage
    };
  }

  if (sourceType === "pdf") {
    throw new Error("This PDF attempt no longer has the original extracted text. It was likely created before source snapshots were saved, or its temporary quiz session expired after 6 hours. Re-upload the PDF from Generate Quiz to rebuild source-based flashcards.");
  }

  if (sourceInput.length >= 20) {
    return {
      text: sourceInput,
      topic: sourceTopic || "Study material",
      difficulty,
      learnerMode,
      outputLanguage
    };
  }

  throw new Error("This attempt does not have enough original source data to generate full flashcards.");
}

async function generateFlashcardsFromAttemptSource(entry) {
  const payload = await buildFlashcardPayloadFromAttempt(entry);
  const response = await fetch(`${API_BASE}/generate-flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to generate flashcards from the original source.");
  const cards = Array.isArray(data?.flashcards) ? data.flashcards : [];
  if (!cards.length) throw new Error("No flashcards were returned from the source material.");

  return {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    sourceType: entry?.sourceType || "text",
    title: (entry?.sourceTopic || entry?.sourceInput || "Study Deck").slice(0, 90),
    flashcards: cards
  };
}

function applySavedTheme() {
  document.body.classList.add("dark");
}

function renderProgressExtras(entries) {
  const badges = resolvePersistentBadges(entries, cloudProfile);
  const game = getGamification(entries);
  const unlocked = badges.filter((badge) => badge.unlocked).length;

  return `
    <section class="panel flow-card badge-cabinet">
      <div class="evaluation-head" style="margin-bottom: 16px;">
        <div>
          <h3 style="font-size: 1.15rem; margin-bottom: 4px;">Badge Cabinet</h3>
          <p class="cabinet-note">Your full collection.</p>
        </div>
        <div class="cabinet-score" style="text-align: right;">
          <strong style="font-size: 1.25rem;">${unlocked}/${badges.length}</strong>
        </div>
      </div>
      <div class="badge-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
        ${badges.map((badge) => `
          <article class="badge-card ${badge.unlocked ? "is-unlocked" : "is-locked"} ${badge.rarity}" style="min-height: auto; padding: 12px;">
            <span class="badge-icon" style="width: 44px; height: 44px; margin-bottom: 8px;"><img src="${badge.icon}" alt="${badge.label}" loading="lazy" style="width: 24px; height: 24px;" /></span>
            <strong style="font-size: 0.9rem;">${badge.label}</strong>
            <small style="display: block; font-size: 0.75rem; line-height: 1.4; margin-top: 4px;">${badge.unlocked ? `Unlocked` : badge.hint}</small>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="panel flow-card mini-games-shell">
      <div class="evaluation-head" style="margin-bottom: 16px;">
        <div>
          <h3 style="font-size: 1.15rem; margin-bottom: 4px;">Mini-Game Stats</h3>
          <p class="cabinet-note">A snapshot of arcade progress.</p>
        </div>
      </div>
      <div class="evaluation-stats" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
        <div class="stat-box"><p>Memory Wins</p><h4>${game.gameStats.memoryWins}</h4></div>
        <div class="stat-box"><p>Best Moves</p><h4>${game.gameStats.memoryBestMoves || "--"}</h4></div>
        <div class="stat-box"><p>Reaction Best</p><h4>${game.gameStats.reactionBest ? `${game.gameStats.reactionBest}ms` : "--"}</h4></div>
        <div class="stat-box"><p>Recall Best</p><h4>${game.gameStats.recallBestLevel || "--"}</h4></div>
      </div>
    </section>
  `;
}

function getLeaderboardBadges(player) {
  const ids = Array.isArray(player?.achievements) ? player.achievements : [];
  const mapped = ids.map((id) => ({
    first_quiz: "starter",
    streak_3: "streak",
    perfect_score: "perfect-shot",
    quiz_master: "scholar",
    xp_500: "xp-hunter",
    flash_fan: "flash-fan",
    memory_master: "memory-master",
    speedster: "speedster"
  }[id] || id));
  return getSharedBadgeCatalog([], { ...player, achievements: ids })
    .map((badge) => ({ ...badge, unlocked: badge.unlocked || mapped.includes(badge.id) }))
    .filter((badge) => badge.unlocked)
    .slice(0, 4);
}

function getVisibleLeaderboard() {
  const session = auth?.getSession?.();
  const currentEmail = session?.email || session?.user?.email || "";
  const query = leaderboardSearch.trim().toLowerCase();
  const scoped = cloudLeaderboard.filter((player) => {
    if (leaderboardFilter === "friends") return player.email === currentEmail;
    return true;
  });
  const searched = query
    ? scoped.filter((player) => String(player.name || "").toLowerCase().includes(query) || String(player.email || "").toLowerCase().includes(query))
    : scoped;
  const sorters = {
    xp: (a, b) => Number(b.totalXp || 0) - Number(a.totalXp || 0),
    accuracy: (a, b) => Number(b.accuracy || b.bestPercentage || 0) - Number(a.accuracy || a.bestPercentage || 0),
    streak: (a, b) => Number(b.currentStreak || 0) - Number(a.currentStreak || 0),
    quizzes: (a, b) => Number(b.totalQuizzes || 0) - Number(a.totalQuizzes || 0),
    score: (a, b) => Number(b.leaderboardScore || 0) - Number(a.leaderboardScore || 0)
  };
  return [...searched].sort(sorters[leaderboardSort] || sorters.score).map((player, index) => ({ ...player, displayRank: index + 1 }));
}

function renderBoard() {
  const entries = getHistory();
  activeReviewAttemptIndex = Math.max(0, Math.min(activeReviewAttemptIndex, Math.max(0, entries.length - 1)));
  const reviewEntry = entries[activeReviewAttemptIndex] || entries[0] || null;
  const reviewAnswers = Array.isArray(reviewEntry?.answers) ? reviewEntry.answers : [];
  const sourceStatus = getAttemptSourceStatus(reviewEntry);
  const flashDecks = getFlashDecks();
  const savedQuestions = getSavedQuestions();
  const visibleLeaderboard = getVisibleLeaderboard();
  const totalLeaderboardPages = Math.ceil(visibleLeaderboard.length / LEADERBOARD_PAGE_SIZE) || 1;
  currentLeaderboardPage = Math.max(1, Math.min(currentLeaderboardPage, totalLeaderboardPages));
  const paginatedLeaderboard = visibleLeaderboard.slice((currentLeaderboardPage - 1) * LEADERBOARD_PAGE_SIZE, currentLeaderboardPage * LEADERBOARD_PAGE_SIZE);

  const hasPodium = currentLeaderboardPage === 1 && visibleLeaderboard.length >= 3;
  const p1 = visibleLeaderboard[0] || {};
  const p2 = visibleLeaderboard[1] || {};
  const p3 = visibleLeaderboard[2] || {};

  const leaderboardMarkup = visibleLeaderboard.length
    ? `
      <section class="panel flow-card scoreboard-table-wrap esports-board">
        <div class="table-header-block leaderboard-tools-head">
          <div>
            <h3>Esports leaderboard</h3>
            <p>Search, filter, and inspect top Quizzy competitors.</p>
          </div>
          <button id="refreshBoardInlineBtn" class="ghost" type="button">Refresh</button>
        </div>
        <div class="leaderboard-controls">
          <div class="segmented-control" role="tablist">
            ${["weekly", "monthly", "all", "friends", "global"].map((item) => `<button class="${leaderboardFilter === item ? "active" : ""}" data-board-filter="${item}" type="button">${item}</button>`).join("")}
          </div>
          <input id="leaderboardSearch" class="leaderboard-search" type="search" value="${escapeHtml(leaderboardSearch)}" placeholder="Search player" />
          <select id="leaderboardSort" class="leaderboard-sort">
            <option value="score" ${leaderboardSort === "score" ? "selected" : ""}>Sort by score</option>
            <option value="xp" ${leaderboardSort === "xp" ? "selected" : ""}>Sort by XP</option>
            <option value="accuracy" ${leaderboardSort === "accuracy" ? "selected" : ""}>Sort by accuracy</option>
            <option value="streak" ${leaderboardSort === "streak" ? "selected" : ""}>Sort by streak</option>
            <option value="quizzes" ${leaderboardSort === "quizzes" ? "selected" : ""}>Sort by quizzes</option>
          </select>
        </div>

        ${hasPodium ? `
        <div class="podium-wrapper fade-in">
          <div class="podium-step rank-2">
            <div class="podium-avatar medal-silver">2</div>
            <div class="podium-name">${escapeHtml(p2.name || 'Player')}</div>
            <div class="podium-score">${p2.totalXp || 0} XP</div>
            <div class="podium-bar"></div>
          </div>
          <div class="podium-step rank-1">
            <div class="podium-avatar glow medal-gold">1</div>
            <div class="podium-name">${escapeHtml(p1.name || 'Player')}</div>
            <div class="podium-score">${p1.totalXp || 0} XP</div>
            <div class="podium-bar"></div>
          </div>
          <div class="podium-step rank-3">
            <div class="podium-avatar medal-bronze">3</div>
            <div class="podium-name">${escapeHtml(p3.name || 'Player')}</div>
            <div class="podium-score">${p3.totalXp || 0} XP</div>
            <div class="podium-bar"></div>
          </div>
        </div>
        ` : ""}

        <div class="compact-leaderboard-list custom-scrollbar">
          ${paginatedLeaderboard.map((player, idx) => {
            const rank = player.displayRank || player.rank || ((currentLeaderboardPage - 1) * LEADERBOARD_PAGE_SIZE + idx + 1);
            if (hasPodium && rank <= 3) return ""; 
            const rowBadges = getLeaderboardBadges(player);
            
            let rankIcon = `#${rank}`;
            if (rank === 1) rankIcon = "#1";
            if (rank === 2) rankIcon = "#2";
            if (rank === 3) rankIcon = "#3";

            return `
            <div class="lb-row fade-in" style="animation-delay: ${idx * 0.04}s">
              <div class="lb-rank ${rank <= 3 ? 'top-rank' : ''}">${rankIcon}</div>
              <div class="lb-details">
                <strong class="lb-name">${escapeHtml(player.name || "Player")}</strong>
                <span class="lb-meta">${player.totalXp} XP • 🔥 ${player.currentStreak}</span>
              </div>
              <div class="row-badges">${rowBadges.length ? rowBadges.map((badge) => `<img class="row-badge ${badge.rarity}" src="${badge.icon}" alt="${escapeHtml(badge.label)}" title="${escapeHtml(badge.label)}" loading="lazy" />`).join("") : `<span class="no-badges">No badges</span>`}</div>
              <div class="lb-score">${player.leaderboardScore || 0} <span style="font-size: 0.7rem; color: var(--muted); font-weight: normal; -webkit-text-fill-color: initial;">pts</span></div>
            </div>
          `}).join("")}
        </div>
        ${totalLeaderboardPages > 1 ? `
        <div class="lb-pagination">
          <button class="ghost leaderboard-prev-btn" style="min-height: 32px; padding: 0 12px; font-size: 0.8rem;" ${currentLeaderboardPage === 1 ? "disabled" : ""}>Prev</button>
          <span class="helper-text" style="font-size: 0.8rem;">${currentLeaderboardPage} / ${totalLeaderboardPages}</span>
          <button class="ghost leaderboard-next-btn" style="min-height: 32px; padding: 0 12px; font-size: 0.8rem;" ${currentLeaderboardPage === totalLeaderboardPages ? "disabled" : ""}>Next</button>
        </div>
        ` : ""}
      </section>
    `
    : `<div class="panel flow-card empty-state" style="padding: 32px; text-align: center;">
         <h3 style="font-size: 1.2rem; margin-bottom: 8px;">No Leaderboard Data</h3>
         <p style="color: var(--muted); font-size: 0.9rem;">Be the first to get on the board!</p>
       </div>`;

  if (!entries.length) {
    scoreboardContent.innerHTML = `
      <div class="panel flow-card evaluation-empty">
        <h3>No Data Yet</h3>
        <p>${isLoggedIn() ? "Take at least one quiz from the home page to populate your scoreboard." : "Log in or register first, then your quiz and arcade progress will start saving here."}</p>
      </div>
      ${cloudProfile ? `<div class="panel flow-card"><h3>Cloud Profile</h3><p>Total Points: ${cloudProfile.totalPoints || 0} | Total XP: ${cloudProfile.totalXp || 0} | Best Streak: ${cloudProfile.bestStreak || 0}</p></div>` : ""}
      ${leaderboardMarkup}
      ${renderProgressExtras(entries)}
    `;
    return;
  }

  const latest = entries[0]?.percentage || 0;
  const avg = Math.round(entries.reduce((sum, e) => sum + (e.percentage || 0), 0) / entries.length);
  const best = Math.max(...entries.map((e) => e.percentage || 0));
  const trend = getTrend(entries);
  const streak = getStreak(entries);
  const chartData = entries.slice(0, 10).reverse();
  const recent = entries.slice(0, 12);
  const game = getGamification(entries);

  scoreboardContent.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; align-items: start;">
      <!-- Column 1: Performance & Stats -->
      <div style="display: grid; gap: 24px; align-content: start;">
        <div class="panel flow-card">
          <div class="score-hero">
            <div class="score-ring" style="--p:${latest}">
              <strong>${latest}%</strong>
              <span>Latest</span>
            </div>
            <div class="score-meta">
              <div class="meta-chip">${getBandLabel(latest)}</div>
              <div class="meta-chip muted">Avg ${avg}%</div>
              <div class="meta-chip muted">Best ${best}%</div>
              <div class="meta-chip muted">Lvl ${game.level}</div>
              <div class="meta-chip ${trend.delta > 0 ? "up" : trend.delta < 0 ? "down" : "flat"}">${trend.label}</div>
            </div>
          </div>
          <div class="score-spark" style="margin-top: 24px;">
            ${chartData.map((e, i) => `
              <div class="spark-col" title="Attempt ${i + 1}: ${e.percentage}%">
                <div class="spark-bar" style="height:${Math.max(12, Math.min(100, e.percentage || 0))}%"></div>
                <span>${e.percentage}%</span>
              </div>
            `).join("")}
          </div>
          <div class="analysis-card" style="margin-top: 24px;">
            <strong>Feedback</strong>
            <p>${getFeedback(entries)}</p>
          </div>
          <div class="analysis-card" style="margin-top: 12px;">
            <strong>Gamification</strong>
            <p>${game.totalXp} XP earned. Level ${game.level} with ${game.progress}% progress to the next level.</p>
            <div class="xp-progress" style="margin: 12px 0;"><span style="width:${game.progress}%"></span></div>
            <p>${game.badges.length ? game.badges.map((badge) => badge.label).join(" | ") : "No badges unlocked yet."}</p>
          </div>
        </div>
        <div class="panel flow-card">
          <h3 style="margin-bottom: 16px; font-size: 1.15rem;">Quick Stats</h3>
          <div class="evaluation-stats" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
            <div class="stat-box"><p>Total XP</p><h4>${cloudProfile?.totalXp ?? game.totalXp}</h4></div>
            <div class="stat-box"><p>Points</p><h4>${cloudProfile?.totalPoints ?? 0}</h4></div>
            <div class="stat-box"><p>Level</p><h4>${game.level}</h4></div>
            <div class="stat-box"><p>Quizzes</p><h4>${entries.length}</h4></div>
            <div class="stat-box"><p>Streak</p><h4>${cloudProfile?.currentStreak ?? streak}</h4></div>
            <div class="stat-box"><p>Best</p><h4>${best}%</h4></div>
          </div>
        </div>
      </div>
      <!-- Column 2: Review & Attempts -->
      <div style="display: grid; gap: 24px; align-content: start;">
        <div class="panel flow-card">
          <div class="table-header-block">
            <h3>Question Review</h3>
            <p>Explanation and answer breakdown.</p>
          </div>
          <div class="attempt-review-rail">
            ${entries.slice(0, 10).map((entry, index) => `
              <button class="attempt-review-btn ${index === activeReviewAttemptIndex ? "active" : ""}" data-attempt-index="${index}" type="button" style="min-width: 100px;">
                <span>${formatShortDate(entry.createdAt).split(",")[0]}</span>
                <strong>${entry.percentage || 0}%</strong>
              </button>
            `).join("")}
          </div>
          <div class="review-rail">
            ${reviewAnswers.length
              ? reviewAnswers.map((answer, index) => `
                <button class="review-q-btn ${answer.isCorrect ? "good" : "bad"}" data-review-index="${index}" type="button">
                  Q${index + 1}
                </button>
              `).join("")
              : `<p class="cabinet-note">No question review is available for this attempt yet.</p>`}
          </div>
          <div id="reviewDetail" class="review-detail" style="margin-top: 16px;">
            ${reviewAnswers.length ? "Select a question to view the explanation." : "Question explanations will appear here after you complete a quiz."}
          </div>
        </div>

        <div class="panel flow-card">
          <div class="table-header-block">
            <h3>Review Tools</h3>
            <p>Study actions for the selected attempt.</p>
          </div>
          <div class="source-status-card ${sourceStatus.level}">
            <strong>${sourceStatus.label}</strong>
            <p>${sourceStatus.message}</p>
          </div>
          <div class="scoreboard-tool-actions">
            <button id="saveAttemptQuestionsBtn" class="ghost" type="button" ${reviewAnswers.length ? "" : "disabled"} style="flex:1;">Save Qs</button>
            <button id="generateAttemptFlashcardsBtn" class="ghost" type="button" ${reviewEntry ? "" : "disabled"} style="flex:1;">Flashcards</button>
          </div>
          <div class="scoreboard-tool-actions" style="margin-top: 12px;">
            <button id="downloadReviewBtn" class="ghost" type="button" ${reviewAnswers.length ? "" : "disabled"} style="flex:1;">DL Review</button>
            <button id="downloadFlashcardsBtn" class="ghost" type="button" ${flashDecks.length ? "" : "disabled"} style="flex:1;">DL Cards</button>
          </div>
        </div>

        <section class="panel flow-card">
          <div class="table-header-block" style="margin-bottom: 12px;">
            <h3>Recent Attempts</h3>
            <p>Your latest runs.</p>
          </div>
          <div class="dashboard-list" style="max-height: 380px;">
            ${recent.map((e) => `
              <div class="answer-option compact-row" style="padding: 12px; align-items: center; gap: 12px;">
                <div class="score-tile">
                  <span style="font-size:0.7rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em;">Score</span>
                  <strong style="color:var(--text); font-size:1.15rem;">${e.percentage}%</strong>
                </div>
                <div>
                  <div style="color:var(--text); font-weight:600; font-size:0.9rem;">${e.score}/${e.total} Correct</div>
                  <div class="helper-text" style="margin-top:2px;">${formatShortDate(e.createdAt)} • ${(e.settings?.difficulty || "mod").toUpperCase()}</div>
                </div>
              </div>
            `).join("")}
          </div>
        </section>
      </div>

      <!-- Column 3: Leaderboard & Games -->
      <div style="display: grid; gap: 24px; align-content: start;">
        ${leaderboardMarkup}
        ${renderProgressExtras(entries)}
      </div>
    </div>
  `;

  const detailNode = document.getElementById("reviewDetail");
  const renderReviewDetail = (idx) => {
    const item = reviewAnswers[idx];
    if (!item || !detailNode) return;
    const selectedText = escapeHtml(item.selected || "Not answered");
    const correctText = escapeHtml(item.correct || "-");
    const explanation = escapeHtml(item.explanation || item.wrongExplanation || "No explanation saved.");
    const questionText = escapeHtml(item.question || `Question ${idx + 1}`);
    const imageBlock = item.image && /^https:\/\/upload\.wikimedia\.org\/.+\.(png|jpg)$/i.test(item.image)
      ? `<div class="explain-image-wrap"><img class="explain-image" src="${item.image}" alt="Review visual" loading="lazy" onerror="this.closest('.explain-image-wrap')?.remove()" /></div>`
      : "";

    detailNode.innerHTML = `
      <p><strong>${questionText}</strong></p>
      <p>Your answer: ${selectedText}</p>
      <p>Correct answer: ${correctText}</p>
      <p>${explanation}</p>
      ${imageBlock}
    `;
  };

  document.querySelector(".leaderboard-prev-btn")?.addEventListener("click", () => {
    if (currentLeaderboardPage > 1) {
      currentLeaderboardPage -= 1;
      renderBoard();
    }
  });

  document.querySelector(".leaderboard-next-btn")?.addEventListener("click", () => {
    if (currentLeaderboardPage < totalLeaderboardPages) {
      currentLeaderboardPage += 1;
      renderBoard();
    }
  });

  document.querySelectorAll("[data-board-filter]").forEach((btnNode) => {
    btnNode.addEventListener("click", () => {
      leaderboardFilter = btnNode.dataset.boardFilter || "all";
      currentLeaderboardPage = 1;
      renderBoard();
    });
  });

  document.getElementById("leaderboardSearch")?.addEventListener("input", (event) => {
    leaderboardSearch = event.target.value || "";
    currentLeaderboardPage = 1;
    renderBoard();
  });

  document.getElementById("leaderboardSort")?.addEventListener("change", (event) => {
    leaderboardSort = event.target.value || "score";
    currentLeaderboardPage = 1;
    renderBoard();
  });

  document.getElementById("refreshBoardInlineBtn")?.addEventListener("click", async () => {
    await syncFromCloud();
    renderBoard();
  });

  document.querySelectorAll(".attempt-review-btn").forEach((btnNode) => {
    btnNode.addEventListener("click", () => {
      activeReviewAttemptIndex = Number(btnNode.dataset.attemptIndex || 0);
      renderBoard();
    });
  });

  document.querySelectorAll(".review-q-btn").forEach((btnNode) => {
    btnNode.addEventListener("click", () => {
      renderReviewDetail(Number(btnNode.dataset.reviewIndex || 0));
    });
  });

  document.getElementById("saveAttemptQuestionsBtn")?.addEventListener("click", () => {
    let savedCount = 0;
    reviewAnswers.forEach((item) => {
      const didSave = addSavedQuestion({
        question: item.question || "",
        correct: item.correct || "",
        explanation: item.explanation || item.wrongExplanation || "",
        image: item.image || null
      });
      if (didSave) savedCount += 1;
    });
    renderBoard();
    const refreshedDetailNode = document.getElementById("reviewDetail");
    if (refreshedDetailNode) {
      refreshedDetailNode.insertAdjacentHTML("afterbegin", `<p><strong>${savedCount ? `Saved ${savedCount} question(s).` : "Questions were already saved."}</strong></p>`);
    }
  });

  document.getElementById("generateAttemptFlashcardsBtn")?.addEventListener("click", () => {
    if (!reviewEntry) return;
    const button = document.getElementById("generateAttemptFlashcardsBtn");
    if (button) {
      button.disabled = true;
      button.textContent = "Generating...";
    }

    generateFlashcardsFromAttemptSource(reviewEntry)
      .then((deck) => {
        const decks = getFlashDecks();
        decks.unshift(deck);
        saveFlashDecks(decks);
        if (isLoggedIn()) {
          cloudRequest("/data/flash-decks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deck)
          });
        }
        renderBoard();
        const refreshedDetailNode = document.getElementById("reviewDetail");
        if (refreshedDetailNode) {
          refreshedDetailNode.insertAdjacentHTML("afterbegin", `<p><strong>Flashcards generated from the original source.</strong></p>`);
        }
      })
      .catch((error) => {
        const refreshedDetailNode = document.getElementById("reviewDetail");
        if (refreshedDetailNode) {
          refreshedDetailNode.insertAdjacentHTML("afterbegin", `<p><strong>${escapeHtml(error.message || "Could not generate flashcards.")}</strong></p>`);
        }
      })
      .finally(() => {
        const refreshedButton = document.getElementById("generateAttemptFlashcardsBtn");
        if (refreshedButton) {
          refreshedButton.disabled = false;
          refreshedButton.textContent = "Generate Flashcards";
        }
      });
  });

  document.getElementById("downloadReviewBtn")?.addEventListener("click", () => {
    if (!reviewEntry) return;
    const filePart = slugifyFilePart(reviewEntry.sourceInput || reviewEntry.sourceType || "review", "review");
    downloadTextFile(`quizzy-review-${filePart}.txt`, buildAttemptReviewText(reviewEntry));
  });

  document.getElementById("downloadFlashcardsBtn")?.addEventListener("click", () => {
    const latestDeck = getFlashDecks()[0];
    if (!latestDeck) return;
    const filePart = slugifyFilePart(latestDeck.title || "flashcards", "flashcards");
    downloadTextFile(`quizzy-flashcards-${filePart}.json`, JSON.stringify(latestDeck, null, 2), "application/json;charset=utf-8");
  });

  if (reviewAnswers.length) renderReviewDetail(0);
}

async function clearHistory() {
  saveHistory([]);
  if (isLoggedIn()) {
    await cloudRequest("/data/attempts", { method: "DELETE" });
    await syncFromCloud();
  }
  renderBoard();
}

refreshBoardBtn?.addEventListener("click", async () => {
  await syncFromCloud();
  renderBoard();
});

clearBoardBtn?.addEventListener("click", clearHistory);
logoutBtn?.addEventListener("click", () => auth?.logout());

async function bootstrap() {
  if (auth) await auth.me();
  await syncFromCloud();
  renderAuthNav();
  renderBoard();
}

applySavedTheme();
bootstrap();
