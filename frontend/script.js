import API_BASE from "./js/config.js";
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
const badgeCabinet = document.getElementById("badgeCabinet");
const gameHub = document.getElementById("gameHub");
const toggle = document.getElementById("themeToggle");
const authUser = document.getElementById("authUser");
const loginLink = document.getElementById("loginLink");
const registerLink = document.getElementById("registerLink");
const logoutBtn = document.getElementById("logoutBtn");
const loader = document.getElementById("loader");
const difficultyMode = document.getElementById("difficultyMode");
const learnerMode = document.getElementById("learnerMode");
const questionMode = document.getElementById("questionMode");
const languageMode = document.getElementById("languageMode");
const roleFlavor = document.getElementById("roleFlavor");
const sidebarTitle = document.getElementById("sidebarTitle");
const timelineTitle = document.getElementById("timelineTitle");
const savedTitle = document.getElementById("savedTitle");
const flashTitle = document.getElementById("flashTitle");
const attemptList = document.getElementById("attemptList");
const savedList = document.getElementById("savedList");
const flashList = document.getElementById("flashList");
const userAvatar = document.getElementById("userAvatar");
const profileAvatar = document.getElementById("profileAvatar");
const profileName = document.getElementById("profileName");
const profileSummary = document.getElementById("profileSummary");
const welcomeHeadline = document.getElementById("welcomeHeadline");
const welcomeSubline = document.getElementById("welcomeSubline");
const quickGenerateBtn = document.getElementById("quickGenerateBtn");
const resumeQuizBtn = document.getElementById("resumeQuizBtn");

const correctSound = new Audio("assets/correct.mp3");
const wrongSound = new Audio("assets/wrong.mp3");

let questions = [];
let index = 0;
let score = 0;
let activeQuizId = null;
let timer;
let timeLeft = 15;
let answered = {};
let choices = {};
let activeSource = "text";
const MAX_PDF_BYTES = 100 * 1024 * 1024;
const QUIZ_BATCH_SIZE = 5;
const HISTORY_BASE = "quizzy-history-v2";
const SAVED_BASE = "quizzy-saved-v1";
const FLASH_BASE = "quizzy-flash-v1";
const BONUS_XP_BASE = "quizzy-bonus-xp-v1";
const CHALLENGE_BASE = "quizzy-challenges-v1";
const MINI_GAME_BASE = "quizzy-mini-games-v1";
const SESSION_ACTIVITY_BASE = "quizzy-session-activity-v1";
const SEEN_BADGES_BASE = "quizzy-seen-badges-v1";
const MAX_HISTORY_ITEMS = 20;
let attemptAnswers = [];
let currentAttemptMeta = null;
let activeFlashDeck = null;
let activeFlashIndex = 0;
let activeFlashFlipped = false;
let suppressFlashToggleClick = false;
let lastQuizRequestBase = null;
let isLoadingMoreQuestions = false;
let activeChallengeSet = [];
let speedRoundState = null;
let memoryMatchState = null;
let wordScrambleState = null;
let trueFalseState = null;
let oddOneOutState = null;
let badgePopupQueue = [];
let activeBadgePopup = null;
let cloudProfile = null;
let cloudLeaderboard = [];

const DEFAULT_SPEED_ROUND_POOL = [
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Earth", "Mars", "Venus", "Jupiter"],
    correct: "B"
  },
  {
    question: "What is H2O commonly called?",
    options: ["Salt", "Water", "Oxygen", "Hydrogen"],
    correct: "B"
  },
  {
    question: "Which part of the plant makes food?",
    options: ["Root", "Stem", "Leaf", "Flower"],
    correct: "C"
  },
  {
    question: "5 x 6 equals?",
    options: ["11", "25", "30", "35"],
    correct: "C"
  },
  {
    question: "Which gas do humans need to breathe?",
    options: ["Carbon dioxide", "Nitrogen", "Oxygen", "Helium"],
    correct: "C"
  },
  {
    question: "Who wrote the Indian national anthem?",
    options: ["Rabindranath Tagore", "Mahatma Gandhi", "Subhas Chandra Bose", "Sarojini Naidu"],
    correct: "A"
  }
];

const DEFAULT_MEMORY_PAIRS = [
  { prompt: "Photosynthesis", answer: "Plants making food using sunlight" },
  { prompt: "CPU", answer: "The brain of a computer" },
  { prompt: "Fraction", answer: "A part of a whole" },
  { prompt: "Evaporation", answer: "Liquid changing into vapor" }
];

const DEFAULT_SCRAMBLE_WORDS = [
  "algorithm",
  "planet",
  "fraction",
  "computer",
  "gravity",
  "biology"
];

const DEFAULT_TRUE_FALSE_POOL = [
  { statement: "The Sun is a star.", answer: true },
  { statement: "Water boils at 50 degrees Celsius at sea level.", answer: false },
  { statement: "A triangle has three sides.", answer: true },
  { statement: "Plants absorb carbon dioxide from the air.", answer: true },
  { statement: "The human heart has 6 chambers.", answer: false }
];

const DEFAULT_ODD_ONE_OUT_POOL = [
  { prompt: "Pick the odd one out", options: ["Mercury", "Venus", "Mars", "Oxygen"], answer: 3 },
  { prompt: "Pick the odd one out", options: ["CPU", "RAM", "Keyboard", "Monitor"], answer: 1 },
  { prompt: "Pick the odd one out", options: ["Circle", "Square", "Triangle", "Banana"], answer: 3 }
];

const ROLE_PRESETS = {
  student: { difficulty: "moderate", questionMode: "mcq", timerBias: 0 },
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

const LANGUAGE_LABELS = {
  English: "English",
  Hindi: "Hindi",
  Bengali: "Bengali",
  Tamil: "Tamil",
  Telugu: "Telugu",
  Marathi: "Marathi",
  Gujarati: "Gujarati",
  Kannada: "Kannada",
  Malayalam: "Malayalam",
  Punjabi: "Punjabi",
  Urdu: "Urdu",
  Spanish: "Spanish",
  French: "French",
  German: "German",
  Portuguese: "Portuguese",
  Italian: "Italian",
  Arabic: "Arabic",
  Chinese: "Chinese",
  Korean: "Korean",
  Japanese: "Japanese"
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

function bonusXpKey() {
  return `${BONUS_XP_BASE}-${getScopeId()}`;
}

function challengeKey() {
  return `${CHALLENGE_BASE}-${getScopeId()}`;
}

function miniGameKey() {
  return `${MINI_GAME_BASE}-${getScopeId()}`;
}

function sessionActivityKey() {
  return `${SESSION_ACTIVITY_BASE}-${getScopeId()}`;
}

function seenBadgesKey() {
  return `${SEEN_BADGES_BASE}-${getScopeId()}`;
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
    outputLanguage: languageMode?.value || "English",
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
    if (userAvatar) userAvatar.textContent = "Q";
    return;
  }

  authUser.textContent = `Hi, ${session.name}`;
  authUser?.classList.remove("hidden");
  logoutBtn?.classList.remove("hidden");
  loginLink?.classList.add("hidden");
  registerLink?.classList.add("hidden");
  const initial = String(session.name || "Q").trim().charAt(0).toUpperCase() || "Q";
  if (userAvatar) userAvatar.textContent = initial;
  if (profileAvatar) profileAvatar.textContent = initial;
}

function renderSaasMeta() {
  const session = auth?.getSession?.();
  const entries = getHistory();
  const average = entries.length
    ? Math.round(entries.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / entries.length)
    : 0;
  const streak = cloudProfile?.currentStreak ?? getStreak(entries);
  const points = cloudProfile?.totalPoints ?? 0;

  if (welcomeHeadline) {
    welcomeHeadline.textContent = session?.name
      ? `Welcome back, ${session.name}`
      : "Welcome to Quizzy";
  }
  if (welcomeSubline) {
    welcomeSubline.textContent = session?.name
      ? `You have completed ${entries.length} quizzes with an average score of ${average}%. Keep your ${streak}-quiz streak alive and climb the leaderboard.`
      : "Generate quizzes from a topic, PDF, or URL, then turn your progress into points, streaks, and badges.";
  }
  if (profileName) {
    profileName.textContent = session?.name || "Quizzy User";
  }
  if (profileSummary) {
    profileSummary.textContent = session?.name
      ? `Average score ${average}% | Current streak ${streak} | Points ${points}`
      : "Sign in to sync attempts, streak, leaderboard rank, and saved study progress.";
  }
}

async function loadCloudDataIntoLocal() {
  if (!isLoggedIn()) return;
  const result = await cloudRequest("/data/bootstrap");
  if (!result.ok) return;
  const attempts = Array.isArray(result.data?.attempts) ? result.data.attempts : [];
  const savedQuestions = Array.isArray(result.data?.savedQuestions) ? result.data.savedQuestions : [];
  const flashDecks = Array.isArray(result.data?.flashDecks) ? result.data.flashDecks : [];
  cloudProfile = result.data?.profile || null;
  cloudLeaderboard = Array.isArray(result.data?.leaderboard) ? result.data.leaderboard : [];
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
  syncChallengeRewards();
  saveSeenBadgeIds(getUnlockedBadgeCatalog().map((badge) => badge.id));
  renderAuthNav();
  renderSaasMeta();
  renderEvaluationBoard();
  renderBadgeCabinet();
  renderGameHub();
  renderSidebar();
}

function getDefaultHint(source) {
  if (source === "text") return "Paste study text to generate a quiz.";
  if (source === "url") return "Paste a public article URL to extract content.";
  return "Upload a PDF file (max 100MB, first pages are used for fast generation).";
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
      error = "PDF is too large. Maximum size is 100MB.";
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
  if (!toggle) return;
  toggle.textContent = document.body.classList.contains("dark") ? "Sun" : "Moon";
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
  const previousBadgeIds = captureUnlockedBadgeIds();
  const decks = getFlashDecks();
  decks.unshift(deck);
  saveFlashDecks(decks);
  markSessionActivity("flashcardsDone");
  if (isLoggedIn()) {
    cloudRequest("/data/flash-decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deck)
    });
  }
  syncChallengeRewards();
  renderBadgeCabinet();
  renderGameHub();
  revealNewBadges(previousBadgeIds);
}

