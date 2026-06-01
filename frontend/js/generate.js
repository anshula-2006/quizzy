import { extractContent, requestQuiz, requestFlashcards, setQuizState, setResultState, addFlashDeck, getSession, getSavedQuizHistory, getFlashDecks, escapeHtml, clearQuizFlow, fetchGlobalQuizzes, startGlobalQuiz } from "./shared.js";
import { createIcons, FileText, FileUp, Link, Plus, Play } from 'lucide';

const sourceCards = document.querySelectorAll("[data-source]");
const topicInput = document.getElementById("topicInput") || document.getElementById("inputText");
const urlInput = document.getElementById("urlInput");
const pdfInput = document.getElementById("pdfInput");
const difficultySelect = document.getElementById("difficultySelect");
const modeSelect = document.getElementById("modeSelect");
const languageSelect = document.getElementById("languageSelect");
const countInput = document.getElementById("countInput") || document.getElementById("countSelect");
const timerMode = document.getElementById("timerMode");
const timerSecondsInput = document.getElementById("timerSecondsInput");
const timerSecondsWrap = document.getElementById("timerSecondsWrap");
const learnerModeSelect = document.getElementById("learnerMode");
const modeDescNode = document.getElementById("modeDesc");
const sourceHint = document.getElementById("sourceHint");
const form = document.getElementById("generateForm");
const flashcardsBtn = document.getElementById("flashcardsBtn");
const generateBtn = document.getElementById("generateBtn");
const errorNode = document.getElementById("generateError");
const generationStatus = document.getElementById("generationStatus");
const generationStatusTitle = document.getElementById("generationStatusTitle");
const generationElapsed = document.getElementById("generationElapsed");
const generationEta = document.getElementById("generationEta");
const generationProgress = document.getElementById("generationProgress");

let activeSource = "text";
let generationTimerId = null;

const modeDescriptions = {
  focus: "Deep, distraction-free learning. Best for mastering new topics at your own pace.",
  arcade: "Fast-paced, gamified. Earn XP, build streaks, and compete.",
  exam: "Strict timer and realistic exam conditions. Tests your readiness under pressure.",
  revision: "Focus on weak topics with detailed explanations and common pitfalls."
};

function estimateQuizWaitSeconds(questionCount, source) {
  const count = Math.max(5, Number(questionCount) || 5);
  const extractionExtra = source === "pdf" ? 10 : source === "url" ? 6 : 0;
  if (count <= 10) return extractionExtra + 15;
  if (count <= 25) return extractionExtra + 35;
  if (count <= 50) return extractionExtra + 60;
  return extractionExtra + 105;
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  if (value < 60) return `${value}s`;
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function startGenerationStatus({ title, estimateSeconds }) {
  clearInterval(generationTimerId);
  const startedAt = Date.now();
  const estimate = Math.max(10, Number(estimateSeconds) || 20);

  if (generationStatus) generationStatus.hidden = false;
  if (generationStatusTitle) generationStatusTitle.textContent = title;

  const update = () => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remaining = Math.max(0, estimate - elapsed);
    const progress = Math.min(94, Math.max(6, Math.round((elapsed / estimate) * 100)));

    if (generationElapsed) generationElapsed.textContent = formatDuration(elapsed);
    if (generationEta) {
      generationEta.textContent = remaining
        ? `Estimated wait: about ${formatDuration(remaining)} remaining`
        : "Finishing up... almost there.";
    }
    if (generationProgress) generationProgress.style.width = `${progress}%`;
  };

  update();
  generationTimerId = window.setInterval(update, 1000);
}

function stopGenerationStatus({ complete = false } = {}) {
  clearInterval(generationTimerId);
  generationTimerId = null;
  if (complete && generationProgress) generationProgress.style.width = "100%";
  if (!complete && generationStatus) generationStatus.hidden = true;
}

requestAnimationFrame(() => {
  createIcons({
    icons: { FileText, FileUp, Link, Plus, Play }
  });
});

