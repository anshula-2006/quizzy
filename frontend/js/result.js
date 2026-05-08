import { clearQuizFlow, feedbackText, getQuizState, getResultState, setQuizState, setResultState, escapeHtml } from "./shared.js";

const resultRoot = document.getElementById("resultRoot");
const resultState = getResultState();
const quizState = getQuizState();

if (!resultState) {
  window.location.replace("./index.html");
}

if (resultState) {
  resultRoot.innerHTML = `
    <section class="panel result-card page-fade result-summary-card">
      <div>
        <p class="eyebrow">Result</p>
        <h1 class="score-big">${resultState.score}/${resultState.total}</h1>
        <p class="page-subtitle" style="margin-top:14px;">${feedbackText(resultState.percentage)}</p>
        <p class="meta-copy" style="margin-top:12px;">Accuracy: ${resultState.percentage}%</p>
      </div>

      <div class="result-stats">
        <article class="stat-card">
          <span>Correct</span>
          <strong>${resultState.score}</strong>
        </article>
        <article class="stat-card">
          <span>Wrong</span>
          <strong>${Math.max(0, resultState.total - resultState.score)}</strong>
        </article>
        <article class="stat-card">
          <span>Confidence</span>
          <strong>${resultState.confidence || 0}%</strong>
        </article>
      </div>

      <div class="button-row landing-actions">
        <button class="btn" id="retryBtn">Retry Quiz</button>
        <button class="btn-outline" id="newQuizBtn">New Quiz</button>
        <a class="btn-outline" href="./dashboard.html">Dashboard</a>
      </div>
    </section>
  `;

  const answers = Array.isArray(resultState.answers) ? resultState.answers : [];
  if (answers.length) {
    resultRoot.insertAdjacentHTML("beforeend", `
      <section class="panel flow-card result-review-list">
        <div class="card-title-row"><div><strong>Question review</strong><span>Fast scan of missed concepts</span></div></div>
        <div class="dashboard-list">
          ${answers.slice(0, 8).map((answer, index) => `
            <article class="answer-option compact-row ${answer.isCorrect ? "correct" : "wrong"}">
              <div class="score-tile"><span>Q${index + 1}</span><strong>${answer.isCorrect ? "OK" : "Review"}</strong></div>
              <div>
                <strong>${escapeHtml(answer.question || "Question")}</strong>
                <p class="helper-text">Correct: ${escapeHtml(answer.correct || "-")}</p>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `);
  }

  document.getElementById("retryBtn")?.addEventListener("click", () => {
    if (!quizState?.questions?.length) {
      window.location.href = "./generate.html";
      return;
    }
    quizState.currentIndex = 0;
    quizState.answers = [];
    setQuizState(quizState);
    setResultState(null);
    window.location.href = "./quiz.html";
  });

  document.getElementById("newQuizBtn")?.addEventListener("click", () => {
    clearQuizFlow();
    window.location.href = "./generate.html";
  });
}
