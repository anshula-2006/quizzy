import { extractContent, requestQuiz, requestFlashcards, setQuizState, setResultState, addFlashDeck } from "./shared.js";

const sourceCards = document.querySelectorAll("[data-source]");
const topicInput = document.getElementById("topicInput");
const urlInput = document.getElementById("urlInput");
const pdfInput = document.getElementById("pdfInput");
const difficultySelect = document.getElementById("difficultySelect");
const modeSelect = document.getElementById("modeSelect");
const languageSelect = document.getElementById("languageSelect");
const countSelect = document.getElementById("countSelect");
const sourceHint = document.getElementById("sourceHint");
const form = document.getElementById("generateForm");
const flashcardsBtn = document.getElementById("flashcardsBtn");
const errorNode = document.getElementById("generateError");

let activeSource = "text";

function setSource(source) {
  activeSource = source;
  sourceCards.forEach((card) => card.classList.toggle("is-active", card.dataset.source === source));
  topicInput.hidden = source !== "text";
  urlInput.hidden = source !== "url";
  pdfInput.closest(".file-wrap").hidden = source !== "pdf";

  if (source === "text") sourceHint.textContent = "Type a topic or paste your notes.";
  if (source === "url") sourceHint.textContent = "Paste a public URL and Quizzy will extract the content.";
  if (source === "pdf") sourceHint.textContent = "Upload a PDF file and Quizzy will extract the text.";
}

if (difficultySelect && !Array.from(difficultySelect.options).some(o => o.value === 'current_events')) {
  const opt = document.createElement('option');
  opt.value = 'current_events';
  opt.textContent = 'Current Events';
  difficultySelect.appendChild(opt);
}

if (!document.getElementById("learnerSelect") && difficultySelect) {
  const wrapper = document.createElement("div");
  wrapper.className = difficultySelect.parentElement.className;
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "8px";
  wrapper.innerHTML = `
    <label for="learnerSelect" style="font-size: 0.85rem; font-weight: 600; color: var(--text);">Learner Mode</label>
    <select id="learnerSelect" class="text-input" style="width: 100%; height: 44px; padding: 0 12px; border-radius: var(--radius-md); border: 1px solid var(--line); background: var(--panel-soft); color: var(--text); font-size: 0.9rem; outline: none; cursor: pointer;">
      <option value="student">Student (Exam Prep)</option>
      <option value="teacher">Teacher (Diagnostic)</option>
      <option value="self-study">Self-Study (Retention)</option>
    </select>
  `;
  difficultySelect.parentElement.after(wrapper);
}
const learnerSelect = document.getElementById("learnerSelect");

if (!document.getElementById("customControlsWrapper") && learnerSelect) {
  const customControlsWrapper = document.createElement("div");
  customControlsWrapper.id = "customControlsWrapper";
  customControlsWrapper.style.display = "flex";
  customControlsWrapper.style.flexDirection = "column";
  customControlsWrapper.style.gap = "16px";
  customControlsWrapper.style.marginTop = "16px";
  customControlsWrapper.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label for="customCountSlider" style="font-size: 0.85rem; font-weight: 600; color: var(--text);">Question Count</label>
        <span id="customCountDisplay" class="meta-chip" style="background: rgba(124, 58, 237, 0.1); color: var(--primary); font-weight: 700; border: none;">10 Questions</span>
      </div>
      <input type="range" id="customCountSlider" min="1" max="30" value="10" style="width: 100%; height: 6px; border-radius: 4px; outline: none; cursor: pointer; accent-color: var(--primary);">
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px; padding: 16px; background: var(--panel-soft); border: 1px solid var(--line); border-radius: var(--radius-md); box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label for="timerToggle" style="font-size: 0.9rem; font-weight: 600; color: var(--text);">Enable Timer (MCQ)</label>
        <input type="checkbox" id="timerToggle" checked style="accent-color: var(--primary); width: 18px; height: 18px; outline: none; cursor: pointer;">
      </div>
      <div id="customTimerWrapper" style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; transition: opacity 0.2s;">
        <label for="customTimerInput" style="font-size: 0.85rem; color: var(--muted);">Seconds per question</label>
        <input type="number" id="customTimerInput" min="5" max="300" value="30" class="text-input" style="width: 80px; height: 36px; padding: 0 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg); color: var(--text); font-size: 0.9rem; outline: none; text-align: center;">
      </div>
    </div>
  `;
  learnerSelect.parentElement.after(customControlsWrapper);
  
  if (countSelect) {
    const wrap = countSelect.closest('.input-wrap');
    if (wrap) wrap.style.display = 'none';
    else countSelect.style.display = 'none';
  }
  document.getElementById("customCountSlider").addEventListener("input", (e) => document.getElementById("customCountDisplay").textContent = e.target.value + " Questions");
  document.getElementById("timerToggle").addEventListener("change", (e) => { document.getElementById("customTimerWrapper").style.opacity = e.target.checked ? "1" : "0.4"; document.getElementById("customTimerInput").disabled = !e.target.checked; });
}

sourceCards.forEach((card) => {
  card.addEventListener("click", () => setSource(card.dataset.source));
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorNode.hidden = true;

  const isTimerOn = document.getElementById("timerToggle")?.checked ?? true;
  const timerValue = document.getElementById("customTimerInput")?.value || "30";

  try {
    const settings = {
      difficulty: difficultySelect.value,
      questionMode: modeSelect.value,
      outputLanguage: languageSelect.value,
      learnerMode: learnerSelect ? learnerSelect.value : "student",
      customTimer: isTimerOn ? timerValue : "off",
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
      questionCount: Number(document.getElementById("customCountSlider")?.value || countSelect?.value || 10),
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
  }
});

flashcardsBtn?.addEventListener("click", async (event) => {
  event.preventDefault();
  errorNode.hidden = true;
  const originalHTML = flashcardsBtn.innerHTML;
  flashcardsBtn.innerHTML = `<svg class="animate-spin inline-block h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generating...`;
  flashcardsBtn.disabled = true;

  const isTimerOn = document.getElementById("timerToggle")?.checked ?? true;
  const timerValue = document.getElementById("customTimerInput")?.value || "30";

  try {
    const settings = {
      difficulty: difficultySelect.value,
      questionMode: modeSelect.value,
      outputLanguage: languageSelect.value,
      learnerMode: learnerSelect ? learnerSelect.value : "student",
      customTimer: isTimerOn ? timerValue : "off",
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
});