function renderWorkspace() {
  const sidebar = document.getElementById("generateSidebar");
  if (!sidebar) return;

  const session = getSession();
  const history = getSavedQuizHistory();
  const decks = getFlashDecks();

  if (history.length === 0 && decks.length === 0) {
    sidebar.innerHTML = `
      <section class="panel flow-card" style="background: linear-gradient(145deg, var(--panel-soft), var(--panel)); border: 1px solid var(--line);">
         <p class="eyebrow">Welcome to Quizzy</p>
         <h2 style="font-size: 1.25rem; margin-bottom: 8px;">Start Your Journey</h2>
         <p class="section-copy" style="font-size: 0.9rem; margin-bottom: 16px;">Transform any topic, PDF, or article into interactive learning materials.</p>
         <div style="display: grid; gap: 12px;">
            <div style="display: flex; gap: 12px; align-items: center; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--line); border-radius: var(--radius-md);">
               <div style="width: 32px; height: 32px; display: grid; place-items: center; background: rgba(79, 70, 229, 0.1); color: var(--primary); border-radius: 8px; font-weight: 700;">1</div>
               <div style="font-size: 0.85rem;"><strong style="display: block; color: var(--text);">Generate a Quiz</strong>Test your knowledge on a topic.</div>
            </div>
            <div style="display: flex; gap: 12px; align-items: center; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--line); border-radius: var(--radius-md);">
               <div style="width: 32px; height: 32px; display: grid; place-items: center; background: rgba(14, 116, 144, 0.1); color: var(--secondary); border-radius: 8px; font-weight: 700;">2</div>
               <div style="font-size: 0.85rem;"><strong style="display: block; color: var(--text);">Upload a PDF</strong>Extract notes to begin learning.</div>
            </div>
            <div style="display: flex; gap: 12px; align-items: center; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--line); border-radius: var(--radius-md);">
               <div style="width: 32px; height: 32px; display: grid; place-items: center; background: rgba(190, 24, 93, 0.1); color: var(--accent); border-radius: 8px; font-weight: 700;">3</div>
               <div style="font-size: 0.85rem;"><strong style="display: block; color: var(--text);">Create Flashcards</strong>Master terms and definitions.</div>
            </div>
         </div>
      </section>
    `;
    return;
  }

  const username = session?.user?.name || session?.name || session?.email || "Learner";
  const totalQuizzes = history.length;
  const totalDecks = decks.length;
  const accuracy = totalQuizzes ? Math.round(history.reduce((acc, cur) => acc + (cur.percentage || 0), 0) / totalQuizzes) : 0;
  
  let streak = 0;
  for (const item of history) {
    if ((item.percentage || 0) >= 70) streak++;
    else break;
  }

  const xp = history.reduce((sum, e) => sum + (e.percentage || 0) + 20, 0);

  const topics = {};
  history.forEach(h => {
     const t = h.settings?.topic || h.sourceTopic || h.sourceInput || "General Topic";
     if (!topics[t]) topics[t] = { count: 0, total: 0 };
     topics[t].count++;
     topics[t].total += (h.percentage || 0);
  });
  const topicStats = Object.keys(topics).map(t => ({
     topic: t,
     avg: Math.round(topics[t].total / topics[t].count),
     count: topics[t].count
  }));
  
  const weakest = topicStats.filter(t => t.avg < 70).sort((a,b) => a.avg - b.avg)[0];
  const strongest = topicStats.filter(t => t.avg >= 80).sort((a,b) => b.avg - a.avg)[0];
  const mostStudied = topicStats.length ? [...topicStats].sort((a,b) => b.count - a.count)[0] : null;
  const recentQuizzes = history.slice(0, 3);
  const lastAttempt = history[0];
  const recommendedTopic = weakest?.topic || mostStudied?.topic || lastAttempt?.settings?.topic || lastAttempt?.sourceTopic || "General Practice";
  const recommendedNextQuiz = weakest
    ? `Sharpen your skills with another quiz on ${escapeHtml(weakest.topic)}`
    : strongest
      ? `Take a harder quiz on ${escapeHtml(strongest.topic)}`
      : `Create your first quiz to get started`;
  const recommendedFlashcardReview = weakest
    ? `Review flashcards for ${escapeHtml(weakest.topic)}`
    : decks.length
      ? `Review ${escapeHtml(decks[0].title)} deck`
      : `Create your first flashcard deck`;

  sidebar.innerHTML = `
    <section class="panel flow-card">
       <p class="eyebrow">Personalized Workspace</p>
       <h2 style="font-size: 1.25rem; margin-bottom: 4px; color: var(--text);">Welcome back, ${escapeHtml(username)}</h2>
       <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px;">
          <div class="saas-stat-card" style="padding: 12px;"><span class="saas-stat-label">XP</span><strong class="saas-stat-value" style="font-size: 1.1rem; margin-top: 4px; display: block;">${xp}</strong></div>
          <div class="saas-stat-card" style="padding: 12px;"><span class="saas-stat-label">Accuracy</span><strong class="saas-stat-value" style="font-size: 1.1rem; margin-top: 4px; display: block;">${accuracy}%</strong></div>
          <div class="saas-stat-card" style="padding: 12px;"><span class="saas-stat-label">Streak</span><strong class="saas-stat-value" style="font-size: 1.1rem; margin-top: 4px; display: block;">${streak}🔥</strong></div>
          <div class="saas-stat-card" style="padding: 12px;"><span class="saas-stat-label">Decks</span><strong class="saas-stat-value" style="font-size: 1.1rem; margin-top: 4px; display: block;">${totalDecks}</strong></div>
       </div>
    </section>
    ${topicStats.length ? `
      <section class="panel flow-card">
         <p class="eyebrow">Recommendations</p>
         <h3 style="font-size: 1rem; margin: 0 0 12px;">${escapeHtml(recommendedTopic)}</h3>
         <div style="display: grid; gap: 10px;">
           <div class="meta-row" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
             <span style="font-size:0.85rem; color:var(--muted);">Weakest topic</span>
             <strong>${escapeHtml(weakest?.topic || "N/A")}</strong>
           </div>
           <div class="meta-row" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
             <span style="font-size:0.85rem; color:var(--muted);">Strongest topic</span>
             <strong>${escapeHtml(strongest?.topic || "N/A")}</strong>
           </div>
           <div class="meta-row" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
             <span style="font-size:0.85rem; color:var(--muted);">Most studied</span>
             <strong>${escapeHtml(mostStudied?.topic || "N/A")}</strong>
           </div>
           <div style="padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--line);">
             <p class="text-secondary" style="margin:0 0 6px; font-size:0.8rem;">Next quiz</p>
             <strong style="display:block;">${recommendedNextQuiz}</strong>
           </div>
           <div style="padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--line);">
             <p class="text-secondary" style="margin:0 0 6px; font-size:0.8rem;">Flashcard review</p>
             <strong style="display:block;">${recommendedFlashcardReview}</strong>
           </div>
         </div>
      </section>
    ` : ''}

    ${(weakest || strongest || lastAttempt) ? `
    <section class="panel flow-card">
       <h3 style="font-size: 1rem; margin-bottom: 12px; color: var(--text);">Continue Learning</h3>
       <div style="display: grid; gap: 12px;">
         ${lastAttempt && lastAttempt.settings?.topic ? `
            <a href="?topic=${encodeURIComponent(lastAttempt.settings.topic)}&mode=revision" class="lb-row glass-card glow-hover" style="padding: 12px; text-decoration: none; display: block; border-color: var(--line);">
               <strong style="display: block; font-size: 0.9rem; color: var(--text);">Review ${escapeHtml(lastAttempt.settings.topic)}</strong>
               <span style="font-size: 0.8rem; color: var(--muted);">Continue Quiz</span>
            </a>
         ` : ''}
         ${weakest ? `
            <div class="lb-row glass-card" style="padding: 12px; border-color: rgba(239, 68, 68, 0.3);">
               <span class="meta-chip" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: var(--error); margin-bottom: 8px;">Needs Improvement</span>
               <strong style="display: block; font-size: 0.9rem; color: var(--text);">${escapeHtml(weakest.topic)} (${weakest.avg}%)</strong>
               <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
                  <a href="?topic=${encodeURIComponent(weakest.topic)}&mode=revision&auto=flashcards" class="btn btn-secondary">Review Flashcards</a>
                  <a href="?topic=${encodeURIComponent(weakest.topic)}&mode=focus" class="btn" style="padding: 4px 10px; font-size: 0.75rem; background: var(--error); border-color: var(--error);">Retry Quiz</a>
               </div>
            </div>
         ` : ''}
         ${strongest ? `
            <div class="lb-row glass-card" style="padding: 12px; border-color: rgba(34, 197, 94, 0.3);">
               <span class="meta-chip" style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); color: var(--success); margin-bottom: 8px;">Strong Topic</span>
               <strong style="display: block; font-size: 0.9rem; color: var(--text);">${escapeHtml(strongest.topic)} (${strongest.avg}%)</strong>
               <div style="display: flex; gap: 8px; margin-top: 10px;">
                  <a href="?topic=${encodeURIComponent(strongest.topic)}&mode=exam" class="btn" style="padding: 4px 10px; font-size: 0.75rem; background: var(--success); border-color: var(--success);">Advanced Quiz</a>
               </div>
            </div>
         ` : ''}
       </div>
    </section>
    ` : ''}
    
    ${recentQuizzes.length ? `
    <section class="panel flow-card">
       <h3 style="font-size: 1rem; margin-bottom: 12px; color: var(--text);">Recent Activity</h3>
       <div style="display: grid; gap: 8px;">
          ${recentQuizzes.map(q => `
             <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 8px 0; border-bottom: 1px solid var(--line);">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; color: var(--muted);">${escapeHtml(q.settings?.topic || q.sourceInput || "Quiz")}</span>
                <strong style="color: ${q.percentage >= 70 ? 'var(--success)' : 'var(--text)'};">${q.percentage}%</strong>
             </div>
          `).join('')}
       </div>
    </section>
    ` : ''}
  `;
}

