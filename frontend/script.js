import API_BASE from "./src/config.js";
import auth from "./auth.js";

const input = document.getElementById("inputText");
const urlInput = document.getElementById("urlInput");
const pdfInput = document.getElementById("pdfInput");
const sourceHint = document.getElementById("sourceHint");
const sourceBtns = document.querySelectorAll(".source-btn");
const btn = document.getElementById("generateBtn");
const quiz = document.getElementById("quiz");
const evaluationBoard = document.getElementById("evaluationBoard");
const toggle = document.getElementById("themeToggle");
const authUser = document.getElementById("authUser");
const loginLink = document.getElementById("loginLink");
const registerLink = document.getElementById("registerLink");
const logoutBtn = document.getElementById("logoutBtn");
const robot = document.getElementById("robotMascot");
const loader = document.getElementById("loader");
const cursorGlow = document.querySelector(".cursor-glow");
const cursorTrail = document.getElementById("cursorTrail");

const correctSound = new Audio("assets/correct.mp3");
const wrongSound = new Audio("assets/wrong.mp3");

let questions = [], index = 0, score = 0, timer, timeLeft = 15, answered = {}, choices = {};
let activeSource = "text";
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const HISTORY_KEY = "quizzy-history-v1";
const MAX_HISTORY_ITEMS = 12;
let attemptAnswers = [];
let currentAttemptMeta = null;

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

async function bootstrapAuth() {
  if (!auth) return;
  const session = auth.getSession();
  if (!session) {
    renderAuthNav();
    return;
  }
  await auth.me();
  renderAuthNav();
}

function getDefaultHint(source) {
  if (source === "text") return "Paste study text to generate a quiz.";
  if (source === "url") return "Paste a public article URL to extract content.";
  return "Upload a PDF file (max 10MB).";
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
    if (input.value.trim().length === 0) {
      error = "Please enter text content.";
    }
  } else if (activeSource === "url") {
    const value = urlInput.value.trim();
    if (!value) {
      error = "Please enter a URL.";
    } else if (!isValidHttpUrl(value)) {
      error = "Enter a valid URL starting with http:// or https://";
    }
  } else if (activeSource === "pdf") {
    const file = pdfInput.files?.[0];
    if (!file) {
      error = "Please choose a PDF file.";
    } else if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      error = "Only PDF files are allowed.";
    } else if (file.size > MAX_PDF_BYTES) {
      error = "PDF is too large. Maximum size is 10MB.";
    }
  }

  if (showError) {
    sourceHint.textContent = error || getDefaultHint(activeSource);
    sourceHint.style.color = error ? "#dc2626" : "";
    if (error) {
      const activeInput = activeSource === "text"
        ? input
        : activeSource === "url"
          ? urlInput
          : pdfInput;
      activeInput?.classList.add("input-invalid");
    }
  }

  return error;
}

function updateGenerateButtonState() {
  btn.disabled = !!validateActiveSourceInput();
}

function setActiveSource(source) {
  activeSource = source;
  sourceBtns.forEach((node) => {
    node.classList.toggle("active", node.dataset.source === source);
  });

  input.classList.toggle("hidden", source !== "text");
  urlInput.classList.toggle("hidden", source !== "url");
  pdfInput.classList.toggle("hidden", source !== "pdf");

  sourceHint.textContent = getDefaultHint(source);
  sourceHint.style.color = "";
  updateGenerateButtonState();
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
sourceBtns.forEach((node) => {
  node.addEventListener("click", () => setActiveSource(node.dataset.source));
});
setActiveSource(activeSource);
bootstrapAuth();
logoutBtn?.addEventListener("click", () => auth?.logout());

toggle.onclick = () => {
  document.body.classList.toggle("dark");
  if (robot) {
    robot.src = document.body.classList.contains("dark")
      ? "assets/robot-dark.png"
      : "assets/robot-light.png";
  }
  setThemeIcon();
};

function setThemeIcon() {
  toggle.textContent = document.body.classList.contains("dark") ? "Sun" : "Moon";
}

function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    // Ignore storage errors
  }
}

function addHistoryEntry(entry) {
  const entries = getHistory();
  entries.unshift(entry);
  saveHistory(entries);
}

function formatShortDate(isoValue) {
  const dt = new Date(isoValue);
  if (Number.isNaN(dt.getTime())) return "Unknown time";
  return dt.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStreak(entries) {
  let streak = 0;
  for (const item of entries) {
    if ((item.percentage || 0) >= 70) streak++;
    else break;
  }
  return streak;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportHistoryJson(entries) {
  const payload = JSON.stringify(entries, null, 2);
  downloadFile(
    `quizzy-history-${new Date().toISOString().slice(0, 10)}.json`,
    payload,
    "application/json"
  );
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, "\"\"")}"`;
  return str;
}

