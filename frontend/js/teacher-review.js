import auth from "../auth.js";
import { escapeHtml, publishGlobalQuiz, requestTeacherExplanation } from "./shared.js";

const REVIEW_KEY = "quizzy-teacher-review-v1";
const root = document.getElementById("teacherReviewRoot");

function readReviewState() {
  try {
    const raw = sessionStorage.getItem(REVIEW_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeReviewState(state) {
  sessionStorage.setItem(REVIEW_KEY, JSON.stringify(state));
}

function isTeacher() {
  return auth?.getSession?.()?.userType === "teacher";
}

function optionKey(index) {
  return String.fromCharCode(65 + index);
}

function questionFromCard(card) {
  const type = card.querySelector("[data-field='type']")?.value === "short" ? "short" : "mcq";
  const question = card.querySelector("[data-field='question']")?.value || "";
  const explanation = card.querySelector("[data-field='explanation']")?.value || "";
  const wrongExplanation = card.querySelector("[data-field='wrongExplanation']")?.value || "";

  if (type === "short") {
    const shortAnswer = card.querySelector("[data-field='shortAnswer']")?.value || "";
    return { question, type, correct: shortAnswer, shortAnswer, acceptableAnswers: [], explanation, wrongExplanation };
  }

  const options = [...card.querySelectorAll("[data-field='option']")].map((input) => input.value);
  const correct = card.querySelector("[data-field='correct']")?.value || "A";
  return { question, type, options, correct, shortAnswer: null, acceptableAnswers: [], explanation, wrongExplanation };
}

function collectState() {
  const previous = readReviewState() || {};
  const questions = [...root.querySelectorAll("[data-question-card]")].map(questionFromCard);
  return {
    ...previous,
    title: document.getElementById("quizTitle")?.value || previous.title || "Teacher Quiz",
    questions
  };
}

function renderAccessMessage() {
  root.innerHTML = `
    <section class="panel flow-card teacher-hero">
      <div>
        <p class="eyebrow">Teacher Review</p>
        <h1 class="section-title">Teacher account required</h1>
        <p class="section-copy">Sign in as a teacher to review and publish generated quizzes.</p>
      </div>
      <a class="btn btn-primary" href="./login.html">Sign In</a>
    </section>
  `;
}

function renderQuestion(question, index) {
  const type = question.type === "short" ? "short" : "mcq";
  const options = Array.isArray(question.options) && question.options.length ? question.options : ["", "", "", ""];
  const correct = String(question.correct || "A").trim().toUpperCase();

  return `
    <article class="panel flow-card" data-question-card data-index="${index}">
      <div style="display:flex; justify-content:space-between; gap:16px; align-items:center; margin-bottom:14px;">
        <div>
          <p class="eyebrow">Question ${index + 1}</p>
          <strong class="section-title" style="font-size:1rem;">Review and correct before publishing</strong>
        </div>
        <select class="input" data-field="type" style="max-width:140px;">
          <option value="mcq" ${type === "mcq" ? "selected" : ""}>MCQ</option>
          <option value="short" ${type === "short" ? "selected" : ""}>Short</option>
        </select>
      </div>

      <label class="field-label">Question</label>
      <textarea class="input" data-field="question" style="min-height:76px;">${escapeHtml(question.question || "")}</textarea>

      <div data-mcq-fields ${type === "short" ? "hidden" : ""} style="margin-top:14px;">
        <div class="field-stack">
          ${options.slice(0, 4).map((option, optionIndex) => `
            <label>
              <span class="field-label">Option ${optionKey(optionIndex)}</span>
              <input class="input" data-field="option" value="${escapeHtml(option)}" />
            </label>
          `).join("")}
        </div>
        <label style="display:block; margin-top:14px;">
          <span class="field-label">Correct Option</span>
          <select class="input" data-field="correct">
            ${["A", "B", "C", "D"].map((key) => `<option value="${key}" ${correct === key ? "selected" : ""}>${key}</option>`).join("")}
          </select>
        </label>
      </div>

      <div data-short-fields ${type === "short" ? "" : "hidden"} style="margin-top:14px;">
        <label>
          <span class="field-label">Correct Answer</span>
          <input class="input" data-field="shortAnswer" value="${escapeHtml(question.shortAnswer || question.correct || "")}" />
        </label>
      </div>

      <div style="display:grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap:16px; margin-top:14px;">
        <label>
          <span class="field-label">Explanation</span>
          <textarea class="input" data-field="explanation" style="min-height:96px;">${escapeHtml(question.explanation || "")}</textarea>
        </label>
        <label>
          <span class="field-label">Wrong Answer Explanation</span>
          <textarea class="input" data-field="wrongExplanation" style="min-height:96px;">${escapeHtml(question.wrongExplanation || "")}</textarea>
        </label>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
        <button class="btn btn-secondary ai-explain-btn" type="button">Ask AI for Explanation</button>
      </div>
    </article>
  `;
}

function bindQuestionControls() {
  root.querySelectorAll("[data-field='type']").forEach((select) => {
    select.addEventListener("change", () => {
      const card = select.closest("[data-question-card]");
      card.querySelector("[data-mcq-fields]").hidden = select.value === "short";
      card.querySelector("[data-short-fields]").hidden = select.value !== "short";
      writeReviewState(collectState());
    });
  });

  root.querySelectorAll("input, textarea, select").forEach((node) => {
    node.addEventListener("input", () => writeReviewState(collectState()));
    node.addEventListener("change", () => writeReviewState(collectState()));
  });

  root.querySelectorAll(".ai-explain-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest("[data-question-card]");
      const question = questionFromCard(card);
      button.disabled = true;
      button.textContent = "Asking AI...";
      try {
        const data = await requestTeacherExplanation(question);
        card.querySelector("[data-field='explanation']").value = data.explanation || question.explanation || "";
        card.querySelector("[data-field='wrongExplanation']").value = data.wrongExplanation || question.wrongExplanation || "";
        writeReviewState(collectState());
      } catch (error) {
        alert(error.message || "Could not generate explanation.");
      } finally {
        button.disabled = false;
        button.textContent = "Ask AI for Explanation";
      }
    });
  });
}

