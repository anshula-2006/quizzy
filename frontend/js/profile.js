import auth from "../auth.js";
import { getFlashDecks, getMiniGameStats, getSavedQuizHistory, apiRequest, escapeHtml } from "./shared.js";
import { getGamificationSummary, getResolvedBadges, mergeBadgesFromSources, getStreak } from "./gamification.js";

const root = document.getElementById("profileRoot");

function averageScore(attempts) {
  return attempts.length ? Math.round(attempts.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / attempts.length) : 0;
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
    <article class="dash-stat-card glass-card glow-hover">
      <span class="saas-stat-label">${label}</span>
      <strong class="saas-stat-value">${value}</strong>
      <span class="saas-stat-helper">${helper}</span>
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
    <section class="panel flow-card dashboard-hero">
      <div class="dashboard-hero-copy">
        <p class="eyebrow">Profile overview</p>
        <h1 class="section-title">${escapeHtml(name)}</h1>
        <p class="section-copy">Your learning profile, progress, and achievements in one place.</p>
      </div>

      <div class="dashboard-top-metrics">
        ${statCard("Rank", rank === "--" ? "--" : `#${rank}`, "Leaderboard position")}
        ${statCard("Level", game.level, "Current stage")}
        ${statCard("Streak", `${game.streak} days`, "Live streak")}
        ${statCard("XP", game.totalXp, "Total points")}
      </div>
    </section>

    <div class="dashboard-stat-grid">
      ${statCard("Quizzes completed", attempts.length || Number(profile?.totalQuizzes || 0), "Sets finished")}
      ${statCard("Accuracy", `${avg}%`, "Average score")}
      ${statCard("Flashcards", flashDecks.length, "Decks created")}
      ${statCard("Badges unlocked", unlocked.length, `out of ${badges.length}`)}
    </div>

    <div class="dashboard-content-grid">
      <section class="panel flow-card">
        <div class="dashboard-block">
          <div class="card-title-row">
            <div>
              <strong class="section-title">Recent activity</strong>
              <span class="section-copy">Latest quiz sessions and performance details.</span>
            </div>
            ${attempts.length > 5 ? `<a href="./profile.html" class="ghost">View all</a>` : ""}
          </div>
          <div class="dashboard-list">
            ${attempts.length ? attempts.slice(0, 6).map((a) => `
              <article class="dashboard-activity-item">
                <div style="display:flex; justify-content:space-between; gap: var(--space-3); flex-wrap:wrap; align-items:center;">
                  <div>
                    <strong>${a.percentage}% score</strong>
                    <span class="section-copy">${escapeHtml(a.settings?.difficulty || "Mixed")} · ${escapeHtml(a.settings?.questionMode || "Quiz")}</span>
                  </div>
                  <span class="meta-chip">${formatShortDate(a.createdAt)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; gap: var(--space-3); flex-wrap:wrap;">
                  <span class="section-copy">${a.score || 0}/${a.total || 0} correct</span>
                  <span class="section-copy">${a.settings?.topic ? escapeHtml(a.settings.topic) : "Practice session"}</span>
                </div>
              </article>
            `).join("") : `<div class="empty-state-mini"><span>No recent activity yet. Take a quiz to begin your streak.</span></div>`}
          </div>
        </div>
      </section>

      <div class="dashboard-side-grid">
        <section class="panel flow-card">
          <div class="dashboard-block">
            <div class="card-title-row">
              <div>
                <strong class="section-title">Progress</strong>
                <span class="section-copy">XP to the next level and momentum.</span>
              </div>
            </div>
            <div class="profile-progress">
              <div class="mini-progress"><span style="width:${game.progress}%"></span></div>
              <div class="profile-progress-meta">
                <span>${game.totalXp} XP earned</span>
                <span>${Math.max(0, 180 - (game.totalXp % 180))} XP to next level</span>
              </div>
            </div>
          </div>
        </section>

        <section class="panel flow-card">
          <div class="dashboard-block">
            <div class="card-title-row">
              <div>
                <strong class="section-title">Recent badges</strong>
                <span class="section-copy">Your newest achievements at a glance.</span>
              </div>
            </div>
            <div class="profile-badge-grid">
              ${unlocked.length ? unlocked.slice(0, 6).map((badge) => `
                <article class="badge-card">
                  <span class="badge-icon">
                    <img src="${badge.icon}" alt="${badge.label}" loading="lazy" />
                  </span>
                  <div>
                    <strong>${badge.label}</strong>
                    <span>${badge.rarity}</span>
                  </div>
                </article>
              `).join("") : `<div class="empty-state-mini"><span>No badges earned yet. Keep quizzing to unlock new rewards.</span></div>`}
            </div>
            ${unlocked.length > 6 ? `<p class="section-copy" style="margin-top: var(--space-3);">+${unlocked.length - 6} more badges earned</p>` : ""}
          </div>
        </section>

        <section class="panel flow-card">
          <div class="dashboard-block">
            <div class="card-title-row">
              <div>
                <strong class="section-title">Activity map</strong>
                <span class="section-copy">Quiz habit over the last 28 days.</span>
              </div>
            </div>
            <div class="heatmap-grid">${heatmap(attempts)}</div>
          </div>
        </section>
      </div>
    </div>
  `;
}

init();
