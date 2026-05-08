import { getFlashDecks, getMiniGameStats, getSavedQuizHistory, apiRequest } from "./shared.js";
import { getGamificationSummary, getResolvedBadges, mergeBadgesFromSources } from "./gamification.js";

const root = document.getElementById("profileRoot");

function avg(entries) {
  return entries.length ? Math.round(entries.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / entries.length) : 0;
}

function heatmap(entries) {
  const counts = new Map();
  entries.forEach((entry) => counts.set(new Date(entry.createdAt).toISOString().slice(0, 10), (counts.get(new Date(entry.createdAt).toISOString().slice(0, 10)) || 0) + 1));
  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (27 - index));
    const count = counts.get(date.toISOString().slice(0, 10)) || 0;
    return `<span class="heat-cell heat-${Math.min(4, count)}"></span>`;
  }).join("");
}

async function init() {
  let data = await apiRequest("/data/bootstrap");
  if (!data) {
    data = { attempts: getSavedQuizHistory(), flashDecks: getFlashDecks(), miniGameStats: getMiniGameStats(), profile: null, leaderboard: [] };
  }
  const attempts = Array.isArray(data.attempts) ? data.attempts : [];
  const profile = data.profile || null;
  mergeBadgesFromSources(attempts, profile, profile?.achievements || []);
  const game = getGamificationSummary(attempts, profile);
  const badges = getResolvedBadges(attempts, profile);
  const unlocked = badges.filter((badge) => badge.unlocked);

  root.innerHTML = `
    <section class="panel dashboard-command profile-hero">
      <div>
        <p class="eyebrow">Profile analytics</p>
        <h1>${profile ? "Your performance profile" : "Guest profile"}</h1>
        <p>XP progression, accuracy, activity, and achievements in a compact view.</p>
      </div>
      <div class="quick-pill">${game.totalXp} XP</div>
    </section>
    <section class="hero-stats-grid profile-stats">
      <article class="analytics-card stat-card-premium"><span>Accuracy</span><strong>${avg(attempts)}%</strong><small>average score</small></article>
      <article class="analytics-card stat-card-premium"><span>Level</span><strong>${game.level}</strong><small>${game.progress}% to next</small></article>
      <article class="analytics-card stat-card-premium"><span>Streak</span><strong>${game.streak}</strong><small>current chain</small></article>
      <article class="analytics-card stat-card-premium"><span>Badges</span><strong>${unlocked.length}</strong><small>${badges.length} available</small></article>
    </section>
    <section class="dashboard-tab-panel is-active">
      <article class="panel flow-card">
        <div class="card-title-row"><div><strong>Activity heatmap</strong><span>Last 28 days</span></div></div>
        <div class="activity-heatmap">${heatmap(attempts)}</div>
      </article>
      <article class="panel flow-card">
        <div class="card-title-row"><div><strong>XP progression</strong><span>Current level progress</span></div></div>
        <div class="xp-progress" style="margin-top:20px;"><span style="width:${game.progress}%"></span></div>
        <p class="helper-text">${game.totalXp} total XP across quizzes and activities.</p>
      </article>
      <article class="panel flow-card wide-tab-card">
        <div class="card-title-row"><div><strong>Badge collection</strong><span>Common, rare, epic, legendary style cabinet</span></div></div>
        <div class="badge-grid premium-badges">
          ${badges.map((badge) => `<article class="badge-card ${badge.unlocked ? "is-unlocked" : "is-locked"} ${badge.rarity}"><span class="badge-icon"><img src="${badge.icon}" alt="${badge.label}" /></span><strong>${badge.label}</strong><small>${badge.unlocked ? "Unlocked" : badge.hint}</small></article>`).join("")}
        </div>
      </article>
    </section>
  `;
}

init();
