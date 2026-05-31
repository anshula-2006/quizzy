import auth from "../auth.js";
import { apiRequest, escapeHtml } from "./shared.js";
import Chart from 'chart.js/auto';
import { createIcons, Trophy, Star, Target, Flame, FileText, Medal, Activity, Play, Layers, Download } from 'lucide';

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
    const label = entry?.settings?.topic || entry?.sourceInput || entry?.sourceTopic || "General Topic";
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
  const mostStudied = categoryStats.length ? [...categoryStats].sort((a, b) => b.count - a.count)[0] : null;

  return [
    { label: "Strongest Topic", value: strongest ? `${escapeHtml(strongest.label)} (${strongest.average}%)` : "Play a quiz to calibrate" },
    { label: "Weakest Topic", value: weakest ? `${escapeHtml(weakest.label)} (${weakest.average}%)` : "Play a quiz to calibrate" },
    { label: "Most Studied", value: mostStudied ? `${escapeHtml(mostStudied.label)} (${mostStudied.count} times)` : "Play a quiz to calibrate" },
    { label: "Improvement Needed", value: weakest && weakest.average < 70 ? `Review ${escapeHtml(weakest.label)}` : "Keep up the good work!" }
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
    <div class="dashboard-stat-grid">${Array.from({ length: 4 }, () => `<div class="analytics-card skeleton-panel"></div>`).join("")}</div>
    <div class="dashboard-content-grid">
       <div class="chart-card panel skeleton-panel"></div>
       <div class="chart-card panel skeleton-panel"></div>
    </div>
  `;
}

function getCompactIcon(type) {
  const iconMap = {
    xp: `<i data-lucide="star" style="width: 20px; height: 20px;"></i>`,
    rank: `<i data-lucide="trophy" style="width: 20px; height: 20px;"></i>`,
    accuracy: `<i data-lucide="target" style="width: 20px; height: 20px;"></i>`,
    streak: `<i data-lucide="flame" style="width: 20px; height: 20px;"></i>`,
    quizzes: `<i data-lucide="file-text" style="width: 20px; height: 20px;"></i>`,
    badges: `<i data-lucide="medal" style="width: 20px; height: 20px;"></i>`,
    layers: `<i data-lucide="layers" style="width: 20px; height: 20px;"></i>`
  };
  return iconMap[type] || `<i data-lucide="activity" style="width: 20px; height: 20px;"></i>`;
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
      ${helper ? `<p class="section-copy" style="margin: 0; font-size: 0.8rem;">${helper}</p>` : ''}
    </article>
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
  // Default stats row shown on the dashboard; overwritten for specific user types when needed
  let statsRow = `
    ${compactStatCard("Total XP", game.totalXp, "Level " + game.level, "xp")}
    ${compactStatCard("Global Rank", rank === "--" ? "--" : "#" + rank, "Leaderboard", "rank")}
    ${compactStatCard("Accuracy", avg + "%", "Best: " + best + "%", "accuracy")}
    ${compactStatCard("Streak", game.streak, "Consecutive >70%", "streak")}
    ${compactStatCard("Quizzes", attempts.length, "Total completions", "quizzes")}
    ${compactStatCard("Badges", unlockedBadges.length, "Out of " + badges.length, "badges")}
  `;
  const recent = attempts.slice(0, 6);
  const insights = getInsights(attempts, badges, profile);
  const categoryStats = getCategoryStats(attempts);
  const session = auth?.getSession?.();

  const welcomeSub = "Here's your learning progress and personalized recommendations.";

  // Personalized Smart Count logic
  const hasHistory = attempts.length > 0;
  const smartCount = hasHistory && avg < 60 ? 5 : hasHistory && avg > 85 ? 15 : 10;

  let actionButtons = `
    <div class="dashboard-actions">
      <a href="./generate.html?count=${smartCount}" class="btn btn-primary"><i data-lucide="play" style="width: 14px; height: 14px; margin-right: 6px;"></i> Start Smart Quiz</a>
      <a href="./flashcards.html" class="btn btn-secondary"><i data-lucide="layers" style="width: 14px; height: 14px; margin-right: 6px;"></i> Study Flashcards</a>
    </div>
  `;

  const quizzesCompleted = attempts.length;
  const currentName = escapeHtml(auth?.getSession?.()?.name || auth?.getSession?.()?.email || 'Player');
  const latestFlashcards = Array.isArray(flashDecks) ? flashDecks.slice(0, 3) : [];
  const totalFlashcards = Array.isArray(flashDecks) ? flashDecks.length : 0;
  const recentActivity = recent.slice(0, 4);
  const lastAttempt = attempts[0] || null;
  const reviewTopic = lastAttempt?.settings?.topic || lastAttempt?.sourceInput || lastAttempt?.sourceTopic || 'your next review';
  const weakestTopic = categoryStats.length ? [...categoryStats].sort((a, b) => a.average - b.average)[0] : null;
  const mostStudiedTopic = categoryStats.length ? [...categoryStats].sort((a, b) => b.count - a.count)[0] : null;
  const personalizedFocus = weakestTopic ? `Review ${escapeHtml(weakestTopic.label)}` : `Practice ${escapeHtml(reviewTopic)}`;
  const personalizedNextStep = attempts.length ? `Continue with ${escapeHtml(reviewTopic)}` : 'Create your first quiz';
  const flashcardsStatus = totalFlashcards ? `${totalFlashcards} deck${totalFlashcards === 1 ? '' : 's'} ready to review` : 'No decks created yet';
  
  const isNewUser = attempts.length === 0 && flashDecks.length === 0;

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
    <div class="card-title-row">
      <div>
        <h1 class="section-title">Welcome back, ${currentName}</h1>
        <p class="section-copy">${welcomeSub}</p>
      </div>
      <div>
        ${actionButtons}
      </div>
    </div>

    <div class="dashboard-stat-grid">
      ${statsRow}
    </div>

    <div class="dashboard-content-grid">
      <!-- Left Column: Primary Learning Workflows -->
      <div style="display: grid; gap: var(--space-4); align-content: start;">
        
        <!-- Continue Learning / Hero -->
        <section class="panel flow-card" style="background: linear-gradient(145deg, var(--color-surface-2), var(--color-surface-1));">
          ${isNewUser 
            ? `
            <div style="display: flex; flex-direction: column; gap: var(--space-3); align-items: start;">
              <div>
                <p class="eyebrow">Get Started</p>
                <h2 style="margin: var(--space-1) 0; font-size: 1.25rem; font-weight: 700;">
                  Ready to start learning?
                </h2>
                <p class="section-copy" style="margin: 0; font-size: 0.9rem;">
                  Generate your first quiz from a topic, PDF, or web page.
                </p>
              </div>
              <a href="./generate.html" class="btn">Create Your First Quiz</a>
            </div>
            ` 
            : `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3);">
              <div style="flex: 1; min-width: 200px;">
                <p class="eyebrow">Continue Learning</p>
                <h2 style="margin: var(--space-1) 0; font-size: 1.25rem; font-weight: 700;">
                  ${lastAttempt ? escapeHtml(reviewTopic) : 'Start your first quiz'}
                </h2>
                <p class="section-copy" style="margin: 0; font-size: 0.9rem;">
                  ${lastAttempt ? 'Resume practice to improve your accuracy and earn more XP.' : 'Generate a quiz from any topic or document to begin.'}
                </p>
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-3);">
                ${lastAttempt ? `
                  <div style="text-align: right;">
                    <span style="font-size: 0.75rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">Last Score</span>
                    <strong style="display: block; font-size: 1.5rem; color: var(--color-text-primary); line-height: 1;">${lastAttempt.percentage}%</strong>
                  </div>
                ` : ''}
                <a href="./generate.html${lastAttempt ? `?topic=${encodeURIComponent(reviewTopic)}&mode=revision` : ''}" class="btn" style="white-space: nowrap;">
                  ${lastAttempt ? 'Practice Again' : 'Create Quiz'}
                </a>
              </div>
            </div>
            `
          }
        </section>

        <!-- Nested Grid for Quizzes and Flashcards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4);">

          <!-- Performance Chart -->
          <section class="panel flow-card" style="grid-column: 1 / -1;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
              <strong style="font-size: 1.1rem;">Performance Trend</strong>
            </div>
            <div style="height: 200px; width: 100%;">
              <canvas id="performanceChart"></canvas>
            </div>
          </section>

          <!-- Recent Quizzes -->
          <section class="panel flow-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
              <strong style="font-size: 1.1rem;">Recent Quizzes</strong>
              ${attempts.length > 4 ? `<a href="./profile.html" class="text-secondary text-sm" style="font-weight: 500;">View all</a>` : ''}
            </div>
            <div style="display: grid;">
              ${recentActivity.length 
                ? recentActivity.map((a, i) => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) 0; ${i !== recentActivity.length - 1 ? 'border-bottom: 1px solid var(--color-border-default);' : ''}">
                    <div style="min-width: 0; flex: 1; padding-right: var(--space-3);">
                      <strong style="font-size: 0.95rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${a.settings?.topic ? escapeHtml(a.settings.topic) : 'Practice Session'}</strong>
                      <span class="text-secondary text-xs">${formatDate(a.createdAt)} • ${(a.settings?.difficulty || 'Mixed').toUpperCase()}</span>
                    </div>
                    <strong style="font-size: 1.1rem; color: ${a.percentage >= 70 ? 'var(--color-success-light)' : 'var(--color-text-primary)'};">${a.percentage}%</strong>
                  </div>
                `).join('')
                : `
                <div style="padding: var(--space-4); text-align: center; background: var(--color-surface-2); border-radius: var(--radius-lg); border: 1px dashed var(--color-border-default);">
                  <p class="section-copy" style="margin: 0 0 var(--space-2); font-size: 0.9rem;">No quizzes yet</p>
                  <a href="./generate.html" class="btn btn-secondary">Take your first quiz</a>
                </div>
              `
              }
            </div>
          </section>

          <!-- Recent Flashcards -->
          <section class="panel flow-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
              <strong style="font-size: 1.1rem;">Your Flashcards</strong>
              <a href="./flashcards.html" class="text-secondary text-sm" style="font-weight: 500;">View all</a>
            </div>
            <div style="display: grid;">
              ${latestFlashcards.length 
                ? latestFlashcards.map((deck, i) => `
                  <a href="./flashcards.html" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-3) 0; text-decoration: none; color: inherit; ${i !== latestFlashcards.length - 1 ? 'border-bottom: 1px solid var(--color-border-default);' : ''}">
                    <strong style="font-size: 0.95rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: var(--space-3);">${escapeHtml(deck.title || 'Untitled Deck')}</strong>
                    <span class="text-secondary text-xs" style="white-space: nowrap;">${Array.isArray(deck.flashcards) ? deck.flashcards.length : 0} terms</span>
                  </a>
                `).join('')
                : `
                <div style="padding: var(--space-4); text-align: center; background: var(--color-surface-2); border-radius: var(--radius-lg); border: 1px dashed var(--color-border-default);">
                  <p class="section-copy" style="margin: 0 0 var(--space-2); font-size: 0.9rem;">No flashcards yet</p>
                  <a href="./generate.html" class="btn btn-secondary">Create a deck</a>
                </div>
              `
              }
            </div>
          </section>
        </div>
      </div>

      <!-- Right Column: Leaderboard & Insights -->
      <div style="display: grid; gap: var(--space-4); align-content: start;">

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

        <section class="panel flow-card">
          <strong style="display: block; font-size: 1.1rem; margin-bottom: var(--space-3);">Learning Plan</strong>
          <div style="display: grid; gap: 16px;">
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span class="text-xs" style="color: var(--color-text-secondary);">Focus</span>
              <strong style="font-size: 0.95rem; text-align: right;">${personalizedFocus}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span class="text-xs" style="color: var(--color-text-secondary);">Next Step</span>
              <strong style="font-size: 0.95rem; text-align: right;">${personalizedNextStep}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span class="text-xs" style="color: var(--color-text-secondary);">Top Topic</span>
              <strong style="font-size: 0.95rem; text-align: right;">${mostStudiedTopic ? escapeHtml(mostStudiedTopic.label) : 'No topic yet'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span class="text-xs" style="color: var(--color-text-secondary);">Flashcard Status</span>
              <strong style="font-size: 0.95rem; text-align: right;">${flashcardsStatus}</strong>
            </div>
          </div>
        </section>
        
        <!-- Progress Readout -->
        <section class="panel flow-card">
          <strong style="display: block; font-size: 1.1rem; margin-bottom: var(--space-3);">Insights</strong>
          <div style="display: grid; gap: var(--space-4);">
            ${insights.slice(0, 4).map(insight => `
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

  requestAnimationFrame(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    } else {
      createIcons({
        icons: { Trophy, Star, Target, Flame, FileText, Medal, Activity, Play, Layers, Download }
      });
    }

    const ctx = document.getElementById('performanceChart');
    if (ctx && weekly.length > 0) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: weekly.map(w => w.label),
          datasets: [{
            label: 'Avg Accuracy',
            data: weekly.map(w => w.score),
            borderColor: '#6366F1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4
          }, {
            label: 'XP Gained',
            data: weekly.map(w => w.xp),
            borderColor: '#BE185D',
            backgroundColor: 'rgba(190, 24, 93, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, max: 100, grid: { color: '#374151' } },
            x: { grid: { display: false } }
          }
        }
      });
    }
  });

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