async function renderGlobalQuizShelf() {
  const sidebar = document.getElementById("generateSidebar");
  if (!sidebar) return;
  const session = getSession();
  const isTeacher = session?.user?.userType === "teacher";
  const quizzes = await fetchGlobalQuizzes();
  const shelf = document.createElement("section");
  shelf.className = "panel flow-card";
  shelf.innerHTML = `
    <p class="eyebrow">${isTeacher ? "Published quizzes" : "Teacher quizzes"}</p>
    <h2 style="font-size: 1.05rem; margin: 0 0 10px;">${isTeacher ? "Global classroom bank" : "Solve a teacher quiz"}</h2>
    <div class="dashboard-list" id="globalQuizList">
      ${quizzes.length ? quizzes.slice(0, 5).map((quiz) => `
        <article class="dashboard-activity-item">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <strong>${escapeHtml(quiz.title)}</strong>
              <span class="section-copy">${Number(quiz.questionCount || 0)} questions · ${escapeHtml(quiz.teacherName || "Teacher")}</span>
            </div>
            ${isTeacher ? "" : `<button class="btn btn-secondary global-quiz-start" type="button" data-id="${escapeHtml(quiz.id)}">Start</button>`}
          </div>
        </article>
      `).join("") : `<p class="section-copy">No teacher quizzes have been published yet.</p>`}
    </div>
  `;
  sidebar.prepend(shelf);

  shelf.querySelectorAll(".global-quiz-start").forEach((button) => {
    button.addEventListener("click", async () => {
      errorNode.hidden = true;
      button.disabled = true;
      button.textContent = "Starting...";
      try {
        const payload = await startGlobalQuiz(button.dataset.id);
        setQuizState({
          quizId: payload.quizId,
          questions: payload.questions,
          originalQuestions: payload.questions,
          currentIndex: 0,
          answers: [],
          generatedAt: new Date().toISOString(),
          settings: payload.settings,
          meta: payload.meta
        });
        setResultState(null);
        window.location.href = "./quiz.html";
      } catch (error) {
        errorNode.hidden = false;
        errorNode.textContent = error.message || "Could not start this quiz.";
        button.disabled = false;
        button.textContent = "Start";
      }
    });
  });
}

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

