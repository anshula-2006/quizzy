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

function statCard(label, value, helper) {
  return `
    <article class="saas-stat-card panel">
      <span class="saas-stat-label">${label}</span>
      <strong class="saas-stat-value">${value}</strong>
      <span class="saas-stat-helper">${helper}</span>
    </article>
  `;
}

function renderLineChart(data) {
  if (!data || !data.length) return `<div class="empty-state-mini" style="height: 190px; display: grid; place-items: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span>No data to chart</span></div>`;
  const maxScore = Math.max(...data.map(d => d.score), 10);
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = 92 - ((item.score / maxScore) * 84);
    return `${x},${y}`;
  }).join(" ");
  
  return `
    <div style="position: relative; height: 190px; margin-top: 18px;">
      <svg class="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Weekly performance line graph" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; filter: none; margin: 0;">
      <defs>
        <linearGradient id="lineGlow" x1="0" x2="1">
          <stop offset="0%" stop-color="#888" />
          <stop offset="100%" stop-color="#ededed" />
        </linearGradient>
      </defs>
        <polyline points="${points}" fill="none" stroke="url(#lineGlow)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      ${data.map((item, index) => {
        const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
          const y = 92 - ((item.score / maxScore) * 84);
          return `<circle cx="${x}" cy="${y}" r="1.5" fill="#000" stroke="#ededed" stroke-width="1.5" />`;
      }).join("")}
    </svg>
    </div>
    <div class="chart-axis" style="margin-top: 12px; display: flex; justify-content: space-between;">${data.map((item) => `<span>${item.label}</span>`).join("")}</div>
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
  const insights = getInsights(attempts, badges, profile);

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
        <div class="xp-progress" style="margin-top: 8px;"><span style="width:${game.progress}%"></span></div>
      </div>
    </aside>

    <main class="dash-main">
      <header class="dash-topbar panel">
        <button class="mobile-menu-btn" type="button" aria-label="Toggle sidebar">Menu</button>
        <label class="dash-search"><span>Search</span><input type="search" placeholder="Search quizzes, badges, rivals..." /></label>
        <div class="topbar-cluster">
          <span class="quick-pill">${game.totalXp} XP</span>
          <span class="quick-pill">${game.streak} streak</span>
          <button class="icon-btn" type="button" title="Notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          </button>
          <div class="avatar-chip"><span>${escapeHtml((auth?.getSession?.()?.name || "Q").slice(0, 1).toUpperCase())}</span><strong>${escapeHtml(auth?.getSession?.()?.name || "Player")}</strong></div>
        </div>
      </header>

      <section class="profile-header-compact panel">
        <div class="profile-identity">
          <div class="profile-avatar-large">${escapeHtml((auth?.getSession?.()?.name || "Q").slice(0, 1).toUpperCase())}</div>
          <div class="profile-title">
            <h1>${escapeHtml(auth?.getSession?.()?.name || "Player")}</h1>
            <span class="pill">Level ${game.level}</span>
          </div>
        </div>
        <div class="profile-metrics">
          <div class="profile-metric"><span>Global Rank</span><strong>${rank === "--" ? "--" : `#${rank}`}</strong></div>
          <div class="profile-metric border-left"><span>Total XP</span><strong>${game.totalXp}</strong></div>
          <div class="profile-metric border-left"><span>Streak</span><strong>${game.streak} 🔥</strong></div>
        </div>
      </section>

      <section class="hero-stats-grid">
        ${statCard("Quizzes", attempts.length || Number(profile?.totalQuizzes || 0), "total attempts")}
        ${statCard("Accuracy", `${avg}%`, `${best}% best`)}
        ${statCard("Flashcards", cardCount, `${flashDecks.length} decks`)}
        ${statCard("Badges", unlockedBadges.length, `${badges.length} available`)}
      </section>

      <div class="dashboard-content-grid">
        <div style="display: grid; gap: 16px; align-content: start;">
          <section class="panel flow-card">
            <div class="card-title-row">
              <div><strong style="font-size:1.1rem;">Performance Velocity</strong><span style="display:block; margin-top:2px; font-size:0.85rem;">Last 7 days accuracy trend</span></div>
            </div>
            ${renderLineChart(weekly)}
          </section>

          <section class="panel flow-card">
            <div class="card-title-row">
              <div><strong style="font-size:1.1rem;">AI Insights</strong><span style="display:block; margin-top:2px; font-size:0.85rem;">Algorithmic feedback</span></div>
            </div>
            <div class="insight-grid" style="margin-top: 16px;">
              ${insights.map(i => `
                <div class="insight-pill" style="align-items: flex-start;">
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="color: var(--text);">${i.label}</span>
                    <span style="font-size: 0.8rem; font-weight: 400; text-transform: none; letter-spacing: 0;">${i.value}</span>
                  </div>
                </div>
              `).join("")}
            </div>
          </section>
        </div>

        <div style="display: grid; gap: 16px; align-content: start;">
          <section class="panel flow-card">
            <div class="card-title-row">
              <div><strong style="font-size:1.1rem;">Recent Activity</strong><span style="display:block; margin-top:2px; font-size:0.85rem;">Your latest learning sessions</span></div>
            </div>
            <div class="timeline-list" style="margin-top: 16px;">
              ${recent.length ? recent.map(a => `
                <div class="timeline-item" style="grid-template-columns: 1fr;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: var(--text); font-size: 0.95rem;">${a.percentage}% Score</strong>
                    <span style="font-size: 0.75rem; background: var(--panel-soft); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--line);">${a.settings?.difficulty?.toUpperCase()}</span>
                  </div>
                  <span style="color: var(--muted); font-size: 0.8rem; margin-top: 4px;">${formatDate(a.createdAt)} • ${a.score}/${a.total} Correct</span>
                </div>
              `).join("") : `<div class="empty-state-mini" style="padding: 24px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span style="color: var(--muted); font-size: 0.9rem;">No recent activity. Start a quiz!</span></div>`}
            </div>
          </section>
        </div>
      </div>
    </main>
`;
}