function getBonusXp() {
  try {
    const raw = localStorage.getItem(bonusXpKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return Math.max(0, Number(parsed?.total || 0));
  } catch {
    return 0;
  }
}

function saveBonusXp(total) {
  localStorage.setItem(bonusXpKey(), JSON.stringify({ total: Math.max(0, Math.round(Number(total) || 0)) }));
}

function getChallengeProgress() {
  try {
    const raw = localStorage.getItem(challengeKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      completed: Array.isArray(parsed?.completed) ? parsed.completed : [],
      rewards: Array.isArray(parsed?.rewards) ? parsed.rewards : []
    };
  } catch {
    return { completed: [], rewards: [] };
  }
}

function saveChallengeProgress(progress) {
  localStorage.setItem(challengeKey(), JSON.stringify({
    completed: Array.isArray(progress?.completed) ? progress.completed : [],
    rewards: Array.isArray(progress?.rewards) ? progress.rewards : []
  }));
}

function getMiniGameStats() {
  try {
    const raw = localStorage.getItem(miniGameKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      speedBest: Math.max(0, Number(parsed?.speedBest || 0)),
      speedRuns: Math.max(0, Number(parsed?.speedRuns || 0)),
      memoryWins: Math.max(0, Number(parsed?.memoryWins || 0)),
      scrambleWins: Math.max(0, Number(parsed?.scrambleWins || 0)),
      trueFalseBest: Math.max(0, Number(parsed?.trueFalseBest || 0)),
      oddOneOutWins: Math.max(0, Number(parsed?.oddOneOutWins || 0)),
      rewards: Array.isArray(parsed?.rewards) ? parsed.rewards : []
    };
  } catch {
    return { speedBest: 0, speedRuns: 0, memoryWins: 0, scrambleWins: 0, trueFalseBest: 0, oddOneOutWins: 0, rewards: [] };
  }
}

function saveMiniGameStats(stats) {
  localStorage.setItem(miniGameKey(), JSON.stringify({
    speedBest: Math.max(0, Number(stats?.speedBest || 0)),
    speedRuns: Math.max(0, Number(stats?.speedRuns || 0)),
    memoryWins: Math.max(0, Number(stats?.memoryWins || 0)),
    scrambleWins: Math.max(0, Number(stats?.scrambleWins || 0)),
    trueFalseBest: Math.max(0, Number(stats?.trueFalseBest || 0)),
    oddOneOutWins: Math.max(0, Number(stats?.oddOneOutWins || 0)),
    rewards: Array.isArray(stats?.rewards) ? stats.rewards : []
  }));
}

function getSessionActivity() {
  try {
    const raw = localStorage.getItem(sessionActivityKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      quizDone: Boolean(parsed?.quizDone),
      flashcardsDone: Boolean(parsed?.flashcardsDone),
      miniGameDone: Boolean(parsed?.miniGameDone)
    };
  } catch {
    return { quizDone: false, flashcardsDone: false, miniGameDone: false };
  }
}

function saveSessionActivity(activity) {
  localStorage.setItem(sessionActivityKey(), JSON.stringify({
    quizDone: Boolean(activity?.quizDone),
    flashcardsDone: Boolean(activity?.flashcardsDone),
    miniGameDone: Boolean(activity?.miniGameDone)
  }));
}

function markSessionActivity(key) {
  const activity = getSessionActivity();
  activity[key] = true;
  saveSessionActivity(activity);
}

function getSeenBadgeIds() {
  try {
    const raw = localStorage.getItem(seenBadgesKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSeenBadgeIds(ids) {
  localStorage.setItem(seenBadgesKey(), JSON.stringify(Array.isArray(ids) ? ids : []));
}

function showToast(message, variant = "default") {
  const host = document.body;
  if (!host) return;
  const rack = document.getElementById("toastRack") || (() => {
    const node = document.createElement("div");
    node.id = "toastRack";
    node.className = "toast-rack";
    document.body.appendChild(node);
    return node;
  })();

  const toast = document.createElement("div");
  toast.className = `toast-item ${variant}`;
  toast.textContent = message;
  rack.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 260);
  }, 2600);
}

function awardBonusXp(amount, reason, rewardId = "") {
  const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (!safeAmount) return;

  if (rewardId) {
    const progress = getChallengeProgress();
    const rewards = new Set(progress.rewards);
    if (rewards.has(rewardId)) return;
    rewards.add(rewardId);
    saveChallengeProgress({ ...progress, rewards: Array.from(rewards) });
  }

  const nextTotal = getBonusXp() + safeAmount;
  saveBonusXp(nextTotal);
  showToast(`+${safeAmount} XP: ${reason}`, "xp");
}

function getChallengeDeck(entries, gameStats) {
  const latest = entries[0] || null;
  return [
    {
      id: "quiz-80",
      title: "Sharp Shooter",
      xp: 60,
      description: "Score 80% or more in your next quiz. Your XP will jump higher when you nail this mission.",
      cta: "Start a quiz",
      completed: entries.some((entry) => Number(entry.percentage || 0) >= 80)
    },
    {
      id: "speed-runner",
      title: "Lightning Sprint",
      xp: 40,
      description: "Play Speed Round and hit 4 correct answers. Bonus XP drops the second you do it.",
      cta: "Play Speed Round",
      completed: Number(gameStats.speedBest || 0) >= 4
    },
    {
      id: "memory-hero",
      title: "Match Master",
      xp: 35,
      description: "Beat Memory Match once to collect extra XP and unlock a fresh badge.",
      cta: "Play Memory Match",
      completed: Number(gameStats.memoryWins || 0) >= 1
    },
    {
      id: "combo-keeper",
      title: "Streak Builder",
      xp: 45,
      description: "Chain together 3 quiz wins above 70% to raise your level bar even faster.",
      cta: "Keep the streak alive",
      completed: getStreak(entries) >= 3
    },
    {
      id: "flash-fan",
      title: "Card Collector",
      xp: 30,
      description: "Generate a flashcard deck. Every smart study move should feel rewarding too.",
      cta: "Make flashcards",
      completed: getFlashDecks().length >= 1
    }
  ];
}

function syncChallengeRewards(entries = getHistory()) {
  const gameStats = getMiniGameStats();
  const progress = getChallengeProgress();
  const completed = new Set(progress.completed);
  const rewards = new Set(progress.rewards);
  const deck = getChallengeDeck(entries, gameStats);

  deck.forEach((challenge) => {
    if (!challenge.completed) return;
    completed.add(challenge.id);
    const rewardId = `challenge:${challenge.id}`;
    if (!rewards.has(rewardId)) {
      rewards.add(rewardId);
      saveBonusXp(getBonusXp() + challenge.xp);
      showToast(`Challenge cleared: ${challenge.title} (+${challenge.xp} XP)`, "xp");
    }
  });

  saveChallengeProgress({ completed: Array.from(completed), rewards: Array.from(rewards) });
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

function getSourceEmoji(sourceType) {
  if (sourceType === "pdf") return "PDF";
  if (sourceType === "url") return "URL";
  return "TOPIC";
}

function renderSidebar() {
  const entries = getHistory();
  const saved = getSavedQuestions();
  const decks = getFlashDecks();
  const game = getGamification(entries);

  if (attemptList) {
    attemptList.innerHTML = entries.length
      ? entries.slice(0, 8).map((e) => `
          <article class="rounded-2xl border border-white/10 bg-white/6 p-3 text-white">
            <div class="flex items-center justify-between gap-2">
              <strong class="text-lg font-black">${e.percentage}%</strong>
              <span class="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/70">${getSourceEmoji(e.sourceType)}</span>
            </div>
            <p class="mt-2 text-xs text-white/65">${e.score}/${e.total} • ${formatShortDate(e.createdAt)}</p>
            <p class="mt-1 text-xs text-white/50">${(e.settings?.difficulty || "moderate").toUpperCase()} • ${(e.settings?.questionMode || "mcq").toUpperCase()} • ${(e.settings?.outputLanguage || "English").toUpperCase()}</p>
          </article>
        `).join("")
      : `<p class="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/55">No attempts yet. Your latest runs will appear here.</p>`;
    if (entries.length) {
      attemptList.insertAdjacentHTML(
        "afterbegin",
        `<article class="rounded-3xl border border-cyan-300/20 bg-gradient-to-r from-violet-500/20 to-cyan-400/15 p-4 text-white">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.25em] text-cyan-100/80">Current level</p>
              <strong class="mt-1 block text-2xl font-black">Lvl ${game.level}</strong>
            </div>
            <div class="text-right">
              <p class="text-sm font-bold">${game.totalXp} XP</p>
              <p class="text-xs text-white/60">${game.badges.length} badge(s) unlocked</p>
            </div>
          </div>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <span class="block h-full rounded-full bg-gradient-to-r from-violet-300 to-cyan-300" style="width:${game.progress}%"></span>
          </div>
        </article>`
      );
    }
  }

  if (savedList) {
    savedList.innerHTML = saved.length
      ? saved.slice(0, 10).map((item) => `
          <details class="rounded-2xl border border-white/10 bg-white/6 p-3 text-white/80">
            <summary class="cursor-pointer list-none text-sm font-semibold text-white">${item.question}</summary>
            <p class="mt-3 text-xs"><strong class="text-white">Answer:</strong> ${item.correct}</p>
            <p class="mt-2 text-xs leading-5 text-white/60">${item.explanation || ""}</p>
          </details>
        `).join("")
      : `<p class="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/55">No saved questions yet.</p>`;
  }

  if (flashList) {
    flashList.innerHTML = decks.length
      ? decks.slice(0, 6).map((deck) => `
          <details class="rounded-2xl border border-white/10 bg-white/6 p-3 text-white/80">
            <summary class="cursor-pointer list-none text-sm font-semibold text-white">${deck.title} (${deck.flashcards.length})</summary>
            <div class="mt-3 space-y-2">
              ${deck.flashcards.slice(0, 3).map((c) => `<p class="rounded-xl bg-black/20 px-3 py-2 text-xs"><strong class="text-white">${c.front}</strong><br/>${c.back}</p>`).join("")}
            </div>
          </details>
        `).join("")
      : `<p class="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-5 text-sm text-white/55">No flashcard decks generated yet.</p>`;
  }

}

async function clearDashboardHistory() {
  saveHistory([]);

  if (!isLoggedIn()) {
    syncChallengeRewards([]);
    renderSaasMeta();
    renderEvaluationBoard();
    renderBadgeCabinet();
    renderGameHub();
    renderSidebar();
    showToast("Dashboard history cleared.", "success");
    return;
  }

  const result = await cloudRequest("/data/attempts", { method: "DELETE" });
  if (!result.ok) {
    await loadCloudDataIntoLocal();
    renderSaasMeta();
    renderEvaluationBoard();
    renderBadgeCabinet();
    renderGameHub();
    renderSidebar();
    showToast(result.error || "Could not clear dashboard history.", "error");
    return;
  }

  await loadCloudDataIntoLocal();
  syncChallengeRewards(getHistory());
  renderSaasMeta();
  renderEvaluationBoard();
  renderBadgeCabinet();
  renderGameHub();
  renderSidebar();
  showToast("Dashboard history cleared.", "success");
}

function renderEvaluationBoard() {
  if (!evaluationBoard) return;
  renderSaasMeta();
  const entries = getHistory();

  const role = learnerMode?.value || "student";
  const labels = ROLE_LABELS[role] || ROLE_LABELS.student;

  if (entries.length === 0) {
    evaluationBoard.innerHTML = `
      <div class="rounded-[28px] border border-dashed border-white/15 bg-white/5 p-6 text-white">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.25em] text-violet-200">${labels.dashboard}</p>
            <h3 class="mt-2 text-2xl font-black">No runs yet</h3>
            <p class="mt-2 max-w-xl text-sm leading-6 text-white/60">Generate your first quiz and this area will turn into a progress snapshot with streaks, XP, and review notes.</p>
          </div>
          <button id="clearHistoryBtn" class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 transition hover:text-white" type="button">Clear History</button>
        </div>
      </div>
    `;
    document.getElementById("clearHistoryBtn")?.addEventListener("click", clearDashboardHistory);
    return;
  }

  const latest = entries[0];
  const latestAnswers = Array.isArray(latest.answers) ? latest.answers : [];
  const best = Math.max(...entries.map((e) => e.percentage || 0));
  const avg = Math.round(entries.reduce((sum, e) => sum + (e.percentage || 0), 0) / entries.length);
  const streak = getStreak(entries);
  const recent = entries.slice(0, 5);
  const wrongCount = latestAnswers.filter((a) => !a.isCorrect).length;
  const game = getGamification(entries);
  const unlockedBadges = game.badges.slice(0, 4).map((badge) => `
    <span class="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-white/80">${badge.label}</span>
  `).join("");

  evaluationBoard.innerHTML = `
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div class="rounded-[28px] border border-white/10 bg-gradient-to-br from-violet-500/18 to-cyan-400/10 p-5 text-white">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.25em] text-violet-200">${labels.dashboard}</p>
              <h3 class="mt-2 text-3xl font-black">${latest.percentage}% latest score</h3>
              <p class="mt-2 text-sm leading-6 text-white/65">${getFeedback(entries)}</p>
            </div>
            <button id="clearHistoryBtn" class="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/75 transition hover:text-white" type="button">Clear</button>
          </div>
          <div class="mt-5 grid gap-3 sm:grid-cols-4">
            <div class="rounded-2xl bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">Level</p>
              <strong class="mt-2 block text-2xl font-black">${game.level}</strong>
            </div>
            <div class="rounded-2xl bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">XP</p>
              <strong class="mt-2 block text-2xl font-black">${game.totalXp}</strong>
            </div>
            <div class="rounded-2xl bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">Streak</p>
              <strong class="mt-2 block text-2xl font-black">${streak}</strong>
            </div>
            <div class="rounded-2xl bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">Best</p>
              <strong class="mt-2 block text-2xl font-black">${best}%</strong>
            </div>
          </div>
          <div class="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
            <div class="h-full rounded-full bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300" style="width:${game.progress}%"></div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            ${unlockedBadges || `<span class="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold text-white/70">No badges yet</span>`}
          </div>
        </div>
        <div class="rounded-[28px] border border-white/10 bg-white/6 p-5 text-white">
          <p class="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Snapshot</p>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="rounded-2xl bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">Average</p>
              <strong class="mt-2 block text-2xl font-black">${avg}%</strong>
            </div>
            <div class="rounded-2xl bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">Need review</p>
              <strong class="mt-2 block text-2xl font-black">${wrongCount}</strong>
            </div>
            <div class="rounded-2xl bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">Band</p>
              <strong class="mt-2 block text-lg font-black">${getBandLabel(latest.percentage)}</strong>
            </div>
            <div class="rounded-2xl bg-black/20 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-white/45">Trend</p>
              <strong class="mt-2 block text-sm font-bold">${getTrend(entries).label}</strong>
            </div>
          </div>
          <div class="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p class="text-sm font-semibold text-white">Latest attempt</p>
            <p class="mt-2 text-sm text-white/65">${latest.score}/${latest.total} • ${formatShortDate(latest.createdAt)} • ${(latest.settings?.outputLanguage || "English").toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div class="rounded-[28px] border border-white/10 bg-white/6 p-5 text-white">
          <div class="flex items-center justify-between gap-3">
            <h4 class="text-lg font-black">Recent attempts</h4>
            <span class="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/60">${entries.length} total</span>
          </div>
          <div class="mt-4 space-y-3">
            ${recent.map((e) => `
              <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div class="flex items-center justify-between gap-3">
                  <strong class="text-lg font-black">${e.percentage}%</strong>
                  <span class="text-xs uppercase tracking-[0.18em] text-white/45">${(e.settings?.difficulty || "moderate").toUpperCase()}</span>
                </div>
                <p class="mt-2 text-sm text-white/65">${e.score}/${e.total} • ${formatShortDate(e.createdAt)}</p>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="rounded-[28px] border border-white/10 bg-white/6 p-5 text-white">
          <h4 class="text-lg font-black">Question review</h4>
          <div class="mt-4 flex flex-wrap gap-2">
            ${latestAnswers.map((a, i) => `
              <button class="review-q-btn rounded-full border px-4 py-2 text-sm font-semibold ${a.isCorrect ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100" : "border-rose-300/30 bg-rose-400/15 text-rose-100"}" data-review-index="${i}">
                Q${i + 1}
              </button>
            `).join("")}
          </div>
          <div id="reviewDetail" class="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/70">Click a question chip to view the explanation.</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("clearHistoryBtn")?.addEventListener("click", clearDashboardHistory);

  const detailNode = document.getElementById("reviewDetail");
  const renderReviewDetail = (idx) => {
    const item = latestAnswers[idx];
    if (!item || !detailNode) return;
    const imageBlock = item.image && /^https:\/\/upload\.wikimedia\.org\/.+\.(png|jpg)$/i.test(item.image)
      ? `<div class="explain-image-wrap"><img class="explain-image" src="${item.image}" alt="Review visual" loading="lazy" onerror="this.closest('.explain-image-wrap')?.remove()" /></div>`
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

function getSpeedRoundPool() {
  const saved = getSavedQuestions()
    .filter((item) => item?.question && item?.correct)
    .slice(0, 8)
    .map((item, index, arr) => {
      const wrongOptions = arr
        .filter((other) => other.question !== item.question && other.correct)
        .map((other) => other.correct)
        .filter((value, idx, list) => value && list.indexOf(value) === idx)
        .slice(0, 3);
      const options = [item.correct, ...wrongOptions];
      while (options.length < 4) {
        options.push(DEFAULT_SPEED_ROUND_POOL[(index + options.length) % DEFAULT_SPEED_ROUND_POOL.length].options[0]);
      }
      const shuffled = options
        .slice(0, 4)
        .sort(() => Math.random() - 0.5);
      return {
        question: item.question,
        options: shuffled,
        correct: String.fromCharCode(65 + shuffled.indexOf(item.correct))
      };
    });

  return (saved.length ? saved : DEFAULT_SPEED_ROUND_POOL)
    .slice(0, 6)
    .sort(() => Math.random() - 0.5);
}

function getMemoryPairs() {
  const decks = getFlashDecks();
  const deckCards = decks
    .flatMap((deck) => Array.isArray(deck.flashcards) ? deck.flashcards : [])
    .filter((card) => card?.front && card?.back)
    .slice(0, 4)
    .map((card) => ({ prompt: card.front, answer: card.back }));

  return (deckCards.length ? deckCards : DEFAULT_MEMORY_PAIRS).slice(0, 4);
}

function getScramblePool() {
  const flashWords = getFlashDecks()
    .flatMap((deck) => Array.isArray(deck.flashcards) ? deck.flashcards : [])
    .map((card) => String(card?.front || "").trim().split(/\s+/)[0] || "")
    .filter((word) => /^[a-zA-Z]{5,}$/.test(word))
    .slice(0, 8);
  return (flashWords.length ? flashWords : DEFAULT_SCRAMBLE_WORDS).slice(0, 6);
}

function scrambleWord(word) {
  const chars = String(word || "").split("");
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const scrambled = chars.join("");
  return scrambled.toLowerCase() === String(word || "").toLowerCase() ? chars.reverse().join("") : scrambled;
}

function getTrueFalsePool() {
  const saved = getSavedQuestions()
    .filter((item) => item?.question && item?.correct)
    .slice(0, 5)
    .flatMap((item, index) => ([
      { statement: `${item.question} Answer: ${item.correct}`, answer: true },
      { statement: `${item.question} Answer: ${(getSavedQuestions()[index + 1]?.correct || "Unknown")}`, answer: false }
    ]));
  return (saved.length ? saved : DEFAULT_TRUE_FALSE_POOL).slice(0, 6);
}

function getOddOneOutPool() {
  const defaults = DEFAULT_ODD_ONE_OUT_POOL.slice();
  const flash = getFlashDecks()[0];
  if (flash?.flashcards?.length >= 3) {
    defaults.unshift({
      prompt: "Pick the odd one out",
      options: [
        flash.flashcards[0]?.front || "Biology",
        flash.flashcards[1]?.front || "Physics",
        flash.flashcards[2]?.front || "Chemistry",
        "Banana"
      ],
      answer: 3
    });
  }
  return defaults.slice(0, 4);
}

function renderBadgeCabinet() {
  if (!badgeCabinet) return;
  const entries = getHistory();
  const game = getGamification(entries);
  const badgeList = getBadgeCatalog(entries);
  const unlockedCount = badgeList.filter((badge) => badge.unlocked).length;

  badgeCabinet.innerHTML = `
    <div class="space-y-5 text-white">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 class="text-xl font-black">Badge cabinet</h3>
          <p class="mt-2 text-sm leading-6 text-white/60">Collect playful rewards while you quiz, review, and explore bonus modes.</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-center">
          <strong class="block text-2xl font-black">${unlockedCount}/${badgeList.length}</strong>
          <span class="text-xs uppercase tracking-[0.22em] text-white/45">Unlocked</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2 text-xs font-semibold">
        <span class="rounded-full border border-white/10 bg-white/8 px-3 py-1">Quiz XP ${game.quizXp}</span>
        <span class="rounded-full border border-white/10 bg-white/8 px-3 py-1">Bonus XP ${game.bonusXp}</span>
        <span class="rounded-full border border-white/10 bg-white/8 px-3 py-1">Level ${game.level}</span>
        <span class="rounded-full border border-white/10 bg-white/8 px-3 py-1">Speed Best ${game.gameStats.speedBest}</span>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        ${badgeList.map((badge) => `
          <article class="rounded-[26px] border p-4 ${badge.unlocked ? "border-white/12 bg-white/8 text-white" : "border-white/8 bg-white/[0.04] text-white/65"}">
            <div class="flex items-start justify-between gap-3">
              <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <img src="${badge.icon}" alt="${badge.label}" loading="lazy" class="h-11 w-11 object-contain" />
              </span>
              <span class="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${badge.unlocked ? "bg-emerald-400/15 text-emerald-100" : "bg-white/8 text-white/45"}">${badge.rarity}</span>
            </div>
            <strong class="mt-4 block text-base font-black">${badge.label}</strong>
            <small class="mt-2 block text-sm leading-6">${badge.unlocked ? `${badge.rarity.toUpperCase()} reward unlocked` : badge.hint}</small>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderGameHub() {
  if (!gameHub) return;
  const entries = getHistory();
  const gameStats = getMiniGameStats();
  const progress = getChallengeProgress();
  const completed = new Set(progress.completed);
  activeChallengeSet = getChallengeDeck(entries, gameStats);

  const challengeCards = activeChallengeSet.map((challenge) => `
    <article class="challenge-card ${challenge.completed ? "done" : ""}">
      <div class="challenge-top">
        <span class="meta-chip">${challenge.xp} XP</span>
        <span class="challenge-state">${challenge.completed ? "Completed" : "Active"}</span>
      </div>
      <h4>${challenge.title}</h4>
      <p>${challenge.description}</p>
      <button
        type="button"
        class="ghost challenge-cta"
        data-challenge-action="${challenge.id}"
      >${challenge.completed || completed.has(challenge.id) ? "Claimed" : challenge.cta}</button>
    </article>
  `).join("");

  const speedPrompt = speedRoundState
    ? `
      <div class="mini-game-panel">
        <div class="mini-game-head">
          <div>
            <h4>Speed Round</h4>
            <p>Your XP will get higher if you finish strong here. Chain correct answers before the timer runs out.</p>
          </div>
          <div class="speed-stats">
            <span>${speedRoundState.timeLeft}s</span>
            <span>${speedRoundState.score} score</span>
            <span>${speedRoundState.streak} streak</span>
          </div>
        </div>
        <div class="card speed-question-card">
          <strong>${speedRoundState.current.question}</strong>
          <div class="speed-options">
            ${speedRoundState.current.options.map((option, index) => `
              <button type="button" class="speed-option" data-speed-answer="${String.fromCharCode(65 + index)}">
                ${String.fromCharCode(65 + index)}. ${option}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `
    : `
      <div class="mini-game-panel">
        <div class="mini-game-head">
          <div>
            <h4>Speed Round</h4>
            <p>Beat 4 correct answers in 45 seconds. XP jumps higher when you keep a streak alive.</p>
          </div>
          <button type="button" id="startSpeedRoundBtn">Play for +40 XP</button>
        </div>
        <p class="mini-game-note">Fast, fun, and perfect for kids who like game pressure more than long revision sessions.</p>
      </div>
    `;

  const memoryPrompt = memoryMatchState
    ? `
      <div class="mini-game-panel">
        <div class="mini-game-head">
          <div>
            <h4>Memory Match</h4>
            <p>Match study prompts with their answers. Clear the board for a fun XP boost.</p>
          </div>
          <div class="speed-stats">
            <span>${memoryMatchState.matches} matches</span>
            <span>${memoryMatchState.moves} moves</span>
          </div>
        </div>
        <div class="memory-grid">
          ${memoryMatchState.cards.map((card) => `
            <button
              type="button"
              class="memory-card ${card.matched ? "matched" : ""} ${card.revealed ? "revealed" : ""}"
              data-memory-card="${card.id}"
              ${card.matched ? "disabled" : ""}
            >
              <span>${card.revealed || card.matched ? card.label : "?"}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `
    : `
      <div class="mini-game-panel">
        <div class="mini-game-head">
          <div>
            <h4>Memory Match</h4>
            <p>Flip and match terms with answers. A quick win here also levels you up faster.</p>
          </div>
          <button type="button" id="startMemoryMatchBtn">Play for +35 XP</button>
        </div>
        <p class="mini-game-note">This one works especially well for younger students and revision breaks.</p>
      </div>
    `;

  const scramblePrompt = wordScrambleState
    ? `
      <div class="mini-game-panel">
        <div class="mini-game-head">
          <div>
            <h4>Word Scramble</h4>
            <p>Unscramble the study word. Solve it and your XP gets a nice little boost.</p>
          </div>
          <div class="speed-stats">
            <span>${wordScrambleState.round} / ${wordScrambleState.totalRounds}</span>
            <span>${wordScrambleState.score} score</span>
          </div>
        </div>
        <div class="card speed-question-card">
          <strong>${wordScrambleState.scrambled}</strong>
          <input id="scrambleInput" class="source-input mini-input" type="text" placeholder="Type the correct word" />
          <div class="mini-actions">
            <button type="button" id="submitScrambleBtn">Submit</button>
          </div>
        </div>
      </div>
    `
    : `
      <div class="mini-game-panel">
        <div class="mini-game-head">
          <div>
            <h4>Word Scramble</h4>
            <p>Quick spelling and memory game built from your study words or flashcards.</p>
          </div>
          <button type="button" id="startScrambleBtn">Play for +25 XP</button>
        </div>
        <p class="mini-game-note">A nice low-pressure game for younger learners.</p>
      </div>
    `;

  const trueFalsePrompt = trueFalseState
    ? `
      <div class="mini-game-panel">
        <div class="mini-game-head">
          <div>
            <h4>True or False Toss</h4>
            <p>Pick fast. Your XP gets higher if you clear the whole round.</p>
          </div>
          <div class="speed-stats">
            <span>${trueFalseState.index + 1} / ${trueFalseState.pool.length}</span>
            <span>${trueFalseState.correct} correct</span>
          </div>
        </div>
        <div class="card speed-question-card">
          <strong>${trueFalseState.current.statement}</strong>
          <div class="speed-options">
            <button type="button" class="speed-option" data-tf-answer="true">True</button>
            <button type="button" class="speed-option" data-tf-answer="false">False</button>
          </div>
        </div>
      </div>
    `
    : `
      <div class="mini-game-panel">
        <div class="mini-game-head">
          <div>
            <h4>True or False Toss</h4>
            <p>Short fact-check game using quiz facts and simple knowledge prompts.</p>
          </div>
          <button type="button" id="startTrueFalseBtn">Play for +30 XP</button>
        </div>
        <p class="mini-game-note">Great for quick energy and confidence boosts.</p>
      </div>
    `;

  const oddOneOutPrompt = oddOneOutState
    ? `
      <div class="mini-game-panel">
        <div class="mini-game-head">
          <div>
            <h4>Odd One Out</h4>
            <p>Spot the item that does not belong. Easy to play, sneaky good for revision.</p>
          </div>
          <div class="speed-stats">
            <span>${oddOneOutState.index + 1} / ${oddOneOutState.pool.length}</span>
            <span>${oddOneOutState.correct} correct</span>
          </div>
        </div>
        <div class="card speed-question-card">
          <strong>${oddOneOutState.current.prompt}</strong>
          <div class="speed-options">
            ${oddOneOutState.current.options.map((option, index) => `
              <button type="button" class="speed-option" data-odd-answer="${index}">
                ${option}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `
    : `
      <div class="mini-game-panel">
        <div class="mini-game-head">
          <div>
            <h4>Odd One Out</h4>
            <p>Find the outsider in each set. Good for school kids and fast brain warmups.</p>
          </div>
          <button type="button" id="startOddOneOutBtn">Play for +30 XP</button>
        </div>
        <p class="mini-game-note">Pattern spotting makes revision feel more like a puzzle app.</p>
      </div>
    `;

  gameHub.innerHTML = `
    <div class="evaluation-wrap">
      <div class="game-hub">
        <div class="card challenge-board">
          <div class="evaluation-head">
            <div>
              <h3>XP Missions</h3>
              <p class="cabinet-note">Tell learners exactly what gets them more XP so the study loop feels playful.</p>
            </div>
            <div class="meta-chip">Bonus XP ${getBonusXp()}</div>
          </div>
          <div class="challenge-grid">${challengeCards}</div>
        </div>
        <div class="card mini-games-shell">
          <div class="evaluation-head">
            <div>
              <h3>Mini Games</h3>
              <p class="cabinet-note">Short playful tasks that make the quiz app feel more like a game room.</p>
            </div>
          </div>
          <div class="mini-games-grid">
            ${speedPrompt}
            ${memoryPrompt}
            ${scramblePrompt}
            ${trueFalsePrompt}
            ${oddOneOutPrompt}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("startSpeedRoundBtn")?.addEventListener("click", startSpeedRound);
  document.getElementById("startMemoryMatchBtn")?.addEventListener("click", startMemoryMatch);
  document.getElementById("startScrambleBtn")?.addEventListener("click", startWordScramble);
  document.getElementById("startTrueFalseBtn")?.addEventListener("click", startTrueFalseToss);
  document.getElementById("startOddOneOutBtn")?.addEventListener("click", startOddOneOut);
  document.getElementById("submitScrambleBtn")?.addEventListener("click", submitScrambleGuess);
  document.querySelectorAll("[data-speed-answer]").forEach((node) => {
    node.addEventListener("click", () => answerSpeedRound(node.dataset.speedAnswer || ""));
  });
  document.querySelectorAll("[data-tf-answer]").forEach((node) => {
    node.addEventListener("click", () => answerTrueFalse(node.dataset.tfAnswer === "true"));
  });
  document.querySelectorAll("[data-odd-answer]").forEach((node) => {
    node.addEventListener("click", () => answerOddOneOut(Number(node.dataset.oddAnswer)));
  });
  document.querySelectorAll("[data-memory-card]").forEach((node) => {
    node.addEventListener("click", () => selectMemoryCard(node.dataset.memoryCard || ""));
  });
  document.querySelectorAll("[data-challenge-action]").forEach((node) => {
    node.addEventListener("click", () => {
      const action = node.dataset.challengeAction || "";
      if (action === "speed-runner") startSpeedRound();
      else if (action === "memory-hero") startMemoryMatch();
      else if (action === "flash-fan") flashcardsBtn?.click();
      else if (action === "quiz-80" || action === "combo-keeper") btn?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function startSpeedRound() {
  const pool = getSpeedRoundPool();
  let pointer = 0;
  const nextQuestion = () => pool[pointer % pool.length];
  speedRoundState = {
    pool,
    pointer,
    score: 0,
    streak: 0,
    correctCount: 0,
    timeLeft: 45,
    current: nextQuestion(),
    timerId: null
  };

  speedRoundState.timerId = setInterval(() => {
    if (!speedRoundState) return;
    speedRoundState.timeLeft -= 1;
    if (speedRoundState.timeLeft <= 0) {
      finishSpeedRound();
      return;
    }
    renderGameHub();
  }, 1000);

  renderGameHub();
}

function answerSpeedRound(letter) {
  if (!speedRoundState) return;
  const isCorrect = letter === speedRoundState.current.correct;
  if (isCorrect) {
    speedRoundState.correctCount += 1;
    speedRoundState.streak += 1;
    speedRoundState.score += 10 + (speedRoundState.streak * 2);
  } else {
    speedRoundState.streak = 0;
  }
  speedRoundState.pointer += 1;
  speedRoundState.current = speedRoundState.pool[speedRoundState.pointer % speedRoundState.pool.length];
  renderGameHub();
}

function finishSpeedRound() {
  if (!speedRoundState) return;
  const previousBadgeIds = captureUnlockedBadgeIds();
  clearInterval(speedRoundState.timerId);
  const result = speedRoundState;
  const stats = getMiniGameStats();
  stats.speedRuns += 1;
  stats.speedBest = Math.max(stats.speedBest, result.correctCount);
  saveMiniGameStats(stats);

  const earnedXp = Math.max(12, Math.min(70, result.correctCount * 8 + result.streak * 2));
  if (result.correctCount > 0) {
    awardBonusXp(earnedXp, `Speed Round cleared with ${result.correctCount} right answers`);
  }
  markSessionActivity("miniGameDone");
  speedRoundState = null;
  syncChallengeRewards();
  renderBadgeCabinet();
  renderEvaluationBoard();
  renderSidebar();
  renderGameHub();
  revealNewBadges(previousBadgeIds);
  showToast(`Speed Round finished: ${result.correctCount} correct, ${result.score} score`, "success");
}

function startMemoryMatch() {
  const pairs = getMemoryPairs();
  const cards = pairs
    .flatMap((pair, index) => ([
      { id: `p-${index}`, pairId: `pair-${index}`, label: pair.prompt, matched: false, revealed: false },
      { id: `a-${index}`, pairId: `pair-${index}`, label: pair.answer, matched: false, revealed: false }
    ]))
    .sort(() => Math.random() - 0.5);

  memoryMatchState = {
    cards,
    firstPick: null,
    lock: false,
    matches: 0,
    moves: 0
  };
  renderGameHub();
}

function selectMemoryCard(cardId) {
  if (!memoryMatchState || memoryMatchState.lock) return;
  const card = memoryMatchState.cards.find((item) => item.id === cardId);
  if (!card || card.matched || card.revealed) return;
  card.revealed = true;

  if (!memoryMatchState.firstPick) {
    memoryMatchState.firstPick = cardId;
    renderGameHub();
    return;
  }

  memoryMatchState.moves += 1;
  const firstCard = memoryMatchState.cards.find((item) => item.id === memoryMatchState.firstPick);
  if (!firstCard) {
    memoryMatchState.firstPick = null;
    renderGameHub();
    return;
  }

  if (firstCard.pairId === card.pairId && firstCard.id !== card.id) {
    firstCard.matched = true;
    card.matched = true;
    memoryMatchState.matches += 1;
    memoryMatchState.firstPick = null;
    if (memoryMatchState.matches === memoryMatchState.cards.length / 2) {
      finishMemoryMatch();
      return;
    }
    renderGameHub();
    return;
  }

  memoryMatchState.lock = true;
  const oldPick = memoryMatchState.firstPick;
  memoryMatchState.firstPick = null;
  renderGameHub();
  setTimeout(() => {
    if (!memoryMatchState) return;
    const a = memoryMatchState.cards.find((item) => item.id === oldPick);
    const b = memoryMatchState.cards.find((item) => item.id === cardId);
    if (a && !a.matched) a.revealed = false;
    if (b && !b.matched) b.revealed = false;
    memoryMatchState.lock = false;
    renderGameHub();
  }, 650);
}

function finishMemoryMatch() {
  if (!memoryMatchState) return;
  const previousBadgeIds = captureUnlockedBadgeIds();
  const result = memoryMatchState;
  const stats = getMiniGameStats();
  stats.memoryWins += 1;
  saveMiniGameStats(stats);

  const cleanPlayBonus = result.moves <= 6 ? 15 : 0;
  awardBonusXp(35 + cleanPlayBonus, `Memory Match won in ${result.moves} moves`);
  markSessionActivity("miniGameDone");
  memoryMatchState = null;
  syncChallengeRewards();
  renderBadgeCabinet();
  renderEvaluationBoard();
  renderSidebar();
  renderGameHub();
  revealNewBadges(previousBadgeIds);
  showToast("Memory Match cleared. Nice one.", "success");
}

function startWordScramble() {
  const pool = getScramblePool();
  const currentWord = pool[0];
  wordScrambleState = {
    pool,
    index: 0,
    round: 1,
    totalRounds: Math.min(4, pool.length),
    score: 0,
    word: currentWord,
    scrambled: scrambleWord(currentWord)
  };
  renderGameHub();
}

function submitScrambleGuess() {
  if (!wordScrambleState) return;
  const value = (document.getElementById("scrambleInput")?.value || "").trim().toLowerCase();
  const answer = String(wordScrambleState.word || "").trim().toLowerCase();
  if (value === answer) {
    wordScrambleState.score += 1;
  }
  wordScrambleState.index += 1;
  if (wordScrambleState.index >= wordScrambleState.totalRounds) {
    finishWordScramble();
    return;
  }
  wordScrambleState.round += 1;
  wordScrambleState.word = wordScrambleState.pool[wordScrambleState.index];
  wordScrambleState.scrambled = scrambleWord(wordScrambleState.word);
  renderGameHub();
}

function finishWordScramble() {
  if (!wordScrambleState) return;
  const previousBadgeIds = captureUnlockedBadgeIds();
  const result = wordScrambleState;
  const stats = getMiniGameStats();
  if (result.score >= 2) stats.scrambleWins += 1;
  saveMiniGameStats(stats);
  if (result.score > 0) awardBonusXp(10 + (result.score * 5), `Word Scramble solved ${result.score} word(s)`);
  markSessionActivity("miniGameDone");
  wordScrambleState = null;
  syncChallengeRewards();
  renderBadgeCabinet();
  renderEvaluationBoard();
  renderSidebar();
  renderGameHub();
  revealNewBadges(previousBadgeIds);
  showToast(`Word Scramble complete: ${result.score}/${result.totalRounds}`, "success");
}

function startTrueFalseToss() {
  const pool = getTrueFalsePool();
  trueFalseState = {
    pool,
    index: 0,
    correct: 0,
    current: pool[0]
  };
  renderGameHub();
}

function answerTrueFalse(choice) {
  if (!trueFalseState) return;
  if (choice === Boolean(trueFalseState.current.answer)) {
    trueFalseState.correct += 1;
  }
  trueFalseState.index += 1;
  if (trueFalseState.index >= trueFalseState.pool.length) {
    finishTrueFalseToss();
    return;
  }
  trueFalseState.current = trueFalseState.pool[trueFalseState.index];
  renderGameHub();
}

function finishTrueFalseToss() {
  if (!trueFalseState) return;
  const previousBadgeIds = captureUnlockedBadgeIds();
  const result = trueFalseState;
  const stats = getMiniGameStats();
  stats.trueFalseBest = Math.max(stats.trueFalseBest, result.correct);
  saveMiniGameStats(stats);
  if (result.correct > 0) awardBonusXp(12 + (result.correct * 4), `True or False Toss got ${result.correct} right`);
  markSessionActivity("miniGameDone");
  trueFalseState = null;
  syncChallengeRewards();
  renderBadgeCabinet();
  renderEvaluationBoard();
  renderSidebar();
  renderGameHub();
  revealNewBadges(previousBadgeIds);
  showToast(`True or False Toss: ${result.correct}/${result.pool.length}`, "success");
}

function startOddOneOut() {
  const pool = getOddOneOutPool();
  oddOneOutState = {
    pool,
    index: 0,
    correct: 0,
    current: pool[0]
  };
  renderGameHub();
}

function answerOddOneOut(choice) {
  if (!oddOneOutState) return;
  if (choice === Number(oddOneOutState.current.answer)) {
    oddOneOutState.correct += 1;
  }
  oddOneOutState.index += 1;
  if (oddOneOutState.index >= oddOneOutState.pool.length) {
    finishOddOneOut();
    return;
  }
  oddOneOutState.current = oddOneOutState.pool[oddOneOutState.index];
  renderGameHub();
}

function finishOddOneOut() {
  if (!oddOneOutState) return;
  const previousBadgeIds = captureUnlockedBadgeIds();
  const result = oddOneOutState;
  const stats = getMiniGameStats();
  if (result.correct >= 2) stats.oddOneOutWins += 1;
  saveMiniGameStats(stats);
  if (result.correct > 0) awardBonusXp(12 + (result.correct * 5), `Odd One Out solved ${result.correct} puzzle(s)`);
  markSessionActivity("miniGameDone");
  oddOneOutState = null;
  syncChallengeRewards();
  renderBadgeCabinet();
  renderEvaluationBoard();
  renderSidebar();
  renderGameHub();
  revealNewBadges(previousBadgeIds);
  showToast(`Odd One Out: ${result.correct}/${result.pool.length}`, "success");
}

function normalizeShortAnswer(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getAttemptXp(entry) {
  if (!entry) return 0;
  const difficultyBonusMap = { easy: 8, moderate: 14, tough: 22, super: 32 };
  const modeBonusMap = { mcq: 8, mixed: 14, short: 18 };
  const base = 20;
  const accuracyBonus = Math.round(Number(entry.percentage || 0));
  const difficultyBonus = difficultyBonusMap[entry.settings?.difficulty] || 10;
  const modeBonus = modeBonusMap[entry.settings?.questionMode] || 8;
  const perfectBonus = Number(entry.percentage || 0) === 100 ? 30 : 0;
  return base + accuracyBonus + difficultyBonus + modeBonus + perfectBonus;
}

function getLevelFromXp(totalXp) {
  return Math.max(1, Math.floor(totalXp / 180) + 1);
}

function getLevelProgress(totalXp) {
  return Math.round(((totalXp % 180) / 180) * 100);
}

function getBadgeImagePath(rarity, filename) {
  return new URL(`./assets/badges/${rarity}/${filename}`, import.meta.url).href;
}

function hasComeback(entries) {
  for (let i = 0; i < entries.length - 1; i++) {
    const current = Number(entries[i]?.percentage || 0);
    const previous = Number(entries[i + 1]?.percentage || 0);
    if (current - previous >= 20) return true;
  }
  return false;
}

function getNightOwlCount(entries) {
  return entries.filter((entry) => {
    const dt = new Date(entry?.createdAt);
    const hour = dt.getHours();
    return !Number.isNaN(dt.getTime()) && (hour >= 21 || hour < 5);
  }).length;
}

function getBadgeCatalog(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const bonusXp = getBonusXp();
  const gameStats = getMiniGameStats();
  const totalXp = list.reduce((sum, entry) => sum + getAttemptXp(entry), 0) + bonusXp;
  const streak = getStreak(list);
  const best = list.length ? Math.max(...list.map((entry) => Number(entry.percentage || 0))) : 0;
  const perfectCount = list.filter((entry) => Number(entry.percentage || 0) === 100).length;
  const superCount = list.filter((entry) => entry?.settings?.difficulty === "super").length;
  const completedChallenges = getChallengeProgress().completed.length;
  const sessionActivity = getSessionActivity();

  return [
    { id: "starter", label: "First Spark", icon: getBadgeImagePath("bronze", "first_spark.png"), rarity: "bronze", unlocked: list.length >= 1, hint: "Finish your first quiz." },
    { id: "streak", label: "Hot Streak", icon: getBadgeImagePath("silver", "hot_streak.png"), rarity: "silver", unlocked: streak >= 3, hint: "Win 3 quizzes in a row." },
    { id: "scholar", label: "Quiz Boss", icon: getBadgeImagePath("gold", "quiz_boss.png"), rarity: "gold", unlocked: best >= 90, hint: "Reach 90% on a quiz." },
    { id: "perfect-shot", label: "Perfect Shot", icon: getBadgeImagePath("gold", "perfect_shot.png"), rarity: "gold", unlocked: perfectCount >= 1, hint: "Score 100% on a quiz." },
    { id: "grinder", label: "Consistency Champ", icon: getBadgeImagePath("silver", "consistency_champ.png"), rarity: "silver", unlocked: list.length >= 5, hint: "Complete 5 quizzes." },
    { id: "legend", label: "Quiz Legend", icon: getBadgeImagePath("gold", "quiz_legend.png"), rarity: "gold", unlocked: totalXp >= 600, hint: "Earn 600 total XP." },
    { id: "flash-fan", label: "Flash Fan", icon: getBadgeImagePath("bronze", "flash_fan.png"), rarity: "bronze", unlocked: getFlashDecks().length >= 1, hint: "Generate one flashcard deck." },
    { id: "memory-master", label: "Memory Master", icon: getBadgeImagePath("gold", "memory_master.png"), rarity: "gold", unlocked: Number(gameStats.memoryWins || 0) >= 1, hint: "Win one Memory Match game." },
    { id: "speedster", label: "Speedster", icon: getBadgeImagePath("silver", "speedster.png"), rarity: "silver", unlocked: Number(gameStats.speedBest || 0) >= 4, hint: "Get 4 right in Speed Round." },
    { id: "xp-hunter", label: "XP Hunter", icon: getBadgeImagePath("silver", "xp_hunter.png"), rarity: "silver", unlocked: bonusXp >= 300, hint: "Earn 300 bonus XP from games and missions." },
    { id: "challenge-crusher", label: "Challenge Crusher", icon: getBadgeImagePath("gold", "challenge_crusher.png"), rarity: "gold", unlocked: completedChallenges >= 3, hint: "Complete 3 XP missions." },
    { id: "comeback-kid", label: "Comeback Kid", icon: getBadgeImagePath("silver", "comeback_kid.png"), rarity: "silver", unlocked: hasComeback(list), hint: "Improve by 20% from one quiz to the next." },
    { id: "night-owl", label: "Night Owl", icon: getBadgeImagePath("bronze", "night_owl.png"), rarity: "bronze", unlocked: getNightOwlCount(list) >= 3, hint: "Complete 3 quizzes late at night." },
    { id: "brain-blaster", label: "Brain Blaster", icon: getBadgeImagePath("gold", "brain_blaster.png"), rarity: "gold", unlocked: superCount >= 1, hint: "Finish a Super difficulty quiz." },
    { id: "study-ninja", label: "Study Ninja", icon: getBadgeImagePath("special", "study_ninja.png"), rarity: "special", unlocked: sessionActivity.quizDone && sessionActivity.flashcardsDone && sessionActivity.miniGameDone, hint: "Do a quiz, flashcards, and a mini-game in one session." }
  ];
}

function getUnlockedBadgeCatalog(entries = getHistory()) {
  return getBadgeCatalog(entries).filter((badge) => badge.unlocked);
}

function captureUnlockedBadgeIds(entries = getHistory()) {
  return new Set(getUnlockedBadgeCatalog(entries).map((badge) => badge.id));
}

function enqueueBadgePopups(badges) {
  if (!Array.isArray(badges) || !badges.length) return;
  badgePopupQueue.push(...badges);
  if (!activeBadgePopup) showNextBadgePopup();
}

function showNextBadgePopup() {
  if (activeBadgePopup || !badgePopupQueue.length) return;
  const badge = badgePopupQueue.shift();
  activeBadgePopup = badge;
  const existing = document.getElementById("badgeUnlockModal");
  existing?.remove();

  const modal = document.createElement("div");
  modal.id = "badgeUnlockModal";
  modal.className = "badge-popup-backdrop";
  modal.innerHTML = `
    <div class="badge-popup-card">
      <span class="badge-popup-label">Badge Unlocked</span>
      <div class="badge-popup-image-wrap">
        <img src="${badge.icon}" alt="${badge.label}" class="badge-popup-image" />
      </div>
      <h3>${badge.label}</h3>
      <p>${badge.hint}</p>
      <button id="badgePopupCloseBtn" type="button">Awesome</button>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => {
    modal.remove();
    activeBadgePopup = null;
    if (badgePopupQueue.length) showNextBadgePopup();
  };
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  document.getElementById("badgePopupCloseBtn")?.addEventListener("click", close);
}

function revealNewBadges(previousBadgeIds = new Set(), entries = getHistory()) {
  const unlocked = getUnlockedBadgeCatalog(entries);
  const currentIds = new Set(unlocked.map((badge) => badge.id));
  const seenIds = new Set(getSeenBadgeIds());
  const newBadges = unlocked.filter((badge) => currentIds.has(badge.id) && !previousBadgeIds.has(badge.id) && !seenIds.has(badge.id));
  if (!newBadges.length) return;
  newBadges.forEach((badge) => seenIds.add(badge.id));
  saveSeenBadgeIds(Array.from(seenIds));
  enqueueBadgePopups(newBadges);
}

function getGamification(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const latest = list[0] || null;
  const bonusXp = getBonusXp();
  const gameStats = getMiniGameStats();
  const quizXp = list.reduce((sum, entry) => sum + getAttemptXp(entry), 0);
  const totalXp = quizXp + bonusXp;
  const streak = getStreak(list);
  const best = list.length ? Math.max(...list.map((entry) => Number(entry.percentage || 0))) : 0;
  const badges = getBadgeCatalog(list).filter((badge) => badge.unlocked);

  return {
    totalXp,
    quizXp,
    bonusXp,
    level: getLevelFromXp(totalXp),
    progress: getLevelProgress(totalXp),
    streak,
    best,
    gameStats,
    badges,
    latestXp: latest ? getAttemptXp(latest) : 0
  };
}

function getNewBadges(currentEntries, previousEntries = []) {
  const currentBadges = new Set(getGamification(currentEntries).badges.map((badge) => badge.id));
  const previousBadges = new Set(getGamification(previousEntries).badges.map((badge) => badge.id));
  return getGamification(currentEntries).badges.filter((badge) => !previousBadges.has(badge.id) && currentBadges.has(badge.id));
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
  sourceHint.textContent = getDefaultHint(activeSource);
  sourceHint.style.color = "";

  return {
    text: data.text,
    extractionId: data.extractionId || null,
    fullReady: Boolean(data.fullReady)
  };
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

  const extracted = await extractSourceText();
  return {
    text: extracted.text,
    extractionId: extracted.extractionId,
    preferFull: false,
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

async function requestQuizQuestions(requestPayload) {
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
  return {
    quizId: data.quizId || null,
    questions: cleaned
  };
}

function appendMoreQuestions(newQuestions) {
  questions = [...questions, ...newQuestions];
  const missingSlots = questions.length - attemptAnswers.length;
  if (missingSlots > 0) {
    attemptAnswers.push(...Array.from({ length: missingSlots }, () => null));
  }
}

async function loadMoreQuestions() {
  if (isLoadingMoreQuestions || !lastQuizRequestBase) return;
  isLoadingMoreQuestions = true;
  const moreBtn = document.getElementById("moreQuestionsBtn");
  if (moreBtn) {
    moreBtn.disabled = true;
    moreBtn.textContent = "Loading...";
  }

  try {
    const morePayload = { ...lastQuizRequestBase, questionCount: QUIZ_BATCH_SIZE };
    const extra = await requestQuizQuestions(morePayload);
    appendMoreQuestions(extra.questions);
    activeQuizId = null;
    showQuestion();
  } catch (err) {
    showToast(err.message || "Could not load more questions");
  } finally {
    isLoadingMoreQuestions = false;
    const refreshedBtn = document.getElementById("moreQuestionsBtn");
    if (refreshedBtn) {
      refreshedBtn.disabled = false;
      refreshedBtn.textContent = "More Questions";
    }
  }
}

btn.onclick = async () => {
  loader.classList.remove("hidden");
  btn.disabled = true;
  if (flashcardsBtn) flashcardsBtn.disabled = true;

  try {
    const settings = getSettings();
    const contentPayload = await buildContentPayload();
    const requestBase = { ...contentPayload, ...settings };
    const requestPayload = { ...requestBase, questionCount: QUIZ_BATCH_SIZE };
    const quizPayload = await requestQuizQuestions(requestPayload);
    const cleaned = quizPayload.questions;

    questions = cleaned;
    activeQuizId = quizPayload.quizId;
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
    lastQuizRequestBase = {
      ...requestBase,
      preferFull: contentPayload.sourceType === "pdf"
    };

    loader.classList.add("hidden");
    quiz.scrollIntoView({ behavior: "smooth" });
    showQuestion();
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
    activeFlashDeck = null;
    activeFlashIndex = 0;
    activeFlashFlipped = false;
    return;
  }
  activeFlashDeck = deck;
  activeFlashIndex = Math.max(0, Math.min(activeFlashIndex, deck.flashcards.length - 1));
  const card = deck.flashcards[activeFlashIndex];
  const imageBlock = card.image && /^https:\/\/upload\.wikimedia\.org\/.+\.(png|jpg)$/i.test(card.image)
    ? `<div class="explain-image-wrap"><img class="explain-image" src="${card.image}" alt="Flashcard visual" loading="lazy" onerror="this.closest('.explain-image-wrap')?.remove()" /></div>`
    : "";

  flashcardsBoard.innerHTML = `
    <div class="evaluation-wrap">
      <div class="card flashcards-shell">
        <div class="flash-shell-head">
          <div>
            <h3>Flashcards</h3>
            <p>${deck.title}</p>
          </div>
          <button id="flashFlipBtn" class="ghost flash-flip-btn" type="button">
            ${activeFlashFlipped ? "Show Question" : "Flip Card"}
          </button>
        </div>
        <div class="flash-viewer">
          <div class="flash-head">
            <span>Card ${activeFlashIndex + 1} / ${deck.flashcards.length}</span>
            <div class="flash-nav">
              <button id="flashPrevBtn" class="ghost" type="button" ${activeFlashIndex === 0 ? "disabled" : ""}>Prev</button>
              <button id="flashNextBtn" class="ghost" type="button" ${activeFlashIndex === deck.flashcards.length - 1 ? "disabled" : ""}>Next</button>
            </div>
          </div>
          <p class="flash-gesture-hint">Tap to flip. Swipe left or right to move between cards.</p>
          <button
            id="flashCardToggle"
            class="flash-scene ${activeFlashFlipped ? "is-flipped" : ""}"
            type="button"
            aria-label="Flip flashcard"
            aria-pressed="${activeFlashFlipped ? "true" : "false"}"
          >
            <div class="flash-card-3d">
              <div class="flash-face flash-face-front">
                <span class="flash-face-badge">Question</span>
                <div class="flash-face-copy">
                  <strong>${card.front}</strong>
                  <span class="flash-face-meta">Tap or click to reveal the answer</span>
                </div>
              </div>
              <div class="flash-face flash-face-back">
                <span class="flash-face-badge">Answer</span>
                <div class="flash-face-copy">
                  <strong>${card.back}</strong>
                  <span class="flash-answer-hint"><span>Hint</span>${card.hint || "-"}</span>
                </div>
                ${imageBlock}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  `;

  const goToPreviousFlashcard = () => {
    if (!activeFlashDeck || activeFlashIndex <= 0) return;
    activeFlashIndex -= 1;
    activeFlashFlipped = false;
    renderFlashcardsBoard(activeFlashDeck);
  };

  const goToNextFlashcard = () => {
    if (!activeFlashDeck || activeFlashIndex >= activeFlashDeck.flashcards.length - 1) return;
    activeFlashIndex += 1;
    activeFlashFlipped = false;
    renderFlashcardsBoard(activeFlashDeck);
  };

  const flashCardToggle = document.getElementById("flashCardToggle");
  flashCardToggle?.addEventListener("click", () => {
    if (suppressFlashToggleClick) {
      suppressFlashToggleClick = false;
      return;
    }
    activeFlashFlipped = !activeFlashFlipped;
    renderFlashcardsBoard(activeFlashDeck);
  });

  let touchStartX = 0;
  let touchStartY = 0;
  flashCardToggle?.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  flashCardToggle?.addEventListener("touchend", (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    suppressFlashToggleClick = true;
    if (deltaX < 0) goToNextFlashcard();
    else goToPreviousFlashcard();
  }, { passive: true });

  document.getElementById("flashFlipBtn")?.addEventListener("click", () => {
    activeFlashFlipped = !activeFlashFlipped;
    renderFlashcardsBoard(activeFlashDeck);
  });

  document.getElementById("flashPrevBtn")?.addEventListener("click", goToPreviousFlashcard);
  document.getElementById("flashNextBtn")?.addEventListener("click", goToNextFlashcard);
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
    <div class="space-y-4">
      <label class="block text-sm font-bold text-white" for="shortAnswerInput">Your answer</label>
      <textarea id="shortAnswerInput" class="min-h-[150px] w-full rounded-[28px] border border-white/12 bg-slate-950/35 px-5 py-4 text-base text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60" placeholder="Type your answer here..."></textarea>
      <button id="submitShortBtn" class="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:scale-[1.02]" type="button">Lock Answer</button>
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
    <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-4 backdrop-blur-md sm:px-6 sm:py-6">
      <div class="mx-auto flex min-h-full max-w-5xl items-center justify-center">
        <div class="quiz-card fade-in-up w-full rounded-[36px] border border-white/12 bg-[linear-gradient(180deg,rgba(16,23,42,0.95),rgba(11,18,32,0.98))] p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.32em] text-violet-200">Quiz mode</p>
              <h2 class="mt-2 text-2xl font-black sm:text-3xl">Question ${index + 1} of ${questions.length}</h2>
            </div>
            <div class="flex flex-wrap gap-2">
              <span class="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">${q.type.toUpperCase()}</span>
              <span id="quizTimerChip" class="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">${isShort ? "No timer" : `${timeLeft}s left`}</span>
            </div>
          </div>

          <div class="mt-5">
            <div class="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
              <span>Progress</span>
              <span>${progress}%</span>
            </div>
            <div class="h-3 overflow-hidden rounded-full bg-white/10">
              <div class="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 transition-all duration-300" style="width:${progress}%"></div>
            </div>
          </div>

          <div class="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div class="rounded-[30px] bg-gradient-to-br from-violet-500/16 to-cyan-400/10 p-6">
              <p class="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100/80">Focus prompt</p>
              <h3 class="mt-4 text-2xl font-black leading-tight sm:text-3xl">${q.question}</h3>
              <p class="mt-4 text-sm leading-6 text-white/60">Choose your answer and move to the next challenge. Smooth and fast, one step at a time.</p>
            </div>

            <div class="space-y-4">
              ${q.type === "mcq"
                ? q.options.map((o, i) => `
                  <button class="option quiz-option flex w-full items-center gap-4 rounded-[28px] border border-white/12 bg-white/6 px-5 py-5 text-left" data-o="${String.fromCharCode(65 + i)}" type="button">
                    <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-cyan-100">${String.fromCharCode(65 + i)}</span>
                    <span class="text-base font-semibold text-white">${o}</span>
                  </button>`).join("")
                : renderShortAnswerInput()}
            </div>
          </div>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-wrap gap-3">
              <button id="prevBtn" class="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12" ${index === 0 ? "disabled" : ""}>Previous</button>
              <button id="moreQuestionsBtn" class="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12" ${isLoadingMoreQuestions ? "disabled" : ""}>${isLoadingMoreQuestions ? "Loading..." : "More Questions"}</button>
            </div>
            <div class="flex flex-wrap gap-3">
              <button id="finishBtn" class="rounded-full border border-rose-300/20 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/15">Finish</button>
              <button id="nextBtn" class="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:scale-[1.02]">Next</button>
            </div>
          </div>
        </div>
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
  document.getElementById("moreQuestionsBtn")?.addEventListener("click", loadMoreQuestions);
  document.getElementById("finishBtn")?.addEventListener("click", finish);
  document.getElementById("nextBtn")?.addEventListener("click", next);

  if (answered[index]) {
    clearInterval(timer);
    const timerChip = document.getElementById("quizTimerChip");
    if (timerChip) timerChip.innerText = "Done";
    reveal(q, choices[index], true);
    return;
  }

  if (isShort) return;

  timer = setInterval(() => {
    timeLeft--;
    const clock = document.getElementById("quizTimerChip");
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
      ? `<p class="text-sm leading-6 text-rose-100"><strong>Why your answer was wrong:</strong> ${q.wrongExplanation || "Your selected answer does not match the validated correct answer and supporting concept."}</p>`
      : "";
    const imageBlock = q.image && /^https:\/\/upload\.wikimedia\.org\/.+\.(png|jpg)$/i.test(q.image)
      ? `<div class="explain-image-wrap"><img class="explain-image" src="${q.image}" alt="Explanation visual" loading="lazy" onerror="this.closest('.explain-image-wrap')?.remove()" /></div>`
      : "";

    quiz.querySelector(".quiz-card").insertAdjacentHTML(
      "beforeend",
      `<div class="explanation mt-6 rounded-[28px] border border-white/12 bg-black/20 p-5 text-white">
        <div class="explanation-head flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span class="inline-flex w-fit rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] ${isCorrect ? "bg-emerald-400/15 text-emerald-100" : "bg-rose-400/15 text-rose-100"}">${isCorrect ? "Correct" : "Wrong"}</span>
          <strong class="text-sm text-white/85">${answerText}</strong>
        </div>
        <p class="mt-4 text-sm leading-6 text-white/70">${q.explanation || ""}</p>
        ${wrongBlock}
        ${imageBlock}
        <button id="saveQuestionBtn" class="mt-4 rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12" type="button">Save Question</button>
      </div>`
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

  const entry = {
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
  entry.gamification = {
    xp: getAttemptXp(entry)
  };
  return entry;
}

function buildSubmissionAnswers() {
  return questions.map((q, i) => {
    const answer = attemptAnswers[i];
    return {
      question: q.question,
      selected: answer?.selected ?? ""
    };
  });
}

async function submitQuizAttempt() {
  if (!isLoggedIn() || !activeQuizId) return null;

  const response = await cloudRequest("/submit-quiz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quizId: activeQuizId,
      answers: buildSubmissionAnswers(),
      sourceType: currentAttemptMeta?.sourceType || "text",
      sourceInput: currentAttemptMeta?.sourceInput || "",
      settings: currentAttemptMeta?.settings || getSettings()
    })
  });

  if (!response.ok) {
    throw new Error(response.error || "Failed to submit quiz");
  }

  return response.data;
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

async function finish() {
  confetti();
  clearInterval(timer);
  const previousBadgeIds = captureUnlockedBadgeIds();
  const previousEntries = getHistory();
  let entry = buildHistoryEntry();

  if (isLoggedIn() && activeQuizId) {
    try {
      const serverResult = await submitQuizAttempt();
      if (serverResult?.evaluation) {
        score = Number(serverResult.evaluation.score || 0);
        entry = {
          ...entry,
          ...serverResult.attempt,
          score: Number(serverResult.evaluation.score || 0),
          total: Number(serverResult.evaluation.total || entry.total || 0),
          percentage: Number(serverResult.evaluation.percentage || 0),
          confidence: Number(serverResult.evaluation.confidence || 0),
          answers: Array.isArray(serverResult.evaluation.answers) ? serverResult.evaluation.answers : entry.answers,
          gamification: {
            xp: Number(serverResult.gamification?.xpEarned || 0),
            points: Number(serverResult.gamification?.pointsEarned || 0),
            totalXp: Number(serverResult.gamification?.totalXp || 0),
            totalPoints: Number(serverResult.gamification?.totalPoints || 0),
            streak: Number(serverResult.gamification?.currentStreak || 0),
            achievements: Array.isArray(serverResult.gamification?.achievements) ? serverResult.gamification.achievements : []
          }
        };
        cloudProfile = {
          ...(cloudProfile || {}),
          totalXp: entry.gamification.totalXp,
          totalPoints: entry.gamification.totalPoints,
          currentStreak: entry.gamification.streak,
          achievements: entry.gamification.achievements
        };
        await loadCloudDataIntoLocal();
      }
    } catch (error) {
      showToast(error.message || "Falling back to local evaluation");
    }
  }

  markSessionActivity("quizDone");
  addHistoryEntry(entry);
  autoSaveQuestionsFromEntry(entry);
  syncChallengeRewards([entry, ...previousEntries]);
  renderEvaluationBoard();
  renderBadgeCabinet();
  renderGameHub();
  renderSidebar();

  const assessment = getAssessmentLabel(entry.percentage);
  const allEntries = [entry, ...previousEntries];
  const game = getGamification(allEntries);
  const newBadges = getUnlockedBadgeCatalog(allEntries).filter((badge) => !previousBadgeIds.has(badge.id));
  revealNewBadges(previousBadgeIds, allEntries);

  quiz.innerHTML = `
    <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-4 backdrop-blur-md sm:px-6 sm:py-6">
      <div class="mx-auto flex min-h-full max-w-4xl items-center justify-center">
        <div class="fade-in-up w-full rounded-[36px] border border-white/12 bg-[linear-gradient(180deg,rgba(16,23,42,0.95),rgba(11,18,32,0.98))] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8">
          <div class="text-center">
            <span class="inline-flex rounded-full bg-emerald-400/15 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-100">Quiz completed</span>
            <h2 class="mt-4 text-3xl font-black sm:text-5xl">You scored ${score}/${questions.length} 🎯</h2>
            <p class="mt-3 text-base leading-7 text-white/65">${assessment}. Your run has been added to your progress history.</p>
          </div>

          <div class="mt-8 grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div class="rounded-[30px] bg-gradient-to-br from-violet-500/18 to-cyan-400/10 p-6 text-center">
              <p class="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">Final score</p>
              <strong class="mt-3 block text-6xl font-black">${entry.percentage}%</strong>
              <p class="mt-3 text-sm text-white/65">${Math.max(0, questions.length - score)} miss(es) • ${entry.gamification?.xp || getAttemptXp(entry)} XP earned</p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl border border-white/10 bg-white/6 p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-white/45">Correct</p>
                <strong class="mt-2 block text-2xl font-black">${score}</strong>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/6 p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-white/45">Wrong</p>
                <strong class="mt-2 block text-2xl font-black">${Math.max(0, questions.length - score)}</strong>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/6 p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-white/45">Streak</p>
                <strong class="mt-2 block text-2xl font-black">${entry.gamification?.streak || game.streak || 0}</strong>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/6 p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-white/45">Level</p>
                <strong class="mt-2 block text-2xl font-black">${game.level}</strong>
              </div>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap gap-2">
            <span class="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold">Mode ${(entry.settings?.difficulty || "moderate").toUpperCase()}</span>
            <span class="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold">Type ${(entry.settings?.questionMode || "mcq").toUpperCase()}</span>
            <span class="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold">Language ${entry.settings?.outputLanguage || "English"}</span>
            ${entry.confidence ? `<span class="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-semibold">Confidence ${entry.confidence}%</span>` : ""}
          </div>

          <div class="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
            <span class="block h-full rounded-full bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300" style="width:${game.progress}%"></span>
          </div>

          <p class="mt-5 text-sm leading-6 text-white/70">${newBadges.length ? `New badges unlocked: ${newBadges.map((badge) => badge.label).join(", ")}` : `Badges unlocked: ${game.badges.map((badge) => badge.label).join(", ") || "None yet"}`}</p>

          <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button id="retryQuizBtn" class="rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:scale-[1.02]" type="button">Retry</button>
            <button id="goDashboardBtn" class="rounded-full border border-white/12 bg-white/8 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/12" type="button">New Quiz</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("retryQuizBtn")?.addEventListener("click", () => {
    document.getElementById("generateSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    btn?.click();
  });

  document.getElementById("goDashboardBtn")?.addEventListener("click", () => {
    document.getElementById("generateSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
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
syncChallengeRewards();
renderEvaluationBoard();
renderBadgeCabinet();
renderGameHub();
renderSidebar();
renderFlashcardsBoard(getFlashDecks()[0] || null);
bootstrapAuth();

quickGenerateBtn?.addEventListener("click", () => {
  document.getElementById("generateSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  input?.focus();
});

resumeQuizBtn?.addEventListener("click", () => {
  document.getElementById("quizSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