if (learnerModeSelect) {
  learnerModeSelect.addEventListener("change", (e) => {
    if (modeDescNode) {
      modeDescNode.textContent = modeDescriptions[e.target.value] || "";
    }
  });
  modeDescNode.textContent = modeDescriptions[learnerModeSelect.value];
}

const params = new URLSearchParams(window.location.search);
const prefillTopic = params.get("topic");
const prefillMode = params.get("mode");
const prefillCount = params.get("count");
const autoGenerate = params.get("auto");

if (prefillTopic && topicInput) {
  topicInput.value = prefillTopic;
  setSource("text");
}

if (prefillMode && learnerModeSelect) {
  learnerModeSelect.value = prefillMode;
  learnerModeSelect.dispatchEvent(new Event("change"));
}

if (prefillCount && countInput) {
  countInput.value = prefillCount;
}

sourceCards.forEach((card) => {
  card.addEventListener("click", () => setSource(card.dataset.source));
});

timerMode?.addEventListener("change", () => {
  const timerOn = timerMode.value === "on";
  if (timerSecondsWrap) {
    timerSecondsWrap.hidden = !timerOn;
    timerSecondsWrap.style.display = timerOn ? "" : "none";
  }
});

timerMode?.dispatchEvent(new Event("change"));

if (autoGenerate === "flashcards" && flashcardsBtn && prefillTopic) {
  setTimeout(() => flashcardsBtn.click(), 100);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearQuizFlow();
  errorNode.hidden = true;

  const questionCount = Math.floor(Number(countInput?.value || 0));
  if (!Number.isFinite(questionCount) || questionCount < 5) {
    errorNode.hidden = false;
    errorNode.textContent = "Minimum 5 questions required.";
    countInput?.focus();
    return;
  }
  if (questionCount > 100) {
    errorNode.hidden = false;
    errorNode.textContent = "Maximum 100 questions allowed.";
    countInput?.focus();
    return;
  }

  const timerEnabled = timerMode?.value === "on";
  const timerSeconds = Math.floor(Number(timerSecondsInput?.value || 0));
  if (timerEnabled && (!Number.isFinite(timerSeconds) || timerSeconds < 15)) {
    errorNode.hidden = false;
    errorNode.textContent = "Timer must be at least 15 seconds.";
    timerSecondsInput?.focus();
    return;
  }

  const originalText = generateBtn?.textContent || "Generate Quiz";
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.innerHTML = `<i data-lucide="play" style="width: 16px; height: 16px; margin-right: 4px;"></i> Preparing...`;
  }
  if (flashcardsBtn) flashcardsBtn.disabled = true;
  startGenerationStatus({
    title: `Generating ${questionCount} question${questionCount === 1 ? "" : "s"}`,
    estimateSeconds: estimateQuizWaitSeconds(questionCount, activeSource)
  });

  try {
    const settings = {
      difficulty: difficultySelect.value,
      questionMode: modeSelect.value,
      outputLanguage: languageSelect.value,
      learnerMode: learnerModeSelect ? learnerModeSelect.value : "focus",
      customTimer: timerEnabled ? timerSeconds : "off",
      timerEnabled,
      timerSeconds: timerEnabled ? timerSeconds : null,
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
      questionCount,
      variation: `${Date.now()}-${Math.random().toString(36).slice(2)}`
    });

    if (getSession()?.user?.userType === "teacher") {
      sessionStorage.setItem("quizzy-teacher-review-v1", JSON.stringify({
        quizId: quizPayload.quizId,
        questions: quizPayload.questions,
        generatedAt: new Date().toISOString(),
        settings,
        meta: quizPayload.meta || {
          sourceType: contentPayload.sourceType,
          sourceInput: contentPayload.sourceInput
        },
        title: contentPayload.sourceInput || contentPayload.topic || "Teacher Quiz"
      }));
      setResultState(null);
      stopGenerationStatus({ complete: true });
      window.location.href = "./teacher-review.html";
      return;
    }

    setQuizState({
      quizId: quizPayload.quizId,
      questions: quizPayload.questions,
      originalQuestions: quizPayload.questions,
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
    stopGenerationStatus({ complete: true });
    window.location.href = "./quiz.html";
  } catch (error) {
    stopGenerationStatus();
    errorNode.hidden = false;
    errorNode.textContent = error.message || "An error occurred during generation.";
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.innerHTML = originalText;
    }
    if (flashcardsBtn) flashcardsBtn.disabled = false;
  }
  createIcons({ icons: { FileText, FileUp, Link, Plus, Play } });
});

