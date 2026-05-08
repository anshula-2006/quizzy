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

function renderSparkBars(data, key, suffix = "") {
  const max = Math.max(1, ...data.map((item) => Number(item[key] || 0)));
  return data.map((item, index) => `
    <div class="chart-bar" style="--h:${Math.max(6, (Number(item[key] || 0) / max) * 100)}%; animation-delay:${index * 45}ms" title="${item.label}: ${item[key]}${suffix}">
      <span></span>
      <small>${item.label}</small>
    </div>
  `).join("");
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

function renderHeatmap(attempts) {
  const today = new Date();
  const counts = new Map();
  attempts.forEach((entry) => {
    const key = new Date(entry.createdAt).toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (27 - index));
    const key = date.toISOString().slice(0, 10);
    const count = counts.get(key) || 0;
    return `<span class="heat-cell heat-${Math.min(4, count)}" title="${key}: ${count} quizzes"></span>`;
  }).join("");
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
        ${statCard("Accuracy", `${avg}%`, `${best}% best`, "AC", "green", avg >= 80 ? "Rising" : "Focus")}
        ${statCard("Global Rank", rank === "--" ? "--" : `#${rank}`, "all-time board", "RK", "amber", "Global")}
        ${statCard("Current Streak", game.streak, "70%+ chain", "ST", "red", game.streak ? "Hot" : "Fresh")}
        ${statCard("Longest Streak", profile?.bestStreak ?? game.streak, "personal best", "PB", "blue", "Peak")}
        ${statCard("Badges", unlockedBadges.length, `${badges.length} available`, "BD", "pink", "Persistent")}
        ${statCard("Average Score", `${avg}%`, `${attempts.length} samples`, "AV", "lime", "Tracked")}
      </section>

      <section class="analytics-grid">
        <article class="chart-card panel primary-chart">
          <div class="card-title-row"><div><strong>Weekly performance</strong><span>Average score by day</span></div></div>
          ${renderLineChart(weekly)}
        </article>
        <article class="chart-card panel primary-chart">
          <div class="card-title-row"><div><strong>XP growth</strong><span>Daily earned XP</span></div></div>
          <div class="bar-chart">${renderSparkBars(weekly, "xp", " XP")}</div>
        </article>
      </section>

      <section class="dashboard-tabs panel">
        <button class="${activeDashboardTab === "analytics" ? "active" : ""}" data-dashboard-tab="analytics" type="button">Analytics</button>
        <button class="${activeDashboardTab === "achievements" ? "active" : ""}" data-dashboard-tab="achievements" type="button">Achievements</button>
        <button class="${activeDashboardTab === "activity" ? "active" : ""}" data-dashboard-tab="activity" type="button">Activity</button>
        <button class="${activeDashboardTab === "study" ? "active" : ""}" data-dashboard-tab="study" type="button">Study</button>
        <button class="${activeDashboardTab === "arcade" ? "active" : ""}" data-dashboard-tab="arcade" type="button">Arcade</button>
      </section>

      <section class="dashboard-tab-panel ${activeDashboardTab === "analytics" ? "is-active" : ""}" data-tab-panel="analytics">
        <article class="chart-card panel">
          <div class="card-title-row"><div><strong>Accuracy bars</strong><span>Recent quiz quality</span></div></div>
          <div class="bar-chart">${renderSparkBars(attempts.slice(0, 8).reverse().map((entry, index) => ({ label: `R${index + 1}`, score: Number(entry.percentage || 0) })), "score", "%") || `<p class="empty-copy">No attempts yet.</p>`}</div>
        </article>
        <article class="chart-card panel">
          <div class="card-title-row"><div><strong>Completion heatmap</strong><span>Last 28 days</span></div></div>
          <div class="activity-heatmap">${renderHeatmap(attempts)}</div>
        </article>
        <article class="chart-card panel">
          <div class="card-title-row"><div><strong>Category distribution</strong><span>Difficulty mix</span></div></div>
          <div class="category-stack">
            ${categoryStats.length ? categoryStats.map((item) => `<div><span>${escapeHtml(item.label)}</span><strong>${item.count}</strong><em style="width:${Math.min(100, item.average)}%"></em></div>`).join("") : `<p class="empty-copy">Complete quizzes to build distribution data.</p>`}
          </div>
        </article>
        <article class="chart-card panel">
          <div class="card-title-row"><div><strong>Daily activity</strong><span>Quiz volume</span></div></div>
          <div class="bar-chart">${renderSparkBars(weekly, "count")}</div>
        </article>
        <article class="panel flow-card insights-card">
          <div class="card-title-row"><div><strong>Personal insights</strong><span>Auto-generated coaching</span></div></div>
          <div class="insight-grid">
            ${insights.map((item) => `<div class="insight-pill ${item.tone}"><span>${item.label}</span><strong>${escapeHtml(item.value)}</strong></div>`).join("")}
          </div>
        </article>
        <article class="panel flow-card leaderboard-widget">
          <div class="card-title-row"><div><strong>Leaderboard preview</strong><span>Top 5 rivals</span></div><a href="./scoreboard.html">Open</a></div>
          <div class="mini-leaderboard">
            ${topFive.length ? topFive.map((player) => `
              <div class="mini-lb-row ${player.rank === rank ? "is-me" : ""}">
                <span>#${player.rank}</span>
                <b>${escapeHtml(player.name || "Player")}</b>
                <em>${Number(player.totalXp || 0)} XP</em>
              </div>
            `).join("") : `<p class="empty-copy">Leaderboard data appears after cloud sync.</p>`}
          </div>
        </article>
      </section>

      <section class="dashboard-tab-panel ${activeDashboardTab === "activity" ? "is-active" : ""}" data-tab-panel="activity">
        <article class="panel flow-card activity-card wide-tab-card">
          <div class="card-title-row"><div><strong>Recent activity</strong><span>Quiz, XP, badge, and streak events</span></div></div>
          <div class="timeline-list">
            ${recent.length ? recent.map((entry) => `
              <div class="timeline-item"><i></i><div><strong>${Number(entry.percentage || 0)}% quiz completed</strong><span>${formatDate(entry.createdAt)} - +${getAttemptXp(entry)} XP - streak ${getStreak(attempts.slice(attempts.indexOf(entry)))}</span></div></div>
            `).join("") : `<div class="empty-state-mini"><strong>No activity yet</strong><span>Generate a quiz to start your analytics feed.</span></div>`}
            ${unlockedBadges.slice(0, 3).map((badge) => `<div class="timeline-item badge-event"><i></i><div><strong>${badge.label} unlocked</strong><span>${badge.rarity} badge persisted to your account ledger</span></div></div>`).join("")}
          </div>
        </article>
      </section>

      <section class="dashboard-tab-panel ${activeDashboardTab === "achievements" ? "is-active" : ""}" data-tab-panel="achievements">
        <article class="panel flow-card achievement-showcase wide-tab-card">
          <div class="card-title-row"><div><strong>Achievements</strong><span>${unlockedBadges.length}/${badges.length} unlocked</span></div></div>
          <div class="badge-grid premium-badges">
            ${badges.map((badge) => `
              <article class="badge-card ${badge.unlocked ? "is-unlocked" : "is-locked"} ${badge.rarity}" title="${escapeHtml(badge.hint)}">
                <span class="badge-icon"><img src="${badge.icon}" alt="${escapeHtml(badge.label)}" loading="lazy" /></span>
                <strong>${escapeHtml(badge.label)}</strong>
                <small>${badge.unlocked ? `${badge.rarity} unlocked` : escapeHtml(badge.hint)}</small>
                ${badge.unlocked ? "" : `<div class="mini-progress"><span style="width:${badge.target ? Math.min(100, (Number(badge.progress || 0) / badge.target) * 100) : 8}%"></span></div>`}
              </article>
            `).join("")}
          </div>
        </article>
      </section>

      <section class="dashboard-tab-panel ${activeDashboardTab === "study" ? "is-active" : ""}" data-tab-panel="study">
        <article class="panel flow-card wide-tab-card">
          <div class="card-title-row"><div><strong>Flashcard decks</strong><span>${flashDecks.length} decks - ${cardCount} cards</span></div></div>
          <div class="dashboard-list">
            ${flashDecks.length ? flashDecks.slice(0, 4).map((deck, i) => `
              <div class="answer-option deck-row">
                <div class="deck-row-head"><div><span class="helper-text">${formatDate(deck.createdAt)}</span><strong>${escapeHtml(deck.title) || "Study Deck"}</strong></div><span class="deck-count">${(deck.flashcards || []).length} cards</span></div>
                <div class="deck-actions">
                  <button class="btn-outline open-deck-btn" data-index="${i}">Study</button>
                  <button class="btn-outline edit-deck-btn" data-index="${i}">Rename</button>
                  <button class="btn-outline delete-deck-btn danger-action" data-index="${i}">Delete</button>
                </div>
              </div>
            `).join("") : `<p class="empty-copy">No flashcard decks saved yet.</p>`}
          </div>
        </article>
      </section>

      <section class="dashboard-tab-panel ${activeDashboardTab === "arcade" ? "is-active" : ""}" data-tab-panel="arcade">
        <aside class="panel flow-card arcade-widget wide-tab-card">
          <div class="card-title-row"><div><strong>Arcade stats</strong><span>Mini-game progress</span></div></div>
          <div class="mini-stat-grid">
            <div class="setting-card"><span>Memory Wins</span><strong>${Number(mini.memoryWins || 0)}</strong></div>
            <div class="setting-card"><span>Best Moves</span><strong>${mini.memoryBestMoves || "--"}</strong></div>
            <div class="setting-card"><span>Best Time</span><strong>${mini.memoryBestTime ? `${mini.memoryBestTime}s` : "--"}</strong></div>
            <div class="setting-card"><span>Reaction</span><strong>${mini.reactionBest ? `${mini.reactionBest} ms` : "--"}</strong></div>
          </div>
          <div class="dashboard-quick-links"><a class="btn" href="./arcade.html">Open Arcade</a></div>
        </aside>
      </section>

      <section class="panel dashboard-manage-row">
        <span class="helper-text">Account controls</span>
        <button id="clearHistoryBtn" class="btn-outline" type="button">Clear Quiz History</button>
        <button id="clearDashboardBtn" class="btn-outline" type="button">Clear Dashboard</button>
        <button id="deleteUserBtn" class="btn-outline danger-action" type="button">Delete User</button>
      </section>
    </main>
  `;

  wireDashboardEvents(flashDecks);
}

function wireDashboardEvents(flashDecks) {
  document.querySelector(".mobile-menu-btn")?.addEventListener("click", () => root.classList.toggle("sidebar-open"));

  document.querySelectorAll("[data-dashboard-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeDashboardTab = btn.dataset.dashboardTab || "analytics";
      renderDashboard(dashboardState);
    });
  });

  document.querySelectorAll(".open-deck-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const deck = flashDecks[btn.dataset.index];
      if (!deck) return;
      localStorage.setItem("quizzy-active-deck", JSON.stringify(deck));
      window.location.href = "./flashcards.html";
    });
  });

  document.querySelectorAll(".edit-deck-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const deck = flashDecks[btn.dataset.index];
      if (!deck) return;
      const newTitle = prompt("Enter a new title for this deck:", deck.title);
      if (!newTitle || newTitle.trim() === "" || newTitle.trim() === deck.title) return;
      deck.title = newTitle.trim();
      const localDecks = getFlashDecks();
      const localIdx = localDecks.findIndex((item) => item.id === deck.id || item._id === deck._id);
      if (localIdx !== -1) {
        localDecks[localIdx].title = deck.title;
        saveFlashDecks(localDecks);
      }
      if (isLoggedIn() && deck._id) await apiRequest(`/data/flash-decks/${deck._id}`, { method: "PUT", body: JSON.stringify({ title: deck.title }) });
      init();
    });
  });

  document.querySelectorAll(".delete-deck-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to delete this deck?")) return;
      const deck = flashDecks[btn.dataset.index];
      if (!deck) return;
      const localDecks = getFlashDecks();
      saveFlashDecks(localDecks.filter((item) => item.id !== deck.id && item._id !== deck._id));
      if (isLoggedIn() && deck._id) await apiRequest(`/data/flash-decks/${deck._id}`, { method: "DELETE" });
      init();
    });
  });

  document.getElementById("clearHistoryBtn")?.addEventListener("click", async () => {
    await apiRequest("/data/attempts", { method: "DELETE" });
    const refreshed = await apiRequest("/data/bootstrap");
    if (refreshed) renderDashboard(refreshed);
  });

  document.getElementById("clearDashboardBtn")?.addEventListener("click", async () => {
    if (!confirm("This will clear quiz history, flashcards, mini-game stats, and dashboard progress. Continue?")) return;
    await apiRequest("/data/dashboard", { method: "DELETE" });
    const refreshed = await apiRequest("/data/bootstrap");
    if (refreshed) renderDashboard(refreshed);
  });

  document.getElementById("deleteUserBtn")?.addEventListener("click", async () => {
    const confirmation = prompt("Type DELETE to permanently remove your account:");
    if (confirmation === null) return;
    const password = prompt("Enter your password to confirm account deletion:");
    if (password === null) return;
    const result = await auth.deleteAccount({ password, confirmation });
    if (!result.ok) {
      alert(result.error || "Unable to delete account.");
      return;
    }
    alert("Your account has been deleted.");
    window.location.href = "./register.html";
  });
}

async function init() {
  renderSkeleton();
  if (!isLoggedIn()) {
    dashboardState = { attempts: getSavedQuizHistory(), flashDecks: getFlashDecks(), miniGameStats: getMiniGameStats(), profile: null, leaderboard: [], loading: false };
    mergeBadgesFromSources(dashboardState.attempts, null, []);
    renderDashboard(dashboardState);
    return;
  }

  console.debug("[Quizzy badges] fetching dashboard bootstrap");
  const data = await apiRequest("/data/bootstrap");
  if (!data) {
    dashboardState = { attempts: getSavedQuizHistory(), flashDecks: getFlashDecks(), miniGameStats: getMiniGameStats(), profile: null, leaderboard: [], loading: false };
    mergeBadgesFromSources(dashboardState.attempts, null, []);
    renderDashboard(dashboardState);
    return;
  }
  console.debug("[Quizzy badges] dashboard API response", { achievements: data.profile?.achievements, attempts: data.attempts?.length });
  if (data.miniGameStats) setMiniGameStats(data.miniGameStats);
  if (data.flashDecks) saveFlashDecks(data.flashDecks);
  mergeBadgesFromSources(data.attempts || [], data.profile || null, data.profile?.achievements || []);
  dashboardState = { ...data, loading: false };
  renderDashboard(data);
}

document.body.classList.add("dark");
init();
