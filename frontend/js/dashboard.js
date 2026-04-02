import API_BASE from "./config.js";

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

function renderLoggedOut() {
  root.innerHTML = `
    <section class="panel flow-card">
      <p class="eyebrow">Dashboard</p>
      <h1 class="section-title">Sign in to sync your progress</h1>
      <p class="section-copy">Your dashboard pulls quiz history, flashcards, and mini-game stats from MongoDB. Log in to see your full record here.</p>
      <div class="button-row" style="margin-top:20px;">
        <a class="btn" href="./login.html">Login</a>
        <a class="btn-outline" href="./register.html">Register</a>
      </div>
    </section>
    <aside class="panel game-card">
      <p class="eyebrow">What you get</p>
      <div class="field-stack" style="margin-top:16px;">
        <div class="setting-card"><strong>Quiz history</strong><p class="helper-text">Attempts, scores, and accuracy.</p></div>
        <div class="setting-card"><strong>Flashcard decks</strong><p class="helper-text">Every deck you generated.</p></div>
        <div class="setting-card"><strong>Mini-game stats</strong><p class="helper-text">Memory, reaction, and recall progress.</p></div>
      </div>
    </aside>
  `;
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
              ? flashDecks.map((deck) => `
                <div class="answer-option">
                  <div>
                    <div class="eyebrow">Deck</div>
                    <div style="font-weight:800;">${deck.title || "Study Deck"}</div>
                  </div>
                  <div class="helper-text">${(deck.flashcards || []).length} cards</div>
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
    renderLoggedOut();
    return;
  }
  const result = await cloudRequest("/data/bootstrap");
  if (!result.ok) {
    renderLoggedOut();
    return;
  }
  renderDashboard(result.data);
}

init();
