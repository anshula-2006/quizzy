import API_BASE from "./config.js";

export const SESSION_KEY = "quizzy-session-v2";
export const QUIZ_KEY = "quizzy-vanilla-quiz-v1";
export const RESULT_KEY = "quizzy-vanilla-result-v1";
export const MAX_PDF_BYTES = 100 * 1024 * 1024;
export const HISTORY_BASE = "quizzy-history-v2";
export const MINI_GAME_BASE = "quizzy-mini-games-v1";
export const SESSION_ACTIVITY_BASE = "quizzy-session-activity-v1";
const MAX_HISTORY_ITEMS = 20;

export function spawnFloatingXP(amount, x, y) {
  if (!amount) return;
  
  // Inject the animation CSS once
  if (!document.getElementById("floating-xp-styles")) {
    const style = document.createElement("style");
    style.id = "floating-xp-styles";
    style.textContent = `
      .floating-xp {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        color: #10b981; /* Emerald Green */
        font-size: 2.5rem;
        font-weight: 900;
        text-shadow: 0 4px 12px rgba(0,0,0,0.4);
        animation: floatUpXP 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      }
      .floating-xp .xp-label {
        font-size: 1.2rem;
        color: #34d399;
      }
      @keyframes floatUpXP {
        0% { opacity: 0; transform: translate(-50%, 0) scale(0.5); }
        15% { opacity: 1; transform: translate(-50%, -20px) scale(1.2); }
        100% { opacity: 0; transform: translate(-50%, -100px) scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  const el = document.createElement("div");
  el.className = "floating-xp";
  el.innerHTML = `+${amount} <span class="xp-label">XP</span>`;
  
  el.style.left = x !== undefined ? `${x}px` : "50%";
  el.style.top = y !== undefined ? `${y}px` : "50%";
  
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  const session = getSession();
  return Boolean(session?.token && session?.user?.email);
}

function getScopeId() {
  return getSession()?.user?.email || null;
}

function historyKey() {
  const scopeId = getScopeId();
  return scopeId ? `${HISTORY_BASE}-${scopeId}` : "";
}

function miniGameKey() {
  const scopeId = getScopeId();
  return scopeId ? `${MINI_GAME_BASE}-${scopeId}` : "";
}

function sessionActivityKey() {
  const scopeId = getScopeId();
  return scopeId ? `${SESSION_ACTIVITY_BASE}-${scopeId}` : "";
}

function readJson(key, fallback) {
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!key) return false;
  localStorage.setItem(key, JSON.stringify(value));
  return true;
}

export function getQuizState() {
  try {
    const raw = sessionStorage.getItem(QUIZ_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setQuizState(value) {
  if (!value) {
    sessionStorage.removeItem(QUIZ_KEY);
    return;
  }
  sessionStorage.setItem(QUIZ_KEY, JSON.stringify(value));
}

export function getResultState() {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setResultState(value) {
  if (!value) {
    sessionStorage.removeItem(RESULT_KEY);
    return;
  }
  sessionStorage.setItem(RESULT_KEY, JSON.stringify(value));
}

export function clearQuizFlow() {
  sessionStorage.removeItem(QUIZ_KEY);
  sessionStorage.removeItem(RESULT_KEY);
}

export function getSavedQuizHistory() {
  const parsed = readJson(historyKey(), []);
  return Array.isArray(parsed) ? parsed : [];
}

export function markSessionActivity(activity) {
  if (!isLoggedIn()) return false;
  const key = sessionActivityKey();
  const previous = readJson(key, { quizDone: false, flashcardsDone: false, miniGameDone: false });
  return writeJson(key, {
    quizDone: Boolean(activity?.quizDone || previous.quizDone),
    flashcardsDone: Boolean(activity?.flashcardsDone || previous.flashcardsDone),
    miniGameDone: Boolean(activity?.miniGameDone || previous.miniGameDone)
  });
}

export function saveQuizAttemptLocal(quizState, resultState) {
  if (!isLoggedIn() || !quizState || !resultState) return false;

  const entry = {
    createdAt: new Date().toISOString(),
    generatedAt: quizState.generatedAt || null,
    score: Number(resultState.score || 0),
    total: Number(resultState.total || 0),
    percentage: Number(resultState.percentage || 0),
    confidence: Number(resultState.confidence || 0),
    answers: Array.isArray(resultState.answers) ? resultState.answers : [],
    settings: quizState.settings || {},
    meta: quizState.meta || {}
  };

  const next = [entry, ...getSavedQuizHistory()].slice(0, MAX_HISTORY_ITEMS);
  const saved = writeJson(historyKey(), next);
  if (saved) markSessionActivity({ quizDone: true });
  return saved;
}

export function getMiniGameStats() {
  const parsed = readJson(miniGameKey(), {});
  return {
    memoryWins: Math.max(0, Number(parsed?.memoryWins || 0)),
    memoryBestMoves: Math.max(0, Number(parsed?.memoryBestMoves || 0)),
    memoryBestTime: Math.max(0, Number(parsed?.memoryBestTime || 0)),
    reactionBest: Math.max(0, Number(parsed?.reactionBest || 0)),
    reactionRuns: Math.max(0, Number(parsed?.reactionRuns || 0)),
    recallBestLevel: Math.max(0, Number(parsed?.recallBestLevel || 0)),
    recallRuns: Math.max(0, Number(parsed?.recallRuns || 0))
  };
}

function saveMiniGameStats(stats) {
  const saved = writeJson(miniGameKey(), stats);
  if (saved) markSessionActivity({ miniGameDone: true });
  return saved;
}

export function setMiniGameStats(stats) {
  if (!isLoggedIn()) return false;
  return saveMiniGameStats({
    memoryWins: Math.max(0, Number(stats?.memoryWins || 0)),
    memoryBestMoves: Math.max(0, Number(stats?.memoryBestMoves || 0)),
    memoryBestTime: Math.max(0, Number(stats?.memoryBestTime || 0)),
    reactionBest: Math.max(0, Number(stats?.reactionBest || 0)),
    reactionRuns: Math.max(0, Number(stats?.reactionRuns || 0)),
    recallBestLevel: Math.max(0, Number(stats?.recallBestLevel || 0)),
    recallRuns: Math.max(0, Number(stats?.recallRuns || 0))
  });
}

async function postMiniGameUpdate(type, payload) {
  const session = getSession();
  if (!session?.token) return null;
  const response = await fetch(`${API_BASE}/data/mini-games`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`
    },
    body: JSON.stringify({ type, ...payload })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  if (data?.miniGameStats) setMiniGameStats(data.miniGameStats);
  return data;
}

