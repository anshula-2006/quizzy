import {
  buildResultState,
  getQuizState,
  gradeShortAnswer,
  saveQuizAttemptLocal,
  setQuizState,
  setResultState,
  escapeHtml,
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
  const customTimer = quizState.settings?.customTimer;
  if (customTimer === "off") return null;
  if (customTimer && customTimer !== "auto") return Number(customTimer);

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

  const resultState = buildResultState(quizState, evaluation);
  saveQuizAttemptLocal(quizState, resultState);
  setResultState(resultState);
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
  if (existing || seconds == null) return;
  timerLeft = seconds;

  timerId = window.setInterval(() => {
    timerLeft -= 1;
    const timerNode = document.getElementById("timerPill");
    if (timerNode) timerNode.textContent = `${timerLeft}s left`;
    if (timerLeft <= 0) {
      clearInterval(timerId);
      const shortInput = document.getElementById("shortAnswerInput");
      saveAnswer(shortInput ? shortInput.value.trim() : "");
    }
  }, 1000);
}

function render() {
  if (!quizState?.questions?.length) return;
  clearInterval(timerId);
  const question = getCurrentQuestion();
  const answer = getCurrentAnswer();
  const progress = Math.round(((quizState.currentIndex + 1) / quizState.questions.length) * 100);
  const timerSeconds = timerForQuestion(question);
  const timerLabel = timerSeconds !== null
    ? `${timerSeconds}s left`
    : "No timer";

  const modeLabel = quizState.settings?.learnerMode || "quiz";
  const isExam = modeLabel === "exam";
  const isArcade = modeLabel === "arcade";
  const isFocus = modeLabel === "focus";
  const isRevision = modeLabel === "revision";

  let modeDisplay = "Quiz Mode";
  let promptLabel = "Prompt";
  let helperText = "One question at a time. Select with intent, then move forward.";

  if (isExam) {
      modeDisplay = "Exam Simulator";
      promptLabel = "Examination Question";
      helperText = "Strict exam conditions. Timer is active. Results shown at the end.";
  } else if (isArcade) {
      modeDisplay = "Arcade Mode";
      promptLabel = "Trivia Challenge";
      helperText = "Fast-paced trivia. Beat the clock and keep the streak alive!";
  } else if (isFocus) {
      modeDisplay = "Focus Mode";
      promptLabel = "Focus Prompt";
      helperText = "Distraction-free learning. Take your time to understand the core concept.";
  } else if (isRevision) {
      modeDisplay = "Revision Mode";
      promptLabel = "Review Prompt";
      helperText = "Targeted practice on weak areas. Learn from the detailed explanations.";
  }

  let currentStreak = 0;
  if (isArcade) {
      for (let i = 0; i <= quizState.currentIndex; i++) {
          const ans = quizState.answers[i];
          if (ans && ans.isCorrect) currentStreak++;
          else if (ans && !ans.isCorrect) currentStreak = 0;
      }
  }
  const streakPill = isArcade ? `<span class="pill" style="color: var(--warning); border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.1);">🔥 ${currentStreak} Streak</span>` : "";

  const isWiki = quizState.meta?.sourceType === "wikipedia";
  const wikiLink = isWiki ? `<a href="${escapeHtml(quizState.meta.sourceInput)}" target="_blank" class="pill" style="text-decoration:none; background:rgba(59,130,246,0.15); color:#3b82f6;">Wikipedia</a>` : "";

  quizRoot.innerHTML = `
    <section class="panel quiz-card page-fade quiz-focus-shell glass-card">
      <div class="quiz-focus-head">
        <div>
          <p class="eyebrow" style="text-transform: capitalize;">${modeDisplay}</p>
          <h1 class="section-title" style="margin-top:0;">Question ${quizState.currentIndex + 1}</h1>
        </div>
        <div class="quiz-focus-meta">
          <span class="pill">${question.type.toUpperCase()}</span>
          ${wikiLink}
          ${streakPill}
          <span class="pill" id="timerPill">${answer ? "Answered" : timerLabel}</span>
        </div>
      </div>
      <div class="split-grid two-col quiz-focus-grid" style="margin-top:18px;">
        <div>
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
            <p class="eyebrow">${promptLabel}</p>
            <h2 class="question-text">${question.question}</h2>
            <p class="section-copy">${helperText}</p>
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
      const correct = answer && !isExam && question.correct === key;
      const wrong = answer && !isExam && answer.selected === key && !answer.isCorrect;
      const selected = answer && isExam && answer.selected === key;
      return `
        <button class="answer-option ${correct ? "correct" : ""} ${wrong ? "wrong" : ""} ${selected ? "selected" : ""}" data-key="${key}" ${answer ? "disabled" : ""} ${selected ? 'style="border-color: var(--primary); background: rgba(139, 92, 246, 0.1);"' : ''}>
          <span class="answer-key">${key}</span>
          <span>${option}</span>
        </button>
      `;
    }).join("");

    answerStack.querySelectorAll(".answer-option").forEach((button) => {
      button.addEventListener("click", () => saveAnswer(button.dataset.key));
    });
  } else {
    const safeSelected = String(answer?.selected || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    answerStack.innerHTML = `
      <textarea class="answer-input" id="shortAnswerInput" placeholder="Type your answer here..." ${answer ? "disabled" : ""}>${safeSelected}</textarea>
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
    if (isExam) {
      feedbackWrap.innerHTML = `
        <div class="feedback-box" style="background: var(--bg-secondary); border-color: var(--line);">
          <h3 class="feedback-title" style="color: var(--text);">Answer Recorded</h3>
          <p class="feedback-copy">Your response has been saved. Move to the next question.</p>
        </div>
      `;
    } else {
      feedbackWrap.innerHTML = `
        <div class="feedback-box ${answer.isCorrect ? "good" : "bad"}">
          <h3 class="feedback-title">${answer.isCorrect ? "Correct" : "Needs review"}</h3>
          <p class="feedback-copy">${question.type === "short" ? `Correct answer: ${question.shortAnswer}` : `Correct option: ${question.correct}`}</p>
          <p class="feedback-copy" style="margin-top:10px;">${question.explanation || "No explanation available."}</p>
          ${!answer.isCorrect && question.wrongExplanation ? `<p class="feedback-copy" style="margin-top:10px;">${question.wrongExplanation}</p>` : ""}
        </div>
      `;
    }
  }

  document.getElementById("prevBtn")?.addEventListener("click", movePrev);
  document.getElementById("nextBtn")?.addEventListener("click", moveNext);

  startTimer();
}

if (quizState?.questions?.length) {
  render();
}
