import { extractContent, requestQuiz, requestFlashcards, setQuizState, setResultState, addFlashDeck } from "./shared.js";

const sourceCards = document.querySelectorAll("[data-source]");
const topicInput = document.getElementById("topicInput") || document.getElementById("inputText");
const urlInput = document.getElementById("urlInput");
const pdfInput = document.getElementById("pdfInput");
const difficultySelect = document.getElementById("difficultySelect");
const modeSelect = document.getElementById("modeSelect");
const languageSelect = document.getElementById("languageSelect");
const countSelect = document.getElementById("countSelect");
const sourceHint = document.getElementById("sourceHint");
const form = document.getElementById("generateForm");
const flashcardsBtn = document.getElementById("flashcardsBtn");
const generateBtn = document.getElementById("generateBtn");
const errorNode = document.getElementById("generateError");

let activeSource = "text";

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
      wrapper.style.gap = "var(--space-2)";
  wrapper.innerHTML = `
        <label for="learnerSelect" style="font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary);">Learning Mode</label>
        <select id="learnerSelect" class="select-input">
      <option value="focus" selected>Focus Mode</option>
      <option value="arcade">Arcade Mode</option>
      <option value="exam">Exam Mode</option>
      <option value="revision">Revision Mode</option>
    </select>
        <p id="learnerDescription" style="margin-top: 2px; font-size: var(--font-size-xs); color: var(--color-text-secondary); line-height: 1.4;">
      Deep, distraction-free learning. Best for mastering new topics at your own pace without timer pressure.
    </p>
  `;
  difficultySelect.parentElement.after(wrapper);
}
const learnerSelect = document.getElementById("learnerSelect");

if (!document.getElementById("customControlsWrapper") && learnerSelect) {
  const customControlsWrapper = document.createElement("div");
  customControlsWrapper.id = "customControlsWrapper";
  customControlsWrapper.style.display = "flex";
  customControlsWrapper.style.flexDirection = "column";
      customControlsWrapper.style.gap = "var(--space-4)";
      customControlsWrapper.style.marginTop = "var(--space-2)";
      customControlsWrapper.style.gridColumn = "1 / -1";
  customControlsWrapper.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
            <label for="customCountSlider" style="font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary);">Question Count</label>
            <span id="customCountDisplay" class="badge">10 Questions</span>
      </div>
          <input type="range" id="customCountSlider" min="1" max="30" value="10" style="width: 100%; height: 6px; border-radius: 4px; outline: none; cursor: pointer; accent-color: var(--color-accent);">
    </div>
        <div style="display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4); background: var(--color-surface-2); border: 1px solid var(--color-border-default); border-radius: var(--radius-md);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
            <label for="timerToggle" style="font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-text-primary);">Enable Timer <span style="font-weight: 400; font-size: var(--font-size-xs); color: var(--color-text-secondary);">(Disable for Practice Mode)</span></label>
            <input type="checkbox" id="timerToggle" checked style="accent-color: var(--color-accent); width: 16px; height: 16px; outline: none; cursor: pointer;">
      </div>
          <div id="customTimerWrapper" style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-1); transition: opacity 0.2s;">
            <label for="customTimerInput" style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Seconds per question</label>
            <input type="number" id="customTimerInput" min="5" max="300" value="30" class="text-input" style="width: 80px; min-height: 36px; text-align: center;">
      </div>
    </div>
  `;
  learnerSelect.parentElement.after(customControlsWrapper);
  
  if (countSelect) {
    const wrap = countSelect.closest('.input-wrap');
    if (wrap) wrap.style.display = 'none';
    else countSelect.style.display = 'none';
  }
  const slider = document.getElementById("customCountSlider");
  if (slider) {
    slider.addEventListener("input", (e) => {
      const display = document.getElementById("customCountDisplay");
      if (display) display.textContent = e.target.value + " Questions";
    });
  }
  const timerToggle = document.getElementById("timerToggle");
  if (timerToggle) {
    timerToggle.addEventListener("change", (e) => { 
      const wrap = document.getElementById("customTimerWrapper");
      if (wrap) wrap.style.opacity = e.target.checked ? "1" : "0.4"; 
      const input = document.getElementById("customTimerInput");
      if (input) input.disabled = !e.target.checked; 
    });
  }
  
  const modeDescriptions = {
    focus: "Deep, distraction-free learning. Best for mastering new topics at your own pace without timer pressure.",
    arcade: "Fast-paced, gamified learning. Earn XP, build streaks, and play timed challenges. Best for fun, quick reviews.",
    exam: "Strict timer and realistic exam experience. Tests your readiness under pressure. Best for final prep.",
    revision: "Focuses heavily on weak topics and common pitfalls. Detailed explanations. Best for repeating bookmarked or weak areas."
  };

  learnerSelect.addEventListener("change", (e) => {
    const desc = document.getElementById("learnerDescription");
    if (desc) desc.textContent = modeDescriptions[e.target.value] || "";
    
    const timerToggle = document.getElementById("timerToggle");
    const timerInput = document.getElementById("customTimerInput");
    const timerWrap = document.getElementById("customTimerWrapper");
    
    if (e.target.value === "focus" || e.target.value === "revision") {
      timerToggle.checked = false;
      timerInput.disabled = true;
      if(timerWrap) timerWrap.style.opacity = "0.4";
    } else if (e.target.value === "arcade") {
      timerToggle.checked = true;
      timerInput.disabled = false;
      timerInput.value = "15";
      if(timerWrap) timerWrap.style.opacity = "1";
    } else if (e.target.value === "exam") {
      timerToggle.checked = true;
      timerInput.disabled = false;
      timerInput.value = "45";
      if(timerWrap) timerWrap.style.opacity = "1";
    }
  });
}

const params = new URLSearchParams(window.location.search);
const prefillTopic = params.get("topic");
const prefillMode = params.get("mode");

if (prefillTopic && topicInput) {
  topicInput.value = prefillTopic;
  setSource("text");
}

if (prefillMode && learnerSelect) {
  learnerSelect.value = prefillMode;
  learnerSelect.dispatchEvent(new Event("change"));
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
    generateBtn.textContent = "Preparing quiz...";
  }
  if (flashcardsBtn) flashcardsBtn.disabled = true;

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
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = originalText;
    }
    if (flashcardsBtn) flashcardsBtn.disabled = false;
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
