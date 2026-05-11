import auth from "../auth.js";
import { apiRequest, escapeHtml } from "./shared.js";

function getScopeId() {
  const session = auth?.getSession?.();
  return session?.email || "guest";
}

function getHistory() {
  try {
    const raw = localStorage.getItem(`quizzy-history-v2-${getScopeId()}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getFlashDecks() {
  try {
    const raw = localStorage.getItem(`quizzy-flash-v1-${getScopeId()}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getMiniGameStats() {
  try {
    const raw = localStorage.getItem(`quizzy-mini-games-v1-${getScopeId()}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getBonusXp() {
  try {
    const raw = localStorage.getItem(`quizzy-bonus-xp-v1-${getScopeId()}`);
    return raw ? Math.max(0, Number(JSON.parse(raw)?.total || 0)) : 0;
  } catch {
    return 0;
  }
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
    if ((item.percentage || 0) >= 70) streak++;
    else break;
  }
  return streak;
}

function getBadgeCatalog(entries) {
  const streak = getStreak(entries);
  const best = entries.length ? Math.max(...entries.map((entry) => Number(entry.percentage || 0))) : 0;
  return [
    { id: "starter", label: "First Spark", rarity: "bronze", unlocked: entries.length >= 1, hint: "Finish your first quiz." },
    { id: "streak", label: "Hot Streak", rarity: "silver", unlocked: streak >= 3, hint: "Win 3 quizzes in a row." },
    { id: "scholar", label: "Quiz Boss", rarity: "gold", unlocked: best >= 90, hint: "Reach 90% on a quiz." }
  ];
}

function getGamification(entries, profile) {
  const totalXp = entries.reduce((sum, entry) => sum + getAttemptXp(entry), 0) + getBonusXp();
  return {
    totalXp: profile?.totalXp || totalXp,
    level: Math.max(1, Math.floor(totalXp / 180) + 1),
    progress: Math.round(((totalXp % 180) / 180) * 100),
    streak: profile?.currentStreak ?? getStreak(entries)
  };
}

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

function getCompactIcon(type) {
  const icons = {
    xp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`,
    rank: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5aa2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`,
    accuracy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M22 12h-4"></path><path d="M6 12H2"></path><path d="M12 6V2"></path><path d="M12 22v-4"></path><circle cx="12" cy="12" r="2"></circle></svg>`,
    streak: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`,
    quizzes: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    badges: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15l-3 3-1-4-4-1 3-3-1-4 4 1 3-3 3 3 4-1-1 4 3 3-4 1-1 4-3-3z"></path></svg>`
  };
  return icons[type] || "";
}

function compactStatCard(label, value, helper, iconType) {
  return `
    <article class="panel glass-card glow-hover" style="padding: 20px; display: flex; align-items: flex-start; gap: 16px; min-width: 0;">
      <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--primary); color: white; display: grid; place-items: center; flex-shrink: 0; opacity: 0.9; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
        <div style="width: 20px; height: 20px;">
          ${getCompactIcon(iconType)}
        </div>
      </div>
      <div style="min-width: 0; flex: 1;">
        <span style="font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">${label}</span>
        <strong style="font-size: 1.4rem; font-weight: 800; color: var(--text); display: block; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${value}</strong>
        ${helper ? `<span style="font-size: 0.8rem; color: var(--secondary); display: block; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${helper}</span>` : ''}
      </div>
    </article>
  `;
}

function renderLineChart(data) {
  if (!data || !data.length) return `<div class="empty-state-mini" style="height: 160px; display: grid; place-items: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span>No data to chart</span></div>`;
  const maxScore = Math.max(...data.map(d => d.score), 10);
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = 92 - ((item.score / maxScore) * 84);
    return `${x},${y}`;
  }).join(" ");
  
  return `
    <div style="position: relative; height: 160px; margin-top: 16px;">
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
  const game = getGamification(attempts, profile);
  const badges = getBadgeCatalog(attempts);
  const unlockedBadges = badges.filter((badge) => badge.unlocked);
  const weekly = getWeeklyData(attempts);
  const avg = averageScore(attempts);
  const best = attempts.length ? Math.max(...attempts.map((entry) => Number(entry.percentage || 0))) : Number(profile?.bestPercentage || 0);
  const rank = getRank(profile, leaderboard);
  const cardCount = flashDecks.reduce((sum, deck) => sum + (Array.isArray(deck.flashcards) ? deck.flashcards.length : 0), 0);
  const recent = attempts.slice(0, 6);
  const insights = getInsights(attempts, badges, profile);
  const categoryStats = getCategoryStats(attempts);
  const topPlayers = leaderboard.slice(0, 5);
  const session = auth?.getSession?.();
  const userType = profile?.userType || session?.userType || localStorage.getItem('quizzy-userType') || 'student';

  let welcomeSub = "Here's what's happening with your learning progress.";
  let actionButtons = `
    <div style="display: flex; gap: 8px;">
      <a href="./generate.html" class="btn" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Start Quiz</a>
      <a href="./flashcards.html" class="btn-outline" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Study Flashcards</a>
    </div>
  `;
  let statsRow = `
    ${compactStatCard("Total XP", game.totalXp, "Level " + game.level, "xp")}
    ${compactStatCard("Global Rank", rank === "--" ? "--" : "#" + rank, "Leaderboard", "rank")}
    ${compactStatCard("Accuracy", avg + "%", "Best: " + best + "%", "accuracy")}
    ${compactStatCard("Streak", game.streak + " 🔥", "Consecutive >70%", "streak")}
    ${compactStatCard("Quizzes", attempts.length, "Total completions", "quizzes")}
    ${compactStatCard("Badges", unlockedBadges.length, "Out of " + badges.length, "badges")}
  `;

  if (userType === 'teacher') {
    welcomeSub = "Overview of your classroom analytics and quizzes.";
    actionButtons = `
      <div style="display: flex; gap: 8px;">
        <a href="./generate.html?mode=exam" class="btn" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Create Assessment</a>
        <button id="downloadClassReportBtn" class="btn-outline" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Class Report ⬇</button>
      </div>
    `;
    statsRow = `
      ${compactStatCard("Created", attempts.length, "Total Quizzes", "quizzes")}
      ${compactStatCard("Avg Score", avg + "%", "Cohort Accuracy", "accuracy")}
      ${compactStatCard("Students", leaderboard.length, "Active Learners", "rank")}
      ${compactStatCard("Flashcards", flashDecks.length, "Decks created", "badges")}
    `;
  } else if (userType === 'student') {
    welcomeSub = "Ready to play, learn, and level up? Let's go!";
    actionButtons = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <a href="./generate.html?topic=Daily%20Trivia%20Challenge&mode=arcade" class="btn" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem; background: var(--success); color: #fff; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); border: none;">Daily Challenge ⚡</a>
        <a href="./arcade.html" class="btn" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Play Games 🎮</a>
        <a href="./generate.html" class="btn-outline" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Take a Quiz 🎯</a>
      </div>
    `;
    statsRow = `
      ${compactStatCard("XP", game.totalXp, "Points!", "xp")}
      ${compactStatCard("Level", game.level, "Keep going!", "streak")}
      ${compactStatCard("Badges", unlockedBadges.length, "Collected", "badges")}
      ${compactStatCard("Streak", game.streak + " 🔥", "Daily plays", "streak")}
    `;
  } else if (userType === 'self_learner') {
    welcomeSub = "Track your mastery, revise weak topics, and build habits.";
    actionButtons = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <a href="./generate.html?topic=Daily%20Revision%20Challenge&mode=exam" class="btn" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem; background: var(--success); color: #fff; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); border: none;">Daily Challenge ⚡</a>
        <a href="./generate.html?mode=focus" class="btn" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Focus Study</a>
        <a href="./generate.html?mode=revision" class="btn-outline" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Revision Mode</a>
      </div>
    `;
    statsRow = `
      ${compactStatCard("Mastery", game.level, "Current Level", "xp")}
      ${compactStatCard("Accuracy", avg + "%", "Overall Rate", "accuracy")}
      ${compactStatCard("Flashcards", flashDecks.length, "Decks Active", "quizzes")}
      ${compactStatCard("Streak", game.streak + " 🔥", "Consistent Study", "streak")}
    `;
  }

  let weakTopicsHtml = "";
  const weakTopics = categoryStats.filter(c => c.average < 75).sort((a,b) => a.average - b.average).slice(0, 3);
  if ((userType === "student" || userType === "self_learner") && weakTopics.length > 0) {
    weakTopicsHtml = `
      <section class="panel flow-card glass-card glow-hover" style="padding: 24px; margin-top: 16px; border-color: rgba(239, 68, 68, 0.3);">
        <div style="margin-bottom: 12px;">
          <strong style="font-size:1.05rem; display:block; color: var(--error);">Attention Required</strong>
          <span style="font-size:0.8rem; color: var(--muted);">Weak topics & recommended revision</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${weakTopics.map(w => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(239, 68, 68, 0.05); border-radius: var(--radius-md); border: 1px solid rgba(239, 68, 68, 0.2);">
              <span style="font-size: 0.85rem; font-weight: 600; color: var(--error); text-transform: capitalize;">${escapeHtml(w.label)}</span>
              <a href="./generate.html?topic=${encodeURIComponent(w.label)}&mode=revision" class="btn-outline" style="min-height: 24px; padding: 0 8px; font-size: 0.7rem; border-color: rgba(239, 68, 68, 0.4); color: var(--error);">Revise</a>
            </div>
          `).join("")}
        </div>
      </section>
    `;
  }

  root.className = "dashboard-platform-shell page-fade";
  root.innerHTML = `
    <aside class="dash-sidebar panel glass-card">
      <a class="side-brand" href="./index.html"><span class="brand-badge" style="background: var(--primary); box-shadow: var(--glow-shadow);">Q</span><strong>Quizzy</strong></a>
      <nav class="side-nav">
        <a class="active glow-hover" href="./dashboard.html">Dashboard</a>
        <a class="glow-hover" href="./generate.html">Generate</a>
        <a class="glow-hover" href="./flashcards.html">Flashcards</a>
        <a class="glow-hover" href="./scoreboard.html">Leaderboard</a>
        <a class="glow-hover" href="./arcade.html">Arcade</a>
      </nav>
      <div class="side-progress">
        <span>Level ${game.level}</span>
        <strong class="neon-text">${game.totalXp} XP</strong>
        <div class="xp-progress" style="margin-top: 8px;"><span style="width:${game.progress}%"></span></div>
      </div>
    </aside>

    <main class="dash-main" style="display: flex; flex-direction: column; gap: 20px;">
      <header class="dash-topbar panel glass-card">
        <button class="mobile-menu-btn" type="button" aria-label="Toggle sidebar">Menu</button>
        <label class="dash-search"><span>Search</span><input type="search" placeholder="Search quizzes, badges, rivals..." /></label>
        <div class="topbar-cluster">
          <span class="quick-pill">${game.totalXp} XP</span>
          <span class="quick-pill">${game.streak} streak</span>
          <div class="avatar-chip"><span>${escapeHtml((auth?.getSession?.()?.name || "Q").slice(0, 1).toUpperCase())}</span><strong>${escapeHtml(auth?.getSession?.()?.name || "Player")}</strong></div>
        </div>
      </header>

      <!-- Welcome & Quick Actions -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 style="font-size: 1.75rem; font-weight: 800; margin: 0 0 4px; letter-spacing: -0.02em; color: var(--text);">Welcome back, <span class="neon-text">${escapeHtml(auth?.getSession?.()?.name || "Player")}</span></h1>
          <p style="color: var(--muted); font-size: 0.9rem; margin: 0;">${welcomeSub}</p>
        </div>
        ${actionButtons}
      </div>

      <!-- Quick Stats Row -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
        ${statsRow}
      </div>

      <!-- Main Two-Column Layout -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; align-items: start;">
          
        <!-- Left Column: Performance & Insights -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          <section class="panel flow-card glass-card glow-hover" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div>
                <strong style="font-size:1.05rem; display:block;">Accuracy Trend</strong>
                <span style="font-size:0.8rem; color: var(--muted);">Last 7 days performance</span>
              </div>
            </div>
            ${renderLineChart(weekly)}
          </section>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
            <section class="panel flow-card glass-card glow-hover" style="padding: 24px;">
              <div style="margin-bottom: 12px;">
                <strong style="font-size:1.05rem; display:block;">Category Mastery</strong>
                <span style="font-size:0.8rem; color: var(--muted);">Accuracy by topic</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${categoryStats.length ? categoryStats.slice(0,4).map(c => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--line);">
                    <span style="font-size: 0.85rem; text-transform: capitalize; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(c.label)}</span>
                    <strong style="font-size: 0.9rem; color: var(--primary);">${c.average}%</strong>
                  </div>
                `).join("") : `<div class="empty-state-mini" style="padding: 16px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span style="color: var(--muted); font-size: 0.8rem;">No categories yet.</span></div>`}
              </div>
            </section>

            ${weakTopicsHtml}

            <section class="panel flow-card glass-card glow-hover" style="padding: 24px; margin-top: 16px;">
              <div style="margin-bottom: 12px;">
                <strong style="font-size:1.05rem; display:block;">AI Insights</strong>
                <span style="font-size:0.8rem; color: var(--muted);">Smart recommendations</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${insights.slice(0, 3).map(i => `
                  <div style="padding: 8px 12px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--line);">
                    <span style="color: var(--text); font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 2px;">${i.label}</span>
                    <span style="font-size: 0.8rem; color: var(--muted); line-height: 1.4;">${i.value}</span>
                  </div>
                `).join("")}
              </div>
            </section>
          </div>
        </div>

        <!-- Right Column: Activity, Achievements, Leaderboard -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          <section class="panel flow-card glass-card glow-hover" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
              <div>
                <strong style="font-size:1.05rem; display:block;">${userType === 'teacher' ? 'Recent Assessments' : 'Recent Activity'}</strong>
                <span style="font-size:0.8rem; color: var(--muted);">${userType === 'teacher' ? 'Quizzes generated for class' : 'Latest learning sessions'}</span>
              </div>
              ${attempts.length > 4 ? `<a href="./profile.html" style="font-size: 0.8rem; color: var(--text); font-weight: 500;">View All</a>` : ''}
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${recent.length ? recent.slice(0,4).map(a => `
                <div style="padding: 10px 12px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong style="color: var(--text); font-size: 0.9rem; font-weight: 700;">${a.percentage}% Score</strong>
                    <span style="font-size: 0.7rem; background: var(--panel-soft); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--line); color: var(--muted);">${a.settings?.difficulty?.toUpperCase() || 'MODERATE'}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                     <span style="color: var(--muted); font-size: 0.75rem;">${formatDate(a.createdAt)}</span>
                     <span style="color: var(--text); font-size: 0.8rem; font-weight: 500;">${a.score}/${a.total} Correct</span>
                  </div>
                </div>
              `).join("") : `<div class="empty-state-mini" style="padding: 16px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span style="color: var(--muted); font-size: 0.85rem;">No recent activity.</span></div>`}
            </div>
          </section>

          <section class="panel flow-card glass-card glow-hover" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <div>
                <strong style="font-size:1.05rem; display:block;">${userType === 'teacher' ? 'Student Rankings' : 'Top Players'}</strong>
                <span style="font-size:0.8rem; color: var(--muted);">${userType === 'teacher' ? 'Top performers in cohort' : 'Global preview'}</span>
              </div>
              <a href="./scoreboard.html" style="font-size: 0.8rem; color: var(--text); font-weight: 500;">Leaderboard</a>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
               ${topPlayers.length ? topPlayers.slice(0, 4).map((p, idx) => `
                 <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--line); ${p.email === auth?.getSession?.()?.email ? 'border-color: var(--primary); box-shadow: var(--glow-shadow);' : ''}">
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 0.8rem; font-weight: 700; color: var(--muted); width: 16px; text-align: center;">${idx + 1}</span>
                      <strong style="font-size: 0.85rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;">${escapeHtml(p.name)}</strong>
                    </div>
                    <span style="font-size: 0.8rem; font-weight: 700; color: var(--secondary);">${p.totalXp} XP</span>
                 </div>
               `).join("") : `<div class="empty-state-mini" style="padding: 16px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span style="color: var(--muted); font-size: 0.8rem;">No players ranked yet.</span></div>`}
            </div>
          </section>
          
          <section class="panel flow-card glass-card glow-hover" style="padding: 24px;">
            <div style="margin-bottom: 12px;">
              <strong style="font-size:1.05rem; display:block;">Recent Badges</strong>
              <span style="font-size:0.8rem; color: var(--muted);">${unlockedBadges.length}/${badges.length} Unlocked</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
               ${unlockedBadges.length ? unlockedBadges.slice(0, 4).map(b => `
                 <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--line);">
                    <span style="font-size: 1rem;">${b.rarity === 'gold' ? '🥇' : b.rarity === 'silver' ? '🥈' : '🥉'}</span>
                    <strong style="font-size: 0.8rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(b.label)}</strong>
                 </div>
               `).join("") : `<div class="empty-state-mini" style="padding: 16px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md); grid-column: 1 / -1;"><span style="color: var(--muted); font-size: 0.8rem;">No badges earned.</span></div>`}
            </div>
          </section>

        </div>
      </div>
    </main>
`;

  const downloadBtn = document.getElementById("downloadClassReportBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const lines = [
        "Quizzy Classroom Performance Report",
        `Generated: ${new Date().toLocaleString()}`,
        "",
        "Active Students (Top 50):",
        ...leaderboard.slice(0,50).map((p, idx) => `${idx + 1}. ${p.name} - ${p.totalXp} XP (Level ${Math.max(1, Math.floor((p.totalXp||0) / 180) + 1)}) | Streak: ${p.currentStreak || 0} 🔥`),
        "",
        "Recent Assessments:",
        ...attempts.slice(0,20).map(a => `- ${formatDate(a.createdAt)}: ${a.percentage}% Cohort Avg [Mode: ${a.settings?.difficulty?.toUpperCase() || "N/A"}]`)
      ];
      
      const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Classroom_Report_${new Date().toISOString().slice(0,10)}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }
}

async function initDashboard() {
  if (!root) return;
  renderSkeleton();
  
  try {
    let data;
    if (isLoggedIn()) {
      data = await apiRequest("/data/bootstrap");
    } else {
      data = {
        attempts: getHistory(),
        flashDecks: getFlashDecks(),
        miniGameStats: getMiniGameStats(),
        profile: null,
        leaderboard: []
      };
    }
    renderDashboard(data || dashboardState);
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
    renderDashboard(dashboardState);
  }
}

initDashboard();