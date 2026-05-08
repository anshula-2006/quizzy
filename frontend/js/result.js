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
        <div class="card-title-row" style="margin-bottom: 16px;"><div><strong style="font-size: 1.1rem;">Question review</strong><span style="display: block; margin-top: 2px; font-size: 0.85rem;">Fast scan of missed concepts</span></div></div>
        <div style="display: grid; gap: 8px;">
          ${answers.slice(0, 8).map((answer, index) => `
            <div style="display: flex; gap: 16px; padding: 16px; background: var(--panel-soft); border-radius: var(--radius-md); border: 1px solid var(--line); align-items: flex-start;">
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 48px; height: 48px; border-radius: var(--radius-md); background: ${answer.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${answer.isCorrect ? 'var(--green)' : 'var(--red)'}; font-weight: 700; font-size: 0.9rem; flex-shrink: 0;">
                Q${index + 1}
              </div>
              <div style="flex: 1; min-width: 0;">
                <strong style="display: block; font-size: 1rem; color: var(--text); margin-bottom: 4px; line-height: 1.4;">${escapeHtml(answer.question || "Question")}</strong>
                <span style="font-size: 0.85rem; color: var(--muted); display: block;">Correct answer: ${escapeHtml(answer.correct || "-")}</span>
              </div>
            </div>
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
