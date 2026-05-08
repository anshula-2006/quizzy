import auth from "../auth.js";
import { getFlashDecks, getMiniGameStats, getSavedQuizHistory, apiRequest, escapeHtml } from "./shared.js";
import { getGamificationSummary, getResolvedBadges, mergeBadgesFromSources, getStreak } from "./gamification.js";

const root = document.getElementById("profileRoot");

function averageScore(attempts) {
  return entries.length ? Math.round(entries.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / entries.length) : 0;
}

function formatShortDate(isoValue) {
  const dt = new Date(isoValue);
  if (Number.isNaN(dt.getTime())) return "Unknown time";
  return dt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function heatmap(entries) {
  const counts = new Map();
  entries.forEach((entry) => {
    if (!entry.createdAt) return;
    counts.set(new Date(entry.createdAt).toISOString().slice(0, 10), (counts.get(new Date(entry.createdAt).toISOString().slice(0, 10)) || 0) + 1)
  });
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (27 - index));
    const dateStr = date.toISOString().slice(0, 10);
    const count = counts.get(dateStr) || 0;
    return `<span class="heat-cell heat-${Math.min(4, count)}" title="${dateStr}: ${count} quizzes"></span>`;
  }).join("");
}

function getWeeklyData(attempts) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString([], { weekday: "short" }), score: 0, xp: 0, count: 0 };
  });
  const lookup = new Map(days.map((day) => [day.key, day]));
  attempts.forEach((entry) => {
    if (!entry.createdAt) return;
    const key = new Date(entry.createdAt).toISOString().slice(0, 10);
    const day = lookup.get(key);
    if (!day) return;
    day.score += Number(entry.percentage || 0);
    day.count += 1;
  });
  return days.map((day) => ({ ...day, score: day.count ? Math.round(day.score / day.count) : 0 }));
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
  return [...buckets.values()].map((item) => ({ ...item, average: item.count ? Math.round(item.total / item.count) : 0 })).sort((a, b) => b.count - a.count);
}

