import API_BASE from "./src/config.js";
import auth from "./auth.js";

const input = document.getElementById("inputText");
const urlInput = document.getElementById("urlInput");
const pdfInput = document.getElementById("pdfInput");
const sourceHint = document.getElementById("sourceHint");
const sourceBtns = document.querySelectorAll(".source-btn");
const btn = document.getElementById("generateBtn");
const flashcardsBtn = document.getElementById("flashcardsBtn");
const quiz = document.getElementById("quiz");
const evaluationBoard = document.getElementById("evaluationBoard");
const flashcardsBoard = document.getElementById("flashcardsBoard");
const toggle = document.getElementById("themeToggle");
const authUser = document.getElementById("authUser");
const loginLink = document.getElementById("loginLink");
const registerLink = document.getElementById("registerLink");
const logoutBtn = document.getElementById("logoutBtn");
const loader = document.getElementById("loader");
const cursorGlow = document.querySelector(".cursor-glow");
const cursorTrail = document.getElementById("cursorTrail");
const difficultyMode = document.getElementById("difficultyMode");
const learnerMode = document.getElementById("learnerMode");
const questionMode = document.getElementById("questionMode");
const roleFlavor = document.getElementById("roleFlavor");
const sidebarTitle = document.getElementById("sidebarTitle");
const timelineTitle = document.getElementById("timelineTitle");
const savedTitle = document.getElementById("savedTitle");
const flashTitle = document.getElementById("flashTitle");
const scoreTitle = document.getElementById("scoreTitle");
const attemptList = document.getElementById("attemptList");
const savedList = document.getElementById("savedList");
const flashList = document.getElementById("flashList");
const scoreBars = document.getElementById("scoreBars");

const correctSound = new Audio("assets/correct.mp3");
const wrongSound = new Audio("assets/wrong.mp3");

let questions = [];
let index = 0;
let score = 0;
let timer;
let timeLeft = 15;
let answered = {};
let choices = {};
let activeSource = "text";
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const HISTORY_BASE = "quizzy-history-v2";
const SAVED_BASE = "quizzy-saved-v1";
const FLASH_BASE = "quizzy-flash-v1";
const MAX_HISTORY_ITEMS = 20;
let attemptAnswers = [];
let currentAttemptMeta = null;

const ROLE_PRESETS = {
  student: { difficulty: "moderate", questionMode: "mixed", timerBias: 0 },
  teacher: { difficulty: "tough", questionMode: "short", timerBias: -2 },
  "self-study": { difficulty: "easy", questionMode: "mcq", timerBias: 4 }
};

const ROLE_FLAVORS = {
  student: "Student mode: balanced exam-oriented practice.",
  teacher: "Teacher mode: diagnostic, explanation-heavy checks built for classroom use.",
  "self-study": "Self-study mode: retention-first with memory reinforcement and confidence building."
};

const ROLE_LABELS = {
  student: {
    sidebar: "Student Mission Board",
    timeline: "Attempt Timeline",
    saved: "Revision Bank",
    flash: "Flashcard Decks",
    score: "Exam Scoreboard",
    dashboard: "Assessment Dashboard"
  },
  teacher: {
    sidebar: "Teacher Control Desk",
    timeline: "Class Diagnostics",
    saved: "Question Bank",
    flash: "Teaching Flashcards",
    score: "Cohort Readiness",
    dashboard: "Teaching Insights"
  },
  "self-study": {
    sidebar: "Self-Study Lab",
    timeline: "Practice Journey",
    saved: "Memory Vault",
    flash: "Memory Decks",
    score: "Growth Scoreboard",
    dashboard: "Learning Dashboard"
  }
};

function getScopeId() {
  const session = auth?.getSession?.();
  return session?.email || "guest";
}

function historyKey() {
  return `${HISTORY_BASE}-${getScopeId()}`;
}

function savedKey() {
  return `${SAVED_BASE}-${getScopeId()}`;
}

function flashKey() {
  return `${FLASH_BASE}-${getScopeId()}`;
}