function render() {
  if (!isTeacher()) {
    renderAccessMessage();
    return;
  }

  const state = readReviewState();
  if (!state?.questions?.length) {
    root.innerHTML = `
      <section class="panel flow-card teacher-hero">
        <div>
          <p class="eyebrow">Teacher Review</p>
          <h1 class="section-title">No generated quiz to review</h1>
          <p class="section-copy">Generate a quiz first. Teacher accounts are sent here before publishing.</p>
        </div>
        <a class="btn btn-primary" href="./generate.html">Generate Quiz</a>
      </section>
    `;
    return;
  }

  root.innerHTML = `
    <section class="panel flow-card teacher-hero">
      <div>
        <p class="eyebrow">Teacher Review</p>
        <h1 class="section-title">Review before publishing</h1>
        <p class="section-copy">Correct AI-generated answers, refine explanations, then upload the quiz to the global student bank.</p>
      </div>
      <div class="dashboard-actions">
        <a class="btn btn-secondary" href="./generate.html">Generate Again</a>
        <button class="btn btn-primary" id="publishQuizBtn" type="button">Publish Globally</button>
      </div>
    </section>

    <section class="panel flow-card" style="margin-top:16px;">
      <label>
        <span class="field-label">Quiz Title</span>
        <input id="quizTitle" class="input" value="${escapeHtml(state.title || state.meta?.sourceInput || "Teacher Quiz")}" />
      </label>
    </section>

    <div style="display:grid; gap:16px; margin-top:16px;">
      ${state.questions.map(renderQuestion).join("")}
    </div>
  `;

  bindQuestionControls();

  document.getElementById("publishQuizBtn")?.addEventListener("click", async () => {
    const nextState = collectState();
    const publishBtn = document.getElementById("publishQuizBtn");
    publishBtn.disabled = true;
    publishBtn.textContent = "Publishing...";
    try {
      await publishGlobalQuiz({
        title: nextState.title,
        sourceType: nextState.meta?.sourceType || "topic",
        sourceInput: nextState.meta?.sourceInput || nextState.title,
        settings: nextState.settings || {},
        questions: nextState.questions
      });
      sessionStorage.removeItem(REVIEW_KEY);
      window.location.href = "./teacher-dashboard.html";
    } catch (error) {
      alert(error.message || "Could not publish quiz.");
      publishBtn.disabled = false;
      publishBtn.textContent = "Publish Globally";
    }
  });
}

render();
