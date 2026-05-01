import API_BASE from "./config.js";
import auth from "../auth.js";
import { getSavedQuizHistory, getFlashDecks, getMiniGameStats, saveFlashDecks, setMiniGameStats, apiRequest, escapeHtml } from "./shared.js";

const root = document.getElementById("dashboardRoot");
const SESSION_KEY = "quizzy-session-v2";

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

function renderDashboard(data) {
  const attempts = Array.isArray(data?.attempts) ? data.attempts : [];
  const flashDecks = Array.isArray(data?.flashDecks) ? data.flashDecks : [];
  const mini = data?.miniGameStats || {};
  const recent = attempts.slice(0, 5);
  const average = attempts.length
    ? Math.round(attempts.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / attempts.length)
    : 0;
  const best = attempts.length
    ? Math.max(...attempts.map((entry) => Number(entry.percentage || 0)))
    : 0;
  const cardCount = flashDecks.reduce((sum, deck) => sum + (Array.isArray(deck.flashcards) ? deck.flashcards.length : 0), 0);

  root.innerHTML = `
    <section class="panel flow-card dashboard-main-card">
      <div class="dashboard-hero">
        <div>
          <p class="eyebrow">Dashboard</p>
          <h1 class="section-title">Study snapshot</h1>
          <p class="section-copy">Your quizzes, decks, and mini-game momentum in one compact view.</p>
        </div>
        <div class="dashboard-actions">
          <a class="btn" href="./generate.html">New Quiz</a>
          <a class="btn-outline" href="./flashcards.html">Study Decks</a>
        </div>
      </div>

      <div class="dashboard-stat-grid">
        <article class="dash-stat-card accent-blue"><span>Average</span><strong>${average}%</strong><small>${attempts.length || 0} attempts</small></article>
        <article class="dash-stat-card accent-green"><span>Best Score</span><strong>${best}%</strong><small>Personal high</small></article>
        <article class="dash-stat-card accent-purple"><span>Decks</span><strong>${flashDecks.length}</strong><small>${cardCount} cards saved</small></article>
        <article class="dash-stat-card accent-amber"><span>Reaction Best</span><strong>${mini.reactionBest ? `${mini.reactionBest}` : "--"}</strong><small>${mini.reactionBest ? "milliseconds" : "No run yet"}</small></article>
      </div>

      <div class="dashboard-content-grid">
        <div class="setting-card dashboard-list-card">
          <div class="card-title-row">
            <strong>Recent Quizzes</strong>
            <span>${recent.length} shown</span>
          </div>
          <div class="dashboard-list">
            ${recent.length
              ? recent.map((entry) => `
                <div class="answer-option compact-row">
                  <div class="score-tile">
                    <span>Score</span>
                    <strong>${Number(entry.percentage || 0)}%</strong>
                  </div>
                  <div>
                    <div class="helper-text">${formatDate(entry.createdAt)}</div>
                    <div class="helper-text">${(entry.settings?.difficulty || "moderate").toUpperCase()} • ${(entry.settings?.questionMode || "mcq").toUpperCase()} • ${(entry.settings?.outputLanguage || "English").toUpperCase()}</div>
                  </div>
                </div>
              `).join("")
              : `<p class="helper-text">No quiz attempts saved yet.</p>`
            }
          </div>
        </div>

        <div class="setting-card dashboard-list-card">
          <div class="card-title-row">
            <strong>Flashcard Decks</strong>
            <span>${flashDecks.length} total</span>
          </div>
          <div class="dashboard-list">
            ${flashDecks.length
              ? flashDecks.slice(0, 4).map((deck, i) => `
                <div class="answer-option deck-row">
                  <div class="deck-row-head">
                    <div>
                      <div class="helper-text">Created ${formatDate(deck.createdAt)}</div>
                  <strong>${escapeHtml(deck.title) || "Study Deck"}</strong>
                    </div>
                    <span class="deck-count">${(deck.flashcards || []).length} cards</span>
                  </div>
                  <div class="deck-actions">
                    <button class="btn-outline open-deck-btn" data-index="${i}">Study Deck</button>
                    <button class="btn-outline edit-deck-btn" data-index="${i}">Rename</button>
                    <button class="btn-outline delete-deck-btn danger-action" data-index="${i}">Delete</button>
                  </div>
                </div>
              `).join("")
              : `<p class="helper-text">No flashcard decks saved yet.</p>`
            }
          </div>
        </div>
      </div>

      <div class="dashboard-manage-row">
        <span class="helper-text">Account controls</span>
        <button id="clearHistoryBtn" class="btn-outline" type="button">Clear Quiz History</button>
        <button id="clearDashboardBtn" class="btn-outline" type="button">Clear Dashboard</button>
        <button id="deleteUserBtn" class="btn-outline danger-action" type="button">Delete User</button>
      </div>
    </section>

    <aside class="panel game-card dashboard-side-card">
      <p class="eyebrow">Mini-Games</p>
      <h2 class="section-title">Game stats</h2>
      <div class="mini-stat-grid">
        <div class="setting-card"><span>Memory Wins</span><strong>${Number(mini.memoryWins || 0)}</strong></div>
        <div class="setting-card"><span>Best Moves</span><strong>${mini.memoryBestMoves || "--"}</strong></div>
        <div class="setting-card"><span>Best Time</span><strong>${mini.memoryBestTime ? `${mini.memoryBestTime}s` : "--"}</strong></div>
        <div class="setting-card"><span>Reaction Best</span><strong>${mini.reactionBest ? `${mini.reactionBest} ms` : "--"}</strong></div>
        <div class="setting-card"><span>Reaction Runs</span><strong>${Number(mini.reactionRuns || 0)}</strong></div>
        <div class="setting-card"><span>Recall Best</span><strong>${Number(mini.recallBestLevel || 0) || "--"}</strong></div>
        <div class="setting-card"><span>Recall Runs</span><strong>${Number(mini.recallRuns || 0)}</strong></div>
      </div>
      <div class="dashboard-quick-links">
        <a class="btn" href="./arcade.html">Open Arcade</a>
        <a class="btn-outline" href="./scoreboard.html">Leaderboard</a>
      </div>
    </aside>
  `;

  document.querySelectorAll(".open-deck-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const deck = flashDecks[btn.dataset.index];
      if (deck) {
        localStorage.setItem('quizzy-active-deck', JSON.stringify(deck));
        window.location.href = "./flashcards.html";
      }
    });
  });

  document.querySelectorAll(".edit-deck-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const index = btn.dataset.index;
      const deck = flashDecks[index];
      if (!deck) return;

      const newTitle = prompt("Enter a new title for this deck:", deck.title);
      if (!newTitle || newTitle.trim() === "" || newTitle.trim() === deck.title) return;

      deck.title = newTitle.trim();
      const localDecks = getFlashDecks();
      const localIdx = localDecks.findIndex(d => d.id === deck.id);
      if (localIdx !== -1) {
        localDecks[localIdx].title = deck.title;
        saveFlashDecks(localDecks);
      }
      if (isLoggedIn() && deck._id) {
        await apiRequest(`/data/flash-decks/${deck._id}`, { method: "PUT", body: JSON.stringify({ title: deck.title }) });
      }
      init();
    });
  });

  document.querySelectorAll(".delete-deck-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to delete this deck?")) return;
      const index = btn.dataset.index;
      const deck = flashDecks[index];
      if (!deck) return;

      // Remove from local storage
      const localDecks = getFlashDecks();
      saveFlashDecks(localDecks.filter(d => d.id !== deck.id));

      // Remove from cloud if logged in
      if (isLoggedIn() && deck._id) {
        await apiRequest(`/data/flash-decks/${deck._id}`, { method: "DELETE" });
      }
      
      init(); // Re-render the dashboard seamlessly
    });
  });

  document.getElementById("clearHistoryBtn")?.addEventListener("click", async () => {
    await apiRequest("/data/attempts", { method: "DELETE" });
    const refreshed = await apiRequest("/data/bootstrap");
    if (refreshed) renderDashboard(refreshed);
  });

  document.getElementById("clearDashboardBtn")?.addEventListener("click", async () => {
    if (!confirm("This will clear your quiz history, flashcards, mini-game stats, and dashboard progress. Continue?")) return;
    await apiRequest("/data/dashboard", { method: "DELETE" });
    const refreshed = await apiRequest("/data/bootstrap");
    if (refreshed) renderDashboard(refreshed);
  });

  document.getElementById("deleteUserBtn")?.addEventListener("click", async () => {
    const confirmation = prompt('Type DELETE to permanently remove your account:');
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
  if (!isLoggedIn()) {
    renderDashboard({ attempts: getSavedQuizHistory(), flashDecks: getFlashDecks(), miniGameStats: getMiniGameStats() });
    return;
  }
  const data = await apiRequest("/data/bootstrap");
  if (!data) {
    renderDashboard({ attempts: getSavedQuizHistory(), flashDecks: getFlashDecks(), miniGameStats: getMiniGameStats() });
    return;
  }
  if (data.miniGameStats) {
    setMiniGameStats(data.miniGameStats);
  }
  if (data.flashDecks) {
    saveFlashDecks(data.flashDecks);
  }
  renderDashboard(data);
}

init();
