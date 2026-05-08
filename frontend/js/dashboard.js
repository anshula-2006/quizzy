import auth from "../auth.js";
import { getFlashDecks, getMiniGameStats, getSavedQuizHistory, saveFlashDecks, setMiniGameStats, apiRequest, escapeHtml } from "./shared.js";
import { getAttemptXp, getGamificationSummary, getResolvedBadges, getStreak, mergeBadgesFromSources } from "./gamification.js";

const root = document.getElementById("dashboardRoot");
const SESSION_KEY = "quizzy-session-v2";

let dashboardState = {
  attempts: [],
  flashDecks: [],
  miniGameStats: {},
  profile: null,
  leaderboard: [],
  loading: true
};
let activeDashboardTab = "analytics";

function getAuthToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.token || "";
  } catch {
    return "";
  }
}

function isLoggedIn() {
  return Boolean(getAuthToken());
}

function formatDate(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Unknown";
  return dt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function averageScore(attempts) {
  return attempts.length ? Math.round(attempts.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / attempts.length) : 0;
}

function getRank(profile, leaderboard) {
  const session = auth?.getSession?.();
  const email = session?.email || session?.user?.email;
  const found = leaderboard.find((player) => player.email === email);
  return found?.rank || profile?.rank || "--";
}

function getCategoryStats(attempts) {
  const buckets = new Map();
  attempts.forEach((entry) => {
    const label = entry?.settings?.difficulty || entry?.sourceType || "general";
    const current = buckets.get(label) || { label, count: 0, total: 0 };
    current.count += 1;
    current.total += Number(entry.percentage || 0);
    buckets.set(label, current);
  });
  return [...buckets.values()].map((item) => ({ ...item, average: item.count ? Math.round(item.total / item.count) : 0 }));
}

function getInsights(attempts, badges, profile) {
  const categoryStats = getCategoryStats(attempts);
  const strongest = categoryStats.length ? [...categoryStats].sort((a, b) => b.average - a.average)[0] : null;
  const weakest = categoryStats.length ? [...categoryStats].sort((a, b) => a.average - b.average)[0] : null;
  const streak = Math.max(getStreak(attempts), Number(profile?.currentStreak || 0));
  const avg = averageScore(attempts);

  return [
    { label: "Strongest lane", value: strongest ? `${strongest.label} at ${strongest.average}%` : "Play one quiz to calibrate", tone: "good" },
    { label: "Improve next", value: weakest && weakest.average < 80 ? `Replay ${weakest.label} for fast gains` : "Increase question count or difficulty", tone: "warn" },
    { label: "Consistency", value: streak ? `${streak} scoring run${streak === 1 ? "" : "s"} at 70%+` : "Build your first streak", tone: "info" },
    { label: "Badge chase", value: badges.find((badge) => !badge.unlocked)?.hint || "Collection complete for now", tone: "rare" },
    { label: "Performance read", value: avg >= 85 ? "High accuracy. Push Super mode." : avg >= 70 ? "Solid base. Review misses." : "Start with shorter sets.", tone: "info" }
  ];
}

function getWeeklyData(attempts) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString([], { weekday: "short" }), score: 0, xp: 0, count: 0 };
  });
  const lookup = new Map(days.map((day) => [day.key, day]));
  attempts.forEach((entry) => {
    const key = new Date(entry.createdAt).toISOString().slice(0, 10);
    const day = lookup.get(key);
    if (!day) return;
    day.score += Number(entry.percentage || 0);
    day.xp += getAttemptXp(entry);
    day.count += 1;
  });
  return days.map((day) => ({ ...day, score: day.count ? Math.round(day.score / day.count) : 0 }));
}

function renderSkeleton() {
  root.className = "dashboard-platform-shell";
  root.innerHTML = `
    <aside class="dash-sidebar panel skeleton-panel"></aside>
    <main class="dash-main">
      <div class="dash-topbar panel skeleton-panel"></div>
      <div class="hero-stats-grid">${Array.from({ length: 8 }, () => `<div class="analytics-card skeleton-panel"></div>`).join("")}</div>
      <div class="analytics-grid"><div class="chart-card panel skeleton-panel"></div><div class="chart-card panel skeleton-panel"></div></div>
    </main>
  `;
}

function statCard(label, value, helper, icon, accent = "violet", trend = "Live") {
  return `
    <article class="analytics-card stat-card-premium accent-${accent}">
      <div class="stat-orb">${icon}</div>
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${helper}</small>
      <em>${trend}</em>
    </article>
  `;
}