function statCard(label, value, helper) {
  return `
    <article class="saas-stat-card panel" style="padding: 16px; border-radius: var(--radius-md);">
      <span class="saas-stat-label">${label}</span>
      <strong class="saas-stat-value" style="font-size: 1.5rem; margin: 4px 0;">${value}</strong>
      <span class="saas-stat-helper" style="font-size: 0.8rem;">${helper}</span>
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
      <svg class="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Weekly performance" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; filter: none; margin: 0;">
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

async function init() {
  let data = await apiRequest("/data/bootstrap");
  if (!data) {
    data = { attempts: getSavedQuizHistory(), flashDecks: getFlashDecks(), miniGameStats: getMiniGameStats(), profile: null, leaderboard: [] };
  }
  const session = auth?.getSession?.();
  const attempts = Array.isArray(data.attempts) ? data.attempts : [];
  const flashDecks = Array.isArray(data.flashDecks) ? data.flashDecks : [];
  const profile = data.profile || null;
  const leaderboard = Array.isArray(data.leaderboard) ? data.leaderboard : [];
  
  mergeBadgesFromSources(attempts, profile, profile?.achievements || []);
  const game = getGamificationSummary(attempts, profile);
  const badges = getResolvedBadges(attempts, profile);
  const unlocked = badges.filter((badge) => badge.unlocked);
  const avg = averageScore(attempts);
  const weeklyData = getWeeklyData(attempts);
  const categoryStats = getCategoryStats(attempts);
  
  const email = session?.email || session?.user?.email;
  const rankEntry = leaderboard.find((p) => p.email === email);
  const rank = rankEntry?.rank || profile?.rank || "--";
  const name = session?.name || profile?.name || "Player";
  const avatarInitial = escapeHtml(name.slice(0, 1).toUpperCase());

  root.innerHTML = `
    <section class="profile-header-compact panel" style="margin-bottom: 24px; padding: 24px;">
      <div class="profile-identity">
        <div class="profile-avatar-large" style="width: 64px; height: 64px; font-size: 2rem;">${avatarInitial}</div>
        <div class="profile-title">
          <h1 style="font-size: 1.6rem; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.02em;">${escapeHtml(name)}</h1>
          <span style="color: var(--muted); font-size: 0.95rem;">Level ${game.level} • ${game.totalXp} XP</span>
        </div>
      </div>
      <div class="profile-metrics" style="gap: 32px;">
        <div class="profile-metric"><span>Global Rank</span><strong style="font-size: 1.4rem;">${rank === "--" ? "--" : "#" + rank}</strong></div>
        <div class="profile-metric border-left" style="padding-left: 32px;"><span>Streak</span><strong style="font-size: 1.4rem;">${game.streak} 🔥</strong></div>
      </div>
    </section>

    <section class="hero-stats-grid" style="margin-bottom: 24px;">
      ${statCard("Total Quizzes", attempts.length || Number(profile?.totalQuizzes || 0), "Completions")}
      ${statCard("Accuracy", avg + "%", "Average score")}
      ${statCard("Flashcards", flashDecks.length, "Decks created")}
      ${statCard("Badges", unlocked.length, "Earned out of " + badges.length)}
    </section>

    <div class="dashboard-content-grid" style="grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 24px;">
      <!-- Left Column -->
      <div style="display: grid; gap: 24px; align-content: start;">
        <section class="panel flow-card">
           <div class="card-title-row">
             <div><strong style="font-size:1.1rem;">Accuracy Trend</strong><span style="display:block; margin-top:2px; font-size:0.85rem;">Performance over the last 7 days</span></div>
           </div>
           ${renderLineChart(weeklyData)}
        </section>
        
        <section class="panel flow-card">
           <div class="card-title-row">
             <div><strong style="font-size:1.1rem;">Category Performance</strong><span style="display:block; margin-top:2px; font-size:0.85rem;">Accuracy by subject or mode</span></div>
           </div>
           <div style="display: grid; gap: 8px; margin-top: 16px;">
             ${categoryStats.length ? categoryStats.slice(0, 5).map(c => `
               <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--panel-soft); border-radius: var(--radius-md); border: 1px solid var(--line);">
                 <span style="font-size: 0.9rem; text-transform: capitalize; font-weight: 600;">${escapeHtml(c.label)}</span>
                 <div style="display: flex; align-items: center; gap: 16px;">
                   <span style="font-size: 0.8rem; color: var(--muted);">${c.count} quizzes</span>
                   <strong style="font-size: 0.95rem; color: var(--text);">${c.average}%</strong>
                 </div>
               </div>
             `).join("") : `<div class="empty-state-mini" style="padding: 16px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span style="color: var(--muted); font-size: 0.85rem;">No category data yet.</span></div>`}
           </div>
        </section>
        
        <section class="panel flow-card">
           <div class="card-title-row">
             <div><strong style="font-size:1.1rem;">Activity Map</strong><span style="display:block; margin-top:2px; font-size:0.85rem;">Quiz completions in the last 28 days</span></div>
           </div>
           <div class="activity-heatmap" style="margin-top: 20px;">${heatmap(attempts)}</div>
        </section>
      </div>

      <!-- Right Column -->
      <div style="display: grid; gap: 24px; align-content: start;">
        <section class="panel flow-card">
          <div class="card-title-row">
            <div><strong style="font-size:1.1rem;">Level Progress</strong><span style="display:block; margin-top:2px; font-size:0.85rem;">Journey to Level ${game.level + 1}</span></div>
          </div>
          <div class="mini-progress" style="margin-top: 16px; height: 8px;"><span style="width:${game.progress}%"></span></div>
          <div style="display: flex; justify-content: space-between; margin-top: 12px;">
             <span style="font-size: 0.85rem; color: var(--text); font-weight: 600;">${game.totalXp} XP</span>
             <span style="font-size: 0.85rem; color: var(--muted);">${180 - (game.totalXp % 180)} XP to next level</span>
          </div>
        </section>
        
        <section class="panel flow-card">
          <div class="card-title-row">
            <div><strong style="font-size:1.1rem;">Recent Activity</strong><span style="display:block; margin-top:2px; font-size:0.85rem;">Your latest sessions</span></div>
          </div>
          <div class="timeline-list" style="margin-top: 16px; display: grid; gap: 8px;">
             ${attempts.length ? attempts.slice(0, 5).map(a => `
               <div class="timeline-item" style="grid-template-columns: 1fr; padding: 14px; border-radius: var(--radius-md);">
                 <div style="display: flex; justify-content: space-between; align-items: center;">
                   <strong style="color: var(--text); font-size: 0.95rem;">${a.percentage}% Score</strong>
                   <span style="font-size: 0.75rem; background: var(--panel-soft); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--line); font-weight: 600;">${a.settings?.difficulty?.toUpperCase() || 'MODERATE'}</span>
                 </div>
                 <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                    <span style="color: var(--muted); font-size: 0.8rem;">${formatShortDate(a.createdAt)}</span>
                    <span style="color: var(--muted); font-size: 0.8rem;">${a.score}/${a.total} Correct</span>
                 </div>
               </div>
             `).join("") : `<div class="empty-state-mini" style="padding: 24px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md);"><span style="color: var(--muted); font-size: 0.9rem;">No recent activity.</span></div>`}
          </div>
        </section>

        <section class="panel flow-card">
          <div class="card-title-row">
            <div><strong style="font-size:1.1rem;">Top Achievements</strong><span style="display:block; margin-top:2px; font-size:0.85rem;">Your most recent badges</span></div>
          </div>
          <div class="premium-badges" style="display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-top: 16px;">
             ${unlocked.length ? unlocked.slice(0, 4).map(badge => `
               <article class="badge-card is-unlocked ${badge.rarity}" style="min-height: auto; padding: 16px; border-radius: var(--radius-md); background: var(--panel-soft); border: 1px solid var(--line); display: flex; align-items: center; gap: 12px;">
                 <span class="badge-icon" style="width: 40px; height: 40px; margin: 0; box-shadow: none; background: rgba(255,255,255,0.05); border: none; display: grid; place-items: center; border-radius: 8px; flex-shrink: 0;">
                   <img src="${badge.icon}" alt="${badge.label}" loading="lazy" style="width: 24px; height: 24px;" />
                 </span>
                 <div style="min-width: 0;">
                   <strong style="display: block; font-size: 0.95rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${badge.label}</strong>
                   <span style="display: block; margin-top: 2px; font-size: 0.75rem; color: var(--muted);">${badge.rarity}</span>
                 </div>
               </article>
             `).join("") : `<div class="empty-state-mini" style="padding: 16px; text-align: center; border: 1px dashed var(--line); border-radius: var(--radius-md); grid-column: 1 / -1;"><span style="color: var(--muted); font-size: 0.85rem;">No badges earned yet.</span></div>`}
          </div>
        </section>
      </div>
    </div>
  `;
}

init();
