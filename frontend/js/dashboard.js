import API_BASE from "./config.js";
import auth from "../auth.js";
import { getSavedQuizHistory, getFlashDecks, getMiniGameStats, saveFlashDecks } from "./shared.js";

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

async function cloudRequest(path, options = {}) {
  const token = getAuthToken();
  if (!token) return { ok: false, error: "No session token" };
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {})
  };
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: data.error || "Cloud request failed" };
  return { ok: true, data };
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
  const recent = attempts.slice(0, 8);

  root.innerHTML = `
    <section class="panel flow-card">
      <p class="eyebrow">Dashboard</p>
      <h1 class="section-title">Your study snapshot</h1>
      <p class="section-copy">Everything here is loaded from MongoDB Atlas for your account.</p>

      <div class="button-row" style="margin-top:20px;">
        <button id="clearHistoryBtn" class="btn-outline" type="button">Clear Quiz History</button>
        <button id="clearDashboardBtn" class="btn-outline" type="button">Clear Dashboard</button>
        <button id="deleteUserBtn" class="btn-outline" type="button" style="color: var(--danger); border-color: var(--danger);">Delete User</button>
      </div>

      <div class="field-stack" style="margin-top:24px;">
        <div class="setting-card">
          <strong>Recent Quizzes</strong>
          <div style="margin-top:10px;" class="field-stack">
            ${recent.length
              ? recent.map((entry) => `
                <div class="answer-option">
                  <div>
                    <div class="eyebrow">Score</div>
                    <div style="font-weight:800; font-size:1.2rem;">${Number(entry.percentage || 0)}%</div>
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

        <div class="setting-card">
          <strong>Flashcard Decks</strong>
          <div style="margin-top:10px;" class="field-stack">
            ${flashDecks.length
              ? flashDecks.map((deck, i) => `
                <div class="answer-option" style="flex-direction: column; align-items: stretch; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                      <div class="eyebrow">Created ${formatDate(deck.createdAt)}</div>
                      <div style="font-weight:800;">${deck.title || "Study Deck"}</div>
                    </div>
                    <div class="helper-text" style="font-weight:bold; background: var(--bg-hover); padding: 4px 8px; border-radius: 6px;">${(deck.flashcards || []).length} cards</div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button class="btn-outline open-deck-btn" style="flex: 1;" data-index="${i}">Study Deck</button>
                    <button class="btn-outline edit-deck-btn" style="flex: 0 0 auto;" data-index="${i}">Rename</button>
                    <button class="btn-outline delete-deck-btn" style="flex: 0 0 auto; color: var(--danger); border-color: var(--danger);" data-index="${i}">Delete</button>
                  </div>
                </div>
              `).join("")
              : `<p class="helper-text">No flashcard decks saved yet.</p>`
            }
          </div>
        </div>
      </div>
    </section>

    <aside class="panel game-card">
      <p class="eyebrow">Mini-Games</p>
      <h2 class="section-title" style="font-size:2.2rem;">Game stats</h2>
      <div class="field-stack" style="margin-top:18px;">
        <div class="setting-card"><strong>Memory Wins</strong><p class="helper-text">${Number(mini.memoryWins || 0)}</p></div>
        <div class="setting-card"><strong>Best Moves</strong><p class="helper-text">${mini.memoryBestMoves || "--"}</p></div>
        <div class="setting-card"><strong>Best Time</strong><p class="helper-text">${mini.memoryBestTime ? `${mini.memoryBestTime}s` : "--"}</p></div>
        <div class="setting-card"><strong>Reaction Best</strong><p class="helper-text">${mini.reactionBest ? `${mini.reactionBest} ms` : "--"}</p></div>
        <div class="setting-card"><strong>Reaction Runs</strong><p class="helper-text">${Number(mini.reactionRuns || 0)}</p></div>
        <div class="setting-card"><strong>Recall Best</strong><p class="helper-text">${Number(mini.recallBestLevel || 0) || "--"}</p></div>
        <div class="setting-card"><strong>Recall Runs</strong><p class="helper-text">${Number(mini.recallRuns || 0)}</p></div>
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
        await cloudRequest(`/data/flash-decks/${deck._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: deck.title }) });
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
      saveFlashDecks(localDecks.filter(d => d.id !== deck.id && d._id !== deck._id));

      // Remove from cloud if logged in
      if (isLoggedIn() && deck._id) {
        await cloudRequest(`/data/flash-decks/${deck._id}`, { method: "DELETE" });
      }
      
      init(); // Re-render the dashboard seamlessly
    });
  });

  document.getElementById("clearHistoryBtn")?.addEventListener("click", async () => {
    const result = await cloudRequest("/data/attempts", { method: "DELETE" });
    if (!result.ok) return;
    const refreshed = await cloudRequest("/data/bootstrap");
    if (refreshed.ok) renderDashboard(refreshed.data);
  });

  document.getElementById("clearDashboardBtn")?.addEventListener("click", async () => {
    if (!confirm("This will clear your quiz history, flashcards, mini-game stats, and dashboard progress. Continue?")) return;
    const result = await cloudRequest("/data/dashboard", { method: "DELETE" });
    if (!result.ok) return;
    const refreshed = await cloudRequest("/data/bootstrap");
    if (refreshed.ok) renderDashboard(refreshed.data);
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
  const result = await cloudRequest("/data/bootstrap");
  if (!result.ok) {
    renderDashboard({ attempts: getSavedQuizHistory(), flashDecks: getFlashDecks(), miniGameStats: getMiniGameStats() });
    return;
  }
  renderDashboard(result.data);
}

init();
