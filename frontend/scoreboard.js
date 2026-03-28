import API_BASE from "./src/config.js";
import auth from "./auth.js";

const authUser = document.getElementById("authUser");
const loginLink = document.getElementById("loginLink");
const registerLink = document.getElementById("registerLink");
const logoutBtn = document.getElementById("logoutBtn");
const toggle = document.getElementById("themeToggle");
const scoreboardContent = document.getElementById("scoreboardContent");
const refreshBoardBtn = document.getElementById("refreshBoardBtn");
const clearBoardBtn = document.getElementById("clearBoardBtn");

const HISTORY_BASE = "quizzy-history-v2";
const FLASH_BASE = "quizzy-flash-v1";
const BONUS_XP_BASE = "quizzy-bonus-xp-v1";
const CHALLENGE_BASE = "quizzy-challenges-v1";
const MINI_GAME_BASE = "quizzy-mini-games-v1";
const SESSION_ACTIVITY_BASE = "quizzy-session-activity-v1";
const MAX_HISTORY_ITEMS = 20;
let cloudProfile = null;
let cloudLeaderboard = [];

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
  return `assets/badges/${rarity}/${filename}`;
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
    { id: "speedster", label: "Speedster", icon: getBadgeImagePath("silver", "speedster.png"), rarity: "silver", unlocked: Number(gameStats.speedBest || 0) >= 4, hint: "Get 4 right in Speed Round." },
    { id: "xp-hunter", label: "XP Hunter", icon: getBadgeImagePath("silver", "xp_hunter.png"), rarity: "silver", unlocked: bonusXp >= 300, hint: "Earn 300 bonus XP from games and missions." },
    { id: "challenge-crusher", label: "Challenge Crusher", icon: getBadgeImagePath("gold", "challenge_crusher.png"), rarity: "gold", unlocked: completedChallenges >= 3, hint: "Complete 3 XP missions." },
    { id: "comeback-kid", label: "Comeback Kid", icon: getBadgeImagePath("silver", "comeback_kid.png"), rarity: "silver", unlocked: hasComeback(list), hint: "Improve by 20% from one quiz to the next." },
    { id: "night-owl", label: "Night Owl", icon: getBadgeImagePath("bronze", "night_owl.png"), rarity: "bronze", unlocked: getNightOwlCount(list) >= 3, hint: "Complete 3 quizzes late at night." },
    { id: "brain-blaster", label: "Brain Blaster", icon: getBadgeImagePath("gold", "brain_blaster.png"), rarity: "gold", unlocked: superCount >= 1, hint: "Finish a Super difficulty quiz." },
    { id: "study-ninja", label: "Study Ninja", icon: getBadgeImagePath("special", "study_ninja.png"), rarity: "special", unlocked: sessionActivity.quizDone && sessionActivity.flashcardsDone && sessionActivity.miniGameDone, hint: "Do a quiz, flashcards, and a mini-game in one session." }
  ];
}

function getGamification(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const latest = list[0] || null;
  const bonusXp = getBonusXp();
  const gameStats = getMiniGameStats();
  const quizXp = list.reduce((sum, entry) => sum + getAttemptXp(entry), 0);
  const totalXp = quizXp + bonusXp;
  const streak = getStreak(list);
  const best = list.length ? Math.max(...list.map((entry) => Number(entry.percentage || 0))) : 0;
  const badges = getBadgeCatalog(list).filter((badge) => badge.unlocked);

  return {
    totalXp,
    quizXp,
    bonusXp,
    level: getLevelFromXp(totalXp),
    progress: getLevelProgress(totalXp),
    streak,
    best,
    gameStats,
    badges,
    latestXp: latest ? getAttemptXp(latest) : 0
  };
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
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  localStorage.setItem(historyKey(), JSON.stringify(entries.slice(0, MAX_HISTORY_ITEMS)));
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
      speedBest: Math.max(0, Number(parsed?.speedBest || 0)),
      speedRuns: Math.max(0, Number(parsed?.speedRuns || 0)),
      memoryWins: Math.max(0, Number(parsed?.memoryWins || 0)),
      scrambleWins: Math.max(0, Number(parsed?.scrambleWins || 0)),
      trueFalseBest: Math.max(0, Number(parsed?.trueFalseBest || 0)),
      oddOneOutWins: Math.max(0, Number(parsed?.oddOneOutWins || 0))
    };
  } catch {
    return { speedBest: 0, speedRuns: 0, memoryWins: 0, scrambleWins: 0, trueFalseBest: 0, oddOneOutWins: 0 };
  }
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
  const result = await cloudRequest("/data/bootstrap");
  if (!result.ok) return;
  const attempts = Array.isArray(result.data?.attempts) ? result.data.attempts : [];
  cloudProfile = result.data?.profile || null;
  cloudLeaderboard = Array.isArray(result.data?.leaderboard) ? result.data.leaderboard : [];
  saveHistory(attempts);
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

