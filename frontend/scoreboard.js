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
const MAX_HISTORY_ITEMS = 20;

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

function getGamification(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const latest = list[0] || null;
  const totalXp = list.reduce((sum, entry) => sum + getAttemptXp(entry), 0);
  const streak = getStreak(list);
  const best = list.length ? Math.max(...list.map((entry) => Number(entry.percentage || 0))) : 0;
  const badges = [
    { id: "starter", label: "Starter", icon: "Spark", unlocked: list.length >= 1 },
    { id: "streak", label: "Hot Streak", icon: "Flame", unlocked: streak >= 3 },
    { id: "scholar", label: "Scholar", icon: "Crown", unlocked: best >= 90 },
    { id: "grinder", label: "Consistency", icon: "Orbit", unlocked: list.length >= 5 },
    { id: "legend", label: "Quiz Legend", icon: "Nova", unlocked: totalXp >= 600 }
  ].filter((badge) => badge.unlocked);

  return {
    totalXp,
    level: getLevelFromXp(totalXp),
    progress: getLevelProgress(totalXp),
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

function renderBoard() {
  const entries = getHistory();
  if (!entries.length) {
    scoreboardContent.innerHTML = `
      <div class="card evaluation-empty">
        <h3>No Data Yet</h3>
        <p>Take at least one quiz from the home page to populate your scoreboard.</p>
      </div>
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
          <p>${game.badges.length ? game.badges.map((badge) => `${badge.icon} ${badge.label}`).join(" | ") : "No badges unlocked yet."}</p>
        </div>
      </div>
      <div class="card">
        <h3>Quick Stats</h3>
        <div class="evaluation-stats">
          <div class="card"><p>Total XP</p><h4>${game.totalXp}</h4></div>
          <div class="card"><p>Level</p><h4>${game.level}</h4></div>
          <div class="card"><p>Total Quizzes</p><h4>${entries.length}</h4></div>
          <div class="card"><p>Current Streak</p><h4>${streak}</h4></div>
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
