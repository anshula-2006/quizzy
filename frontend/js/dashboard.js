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
  root.className = "page-fade";
  root.innerHTML = `
page    <div class="hero-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px;">${Array.from({ length: 4 }, () => `<div class="analytics-card skeleton-panel" style="height: 100px; border-radius: 12px;"></div>`).join("")}</div>
    <div class="dashboard-content-grid" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 24px;">
       <div class="chart-card panel skeleton-panel" style="height: 300px; border-radius: 16px;"></div>
       <div class="chart-card panel skeleton-panel" style="height: 300px; border-radius: 16px;"></div>
    </div>
  `;
}

function getCompactIcon(type) {
  const icons = {
    xp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`,
    rank: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5aa2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`,
    accuracy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M22 12h-4"></path><path d="M6 12H2"></path><path d="M12 6V2"></path><path d="M12 22v-4"></path><circle cx="12" cy="12" r="2"></circle></svg>`,
    streak: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`,
    quizzes: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    badges: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15l-3 3-1-4-4-1 3-3-1-4 4 1 3-3 3 3 4-1-1 4 3 3-4 1-1 4-3-3z"></path></svg>`
  };
  return icons[type] || "";
}

function compactStatCard(label, value, helper, iconType) {
  return `
    <article class="dash-stat-card">
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="width: 40px; height: 40px; display: grid; place-items: center; border-radius: 14px; background: var(--color-surface-3); color: var(--color-text-primary);">
          ${getCompactIcon(iconType)}
        </div>
        <div style="min-width: 0;">
          <span class="saas-stat-label">${label}</span>
          <div class="saas-stat-value">${value}</div>
        </div>
      </div>
      ${helper ? `<p class="section-copy" style="margin: 0;">${helper}</p>` : ''}
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
  const profile = data?.profile || null;
  const leaderboard = Array.isArray(data?.leaderboard) ? data.leaderboard.filter(user => {
    if (!user) return false;
    const name = String(user.name || '').toLowerCase();
    const email = String(user.email || '').toLowerCase();
    return !user.isDummy && !user.isFake && !name.includes('dummy') && !name.includes('fake') && !email.includes('dummy');
  }) : [];
  const game = getGamification(attempts, profile);
  const badges = getBadgeCatalog(attempts);
  const unlockedBadges = badges.filter((badge) => badge.unlocked);
  const weekly = getWeeklyData(attempts);
  const avg = averageScore(attempts);
  const best = attempts.length ? Math.max(...attempts.map((entry) => Number(entry.percentage || 0))) : Number(profile?.bestPercentage || 0);
  const rank = getRank(profile, leaderboard);
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
    ${compactStatCard("Streak", game.streak, "Consecutive >70%", "streak")}
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
    welcomeSub = "Pick up where you left off and keep your learning streak moving.";
    actionButtons = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <a href="./generate.html?topic=Daily%20Trivia%20Challenge&mode=arcade" class="btn" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem; background: var(--success); color: #fff; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); border: none;">Daily Challenge</a>
        <a href="./arcade.html" class="btn" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Learning Games</a>
        <a href="./generate.html" class="btn-outline" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Take a Quiz</a>
      </div>
    `;
    statsRow = `
      ${compactStatCard("XP", game.totalXp, "Points!", "xp")}
      ${compactStatCard("Level", game.level, "Keep going!", "streak")}
      ${compactStatCard("Badges", unlockedBadges.length, "Collected", "badges")}
      ${compactStatCard("Streak", game.streak, "Current run", "streak")}
    `;
  } else if (userType === 'self_learner') {
    welcomeSub = "Track your mastery, revise weak topics, and build habits.";
    actionButtons = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <a href="./generate.html?topic=Daily%20Revision%20Challenge&mode=exam" class="btn" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem; background: var(--success); color: #fff; box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4); border: none;">Daily Challenge</a>
        <a href="./generate.html?mode=focus" class="btn" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Focus Study</a>
        <a href="./generate.html?mode=revision" class="btn-outline" style="min-height: 32px; padding: 0 16px; font-size: 0.85rem;">Revision Mode</a>
      </div>
    `;
    statsRow = `
      ${compactStatCard("Mastery", game.level, "Current Level", "xp")}
      ${compactStatCard("Accuracy", avg + "%", "Overall Rate", "accuracy")}
      ${compactStatCard("Flashcards", flashDecks.length, "Decks Active", "quizzes")}
      ${compactStatCard("Streak", game.streak, "Consistent Study", "streak")}
    `;
  }

  const quizzesCompleted = attempts.length;
  const currentName = escapeHtml(auth?.getSession?.()?.name || auth?.getSession?.()?.email || 'Player');
  const latestFlashcards = Array.isArray(flashDecks) ? flashDecks.slice(0, 3) : [];
  const totalFlashcards = Array.isArray(flashDecks) ? flashDecks.length : 0;
  const recentActivity = recent.slice(0, 4);
  const lastAttempt = attempts[0] || null;
  const reviewTopic = lastAttempt?.settings?.topic || lastAttempt?.sourceType || 'your next review';

  // Leaderboard Preview Component
  const top3 = leaderboard.slice(0, 3);
  const leaderboardHtml = top3.length > 0 
    ? top3.map((player, idx) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--color-border-default);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <strong style="color: var(--color-text-secondary); width: 20px;">#${idx + 1}</strong>
            <span style="font-size: 0.9rem; font-weight: 600;">${escapeHtml(player.name)}</span>
          </div>
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--color-accent);">${player.totalXp} XP</span>
        </div>
      `).join('')
    : '<p class="section-copy">No ranked players yet.</p>';

  root.className = "page-fade";
  root.innerHTML = `
    <div style="margin-bottom: var(--space-6);">
      <h1 class="section-title" style="font-size: 2rem;">Welcome back, ${currentName}</h1>
      <p class="section-copy" style="max-width: 600px;">${welcomeSub}</p>
    </div>

    <div class="dashboard-content-grid">
      <!-- Left Column: Primary Learning Workflows -->
      <div style="display: grid; gap: var(--space-6); align-content: start;">
        
        <!-- Continue Learning / Hero -->
        <section class="panel flow-card" style="padding: var(--space-6); background: linear-gradient(145deg, var(--color-surface-2), var(--color-surface-1));">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--space-4);">
            <div style="flex: 1; min-width: 280px;">
              <p class="eyebrow">Continue Learning</p>
              <h2 style="margin: var(--space-2) 0; font-size: 1.5rem; font-weight: 700;">
                ${lastAttempt ? escapeHtml(reviewTopic) : 'Start your first quiz'}
              </h2>
              <p class="section-copy" style="margin-bottom: var(--space-4);">
                ${lastAttempt ? 'Resume practice to improve your accuracy and earn more XP.' : 'Generate a quiz from any topic, URL, or PDF to begin.'}
              </p>
              ${actionButtons}
            </div>
            ${lastAttempt ? `
              <div style="text-align: right; background: var(--color-surface-2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border-default);">
                <span style="font-size: 0.8rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Last Score</span>
                <strong style="display: block; font-size: 1.75rem; color: var(--color-text-primary); line-height: 1.1;">${lastAttempt.percentage}%</strong>
              </div>
            ` : ''}
          </div>
        </section>

        <!-- Recent Flashcards -->
        <section class="panel flow-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
            <strong style="font-size: 1.1rem;">Your Flashcards</strong>
            <a href="./flashcards.html" class="text-secondary text-sm" style="font-weight: 500;">View all</a>
          </div>
          ${latestFlashcards.length 
            ? `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-3);">
                 ${latestFlashcards.map(deck => `
                   <a href="./flashcards.html" style="display: block; padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid var(--color-border-default); background: var(--color-surface-2); text-decoration: none; color: inherit; transition: border-color var(--transition-fast);">
                     <strong style="display: block; font-size: 0.95rem; margin-bottom: var(--space-1);">${escapeHtml(deck.title || 'Untitled Deck')}</strong>
                     <span class="text-secondary text-sm">${Array.isArray(deck.flashcards) ? deck.flashcards.length : 0} terms</span>
                   </a>
                 `).join('')}
               </div>`
            : `<div class="empty-state-mini">No flashcard decks yet. Create one from Generate.</div>`
          }
        </section>

        <!-- Recent Quizzes -->
        <section class="panel flow-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
            <strong style="font-size: 1.1rem;">Recent Quizzes</strong>
            ${attempts.length > 4 ? `<a href="./profile.html" class="text-secondary text-sm" style="font-weight: 500;">View all</a>` : ''}
          </div>
          <div style="display: grid; gap: var(--space-2);">
            ${recentActivity.length 
              ? recentActivity.map(a => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) var(--space-4); background: var(--color-surface-2); border: 1px solid var(--color-border-default); border-radius: var(--radius-md);">
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <strong style="font-size: 0.95rem;">${a.settings?.topic ? escapeHtml(a.settings.topic) : 'Practice Session'}</strong>
                    <span class="text-secondary text-xs">${formatDate(a.createdAt)} • ${(a.settings?.difficulty || 'Mixed').toUpperCase()}</span>
                  </div>
                  <div style="text-align: right;">
                    <strong style="font-size: 1.1rem; color: ${a.percentage >= 70 ? 'var(--color-success-light)' : 'var(--color-text-primary)'};">${a.percentage}%</strong>
                    <span class="text-secondary text-xs" style="display: block;">${a.score}/${a.total}</span>
                  </div>
                </div>
              `).join('')
              : `<div class="empty-state-mini">No recent activity. Start a quiz to see history.</div>`
            }
          </div>
        </section>
      </div>

      <!-- Right Column: Quick Stats & Leaderboard -->
      <div style="display: grid; gap: var(--space-6); align-content: start;">
        
        <!-- Stats Grid 2x2 -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
          <div class="panel flow-card" style="padding: var(--space-4); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
            <span class="text-secondary text-xs" style="text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Total XP</span>
            <strong style="font-size: 1.75rem; color: var(--color-accent); line-height: 1;">${game.totalXp}</strong>
          </div>
          <div class="panel flow-card" style="padding: var(--space-4); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
            <span class="text-secondary text-xs" style="text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Avg Score</span>
            <strong style="font-size: 1.75rem; line-height: 1;">${avg}%</strong>
          </div>
          <div class="panel flow-card" style="padding: var(--space-4); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
            <span class="text-secondary text-xs" style="text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Streak</span>
            <strong style="font-size: 1.75rem; line-height: 1;">${game.streak} 🔥</strong>
          </div>
          <div class="panel flow-card" style="padding: var(--space-4); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
            <span class="text-secondary text-xs" style="text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Quizzes</span>
            <strong style="font-size: 1.75rem; line-height: 1;">${quizzesCompleted}</strong>
          </div>
        </div>

        <!-- Leaderboard Preview -->
        <section class="panel flow-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
            <strong style="font-size: 1.1rem;">Top Performers</strong>
            <a href="./scoreboard.html" class="text-secondary text-sm" style="font-weight: 500;">Full board</a>
          </div>
          <div style="display: flex; flex-direction: column;">
            ${leaderboardHtml}
          </div>
        </section>
        
        <!-- Progress Readout -->
        <section class="panel flow-card">
          <strong style="display: block; font-size: 1.1rem; margin-bottom: var(--space-3);">Insights</strong>
          <div style="display: grid; gap: var(--space-3);">
            ${insights.slice(0, 3).map(insight => `
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span class="text-xs" style="color: var(--color-text-secondary); text-transform: uppercase;">${insight.label}</span>
                <span style="font-size: 0.9rem;">${insight.value}</span>
              </div>
            `).join('')}
          </div>
        </section>

      </div>
    </div>
`;

  const downloadBtn = document.getElementById("downloadClassReportBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const lines = [
        "Quizzy Classroom Performance Report",
        `Generated: ${new Date().toLocaleString()}`,
        "",
        "Active Students (Top 50):",
        ...leaderboard.slice(0,50).map((p, idx) => `${idx + 1}. ${p.name} - ${p.totalXp} XP (Level ${Math.max(1, Math.floor((p.totalXp||0) / 180) + 1)}) | Streak: ${p.currentStreak || 0}`),
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