renderWorkspace();
renderGlobalQuizShelf();

flashcardsBtn?.addEventListener("click", async (event) => {
  event.preventDefault();
  errorNode.hidden = true;
  const originalHTML = flashcardsBtn.innerHTML;
  flashcardsBtn.innerHTML = `<i data-lucide="plus" style="width: 16px; height: 16px; margin-right: 4px;"></i> Generating...`;
  flashcardsBtn.disabled = true;
  if (generateBtn) generateBtn.disabled = true;
  startGenerationStatus({
    title: "Generating flashcards",
    estimateSeconds: activeSource === "pdf" ? 30 : activeSource === "url" ? 24 : 18
  });

  try {
    const settings = {
      difficulty: difficultySelect.value,
      questionMode: modeSelect.value,
      outputLanguage: languageSelect.value,
      learnerMode: learnerModeSelect ? learnerModeSelect.value : "focus",
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
    stopGenerationStatus({ complete: true });
    window.location.href = "./flashcards.html";

  } catch (error) {
    stopGenerationStatus();
    errorNode.hidden = false;
    errorNode.textContent = error.message || "Failed to generate flashcards.";
    flashcardsBtn.innerHTML = originalHTML;
    flashcardsBtn.disabled = false;
    if (generateBtn) generateBtn.disabled = false;
  }
  createIcons({ icons: { FileText, FileUp, Link, Plus, Play } });
});
