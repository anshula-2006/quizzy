import API_BASE from "./config.js";
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

function openFlashcardViewer(deck) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.backgroundColor = "rgba(15, 23, 42, 0.95)";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "20px";

  let currentIndex = 0;
  let flipped = false;

  function render() {
    const card = deck.flashcards[currentIndex];
    overlay.innerHTML = `
      <div class="card" style="width: 100%; max-width: 500px; position: relative; border-radius: 20px; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
        <button class="close-modal" style="position: absolute; top: 16px; right: 20px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-weight: bold; font-size: 1.1rem;">✕</button>
        <div style="margin-bottom: 24px;">
          <h3 style="margin:0; font-size: 1.2rem;">${deck.title}</h3>
          <p style="margin-top:4px; font-size:0.9rem; color:var(--text-muted); font-weight:bold;">Card ${currentIndex + 1} / ${deck.flashcards.length}</p>
        </div>
        <div class="flash-scene" style="width: 100%; height: 320px; perspective: 1000px; cursor: pointer; background: transparent; border: none; padding: 0;">
          <div class="flash-card-3d" style="position: relative; width: 100%; height: 100%; transition: transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1); transform-style: preserve-3d; ${flipped ? "transform: rotateY(180deg);" : ""}">
            <div style="position: absolute; inset: 0; backface-visibility: hidden; border-radius: 16px; padding: 2rem; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: var(--bg-card); border: 2px solid var(--border-main); box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <span style="position: absolute; top: 1.2rem; left: 1.2rem; font-size: 0.75rem; text-transform: uppercase; font-weight: bold; color: var(--primary);">Question</span>
              <strong style="font-size: 1.5rem; line-height: 1.4;">${card.front}</strong>
            </div>
            <div style="position: absolute; inset: 0; backface-visibility: hidden; border-radius: 16px; padding: 2rem; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: var(--bg-hover); border: 2px solid var(--border-main); box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: rotateY(180deg);">
              <span style="position: absolute; top: 1.2rem; left: 1.2rem; font-size: 0.75rem; text-transform: uppercase; font-weight: bold; color: var(--primary);">Answer</span>
              <strong style="font-size: 1.5rem; line-height: 1.4;">${card.back}</strong>
              ${card.hint ? `<p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-muted);"><strong>Hint:</strong> ${card.hint}</p>` : ""}
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: space-between;">
          <button class="btn-outline prev-card" style="flex:1;" ${currentIndex === 0 ? "disabled" : ""}>Previous</button>
          <button class="btn-outline edit-card" style="flex:1;">Edit Card</button>
          <button class="btn next-card" style="flex:1;" ${currentIndex === deck.flashcards.length - 1 ? "disabled" : ""}>Next</button>
        </div>
      </div>
    `;
    overlay.querySelector(".close-modal").onclick = () => overlay.remove();
    overlay.querySelector(".prev-card").onclick = () => { if (currentIndex > 0) { currentIndex--; flipped = false; render(); } };
    overlay.querySelector(".edit-card").onclick = async () => {
      const newFront = prompt("Edit Question:", card.front);
      if (newFront === null) return;
      const newBack = prompt("Edit Answer:", card.back);
      if (newBack === null) return;
      
      card.front = newFront.trim() || card.front;
      card.back = newBack.trim() || card.back;
      
      const localDecks = getFlashDecks();
      const localIdx = localDecks.findIndex(d => d.id === deck.id);
      if (localIdx !== -1) {
        localDecks[localIdx].flashcards = deck.flashcards;
        saveFlashDecks(localDecks);
      }
      
      if (isLoggedIn() && deck._id) {
        await cloudRequest(`/data/flash-decks/${deck._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flashcards: deck.flashcards }) });
      }
      render();
    };
    overlay.querySelector(".next-card").onclick = () => { if (currentIndex < deck.flashcards.length - 1) { currentIndex++; flipped = false; render(); } };
    overlay.querySelector(".flash-scene").onclick = () => { flipped = !flipped; render(); };
  }
  render();
  document.body.appendChild(overlay);
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
      if (deck) openFlashcardViewer(deck);
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
    const result = await cloudRequest("/data/dashboard", { method: "DELETE" });
    if (!result.ok) return;
    const refreshed = await cloudRequest("/data/bootstrap");
    if (refreshed.ok) renderDashboard(refreshed.data);
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
