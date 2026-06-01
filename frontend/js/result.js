import {
  buildStudyPlan,
  clearQuizFlow,
  feedbackText,
  getAdaptiveLearningSummary,
  getPerformancePrediction,
  getQuizState,
  getResultState,
  getSavedQuizHistory,
  setQuizState,
  setResultState,
  escapeHtml,
  reportQuestion
} from "./shared.js";

const resultRoot = document.getElementById("resultRoot");
const resultState = getResultState();
const quizState = getQuizState();

function cloneQuestions(questions) {
  return Array.isArray(questions) ? questions.map((question) => ({ ...question })) : [];
}

function resetRetryState(state, questions, retryPractice = false) {
  return {
    ...state,
    questions,
    currentIndex: 0,
    answers: [],
    meta: {
      ...(state.meta || {}),
      retryPractice
    }
  };
}

if (!resultState) {
  window.location.replace("./index.html");
}

if (resultState) {
  const isWiki = quizState?.meta?.sourceType === "wikipedia";
  const wikiLink = isWiki ? `<p class="meta-copy" style="margin-top:12px;"><a href="${escapeHtml(quizState.meta.sourceInput)}" target="_blank" style="color: #3b82f6; text-decoration: underline;">Read Wikipedia Article</a></p>` : "";
  const savedHistory = getSavedQuizHistory();
  const prediction = getPerformancePrediction(savedHistory, resultState);
  const studyPlan = buildStudyPlan({ resultState, quizState, attempts: savedHistory });
  const adaptiveSummary = getAdaptiveLearningSummary(resultState);

  resultRoot.innerHTML = `
    <section class="panel result-card page-fade result-summary-card glass-card">
      <div>
        <p class="eyebrow">Result</p>
        <h1 class="score-big">${resultState.score}/${resultState.total}</h1>
        <p class="page-subtitle" style="margin-top:14px;">${feedbackText(resultState.percentage)}</p>
        <p class="meta-copy" style="margin-top:12px;">Accuracy: ${resultState.percentage}%</p>
        ${wikiLink}
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
        <article class="stat-card">
          <span>${escapeHtml(prediction.label)}</span>
          <strong>${escapeHtml(prediction.value)}</strong>
        </article>
      </div>

      <div class="result-insight-grid">
        <article class="stat-card result-insight-card">
          <span>Study Plan</span>
          <ul class="compact-list">
            ${studyPlan.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
        <article class="stat-card result-insight-card">
          <span>Performance Prediction</span>
          <strong>${escapeHtml(prediction.value)}</strong>
          <p class="section-copy">${escapeHtml(prediction.message)}</p>
        </article>
        <article class="stat-card result-insight-card">
          <span>${escapeHtml(adaptiveSummary.label)}</span>
          <strong>${escapeHtml(adaptiveSummary.value)}</strong>
          <p class="section-copy">${escapeHtml(adaptiveSummary.message)}</p>
        </article>
      </div>

      <div class="button-row landing-actions" style="flex-wrap: wrap;">
        <button class="btn" id="retryBtn">Retry Full Quiz</button>
        ${resultState.score < resultState.total ? `<button class="btn-outline" id="retryIncorrectBtn" style="border-color: var(--warning); color: var(--warning);">Retry Incorrect</button>` : ""}
        <button class="btn-outline" id="downloadQuizBtn">Download Report</button>
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
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 48px; height: 48px; border-radius: var(--radius-md); background: ${answer.isCorrect ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${answer.isCorrect ? 'var(--success)' : 'var(--error)'}; font-weight: 700; font-size: 0.9rem; flex-shrink: 0;">
                Q${index + 1}
              </div>
              <div style="flex: 1; min-width: 0;">
                <strong style="display: block; font-size: 1rem; color: var(--text); margin-bottom: 4px; line-height: 1.4;">${escapeHtml(answer.question || "Question")}</strong>
                <span style="font-size: 0.85rem; color: var(--muted); display: block;">Correct answer: ${escapeHtml(answer.correct || "-")}</span>
                <button class="btn-outline report-question-btn" type="button" data-index="${index}" style="margin-top:10px; padding:6px 10px; font-size:0.8rem;">Report Question</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    `);
  }

  document.getElementById("retryBtn")?.addEventListener("click", () => {
    const originalQuestions = cloneQuestions(quizState?.originalQuestions?.length ? quizState.originalQuestions : quizState?.questions);
    if (!originalQuestions.length) {
      window.location.href = "./generate.html";
      return;
    }
    setQuizState(resetRetryState(quizState, originalQuestions, false));
    setResultState(null);
    window.location.href = "./quiz.html";
  });

  document.querySelectorAll(".report-question-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.index);
      const answer = answers[index];
      const reason = window.prompt("Why are you reporting this question?", "Answer seems incorrect");
      if (!reason) return;
      button.disabled = true;
      button.textContent = "Reporting...";
      try {
        await reportQuestion({
          quizId: quizState?.quizId || null,
          publishedQuizId: quizState?.meta?.publishedQuizId || "",
          teacherName: quizState?.meta?.teacherName || "",
          question: answer?.question || "",
          selected: answer?.selected || "",
          correct: answer?.correct || "",
          explanation: answer?.explanation || answer?.wrongExplanation || "",
          reason
        });
        button.textContent = "Reported";
      } catch (error) {
        alert(error.message || "Could not report this question.");
        button.disabled = false;
        button.textContent = "Report Question";
      }
    });
  });

  document.getElementById("newQuizBtn")?.addEventListener("click", () => {
    clearQuizFlow();
    window.location.href = "./generate.html";
  });

  document.getElementById("retryIncorrectBtn")?.addEventListener("click", () => {
    const currentQuestions = cloneQuestions(quizState?.questions);
    const wrongQuestions = currentQuestions.reduce((items, question, index) => {
      const answer = resultState.answers?.[index];
      if (!answer || answer.isCorrect) return items;
      items.push({
        ...question,
        correct: question.correct || answer.correct || "",
        shortAnswer: question.shortAnswer || answer.correct || "",
        explanation: question.explanation || answer.explanation || "",
        wrongExplanation: question.wrongExplanation || answer.wrongExplanation || ""
      });
      return items;
    }, []);
    if (!wrongQuestions.length) return;

    setQuizState(resetRetryState(quizState, wrongQuestions, true));
    setResultState(null);
    window.location.href = "./quiz.html";
  });

  document.getElementById("downloadQuizBtn")?.addEventListener("click", () => {
    const lines = [
      `Quizzy Performance Report`,
      `Date: ${new Date().toLocaleString()}`,
      `Score: ${resultState.score} / ${resultState.total} (${resultState.percentage}%)`,
      `\n=== QUESTION REVIEW ===\n`
    ];
    
    (resultState.answers || []).forEach((ans, i) => {
      lines.push(`Q${i + 1}: ${ans.question}`);
      lines.push(`Your Answer: ${ans.selected || 'None'}`);
      lines.push(`Correct Answer: ${ans.correct}`);
      lines.push(`Explanation: ${ans.explanation || ans.wrongExplanation || 'N/A'}\n`);
    });
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Quizzy_Report_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}