function getAuthToken() {
  try {
    const raw = localStorage.getItem("quizzy-session-v2");
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
  if (!response.ok) {
    return { ok: false, error: data.error || "Cloud request failed" };
  }
  return { ok: true, data };
}

function mergeGuestDataToUser(sessionUser) {
  if (!sessionUser?.email) return;
  const userSuffix = sessionUser.email;
  const mergeList = (base, limit = 50, idFn = (x) => JSON.stringify(x)) => {
    const guestRaw = localStorage.getItem(`${base}-guest`);
    const userRaw = localStorage.getItem(`${base}-${userSuffix}`);
    const guest = guestRaw ? JSON.parse(guestRaw) : [];
    const user = userRaw ? JSON.parse(userRaw) : [];
    const combined = [...user, ...guest];
    const dedupMap = new Map();
    combined.forEach((item) => dedupMap.set(idFn(item), item));
    localStorage.setItem(`${base}-${userSuffix}`, JSON.stringify(Array.from(dedupMap.values()).slice(0, limit)));
  };

  try {
    mergeList(HISTORY_BASE, MAX_HISTORY_ITEMS, (x) => String(x?.id || x?.createdAt || Math.random()));
    mergeList(SAVED_BASE, 60, (x) => `${x?.question || ""}-${x?.correct || ""}`);
    mergeList(FLASH_BASE, 25, (x) => String(x?.id || x?.createdAt || Math.random()));
  } catch {
    // Ignore merge errors.
  }
}

function getSettings() {
  const learner = learnerMode?.value || "student";
  const preset = ROLE_PRESETS[learner] || ROLE_PRESETS.student;
  return {
    difficulty: difficultyMode?.value || "moderate",
    learnerMode: learner,
    questionMode: questionMode?.value || "mcq",
    roleProfile: {
      timerBias: preset.timerBias,
      flavor: ROLE_FLAVORS[learner] || ROLE_FLAVORS.student
    }
  };
}

function getTimerSeconds() {
  const { difficulty, roleProfile } = getSettings();
  let base = 30;
  if (difficulty === "easy") base = 36;
  if (difficulty === "tough") base = 24;
  if (difficulty === "super") base = 20;
  return Math.max(6, base + (roleProfile?.timerBias || 0));
}

function setGroupValue(targetId, value) {
  const hidden = document.getElementById(targetId);
  if (hidden) hidden.value = value;

  const group = document.querySelector(`.mode-group[data-target="${targetId}"]`);
  group?.querySelectorAll(".mode-option").forEach((btnNode) => {
    btnNode.classList.toggle("active", btnNode.dataset.value === value);
  });
}

function setRole(role) {
  if (!learnerMode) return;
  learnerMode.value = role;
  document.querySelectorAll(".role-card").forEach((node) => {
    node.classList.toggle("active", node.dataset.role === role);
  });
  if (roleFlavor) roleFlavor.textContent = ROLE_FLAVORS[role] || ROLE_FLAVORS.student;
  const labels = ROLE_LABELS[role] || ROLE_LABELS.student;
  if (sidebarTitle) sidebarTitle.textContent = labels.sidebar;
  if (timelineTitle) timelineTitle.textContent = labels.timeline;
  if (savedTitle) savedTitle.textContent = labels.saved;
  if (flashTitle) flashTitle.textContent = labels.flash;
  if (scoreTitle) scoreTitle.textContent = labels.score;
}

function applyRolePreset(role) {
  const preset = ROLE_PRESETS[role] || ROLE_PRESETS.student;
  setGroupValue("difficultyMode", preset.difficulty);
  setGroupValue("questionMode", preset.questionMode);
}

function wireModeControls() {
  document.querySelectorAll(".mode-group").forEach((group) => {
    group.querySelectorAll(".mode-option").forEach((node) => {
      node.addEventListener("click", () => {
        setGroupValue(group.dataset.target, node.dataset.value);
      });
    });
  });

  document.querySelectorAll(".role-card").forEach((node) => {
    node.addEventListener("click", () => {
      const role = node.dataset.role || "student";
      setRole(role);
      applyRolePreset(role);
    });
  });
}

function renderAuthNav() {
  if (!auth) return;
  const session = auth.getSession();
  if (!session) {
    authUser?.classList.add("hidden");
    logoutBtn?.classList.add("hidden");
    loginLink?.classList.remove("hidden");
    registerLink?.classList.remove("hidden");
    return;
  }

  authUser.textContent = `Hi, ${session.name}`;
  authUser?.classList.remove("hidden");
  logoutBtn?.classList.remove("hidden");
  loginLink?.classList.add("hidden");
  registerLink?.classList.add("hidden");
}

async function loadCloudDataIntoLocal() {
  if (!isLoggedIn()) return;
  const result = await cloudRequest("/data/bootstrap");
  if (!result.ok) return;
  const attempts = Array.isArray(result.data?.attempts) ? result.data.attempts : [];
  const savedQuestions = Array.isArray(result.data?.savedQuestions) ? result.data.savedQuestions : [];
  const flashDecks = Array.isArray(result.data?.flashDecks) ? result.data.flashDecks : [];
  saveHistory(attempts);
  saveSavedQuestions(savedQuestions);
  saveFlashDecks(flashDecks);
}

async function bootstrapAuth() {
  if (!auth) return;
  const session = auth.getSession();
  if (session) {
    await auth.me();
    mergeGuestDataToUser(auth.getSession?.());
    await loadCloudDataIntoLocal();
  }
  renderAuthNav();
  renderEvaluationBoard();
  renderSidebar();
}

function getDefaultHint(source) {
  if (source === "text") return "Paste study text to generate a quiz.";
  if (source === "url") return "Paste a public article URL to extract content.";
  return "Upload a PDF file (max 50MB).";
}

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validateActiveSourceInput(showError = false) {
  let error = "";
  [input, urlInput, pdfInput].forEach((el) => el?.classList.remove("input-invalid"));

  if (activeSource === "text") {
    if (input.value.trim().length === 0) error = "Please enter text content.";
  } else if (activeSource === "url") {
    const value = urlInput.value.trim();
    if (!value) error = "Please enter a URL.";
    else if (!isValidHttpUrl(value)) error = "Enter a valid URL starting with http:// or https://";
  } else if (activeSource === "pdf") {
    const file = pdfInput.files?.[0];
    if (!file) {
      error = "Please choose a PDF file.";
    } else if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      error = "Only PDF files are allowed.";
    } else if (file.size > MAX_PDF_BYTES) {
      error = "PDF is too large. Maximum size is 50MB.";
    }
  }

  if (showError) {
    sourceHint.textContent = error || getDefaultHint(activeSource);
    sourceHint.style.color = error ? "#dc2626" : "";
    if (error) {
      const activeInput = activeSource === "text" ? input : activeSource === "url" ? urlInput : pdfInput;
      activeInput?.classList.add("input-invalid");
    }
  }

  return error;
}

