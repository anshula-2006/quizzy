import {
  buildResultState,
  getQuizState,
  gradeShortAnswer,
  setQuizState,
  setResultState,
  submitQuizAttempt
} from "./shared.js";

const quizRoot = document.getElementById("quizRoot");
const quizState = getQuizState();
let timerId = null;
let timerLeft = 0;

if (!quizState?.questions?.length) {
  window.location.replace("./generate.html");
}

function getCurrentQuestion() {
  return quizState.questions[quizState.currentIndex];
}

function getCurrentAnswer() {
  return quizState.answers[quizState.currentIndex] || null;
}

function timerForQuestion(question) {
  if (question.type !== "mcq") return null;
  if (quizState.settings?.difficulty === "easy") return 36;
  if (quizState.settings?.difficulty === "tough") return 24;
  if (quizState.settings?.difficulty === "super") return 20;
  return 30;
}

function persist() {
  setQuizState(quizState);
}

function saveAnswer(selected) {
  const question = getCurrentQuestion();
  const isCorrect = question.type === "short"
    ? gradeShortAnswer(selected, question)
    : selected === question.correct;

  quizState.answers[quizState.currentIndex] = {
    question: question.question,
    selected,
    correct: question.type === "short" ? question.shortAnswer : question.correct,
    isCorrect,
    type: question.type,
    explanation: question.explanation || "",
    wrongExplanation: question.wrongExplanation || ""
  };
  persist();
  render();
}

async function finishQuiz() {
  clearInterval(timerId);
  let evaluation = null;

  try {
    const response = await submitQuizAttempt(quizState);
    if (response?.evaluation) {
      evaluation = {
        score: Number(response.evaluation.score || 0),
        total: Number(response.evaluation.total || quizState.questions.length),
        percentage: Number(response.evaluation.percentage || 0),
        confidence: Number(response.evaluation.confidence || 0),
        answers: Array.isArray(response.evaluation.answers) ? response.evaluation.answers : undefined
      };
    }
  } catch {
    evaluation = null;
  }

  setResultState(buildResultState(quizState, evaluation));
  window.location.href = "./result.html";
}

function moveNext() {
  if (!getCurrentAnswer()) return;
  if (quizState.currentIndex >= quizState.questions.length - 1) {
    finishQuiz();
    return;
  }
  quizState.currentIndex += 1;
  persist();
  render();
}

function movePrev() {
  if (quizState.currentIndex === 0) return;
  quizState.currentIndex -= 1;
  persist();
  render();
}

function startTimer() {
  clearInterval(timerId);
  const question = getCurrentQuestion();
  const existing = getCurrentAnswer();
  const seconds = timerForQuestion(question);
  if (question.type !== "mcq" || existing || seconds == null) return;
  timerLeft = seconds;

  timerId = window.setInterval(() => {
    timerLeft -= 1;
    const timerNode = document.getElementById("timerPill");
    if (timerNode) timerNode.textContent = `${timerLeft}s left`;
    if (timerLeft <= 0) {
      clearInterval(timerId);
      saveAnswer("");
    }
  }, 1000);
}

function render() {
  if (!quizState?.questions?.length) return;
  clearInterval(timerId);
  const question = getCurrentQuestion();
  const answer = getCurrentAnswer();
  const progress = Math.round(((quizState.currentIndex + 1) / quizState.questions.length) * 100);
  const timerLabel = question.type === "mcq"
    ? `${timerForQuestion(question)}s left`
    : "No timer";

  quizRoot.innerHTML = `
    <section class="panel quiz-card page-fade">
      <p class="eyebrow">Quiz Mode</p>
      <div class="split-grid two-col" style="margin-top:20px;">
        <div>
          <h1 class="section-title" style="margin-top:0;">Question ${quizState.currentIndex + 1}</h1>
          <div class="progress-wrap">
            <div class="progress-head">
              <span>Progress</span>
              <span>${progress}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${progress}%"></div>
            </div>
          </div>
          <div class="question-panel" style="margin-top:22px;">
            <p class="eyebrow">Focus Prompt</p>
            <h2 class="question-text">${question.question}</h2>
            <p class="section-copy">One question at a time. Keep the pace and lock in your answer.</p>
            <div class="game-status-row" style="margin-top:18px;">
              <span class="pill">${question.type.toUpperCase()}</span>
              <span class="pill" id="timerPill">${answer ? "Answered" : timerLabel}</span>
            </div>
          </div>
        </div>
        <div>
          <div class="answer-stack" id="answerStack"></div>
          <div id="feedbackWrap"></div>
          <div class="quiz-actions">
            <button class="btn-outline" id="prevBtn" ${quizState.currentIndex === 0 ? "disabled" : ""}>Previous</button>
            <button class="btn" id="nextBtn" ${answer ? "" : "disabled"}>${quizState.currentIndex === quizState.questions.length - 1 ? "Finish" : "Next"}</button>
          </div>
        </div>
      </div>
    </section>
  `;

  const answerStack = document.getElementById("answerStack");
  if (question.type === "mcq") {
    answerStack.innerHTML = question.options.map((option, index) => {
      const key = String.fromCharCode(65 + index);
      const correct = answer && question.correct === key;
      const wrong = answer && answer.selected === key && !answer.isCorrect;
      return `
        <button class="answer-option ${correct ? "correct" : ""} ${wrong ? "wrong" : ""}" data-key="${key}" ${answer ? "disabled" : ""}>
          <span class="answer-key">${key}</span>
          <span>${option}</span>
        </button>
      `;
    }).join("");

    answerStack.querySelectorAll(".answer-option").forEach((button) => {
      button.addEventListener("click", () => saveAnswer(button.dataset.key));
    });
  } else {
    answerStack.innerHTML = `
      <textarea class="answer-input" id="shortAnswerInput" placeholder="Type your answer here..." ${answer ? "disabled" : ""}>${answer?.selected || ""}</textarea>
      <button class="btn" id="submitShortBtn" ${answer ? "disabled" : ""}>Lock Answer</button>
    `;
    document.getElementById("submitShortBtn")?.addEventListener("click", () => {
      const value = document.getElementById("shortAnswerInput")?.value || "";
      if (!value.trim()) return;
      saveAnswer(value.trim());
    });
  }

  const feedbackWrap = document.getElementById("feedbackWrap");
  if (answer) {
    feedbackWrap.innerHTML = `
      <div class="feedback-box ${answer.isCorrect ? "good" : "bad"}">
        <h3 class="feedback-title">${answer.isCorrect ? "Correct ✅" : "Wrong ❌"}</h3>
        <p class="feedback-copy">${question.type === "short" ? `Correct answer: ${question.shortAnswer}` : `Correct option: ${question.correct}`}</p>
        <p class="feedback-copy" style="margin-top:10px;">${question.explanation || "No explanation available."}</p>
        ${!answer.isCorrect && question.wrongExplanation ? `<p class="feedback-copy" style="margin-top:10px;">${question.wrongExplanation}</p>` : ""}
      </div>
    `;
  }

  document.getElementById("prevBtn")?.addEventListener("click", movePrev);
  document.getElementById("nextBtn")?.addEventListener("click", moveNext);

  startTimer();
}

if (quizState?.questions?.length) {
  render();
}