function exportHistoryCsv(entries) {
  const header = [
    "created_at",
    "source_type",
    "score",
    "total",
    "percentage",
    "question_index",
    "question",
    "selected",
    "correct",
    "is_correct"
  ];

  const rows = [header.join(",")];
  entries.forEach((entry) => {
    const answers = Array.isArray(entry.answers) ? entry.answers : [];
    if (answers.length === 0) {
      rows.push([
        csvEscape(entry.createdAt),
        csvEscape(entry.sourceType),
        csvEscape(entry.score),
        csvEscape(entry.total),
        csvEscape(entry.percentage),
        "",
        "",
        "",
        "",
        ""
      ].join(","));
      return;
    }

    answers.forEach((ans, idx) => {
      rows.push([
        csvEscape(entry.createdAt),
        csvEscape(entry.sourceType),
        csvEscape(entry.score),
        csvEscape(entry.total),
        csvEscape(entry.percentage),
        csvEscape(idx + 1),
        csvEscape(ans.question),
        csvEscape(ans.selected || ""),
        csvEscape(ans.correct || ""),
        csvEscape(ans.isCorrect)
      ].join(","));
    });
  });

  downloadFile(
    `quizzy-history-${new Date().toISOString().slice(0, 10)}.csv`,
    rows.join("\n"),
    "text/csv"
  );
}

function renderEvaluationBoard() {
  if (!evaluationBoard) return;
  const entries = getHistory();

  if (entries.length === 0) {
    evaluationBoard.innerHTML = `
      <div class="card evaluation-empty">
        <h3>Evaluation Board</h3>
        <p>Complete a quiz to see score trends, recent attempts, and answer review.</p>
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
        <h3>Evaluation Board</h3>
        <div class="evaluation-head-actions">
          <button id="exportHistoryJsonBtn" class="ghost">Export JSON</button>
          <button id="exportHistoryCsvBtn" class="ghost">Export CSV</button>
          <button id="clearHistoryBtn" class="ghost">Clear History</button>
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
          <p>${wrongCount} question(s) need revision.</p>
          <details>
            <summary>Review Answers</summary>
            <div class="answer-review">
              ${latestAnswers.map((a, i) => `
                <div class="answer-item ${a.isCorrect ? "good" : "bad"}">
                  <strong>Q${i + 1}. ${a.question}</strong>
                  <p>Your answer: ${a.selected || "Not answered"} | Correct: ${a.correct}</p>
                </div>
              `).join("")}
            </div>
          </details>
        </div>
        <div class="card recent-attempts">
          <h4>Recent Attempts</h4>
          ${recent.map((e) => `
            <div class="attempt-row">
              <span>${formatShortDate(e.createdAt)}</span>
              <span>${e.score}/${e.total} (${e.percentage}%)</span>
              <span>${(e.sourceType || "text").toUpperCase()}</span>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  document.getElementById("clearHistoryBtn")?.addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderEvaluationBoard();
  });
  document.getElementById("exportHistoryJsonBtn")?.addEventListener("click", () => {
    exportHistoryJson(entries);
  });
  document.getElementById("exportHistoryCsvBtn")?.addEventListener("click", () => {
    exportHistoryCsv(entries);
  });
}

setThemeIcon();
renderEvaluationBoard();

/* CURSOR GLOW (SMOOTH FOLLOW) */
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

/* CURSOR TRAIL (COLOR-CHANGING) */
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
    return isDark
      ? ["#fbcfe8", "#c7d2fe", "#a5f3fc", "#fecdd3"]
      : ["#f5d0fe", "#c7d2fe", "#bae6fd", "#bbf7d0"];
  };

  const draw = () => {
    ctx.clearRect(0, 0, cursorTrail.width, cursorTrail.height);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      p.life -= 0.008;
    }
    points = points.filter(p => p.life > 0);

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