function setThemeIcon() {
  toggle.textContent = document.body.classList.contains("dark") ? "Sun" : "Moon";
}

function renderProgressExtras(entries) {
  const badges = getBadgeCatalog(entries);
  const game = getGamification(entries);
  const unlocked = badges.filter((badge) => badge.unlocked).length;

  return `
    <section class="card badge-cabinet">
      <div class="evaluation-head">
        <div>
          <h3>Badge Cabinet</h3>
          <p class="cabinet-note">Your full collection of quiz, mission, and mini-game rewards.</p>
        </div>
        <div class="cabinet-score">
          <strong>${unlocked}/${badges.length}</strong>
          <span>badges unlocked</span>
        </div>
      </div>
      <div class="cabinet-meta">
        <div class="meta-chip">Quiz XP ${game.quizXp}</div>
        <div class="meta-chip">Bonus XP ${game.bonusXp}</div>
        <div class="meta-chip">Level ${game.level}</div>
        <div class="meta-chip">Challenges ${getChallengeProgress().completed.length}</div>
      </div>
      <div class="badge-grid">
        ${badges.map((badge) => `
          <article class="badge-card ${badge.unlocked ? "is-unlocked" : "is-locked"} ${badge.rarity}">
            <span class="badge-icon"><img src="${badge.icon}" alt="${badge.label}" loading="lazy" /></span>
            <strong>${badge.label}</strong>
            <small>${badge.unlocked ? `${badge.rarity.toUpperCase()} reward unlocked` : badge.hint}</small>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="card mini-games-shell">
      <div class="evaluation-head">
        <div>
          <h3>Mini-Game Stats</h3>
          <p class="cabinet-note">A snapshot of the fun side of your study progress.</p>
        </div>
      </div>
      <div class="evaluation-stats">
        <div class="card"><p>Speed Best</p><h4>${game.gameStats.speedBest}</h4></div>
        <div class="card"><p>Speed Runs</p><h4>${game.gameStats.speedRuns}</h4></div>
        <div class="card"><p>Memory Wins</p><h4>${game.gameStats.memoryWins}</h4></div>
        <div class="card"><p>Scramble Wins</p><h4>${game.gameStats.scrambleWins}</h4></div>
        <div class="card"><p>True/False Best</p><h4>${game.gameStats.trueFalseBest}</h4></div>
        <div class="card"><p>Odd One Out</p><h4>${game.gameStats.oddOneOutWins}</h4></div>
      </div>
      <div class="cabinet-meta">
        <div class="meta-chip">Study Ninja ${getSessionActivity().quizDone && getSessionActivity().flashcardsDone && getSessionActivity().miniGameDone ? "Unlocked" : "In progress"}</div>
        <div class="meta-chip">Flash Decks ${getFlashDecks().length}</div>
        <div class="meta-chip">Bonus XP ${game.bonusXp}</div>
      </div>
    </section>
  `;
}

function renderBoard() {
  const entries = getHistory();
  const leaderboardMarkup = cloudLeaderboard.length
    ? `
      <section class="card scoreboard-table-wrap">
        <h3>Leaderboard</h3>
        <div class="scoreboard-table">
          ${cloudLeaderboard.map((player) => `
            <div class="attempt-row">
              <span>#${player.rank} ${player.name}</span>
              <span>${player.leaderboardScore} pts</span>
              <span>${player.totalXp} XP | Streak ${player.currentStreak}</span>
            </div>
          `).join("")}
        </div>
      </section>
    `
    : "";

  if (!entries.length) {
    scoreboardContent.innerHTML = `
      <div class="card evaluation-empty">
        <h3>No Data Yet</h3>
        <p>Take at least one quiz from the home page to populate your scoreboard.</p>
      </div>
      ${cloudProfile ? `<div class="card"><h3>Cloud Profile</h3><p>Total Points: ${cloudProfile.totalPoints || 0} | Total XP: ${cloudProfile.totalXp || 0} | Best Streak: ${cloudProfile.bestStreak || 0}</p></div>` : ""}
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
    <section class="scoreboard-grid">
      <div class="card">
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
        <div class="score-spark">
          ${chartData.map((e, i) => `
            <div class="spark-col" title="Attempt ${i + 1}: ${e.percentage}%">
              <div class="spark-bar" style="height:${Math.max(12, Math.min(100, e.percentage || 0))}%"></div>
              <span>${e.percentage}%</span>
            </div>
          `).join("")}
        </div>
        <div class="analysis-card">
          <strong>Feedback</strong>
          <p>${getFeedback(entries)}</p>
        </div>
        <div class="analysis-card">
          <strong>Gamification</strong>
          <p>${game.totalXp} XP earned. Level ${game.level} with ${game.progress}% progress to the next level.</p>
          <div class="xp-progress"><span style="width:${game.progress}%"></span></div>
          <p>${game.badges.length ? game.badges.map((badge) => badge.label).join(" | ") : "No badges unlocked yet."}</p>
        </div>
      </div>
      <div class="card">
        <h3>Quick Stats</h3>
        <div class="evaluation-stats">
          <div class="card"><p>Total XP</p><h4>${cloudProfile?.totalXp ?? game.totalXp}</h4></div>
          <div class="card"><p>Total Points</p><h4>${cloudProfile?.totalPoints ?? 0}</h4></div>
          <div class="card"><p>Level</p><h4>${game.level}</h4></div>
          <div class="card"><p>Total Quizzes</p><h4>${entries.length}</h4></div>
          <div class="card"><p>Current Streak</p><h4>${cloudProfile?.currentStreak ?? streak}</h4></div>
          <div class="card"><p>Best Score</p><h4>${best}%</h4></div>
          <div class="card"><p>Average</p><h4>${avg}%</h4></div>
        </div>
      </div>
    </section>
    <section class="card scoreboard-table-wrap">
      <h3>Recent Attempts</h3>
      <div class="scoreboard-table">
        ${recent.map((e) => `
          <div class="attempt-row">
            <span>${formatShortDate(e.createdAt)}</span>
            <span>${e.score}/${e.total} (${e.percentage}%)</span>
            <span>${(e.settings?.difficulty || "moderate").toUpperCase()} | ${(e.settings?.questionMode || "mcq").toUpperCase()} | ${(e.settings?.outputLanguage || "English").toUpperCase()} | +${getAttemptXp(e)} XP</span>
          </div>
        `).join("")}
      </div>
    </section>
    ${leaderboardMarkup}
    ${renderProgressExtras(entries)}
  `;
}

async function clearHistory() {
  localStorage.removeItem(historyKey());
  if (isLoggedIn()) {
    await cloudRequest("/data/attempts", { method: "DELETE" });
  }
  renderBoard();
}

refreshBoardBtn?.addEventListener("click", async () => {
  await syncFromCloud();
  renderBoard();
});

clearBoardBtn?.addEventListener("click", clearHistory);
logoutBtn?.addEventListener("click", () => auth?.logout());

toggle.onclick = () => {
  document.body.classList.toggle("dark");
  setThemeIcon();
};

async function bootstrap() {
  if (auth) await auth.me();
  await syncFromCloud();
  renderAuthNav();
  renderBoard();
}

setThemeIcon();
bootstrap();
