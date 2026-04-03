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

sourceCards.forEach((card) => {
  card.addEventListener("click", () => setSource(card.dataset.source));
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorNode.hidden = true;

  try {
    const settings = {
      difficulty: difficultySelect.value,
      questionMode: modeSelect.value,
      outputLanguage: languageSelect.value,
      learnerMode: "student"
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
      meta: {
        sourceType: contentPayload.sourceType,
        sourceInput: contentPayload.sourceInput
      }
    });
    setResultState(null);
    window.location.href = "./quiz.html";
  } catch (error) {
    errorNode.hidden = false;
    errorNode.textContent = error.message || "Failed to generate quiz. Please try again.";
  }
});

flashcardsBtn?.addEventListener("click", async (event) => {
  event.preventDefault();
  errorNode.hidden = true;
  const originalHTML = flashcardsBtn.innerHTML;
  flashcardsBtn.innerHTML = `<svg class="animate-spin inline-block h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Generating...`;
  flashcardsBtn.disabled = true;

  try {
    const settings = {
      difficulty: difficultySelect.value,
      questionMode: modeSelect.value,
      outputLanguage: languageSelect.value,
      learnerMode: "student"
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
      sourceType: contentPayload.sourceType,
      flashcards: cards.map(c => ({ front: c.front || "", back: c.back || "", hint: c.hint || "" }))
    };

    await addFlashDeck(deck);
    window.location.href = "./dashboard.html";

  } catch (error) {
    errorNode.hidden = false;
    errorNode.textContent = error.message || "Failed to generate flashcards. Please try again.";
    flashcardsBtn.innerHTML = originalHTML;
    flashcardsBtn.disabled = false;
  }
});