async function extractSourceText() {
  let response;
  const validationError = validateActiveSourceInput(true);
  if (validationError) {
    throw new Error(validationError);
  }

  if (activeSource === "pdf") {
    const file = pdfInput.files?.[0];
    if (!file) {
      throw new Error("Please choose a PDF file");
    }
    const formData = new FormData();
    formData.append("pdf", file);
    response = await fetch(`${API_BASE}/extract-content`, {
      method: "POST",
      body: formData
    });
  } else {
    const payload = activeSource === "url"
      ? { url: urlInput.value.trim() }
      : { text: input.value.trim() };
    response = await fetch(`${API_BASE}/extract-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not extract content");
  }
  if (!data.text || data.text.trim().length === 0) {
    throw new Error("Extraction returned empty content");
  }
  return data.text;
}

btn.onclick = async () => {
  loader.classList.remove("hidden");
  btn.disabled = true;

  try {
    let requestPayload;
    const rawTextInput = input.value.trim();

    if (activeSource === "text" && rawTextInput.length < 50) {
      requestPayload = { topic: rawTextInput };
    } else {
      const extractedText = await extractSourceText();
      requestPayload = { text: extractedText };
    }

    const res = await fetch(`${API_BASE}/generate-quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to generate quiz");
    }
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error("No questions were returned");
    }

    questions = data.questions;
    index = score = 0;
    answered = {};
    choices = {};
    attemptAnswers = Array.from({ length: questions.length }, () => null);
    currentAttemptMeta = {
      createdAt: new Date().toISOString(),
      sourceType: activeSource,
      sourceInput:
        activeSource === "pdf"
          ? (pdfInput.files?.[0]?.name || "pdf")
          : activeSource === "url"
            ? urlInput.value.trim()
            : input.value.trim().slice(0, 140)
    };

    setTimeout(() => {
      loader.classList.add("hidden");
      quiz.scrollIntoView({ behavior: "smooth" });
      showQuestion();
    }, 1200);
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

function showQuestion() {
  clearInterval(timer);
  timeLeft = 15;
  const q = questions[index];
  const progress = Math.round(((index + 1) / questions.length) * 100);

  quiz.innerHTML = `
    <div class="card quiz-card">
      <div class="quiz-top">
        <span>Q ${index + 1}/${questions.length}</span>
        <span>${timeLeft}s</span>
      </div>
      <div class="progress">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
      <h2>${q.question}</h2>
      ${q.options.map((o,i)=>`
        <div class="option" data-o="${String.fromCharCode(65+i)}">
          ${String.fromCharCode(65+i)}. ${o}
        </div>`).join("")}
      <div class="quiz-actions">
        <button id="prevBtn" class="ghost" ${index === 0 ? "disabled" : ""}>Previous</button>
        <button id="finishBtn" class="ghost">Finish</button>
        <button id="nextBtn">Next</button>
      </div>
    </div>
  `;

  document.querySelectorAll(".option").forEach(opt =>
    opt.onclick = () => answer(opt, q)
  );
  document.getElementById("prevBtn")?.addEventListener("click", prev);
  document.getElementById("finishBtn")?.addEventListener("click", finish);
  document.getElementById("nextBtn")?.addEventListener("click", next);

  if (answered[index]) {
    clearInterval(timer);
    document.querySelector(".quiz-top span:last-child").innerText = "Done";
    reveal(q, choices[index], true);
    return;
  }

  timer = setInterval(() => {
    timeLeft--;
    document.querySelector(".quiz-top span:last-child").innerText = timeLeft + "s";
    if (timeLeft <= 0 && !answered[index]) {
      answered[index] = true;
      choices[index] = null;
      attemptAnswers[index] = {
        question: q.question,
        selected: null,
        correct: q.correct,
        isCorrect: false
      };
      reveal(q, null, false);
      clearInterval(timer);
    }
  }, 1000);
}

function answer(el, q) {
  if (answered[index]) return;
  answered[index] = true;
  choices[index] = el.dataset.o;
  attemptAnswers[index] = {
    question: q.question,
    selected: el.dataset.o,
    correct: q.correct,
    isCorrect: el.dataset.o === q.correct
  };
  clearInterval(timer);
  reveal(q, el.dataset.o, false);
}

function reveal(q, choice, isReview) {
  document.querySelectorAll(".option").forEach(o => {
    o.classList.add("disabled");
    if (o.dataset.o === q.correct) o.classList.add("correct");
  });

  if (choice) {
    const chosen = document.querySelector(`.option[data-o="${choice}"]`);
    if (choice === q.correct) {
      if (!isReview) {
        score++;
        correctSound.play();
      }
    } else {
      chosen?.classList.add("wrong");
      if (!isReview) {
        wrongSound.play();
      }
    }
  }

  if (!quiz.querySelector(".explanation")) {
    quiz.querySelector(".quiz-card").insertAdjacentHTML(
      "beforeend",
      `<div class="explanation">${q.explanation}</div>`
    );
  }
}

function next() {
  index++;
  index < questions.length ? showQuestion() : finish();
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
      correct: q.correct,
      isCorrect: false
    };
  });

  const total = questions.length || 0;
  const percentage = total ? Math.round((score / total) * 100) : 0;

  return {
    id: Date.now(),
    createdAt: currentAttemptMeta?.createdAt || new Date().toISOString(),
    sourceType: currentAttemptMeta?.sourceType || "text",
    sourceInput: currentAttemptMeta?.sourceInput || "",
    score,
    total,
    percentage,
    answers
  };
}

function finish() {
  confetti();
  const entry = buildHistoryEntry();
  addHistoryEntry(entry);
  renderEvaluationBoard();

  quiz.innerHTML = `
    <div class="card quiz-card">
      <h2>Quiz Completed</h2>
      <h1>${score} / ${questions.length}</h1>
      <p>Accuracy: ${entry.percentage}%</p>
      <p>Source: ${entry.sourceType.toUpperCase()}</p>
    </div>
  `;
}

function confetti() {
  for (let i = 0; i < 120; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = `hsl(${Math.random()*360},100%,60%)`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3000);
  }
}

document.querySelectorAll("[data-count]").forEach(counter => {
  let target = +counter.dataset.count, c = 0;
  const run = () => {
    c += Math.ceil(target / 60);
    counter.innerText = c < target ? c : target;
    if (c < target) requestAnimationFrame(run);
  };
  run();
});
