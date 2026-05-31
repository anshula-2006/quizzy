import { extractContent, requestQuiz, requestFlashcards, setQuizState, setResultState, addFlashDeck } from "./shared.js";
import { createIcons, FileText, FileUp, Link, Plus, Play } from 'lucide';

const sourceCards = document.querySelectorAll("[data-source]");
const topicInput = document.getElementById("topicInput") || document.getElementById("inputText");
const urlInput = document.getElementById("urlInput");
const pdfInput = document.getElementById("pdfInput");
const difficultySelect = document.getElementById("difficultySelect");
const modeSelect = document.getElementById("modeSelect");
const languageSelect = document.getElementById("languageSelect");
const countSelect = document.getElementById("countSelect");
const learnerModeSelect = document.getElementById("learnerMode");
const modeDescNode = document.getElementById("modeDesc");
const sourceHint = document.getElementById("sourceHint");
const form = document.getElementById("generateForm");
const flashcardsBtn = document.getElementById("flashcardsBtn");
const generateBtn = document.getElementById("generateBtn");
const errorNode = document.getElementById("generateError");

let activeSource = "text";

const modeDescriptions = {
  focus: "Deep, distraction-free learning. Best for mastering new topics at your own pace.",
  arcade: "Fast-paced, gamified. Earn XP, build streaks, and compete.",
  exam: "Strict timer and realistic exam conditions. Tests your readiness under pressure.",
  revision: "Focus on weak topics with detailed explanations and common pitfalls."
};

requestAnimationFrame(() => {
  createIcons({
    icons: { FileText, FileUp, Link, Plus, Play }
  });
});

function setSource(source) {
  activeSource = source;
  sourceCards.forEach((card) => card.classList.toggle("is-active", card.dataset.source === source));
  if (topicInput) {
    topicInput.hidden = source !== "text";
    topicInput.style.display = source === "text" ? "" : "none";
  }
  if (urlInput) {
    urlInput.hidden = source !== "url";
    urlInput.style.display = source === "url" ? "" : "none";
  }
  if (pdfInput) {
    const wrap = pdfInput.closest(".file-wrap") || pdfInput;
    wrap.hidden = source !== "pdf";
    wrap.style.display = source === "pdf" ? "" : "none";
  }

  if (sourceHint) {
    if (source === "text") sourceHint.textContent = "Type a topic or paste your notes.";
    if (source === "url") sourceHint.textContent = "Paste a public URL and Quizzy will extract the content.";
    if (source === "pdf") sourceHint.textContent = "Upload a PDF file and Quizzy will extract the text.";
  }
}

if (learnerModeSelect) {
  learnerModeSelect.addEventListener("change", (e) => {
    if (modeDescNode) {
      modeDescNode.textContent = modeDescriptions[e.target.value] || "";
    }
  });
  modeDescNode.textContent = modeDescriptions[learnerModeSelect.value];
}

if (difficultySelect && !Array.from(difficultySelect.options).some(o => o.value === 'current_events')) {
  const opt = document.createElement('option');
  opt.value = 'current_events';
  opt.textContent = 'Current Events';
  difficultySelect.appendChild(opt);
}

const params = new URLSearchParams(window.location.search);
const prefillTopic = params.get("topic");
const prefillMode = params.get("mode");
const prefillCount = params.get("count");

if (prefillTopic && topicInput) {
  topicInput.value = prefillTopic;
  setSource("text");
}

if (prefillMode && learnerModeSelect) {
  learnerModeSelect.value = prefillMode;
  learnerModeSelect.dispatchEvent(new Event("change"));
}

if (prefillCount && countSelect) {
  let opt = Array.from(countSelect.options).find(o => o.value === prefillCount);
  if (!opt) {
    opt = document.createElement("option");
    opt.value = prefillCount;
    opt.textContent = `${prefillCount} Questions`;
    countSelect.appendChild(opt);
  }
  countSelect.value = prefillCount;
}

sourceCards.forEach((card) => {
  card.addEventListener("click", () => setSource(card.dataset.source));
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorNode.hidden = true;
  const originalText = generateBtn?.textContent || "Generate Quiz";
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.innerHTML = `<i data-lucide="play" style="width: 16px; height: 16px; margin-right: 4px;"></i> Preparing...`;
  }
  if (flashcardsBtn) flashcardsBtn.disabled = true;

  try {
    const settings = {
      difficulty: difficultySelect.value,
      questionMode: modeSelect.value,
      outputLanguage: languageSelect.value,
      learnerMode: learnerModeSelect ? learnerModeSelect.value : "focus",
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userLocalTime: new Date().toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
    };

    const contentPayload = await extractContent(activeSource, {
      topic: topicInput.value,
      url: urlInput.value,
      pdfFile: pdfInput.files?.[0] || null
    });

    const quizPayload = await requestQuiz({
      ...contentPayload,
      ...settings,
      questionCount: Number(countSelect?.value || 10),
      variation: Date.now()
    });

    setQuizState({
      quizId: quizPayload.quizId,
      questions: quizPayload.questions,
      currentIndex: 0,
      answers: [],
      generatedAt: new Date().toISOString(),
      settings,
      meta: quizPayload.meta || {
        sourceType: contentPayload.sourceType,
        sourceInput: contentPayload.sourceInput
      }
    });
    setResultState(null);
    window.location.href = "./quiz.html";
  } catch (error) {
    errorNode.hidden = false;
    errorNode.textContent = error.message || "An error occurred during generation.";
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.innerHTML = originalText;
    }
    if (flashcardsBtn) flashcardsBtn.disabled = false;
  }
  createIcons({ icons: { FileText, FileUp, Link, Plus, Play } });
});

flashcardsBtn?.addEventListener("click", async (event) => {
  event.preventDefault();
  errorNode.hidden = true;
  const originalHTML = flashcardsBtn.innerHTML;
  flashcardsBtn.innerHTML = `<i data-lucide="plus" style="width: 16px; height: 16px; margin-right: 4px;"></i> Generating...`;
  flashcardsBtn.disabled = true;

  try {
    const settings = {
      difficulty: difficultySelect.value,
      questionMode: modeSelect.value,
      outputLanguage: languageSelect.value,
      learnerMode: learnerModeSelect ? learnerModeSelect.value : "focus",
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userLocalTime: new Date().toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
    };

    const contentPayload = await extractContent(activeSource, {
      topic: topicInput.value,
      url: urlInput.value,
      pdfFile: pdfInput.files?.[0] || null
    });

    const data = await requestFlashcards({ ...contentPayload, ...settings });
    const cards = Array.isArray(data.flashcards) ? data.flashcards : (Array.isArray(data) ? data : []);

    if (!cards.length) throw new Error("No flashcards were generated.");

    const deck = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      title: (contentPayload.topic || contentPayload.sourceInput || "Study Deck").slice(0, 60),
      sourceType: data.meta?.sourceType || contentPayload.sourceType,
      sourceInput: data.meta?.sourceInput || contentPayload.sourceInput,
      flashcards: cards.map(c => ({ front: c.front || "", back: c.back || "", hint: c.hint || "" }))
    };

    await addFlashDeck(deck);
    localStorage.setItem('quizzy-active-deck', JSON.stringify(deck));
    window.location.href = "./flashcards.html";

  } catch (error) {
    errorNode.hidden = false;
    errorNode.textContent = error.message || "Failed to generate flashcards.";
    flashcardsBtn.innerHTML = originalHTML;
    flashcardsBtn.disabled = false;
  }
  createIcons({ icons: { FileText, FileUp, Link, Plus, Play } });
});
