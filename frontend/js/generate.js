import { extractContent, requestQuiz, setQuizState, setResultState } from "./shared.js";

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
    errorNode.textContent = error.message || "Something went wrong.";
  }
});

setSource(activeSource);