export async function recordMemoryWin({ moves, seconds }) {
  if (!isLoggedIn()) return false;
  const previous = getMiniGameStats();
  const saved = saveMiniGameStats({
    ...previous,
    memoryWins: previous.memoryWins + 1,
    memoryBestMoves: previous.memoryBestMoves ? Math.min(previous.memoryBestMoves, moves) : moves,
    memoryBestTime: previous.memoryBestTime ? Math.min(previous.memoryBestTime, seconds) : seconds
  });
  const serverResponse = await postMiniGameUpdate("memory", { moves, seconds });
  return serverResponse || { saved };
}

export async function recordReactionAttempt(reaction) {
  if (!isLoggedIn()) return false;
  const previous = getMiniGameStats();
  const saved = saveMiniGameStats({
    ...previous,
    reactionRuns: previous.reactionRuns + 1,
    reactionBest: previous.reactionBest ? Math.min(previous.reactionBest, reaction) : reaction
  });
  const serverResponse = await postMiniGameUpdate("reaction", { reaction });
  return serverResponse || { saved };
}

export async function recordRecallAttempt(level) {
  if (!isLoggedIn()) return false;
  const previous = getMiniGameStats();
  const saved = saveMiniGameStats({
    ...previous,
    recallRuns: previous.recallRuns + 1,
    recallBestLevel: Math.max(previous.recallBestLevel, level)
  });
  const serverResponse = await postMiniGameUpdate("recall", { level });
  return serverResponse || { saved };
}

export function normalizeQuestion(question) {
  if (!question || typeof question !== "object") return null;
  const type = question.type === "short" ? "short" : "mcq";

  if (type === "mcq") {
    const options = Array.isArray(question.options) && question.options.length >= 2
      ? question.options.slice(0, 4)
      : null;
    const correct = String(question.correct || "A").trim().charAt(0).toUpperCase();
    if (!options) return null;
    return {
      ...question,
      type,
      options,
      correct: ["A", "B", "C", "D"].includes(correct) ? correct : "A"
    };
  }

  return {
    ...question,
    type,
    shortAnswer: question.shortAnswer || question.correct || "",
    acceptableAnswers: Array.isArray(question.acceptableAnswers) ? question.acceptableAnswers : []
  };
}