function updateGenerateButtonState() {
  const invalid = !!validateActiveSourceInput();
  btn.disabled = invalid;
  if (flashcardsBtn) flashcardsBtn.disabled = invalid;
}

function setActiveSource(source) {
  activeSource = source;
  sourceBtns.forEach((node) => node.classList.toggle("active", node.dataset.source === source));
  input.classList.toggle("hidden", source !== "text");
  urlInput.classList.toggle("hidden", source !== "url");
  pdfInput.classList.toggle("hidden", source !== "pdf");
  sourceHint.textContent = getDefaultHint(source);
  sourceHint.style.color = "";
  updateGenerateButtonState();
}

function setThemeIcon() {
  toggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

function getHistory() {
  try {
    const raw = localStorage.getItem(historyKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  localStorage.setItem(historyKey(), JSON.stringify(entries.slice(0, MAX_HISTORY_ITEMS)));
}

function addHistoryEntry(entry) {
  const entries = getHistory();
  entries.unshift(entry);
  saveHistory(entries);
  if (isLoggedIn()) {
    cloudRequest("/data/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry)
    });
  }
}

function getSavedQuestions() {
  try {
    const raw = localStorage.getItem(savedKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSavedQuestions(items) {
  localStorage.setItem(savedKey(), JSON.stringify(items.slice(0, 60)));
}

function addSavedQuestion(item) {
  const items = getSavedQuestions();
  const exists = items.some((q) => q.question === item.question && q.correct === item.correct);
  if (exists) return;
  items.unshift(item);
  saveSavedQuestions(items);
  if (isLoggedIn()) {
    cloudRequest("/data/saved-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
  }
  renderSidebar();
}

function getFlashDecks() {
  try {
    const raw = localStorage.getItem(flashKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFlashDecks(items) {
  localStorage.setItem(flashKey(), JSON.stringify(items.slice(0, 25)));
}

function addFlashDeck(deck) {
  const decks = getFlashDecks();
  decks.unshift(deck);
  saveFlashDecks(decks);
  if (isLoggedIn()) {
    cloudRequest("/data/flash-decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deck)
    });
  }
}

function formatShortDate(isoValue) {
  const dt = new Date(isoValue);
  if (Number.isNaN(dt.getTime())) return "Unknown time";
  return dt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getStreak(entries) {
  let streak = 0;
  for (const item of entries) {
    if ((item.percentage || 0) >= 70) streak++;
    else break;
  }
  return streak;
}

function getAssessmentLabel(percentage) {
  if (percentage >= 90) return "Elite";
  if (percentage >= 75) return "Strong";
  if (percentage >= 60) return "Developing";
  return "Needs Revision";
}

function getFeedback(entries) {
  if (!entries.length) return "Start a quiz to unlock personalized feedback.";
  const latest = entries[0];
  const avg = Math.round(entries.reduce((sum, e) => sum + (e.percentage || 0), 0) / entries.length);
  const wrong = (latest.answers || []).filter((a) => !a.isCorrect);
  const shortWrong = wrong.filter((a) => a.type === "short").length;
  const mcqWrong = wrong.filter((a) => a.type === "mcq").length;

  if (avg >= 85) return "Great momentum. Push to Super mode and mixed questions to keep improving.";
  if (shortWrong > mcqWrong) return "Focus on short-answer precision. Use flashcards to reinforce exact phrasing and key facts.";
  if (mcqWrong > shortWrong) return "Focus on option elimination strategy. Review explanations for each incorrect choice.";
  return "Consistency is building. Keep alternating mixed mode and short mode for stronger retention.";
}

function getTrend(entries) {
  if (entries.length < 2) return { delta: 0, label: "No trend yet" };
  const latest = entries[0].percentage || 0;
  const previous = entries[1].percentage || 0;
  const delta = latest - previous;
  if (delta > 0) return { delta, label: `Up ${delta}% vs last attempt` };
  if (delta < 0) return { delta, label: `Down ${Math.abs(delta)}% vs last attempt` };
  return { delta: 0, label: "Stable vs last attempt" };
}

function getBandLabel(score) {
  if (score >= 90) return "Mastery";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Growing";
  return "Recovery";
}

function renderSidebar() {
  const entries = getHistory();
  const saved = getSavedQuestions();
  const decks = getFlashDecks();

  if (attemptList) {
    attemptList.innerHTML = entries.length
      ? entries.slice(0, 8).map((e) => `
          <div class="mini-item">
            <strong>${e.percentage}%</strong>
            <span>${e.score}/${e.total} | ${formatShortDate(e.createdAt)}</span>
            <small>${(e.settings?.difficulty || "moderate").toUpperCase()} | ${(e.settings?.questionMode || "mcq").toUpperCase()}</small>
          </div>
        `).join("")
      : `<p class="mini-empty">No attempts yet.</p>`;
  }

  if (savedList) {
    savedList.innerHTML = saved.length
      ? saved.slice(0, 10).map((item) => `
          <details class="saved-item">
            <summary>${item.question}</summary>
            <p><strong>Answer:</strong> ${item.correct}</p>
            <p>${item.explanation || ""}</p>
          </details>
        `).join("")
      : `<p class="mini-empty">No saved questions yet.</p>`;
  }

  if (flashList) {
    flashList.innerHTML = decks.length
      ? decks.slice(0, 6).map((deck) => `
          <details class="saved-item">
            <summary>${deck.title} (${deck.flashcards.length})</summary>
            ${deck.flashcards.slice(0, 3).map((c) => `<p><strong>${c.front}</strong><br/>${c.back}</p>`).join("")}
          </details>
        `).join("")
      : `<p class="mini-empty">No flashcard decks generated yet.</p>`;
  }

  if (scoreBars) {
    const chartData = entries.slice(0, 8).reverse();
    if (!chartData.length) {
      scoreBars.innerHTML = `<p class="mini-empty">Scoreboard appears after your first quiz.</p>`;
    } else {
      const latest = entries[0]?.percentage || 0;
      const avg = Math.round(entries.reduce((sum, e) => sum + (e.percentage || 0), 0) / entries.length);
      const trend = getTrend(entries);
      scoreBars.innerHTML = `
        <div class="score-hero">
          <div class="score-ring" style="--p:${latest}">
            <strong>${latest}%</strong>
            <span>Latest</span>
          </div>
          <div class="score-meta">
            <div class="meta-chip">${getBandLabel(latest)}</div>
            <div class="meta-chip muted">Avg ${avg}%</div>
            <div class="meta-chip ${trend.delta > 0 ? "up" : trend.delta < 0 ? "down" : "flat"}">${trend.label}</div>
          </div>
        </div>
        <div class="score-spark">
          ${chartData.map((e, i) => `
            <div class="spark-col" title="Attempt ${i + 1}: ${e.percentage}%">
              <div class="spark-bar" style="height:${Math.max(12, e.percentage)}%"></div>
              <span>${e.percentage}%</span>
            </div>
          `).join("")}
        </div>
        <div class="analysis-card">
          <strong>Feedback</strong>
          <p>${getFeedback(entries)}</p>
        </div>
      `;
    }
  }
}

function renderEvaluationBoard() {
  if (!evaluationBoard) return;
  const entries = getHistory();

  const role = learnerMode?.value || "student";
  const labels = ROLE_LABELS[role] || ROLE_LABELS.student;

  if (entries.length === 0) {
    evaluationBoard.innerHTML = `
      <div class="card evaluation-empty">
        <h3>${labels.dashboard}</h3>
        <p>Attempt quizzes to unlock your progress board, trends, and review deck.</p>
      </div>
    `;
    return;
  }

  const latest = entries[0];
  const latestAnswers = Array.isArray(latest.answers) ? latest.answers : [];
  const best = Math.max(...entries.map((e) => e.percentage || 0));
  const avg = Math.round(entries.reduce((sum, e) => sum + (e.percentage || 0), 0) / entries.length);
  const streak = getStreak(entries);
  const recent = entries.slice(0, 5);
  const wrongCount = latestAnswers.filter((a) => !a.isCorrect).length;

  evaluationBoard.innerHTML = `
    <div class="evaluation-wrap">
      <div class="evaluation-head">
        <h3>${labels.dashboard}</h3>
        <div class="evaluation-head-actions">
          <button id="clearHistoryBtn" class="ghost">Clear</button>
        </div>
      </div>
      <div class="evaluation-stats">
        <div class="card"><p>Total Quizzes</p><h4>${entries.length}</h4></div>
        <div class="card"><p>Best Score</p><h4>${best}%</h4></div>
        <div class="card"><p>Average</p><h4>${avg}%</h4></div>
        <div class="card"><p>Current Streak</p><h4>${streak}</h4></div>
      </div>
      <div class="evaluation-grid">
        <div class="card latest-attempt">
          <h4>Latest Attempt</h4>
          <p>${latest.score}/${latest.total} (${latest.percentage}%) | ${(latest.sourceType || "text").toUpperCase()} | ${formatShortDate(latest.createdAt)}</p>
          <p>Assessment: <strong>${getAssessmentLabel(latest.percentage)}</strong>. ${wrongCount} question(s) need revision.</p>
          <div class="review-rail">
            ${latestAnswers.map((a, i) => `
              <button class="review-q-btn ${a.isCorrect ? "good" : "bad"}" data-review-index="${i}">
                Q${i + 1}. ${a.question}
              </button>
            `).join("")}
          </div>
          <div id="reviewDetail" class="review-detail">Click a question to view full explanation.</div>
        </div>
        <div class="card recent-attempts">
          <h4>Recent Attempts</h4>
          ${recent.map((e) => `
            <div class="attempt-row">
              <span>${formatShortDate(e.createdAt)}</span>
              <span>${e.score}/${e.total} (${e.percentage}%)</span>
              <span>${(e.settings?.difficulty || "moderate").toUpperCase()}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  document.getElementById("clearHistoryBtn")?.addEventListener("click", async () => {
    localStorage.removeItem(historyKey());
    if (isLoggedIn()) {
      await cloudRequest("/data/attempts", { method: "DELETE" });
    }
    renderEvaluationBoard();
    renderSidebar();
  });

  const detailNode = document.getElementById("reviewDetail");
  const renderReviewDetail = (idx) => {
    const item = latestAnswers[idx];
    if (!item || !detailNode) return;
    const imageBlock = item.image && /^https:\/\/upload\.wikimedia\.org\/.+\.(png|jpg)$/i.test(item.image)
      ? `<div class="explain-image-wrap"><img class="explain-image" src="${item.image}" alt="Review visual" loading="lazy" /></div>`
      : "";
    detailNode.innerHTML = `
      <p><strong>${item.question}</strong></p>
      <p>Your answer: ${item.selected || "Not answered"}</p>
      <p>Correct answer: ${item.correct || "-"}</p>
      <p>${item.explanation || "No explanation saved."}</p>
      ${imageBlock}
    `;
  };

  document.querySelectorAll(".review-q-btn").forEach((btnNode) => {
    btnNode.addEventListener("click", () => {
      renderReviewDetail(Number(btnNode.dataset.reviewIndex || 0));
    });
  });
  if (latestAnswers.length) renderReviewDetail(0);
}

if (cursorGlow) {
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  window.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  const follow = () => {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    cursorGlow.style.left = `${currentX}px`;
    cursorGlow.style.top = `${currentY}px`;
    requestAnimationFrame(follow);
  };

  follow();
}

if (cursorTrail) {
  const ctx = cursorTrail.getContext("2d");
  let points = [];

  const resize = () => {
    cursorTrail.width = window.innerWidth;
    cursorTrail.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  window.addEventListener("mousemove", (e) => {
    points.push({ x: e.clientX, y: e.clientY, life: 1 });
  });

  const getPalette = () => {
    const isDark = document.body.classList.contains("dark");
    return isDark ? ["#fbcfe8", "#c7d2fe", "#a5f3fc", "#fecdd3"] : ["#f5d0fe", "#c7d2fe", "#bae6fd", "#bbf7d0"];
  };

  const draw = () => {
    ctx.clearRect(0, 0, cursorTrail.width, cursorTrail.height);
    for (let i = 0; i < points.length; i++) points[i].life -= 0.008;
    points = points.filter((p) => p.life > 0);

    const palette = getPalette();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const alpha = Math.max(0, Math.min(p2.life, 1));
      const colorIndex = Math.floor(i / 10) % palette.length;
      ctx.strokeStyle = `${palette[colorIndex]}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
      ctx.lineWidth = 6 * alpha + 1;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    requestAnimationFrame(draw);
  };

  draw();
}

function normalizeShortAnswer(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function gradeShortAnswer(userValue, q) {
  const user = normalizeShortAnswer(userValue);
  const primary = normalizeShortAnswer(q.shortAnswer || q.correct || "");
  const alternates = Array.isArray(q.acceptableAnswers)
    ? q.acceptableAnswers.map((a) => normalizeShortAnswer(a))
    : [];
  const valid = [primary, ...alternates].filter(Boolean);
  return valid.some((ans) => user === ans || (ans.length > 4 && user.includes(ans)));
}

async function extractSourceText() {
  const validationError = validateActiveSourceInput(true);
  if (validationError) throw new Error(validationError);

  let response;
  if (activeSource === "pdf") {
    const file = pdfInput.files?.[0];
    if (!file) throw new Error("Please choose a PDF file");
    const formData = new FormData();
    formData.append("pdf", file);
    response = await fetch(`${API_BASE}/extract-content`, { method: "POST", body: formData });
  } else {
    const payload = activeSource === "url" ? { url: urlInput.value.trim() } : { text: input.value.trim() };
    response = await fetch(`${API_BASE}/extract-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not extract content");
  if (!data.text || data.text.trim().length === 0) throw new Error("Extraction returned empty content");
  return data.text;
}

async function buildContentPayload() {
  const rawTextInput = input.value.trim();
  if (activeSource === "text" && rawTextInput.length < 50) {
    return {
      topic: rawTextInput,
      sourceType: "topic",
      sourceInput: rawTextInput
    };
  }

  const extractedText = await extractSourceText();
  return {
    text: extractedText,
    sourceType: activeSource,
    sourceInput:
      activeSource === "pdf"
        ? pdfInput.files?.[0]?.name || "pdf"
        : activeSource === "url"
          ? urlInput.value.trim()
          : input.value.trim().slice(0, 140)
  };
}

function normalizeQuestion(q) {
  if (!q || typeof q !== "object") return null;
  const type = q.type === "short" ? "short" : "mcq";

  if (type === "mcq") {
    const options = Array.isArray(q.options) && q.options.length >= 2
      ? q.options.slice(0, 4)
      : ["Option A", "Option B", "Option C", "Option D"];
    const correct = String(q.correct || "A").trim().charAt(0).toUpperCase();
    return {
      ...q,
      type,
      options,
      correct: ["A", "B", "C", "D"].includes(correct) ? correct : "A"
    };
  }

  return {
    ...q,
    type,
    shortAnswer: q.shortAnswer || q.correct || "",
    acceptableAnswers: Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : []
  };
}

btn.onclick = async () => {
  loader.classList.remove("hidden");
  btn.disabled = true;
  if (flashcardsBtn) flashcardsBtn.disabled = true;

  try {
    const settings = getSettings();
    const contentPayload = await buildContentPayload();
    const requestPayload = { ...contentPayload, ...settings };

    const res = await fetch(`${API_BASE}/generate-quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to generate quiz");

    const cleaned = (Array.isArray(data.questions) ? data.questions : [])
      .map(normalizeQuestion)
      .filter(Boolean);

    if (cleaned.length === 0) throw new Error("No questions were returned");

    questions = cleaned;
    index = 0;
    score = 0;
    answered = {};
    choices = {};
    attemptAnswers = Array.from({ length: questions.length }, () => null);
    currentAttemptMeta = {
      createdAt: new Date().toISOString(),
      sourceType: contentPayload.sourceType,
      sourceInput: contentPayload.sourceInput,
      settings
    };

    setTimeout(() => {
      loader.classList.add("hidden");
      quiz.scrollIntoView({ behavior: "smooth" });
      showQuestion();
    }, 900);
  } catch (err) {
    loader.classList.add("hidden");
    quiz.innerHTML = `
      <div class="card quiz-card">
        <h2>Could not generate quiz</h2>
        <p>${err.message}</p>
      </div>
    `;
  } finally {
    updateGenerateButtonState();
  }
};

function normalizeFlashcards(payload) {
  const cards = Array.isArray(payload?.flashcards) ? payload.flashcards : [];
  return cards
    .map((c) => ({
      front: (c?.front || "").trim(),
      back: (c?.back || "").trim(),
      hint: (c?.hint || "").trim(),
      image: c?.image || null
    }))
    .filter((c) => c.front && c.back);
}

function renderFlashcardsBoard(deck) {
  if (!flashcardsBoard) return;
  if (!deck || !Array.isArray(deck.flashcards) || deck.flashcards.length === 0) {
    flashcardsBoard.innerHTML = "";
    return;
  }

  flashcardsBoard.innerHTML = `
    <div class="evaluation-wrap">
      <div class="card">
        <h3>Flashcards</h3>
        <p>${deck.title}</p>
        <div class="flashcards-wrap">
          ${deck.flashcards.map((card, i) => `
            <details class="flash-card">
              <summary>Card ${i + 1}: ${card.front}</summary>
              <p><strong>Answer:</strong> ${card.back}</p>
              <p><strong>Hint:</strong> ${card.hint || "-"}</p>
              ${card.image && /^https:\/\/upload\.wikimedia\.org\/.+\.(png|jpg)$/i.test(card.image)
                ? `<div class="explain-image-wrap"><img class="explain-image" src="${card.image}" alt="Flashcard visual" loading="lazy" /></div>`
                : ""}
            </details>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

flashcardsBtn?.addEventListener("click", async () => {
  loader.classList.remove("hidden");
  btn.disabled = true;
  flashcardsBtn.disabled = true;
  try {
    const settings = getSettings();
    const contentPayload = await buildContentPayload();
    const res = await fetch(`${API_BASE}/generate-flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contentPayload, ...settings })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to generate flashcards");

    const cards = normalizeFlashcards(data);
    if (!cards.length) throw new Error("No flashcards were returned");

    const deck = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      sourceType: contentPayload.sourceType,
      title: (contentPayload.topic || contentPayload.sourceInput || "Study Deck").slice(0, 90),
      flashcards: cards
    };
    addFlashDeck(deck);
    renderFlashcardsBoard(deck);
    renderSidebar();
  } catch (err) {
    flashcardsBoard.innerHTML = `
      <div class="evaluation-wrap">
        <div class="card">
          <h3>Could not generate flashcards</h3>
          <p>${err.message}</p>
        </div>
      </div>
    `;
  } finally {
    loader.classList.add("hidden");
    updateGenerateButtonState();
  }
});

function renderShortAnswerInput() {
  return `
    <div class="short-wrap">
      <textarea id="shortAnswerInput" class="short-answer" placeholder="Type your answer here..."></textarea>
      <button id="submitShortBtn" type="button">Submit Answer</button>
    </div>
  `;
}

function showQuestion() {
  clearInterval(timer);
  const q = questions[index];
  const isShort = q.type === "short";
  timeLeft = isShort ? null : getTimerSeconds();
  const progress = Math.round(((index + 1) / questions.length) * 100);

  quiz.innerHTML = `
    <div class="card quiz-card">
      <div class="quiz-top">
        <span>Q ${index + 1}/${questions.length} | ${q.type.toUpperCase()}</span>
        <span>${isShort ? "No time limit" : `${timeLeft}s`}</span>
      </div>
      <div class="progress">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
      <h2>${q.question}</h2>
      ${q.type === "mcq"
        ? q.options.map((o, i) => `
          <div class="option" data-o="${String.fromCharCode(65 + i)}">
            ${String.fromCharCode(65 + i)}. ${o}
          </div>`).join("")
        : renderShortAnswerInput()}
      <div class="quiz-actions">
        <button id="prevBtn" class="ghost" ${index === 0 ? "disabled" : ""}>Previous</button>
        <button id="finishBtn" class="ghost">Finish</button>
        <button id="nextBtn">Next</button>
      </div>
    </div>
  `;

  if (q.type === "mcq") {
    document.querySelectorAll(".option").forEach((opt) => {
      opt.onclick = () => answerMcq(opt, q);
    });
  } else {
    document.getElementById("submitShortBtn")?.addEventListener("click", () => {
      const value = document.getElementById("shortAnswerInput")?.value || "";
      answerShort(value, q);
    });
  }

  document.getElementById("prevBtn")?.addEventListener("click", prev);
  document.getElementById("finishBtn")?.addEventListener("click", finish);
  document.getElementById("nextBtn")?.addEventListener("click", next);

  if (answered[index]) {
    clearInterval(timer);
    document.querySelector(".quiz-top span:last-child").innerText = "Done";
    reveal(q, choices[index], true);
    return;
  }

  if (isShort) return;

  timer = setInterval(() => {
    timeLeft--;
    const clock = document.querySelector(".quiz-top span:last-child");
    if (clock) clock.innerText = `${timeLeft}s`;

    if (timeLeft <= 0 && !answered[index]) {
      answered[index] = true;
      choices[index] = null;
      attemptAnswers[index] = {
        question: q.question,
        selected: null,
        correct: q.type === "short" ? q.shortAnswer : q.correct,
        isCorrect: false,
        type: q.type,
        explanation: q.explanation || "",
        wrongExplanation: q.wrongExplanation || "",
        image: q.image || null
      };
      reveal(q, null, false);
      clearInterval(timer);
    }
  }, 1000);
}

function answerMcq(el, q) {
  if (answered[index]) return;
  answered[index] = true;
  choices[index] = el.dataset.o;
  const isCorrect = el.dataset.o === q.correct;
  attemptAnswers[index] = {
    question: q.question,
    selected: el.dataset.o,
    correct: q.correct,
    isCorrect,
    type: "mcq",
    explanation: q.explanation || "",
    wrongExplanation: q.wrongExplanation || "",
    image: q.image || null
  };
  clearInterval(timer);
  reveal(q, el.dataset.o, false);
}

function answerShort(value, q) {
  if (answered[index]) return;
  answered[index] = true;
  choices[index] = value;
  const isCorrect = gradeShortAnswer(value, q);
  attemptAnswers[index] = {
    question: q.question,
    selected: value,
    correct: q.shortAnswer,
    isCorrect,
    type: "short",
    explanation: q.explanation || "",
    wrongExplanation: q.wrongExplanation || "",
    image: q.image || null
  };
  clearInterval(timer);
  reveal(q, value, false);
}

function reveal(q, choice, isReview) {
  const isShort = q.type === "short";

  if (!isShort) {
    document.querySelectorAll(".option").forEach((o) => {
      o.classList.add("disabled");
      if (o.dataset.o === q.correct) o.classList.add("correct");
    });
  } else {
    document.getElementById("shortAnswerInput")?.setAttribute("disabled", "disabled");
    document.getElementById("submitShortBtn")?.setAttribute("disabled", "disabled");
  }

  const isCorrect = attemptAnswers[index]?.isCorrect;
  if (isCorrect && !isReview) {
    score++;
    correctSound.play();
  } else if (!isCorrect && !isReview) {
    wrongSound.play();
    if (!isShort && choice) {
      const chosen = document.querySelector(`.option[data-o="${choice}"]`);
      chosen?.classList.add("wrong");
    }
  }

  if (!quiz.querySelector(".explanation")) {
    const answerText = isShort ? `Correct answer: ${q.shortAnswer || q.correct}` : `Correct option: ${q.correct}`;
    const wrongBlock = !isCorrect
      ? `<p><strong>Why your answer was wrong:</strong> ${q.wrongExplanation || "Your selected answer does not match the validated correct answer and supporting concept."}</p>`
      : "";
    const imageBlock = q.image && /^https:\/\/upload\.wikimedia\.org\/.+\.(png|jpg)$/i.test(q.image)
      ? `<div class="explain-image-wrap"><img class="explain-image" src="${q.image}" alt="Explanation visual" loading="lazy" /></div>`
      : "";

    quiz.querySelector(".quiz-card").insertAdjacentHTML(
      "beforeend",
      `<div class="explanation"><p><strong>${answerText}</strong></p><p>${q.explanation || ""}</p>${wrongBlock}${imageBlock}<button id="saveQuestionBtn" class="ghost" type="button">Save Question</button></div>`
    );
    document.getElementById("saveQuestionBtn")?.addEventListener("click", () => {
      addSavedQuestion({
        question: q.question,
        correct: isShort ? (q.shortAnswer || q.correct) : q.correct,
        explanation: q.explanation || "",
        image: q.image || null
      });
    });
  }
}

function next() {
  index++;
  if (index < questions.length) showQuestion();
  else finish();
}

function prev() {
  if (index === 0) return;
  index--;
  showQuestion();
}

function buildHistoryEntry() {
  const answers = questions.map((q, i) => {
    const a = attemptAnswers[i];
    if (a) return a;
    return {
      question: q.question,
      selected: null,
      correct: q.type === "short" ? q.shortAnswer : q.correct,
      isCorrect: false,
      type: q.type,
      explanation: q.explanation || "",
      wrongExplanation: q.wrongExplanation || "",
      image: q.image || null
    };
  });

  const total = questions.length || 0;
  const percentage = total ? Math.round((score / total) * 100) : 0;

  return {
    id: Date.now(),
    createdAt: currentAttemptMeta?.createdAt || new Date().toISOString(),
    sourceType: currentAttemptMeta?.sourceType || "text",
    sourceInput: currentAttemptMeta?.sourceInput || "",
    settings: currentAttemptMeta?.settings || getSettings(),
    score,
    total,
    percentage,
    answers
  };
}

function autoSaveQuestionsFromEntry(entry) {
  const answers = Array.isArray(entry?.answers) ? entry.answers : [];
  answers.forEach((a) => {
    if (!a?.question) return;
    addSavedQuestion({
      question: a.question,
      correct: a.correct || "",
      explanation: a.explanation || a.wrongExplanation || "",
      image: a.image || null
    });
  });
}

function finish() {
  confetti();
  clearInterval(timer);
  const entry = buildHistoryEntry();
  addHistoryEntry(entry);
  autoSaveQuestionsFromEntry(entry);
  renderEvaluationBoard();
  renderSidebar();

  const assessment = getAssessmentLabel(entry.percentage);

  quiz.innerHTML = `
    <div class="card quiz-card">
      <h2>Quiz Completed</h2>
      <h1>${score} / ${questions.length}</h1>
      <p>Accuracy: ${entry.percentage}%</p>
      <p>Assessment: <strong>${assessment}</strong></p>
      <p>Mode: ${(entry.settings?.difficulty || "moderate").toUpperCase()} | ${(entry.settings?.questionMode || "mcq").toUpperCase()} | ${(entry.settings?.learnerMode || "student").toUpperCase()}</p>
      <p>Generate flashcards from your source using the Flashcards button.</p>
    </div>
  `;
}

function confetti() {
  for (let i = 0; i < 90; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = `hsl(${Math.random() * 360},100%,60%)`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2800);
  }
}

input.addEventListener("input", () => {
  validateActiveSourceInput(true);
  updateGenerateButtonState();
});
urlInput.addEventListener("input", () => {
  validateActiveSourceInput(true);
  updateGenerateButtonState();
});
pdfInput.addEventListener("change", () => {
  validateActiveSourceInput(true);
  updateGenerateButtonState();
});
sourceBtns.forEach((node) => node.addEventListener("click", () => setActiveSource(node.dataset.source)));
logoutBtn?.addEventListener("click", () => auth?.logout());

toggle.onclick = () => {
  document.body.classList.toggle("dark");
  setThemeIcon();
};

setThemeIcon();
wireModeControls();
setRole("student");
applyRolePreset("student");
setActiveSource(activeSource);
renderEvaluationBoard();
renderSidebar();
renderFlashcardsBoard(getFlashDecks()[0] || null);
bootstrapAuth();
