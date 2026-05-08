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
  const difficultyBonusMap = { easy: 8, moderate: 14, tough: 22, super: 32 };
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

function statCard(label, value, helper) {
  return `
    <article class="saas-stat-card panel" style="padding: 20px; border-radius: var(--radius-lg); background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent); border: 1px solid var(--line); display: flex; flex-direction: column; justify-content: space-between;">
      <span class="saas-stat-label" style="font-size: 0.85rem; font-weight: 500; color: var(--muted); text-transform: none; letter-spacing: 0;">${label}</span>
      <strong class="saas-stat-value" style="font-size: 2rem; font-weight: 700; color: var(--text); margin: 8px 0 4px; letter-spacing: -0.03em;">${value}</strong>
      <span class="saas-stat-helper" style="font-size: 0.8rem; color: var(--muted); font-weight: 500;">${helper}</span>
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

      <div style="display: grid; gap: 24px; margin-top: 24px;">
        <section class="profile-header-compact panel" style="padding: 24px; display: flex; justify-content: space-between; align-items: center; border-radius: var(--radius-lg); background: linear-gradient(145deg, rgba(255,255,255,0.03), transparent); border: 1px solid var(--line); flex-wrap: wrap; gap: 20px;">
          <div class="profile-identity" style="display: flex; align-items: center; gap: 16px;">
            <div class="profile-avatar-large" style="background: #ededed; color: #000; font-weight: 800; border-radius: 12px; width: 56px; height: 56px; display: grid; place-items: center; font-size: 1.8rem;">${escapeHtml((auth?.getSession?.()?.name || "Q").slice(0, 1).toUpperCase())}</div>
            <div class="profile-title">
              <h1 style="font-size: 1.4rem; margin: 0 0 4px; font-weight: 700; color: var(--text); letter-spacing: -0.02em;">${escapeHtml(auth?.getSession?.()?.name || "Player")}</h1>
              <span class="pill" style="font-size: 0.75rem; padding: 4px 10px; height: auto; background: var(--panel-soft); border: 1px solid var(--line); border-radius: 6px;">Level ${game.level}</span>
            </div>
          </div>
          <div class="profile-metrics" style="display: flex; gap: 32px; align-items: center;">
            <div class="profile-metric" style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Global Rank</span>
              <strong style="font-size: 1.3rem; font-weight: 700; color: var(--text);">${rank === "--" ? "--" : "#" + rank}</strong>
            </div>
            <div class="profile-metric border-left" style="display: flex; flex-direction: column; gap: 4px; padding-left: 32px; border-left: 1px solid var(--line);">
              <span style="font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Total XP</span>
              <strong style="font-size: 1.3rem; font-weight: 700; color: var(--text);">${game.totalXp}</strong>
            </div>
            <div class="profile-metric border-left" style="display: flex; flex-direction: column; gap: 4px; padding-left: 32px; border-left: 1px solid var(--line);">
              <span style="font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em;">Streak</span>
              <strong style="font-size: 1.3rem; font-weight: 700; color: var(--amber);">${game.streak} 🔥</strong>
            </div>
          </div>
        </section>

        <section class="hero-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          ${statCard("Quizzes", attempts.length || Number(profile?.totalQuizzes || 0), "Total completions")}
          ${statCard("Accuracy", avg + "%", `Best: ${best}%`)}
          ${statCard("Flashcards", cardCount, `${flashDecks.length} active decks`)}
          ${statCard("Badges", unlockedBadges.length, `${badges.length} available`)}
        </section>

        <div class="dashboard-content-grid" style="display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr); gap: 24px;">
          
          <!-- Left Column -->
          <div style="display: grid; gap: 24px; align-content: start;">
            <section class="panel flow-card" style="padding: 24px; border-radius: var(--radius-lg);">
              <div class="card-title-row" style="margin-bottom: 20px;">
                <div>
                  <strong style="font-size:1.1rem; display:block;">Performance Velocity</strong>
                  <span style="display:block; margin-top:4px; font-size:0.85rem; color: var(--muted);">Last 7 days accuracy trend</span>
                </div>
              </div>
              ${renderLineChart(weekly)}
            </section>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
              <section class="panel flow-card" style="padding: 20px; border-radius: var(--radius-md);">
                <div class="card-title-row" style="margin-bottom: 16px;">
                  <div>
                    <strong style="font-size:1rem; display:block;">Focus Areas</strong>
                    <span style="display:block; margin-top:2px; font-size:0.8rem; color: var(--muted);">Category breakdown</span>
                  </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  ${categoryStats.length ? categoryStats.slice(0,4).map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-md); border: 1px solid var(--line);">
                      <span style="font-size: 0.85rem; text-transform: capitalize; font-weight: 600; color: var(--text);">${escapeHtml(c.label)}</span>
                      <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 0.75rem; color: var(--muted);">${c.count} qz</span>
                        <strong style="font-size: 0.9rem; color: var(--text);">${c.average}%</strong>
                      </div>
                    </div>
                  `).join("") : `<div class="empty-state-mini" style="padding: 16px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span style="color: var(--muted); font-size: 0.85rem;">No category data yet.</span></div>`}
                </div>
              </section>

              <section class="panel flow-card" style="padding: 20px; border-radius: var(--radius-md);">
                <div class="card-title-row" style="margin-bottom: 16px;">
                  <div>
                    <strong style="font-size:1rem; display:block;">AI Insights</strong>
                    <span style="display:block; margin-top:2px; font-size:0.8rem; color: var(--muted);">Smart recommendations</span>
                  </div>
                </div>
                <div class="insight-grid" style="display: flex; flex-direction: column; gap: 8px;">
                  ${insights.slice(0, 3).map(i => `
                    <div class="insight-pill" style="padding: 10px 12px; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-md); border: 1px solid var(--line); display: block;">
                      <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="color: var(--text); font-size: 0.85rem; font-weight: 600;">${i.label}</span>
                        <span style="font-size: 0.8rem; color: var(--muted); line-height: 1.4; text-transform: none; font-weight: 400; letter-spacing: 0;">${i.value}</span>
                      </div>
                    </div>
                  `).join("")}
                </div>
              </section>
            </div>
          </div>

          <!-- Right Column -->
          <div style="display: grid; gap: 24px; align-content: start;">
            <section class="panel flow-card" style="padding: 24px; border-radius: var(--radius-lg);">
              <div class="card-title-row" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <strong style="font-size:1.1rem; display:block;">Recent Activity</strong>
                  <span style="display:block; margin-top:4px; font-size:0.85rem; color: var(--muted);">Latest learning sessions</span>
                </div>
                ${attempts.length > 5 ? `<a href="./profile.html" class="btn-outline" style="min-height: 32px; padding: 0 12px; font-size: 0.8rem;">View All</a>` : ''}
              </div>
              <div class="timeline-list" style="display: flex; flex-direction: column; gap: 8px;">
                ${recent.length ? recent.slice(0,5).map(a => `
                  <div class="timeline-item" style="padding: 12px 16px; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-md); border: 1px solid var(--line); display: grid; grid-template-columns: 1fr; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <strong style="color: var(--text); font-size: 0.95rem; font-weight: 600;">${a.percentage}% Score</strong>
                      <span style="font-size: 0.7rem; background: var(--bg); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--line); font-weight: 700; color: var(--muted);">${a.settings?.difficulty?.toUpperCase() || 'MODERATE'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                       <span style="color: var(--muted); font-size: 0.8rem;">${formatDate(a.createdAt)}</span>
                       <span style="color: var(--text); font-size: 0.85rem; font-weight: 500;">${a.score}/${a.total} Correct</span>
                    </div>
                  </div>
                `).join("") : `<div class="empty-state-mini" style="padding: 24px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span style="color: var(--muted); font-size: 0.9rem;">No recent activity. Start a quiz!</span></div>`}
              </div>
            </section>

            <section class="panel flow-card" style="padding: 24px; border-radius: var(--radius-lg);">
              <div class="card-title-row" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <strong style="font-size:1.1rem; display:block;">Top Players</strong>
                  <span style="display:block; margin-top:4px; font-size:0.85rem; color: var(--muted);">Global ranking preview</span>
                </div>
                <a href="./scoreboard.html" class="btn-outline" style="min-height: 32px; padding: 0 12px; font-size: 0.8rem;">Leaderboard</a>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                 ${topPlayers.length ? topPlayers.map((p, idx) => `
                   <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(255, 255, 255, 0.02); border-radius: var(--radius-md); border: 1px solid var(--line); ${p.email === auth?.getSession?.()?.email ? 'border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.05);' : ''}">
                      <div style="display: flex; align-items: center; gap: 16px;">
                        <span style="font-size: 0.85rem; font-weight: 700; color: var(--muted); width: 20px; text-align: center;">${idx + 1}</span>
                        <strong style="font-size: 0.95rem; color: var(--text);">${escapeHtml(p.name)}</strong>
                      </div>
                      <span style="font-size: 0.85rem; font-weight: 600; color: var(--muted);">${p.totalXp} XP</span>
                   </div>
                 `).join("") : `<div class="empty-state-mini" style="padding: 16px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span style="color: var(--muted); font-size: 0.85rem;">No players ranked yet.</span></div>`}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
`;
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