export function normalizeShortAnswer(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function gradeShortAnswer(value, question) {
  const user = normalizeShortAnswer(value);
  const primary = normalizeShortAnswer(question.shortAnswer || question.correct || "");
  const alternates = Array.isArray(question.acceptableAnswers)
    ? question.acceptableAnswers.map((item) => normalizeShortAnswer(item))
    : [];
  return [primary, ...alternates]
    .filter(Boolean)
    .some((candidate) => user === candidate || (candidate.length > 4 && user.includes(candidate)));
}

export async function extractContent(inputMode, values) {
  if (inputMode === "text") {
    const trimmed = values.topic.trim();
    if (trimmed.length < 50) {
      return {
        topic: trimmed,
        sourceType: "topic",
        sourceInput: trimmed
      };
    }
  }

  if (inputMode === "pdf") {
    const file = values.pdfFile;
    if (!file) throw new Error("Please choose a PDF file.");
    if (file.size > MAX_PDF_BYTES) throw new Error("PDF is too large. Maximum size is 100MB.");

    const formData = new FormData();
    formData.append("pdf", file);
    const response = await fetch(`${API_BASE}/extract-content`, { method: "POST", body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not read the PDF.");
    return {
      text: data.text,
      extractionId: data.extractionId || null,
      preferFull: false,
      sourceType: "pdf",
      sourceInput: file.name || "pdf"
    };
  }

  if (inputMode === "url") {
    const response = await fetch(`${API_BASE}/extract-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: values.url.trim() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not read that URL.");
    return {
      text: data.text,
      extractionId: data.extractionId || null,
      preferFull: false,
      sourceType: "url",
      sourceInput: values.url.trim()
    };
  }

  const response = await fetch(`${API_BASE}/extract-content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: values.topic.trim() })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not prepare that content.");
  return {
    text: data.text,
    extractionId: data.extractionId || null,
    preferFull: false,
    sourceType: "text",
    sourceInput: values.topic.trim().slice(0, 140)
  };
}

export async function requestQuiz(payload) {
  const response = await fetch(`${API_BASE}/generate-quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to generate quiz.");
  const questions = (Array.isArray(data.questions) ? data.questions : [])
    .map(normalizeQuestion)
    .filter(Boolean);
  if (!questions.length) throw new Error("No quiz questions were returned.");
  return { quizId: data.quizId || null, questions };
}

export async function submitQuizAttempt(quizState) {
  const session = getSession();
  const answers = quizState.questions.map((question, index) => ({
    question: question.question,
    selected: quizState.answers[index]?.selected ?? ""
  }));

  if (!session?.token || !quizState.quizId) return null;

  const response = await fetch(`${API_BASE}/submit-quiz`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`
    },
    body: JSON.stringify({
      quizId: quizState.quizId,
      answers,
      sourceType: quizState.meta?.sourceType || "topic",
      sourceInput: quizState.meta?.sourceInput || "",
      settings: quizState.settings
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Failed to submit quiz.");
  return data;
}

export function buildResultState(quizState, evaluationOverride = null) {
  const answers = quizState.questions.map((question, index) => {
    const answer = quizState.answers[index];
    if (answer) return answer;
    return {
      question: question.question,
      selected: "",
      correct: question.type === "short" ? question.shortAnswer : question.correct,
      isCorrect: false,
      type: question.type,
      explanation: question.explanation || "",
      wrongExplanation: question.wrongExplanation || ""
    };
  });

  const score = answers.filter((answer) => answer.isCorrect).length;
  const total = quizState.questions.length;
  const fallback = {
    score,
    total,
    percentage: total ? Math.round((score / total) * 100) : 0,
    confidence: 0,
    answers
  };

  return {
    ...fallback,
    ...(evaluationOverride || {}),
    generatedAt: quizState.generatedAt,
    meta: quizState.meta,
    settings: quizState.settings
  };
}

export function feedbackText(percentage) {
  if (percentage >= 90) return "Nice! You're sharp.";
  if (percentage >= 75) return "Strong run. You're warming up fast.";
  if (percentage >= 60) return "Good momentum. One more round will feel even better.";
  return "You've got this. Try again and level up.";
}