function renderLineChart(data) {
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = 92 - Math.max(0, Math.min(100, item.score));
    return `${x},${y}`;
  }).join(" ");
  return `
    <svg class="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Weekly performance line graph">
      <defs>
        <linearGradient id="lineGlow" x1="0" x2="1">
          <stop offset="0%" stop-color="#22d3ee" />
          <stop offset="100%" stop-color="#a78bfa" />
        </linearGradient>
      </defs>
      <polyline points="${points}" fill="none" stroke="url(#lineGlow)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${data.map((item, index) => {
        const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
        const y = 92 - Math.max(0, Math.min(100, item.score));
        return `<circle cx="${x}" cy="${y}" r="2.2" />`;
      }).join("")}
    </svg>
    <div class="chart-axis">${data.map((item) => `<span>${item.label}</span>`).join("")}</div>
  `;
}

function renderDashboard(data) {
  dashboardState = { ...data, loading: false };
  const attempts = Array.isArray(data?.attempts) ? data.attempts : [];
  const flashDecks = Array.isArray(data?.flashDecks) ? data.flashDecks : [];
  const mini = data?.miniGameStats || {};
  const profile = data?.profile || null;
  const leaderboard = Array.isArray(data?.leaderboard) ? data.leaderboard : [];
  const game = getGamificationSummary(attempts, profile);
  const badges = getResolvedBadges(attempts, profile);
  const unlockedBadges = badges.filter((badge) => badge.unlocked);
  const weekly = getWeeklyData(attempts);
  const avg = averageScore(attempts);
  const best = attempts.length ? Math.max(...attempts.map((entry) => Number(entry.percentage || 0))) : Number(profile?.bestPercentage || 0);
  const rank = getRank(profile, leaderboard);
  const cardCount = flashDecks.reduce((sum, deck) => sum + (Array.isArray(deck.flashcards) ? deck.flashcards.length : 0), 0);
  const recent = attempts.slice(0, 6);
  const categoryStats = getCategoryStats(attempts);
  const insights = getInsights(attempts, badges, profile);
  const topFive = leaderboard.slice(0, 5);

  root.className = "dashboard-platform-shell page-fade";
  root.innerHTML = `
    <aside class="dash-sidebar panel">
      <a class="side-brand" href="./index.html"><span class="brand-badge">Q</span><strong>Quizzy</strong></a>
      <nav class="side-nav">
        <a class="active" href="./dashboard.html">Dashboard</a>
        <a href="./generate.html">Generate</a>
        <a href="./flashcards.html">Flashcards</a>
        <a href="./scoreboard.html">Leaderboard</a>
        <a href="./arcade.html">Arcade</a>
      </nav>
      <div class="side-progress">
        <span>Level ${game.level}</span>
        <strong>${game.totalXp} XP</strong>
        <div class="xp-progress"><span style="width:${game.progress}%"></span></div>
      </div>
    </aside>

    <main class="dash-main">
      <header class="dash-topbar panel">
        <button class="mobile-menu-btn" type="button" aria-label="Toggle sidebar">Menu</button>
        <label class="dash-search"><span>Search</span><input type="search" placeholder="Search quizzes, badges, rivals..." /></label>
        <div class="topbar-cluster">
          <span class="quick-pill">${game.totalXp} XP</span>
          <span class="quick-pill">${game.streak} streak</span>
          <button class="icon-btn" type="button" title="Notifications">!</button>
          <div class="avatar-chip"><span>${escapeHtml((auth?.getSession?.()?.name || "Q").slice(0, 1).toUpperCase())}</span><strong>${escapeHtml(auth?.getSession?.()?.name || "Player")}</strong></div>
        </div>
      </header>

      <section class="dashboard-command panel">
        <div>
          <p class="eyebrow">Command center</p>
          <h1>Competitive quiz analytics</h1>
          <p>Track XP velocity, accuracy, streak pressure, badges, and study momentum from one polished cockpit.</p>
        </div>
        <div class="dashboard-actions">
          <a class="btn" href="./generate.html">New Quiz</a>
          <a class="btn-outline" href="./scoreboard.html">View Leaderboard</a>
        </div>
      </section>

      <section class="hero-stats-grid">
        ${statCard("Quizzes", attempts.length || Number(profile?.totalQuizzes || 0), "total attempts", "QZ", "cyan", recent.length ? "Active" : "Ready")}
        ${statCard("Total XP", game.totalXp, `Level ${game.level}`, "XP", "violet", `+${game.latestXp} latest`)}
        ${statCard("Accuracy", `${avg}%`, `${best}% best`, "AC", "g