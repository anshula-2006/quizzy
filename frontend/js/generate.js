import { extractContent, requestQuiz, requestFlashcards, setQuizState, setResultState, addFlashDeck, getSession, getSavedQuizHistory, getFlashDecks, escapeHtml } from "./shared.js";
import { createIcons, FileText, FileUp, Link, Plus, Play } from 'lucide';

const sourceCards = document.querySelectorAll("[data-source]");
const topicInput = document.getElementById("topicInput") || document.getElementById("inputText");
const urlInput = document.getElementById("urlInput");
const pdfInput = document.getElementById("pdfInput");
const difficultySelect = document.getElementById("difficultySelect");
const modeSelect = document.getElementById("modeSelect");
const languageSelect = document.getElementById("languageSelect");
const countSelect = document.getElementById("countSelect");
const learnerModeSelect = document.getElementById("learnerMode");
const modeDescNode = document.getElementById("modeDesc");
const sourceHint = document.getElementById("sourceHint");
const form = document.getElementById("generateForm");
const flashcardsBtn = document.getElementById("flashcardsBtn");
const generateBtn = document.getElementById("generateBtn");
const errorNode = document.getElementById("generateError");

let activeSource = "text";

const modeDescriptions = {
  focus: "Deep, distraction-free learning. Best for mastering new topics at your own pace.",
  arcade: "Fast-paced, gamified. Earn XP, build streaks, and compete.",
  exam: "Strict timer and realistic exam conditions. Tests your readiness under pressure.",
  revision: "Focus on weak topics with detailed explanations and common pitfalls."
};

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
  const recentQuizzes = history.slice(0, 3);
  const lastAttempt = history[0];

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
                  <a href="?topic=${encodeURIComponent(weakest.topic)}&mode=revision&auto=flashcards" class="btn-outline" style="padding: 4px 10px; font-size: 0.75rem;">Review Flashcards</a>
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

if (difficultySelect && !Array.from(difficultySelect.options).some(o => o.value === 'current_events')) {
  const opt = document.createElement('option');
  opt.value = 'current_events';
  opt.textContent = 'Current Events';
  difficultySelect.appendChild(opt);
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

if (prefillCount && countSelect) {
  let opt = Array.from(countSelect.options).find(o => o.value === prefillCount);
  if (!opt) {
    opt = document.createElement("option");
    opt.value = prefillCount;
    opt.textContent = `${prefillCount} Questions`;
    countSelect.appendChild(opt);
  }
  countSelect.value = prefillCount;
}

sourceCards.forEach((card) => {
  card.addEventListener("click", () => setSource(card.dataset.source));
});

if (autoGenerate === "flashcards" && flashcardsBtn && prefillTopic) {
  setTimeout(() => flashcardsBtn.click(), 100);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorNode.hidden = true;
  const originalText = generateBtn?.textContent || "Generate Quiz";
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.innerHTML = `<i data-lucide="play" style="width: 16px; height: 16px; margin-right: 4px;"></i> Preparing...`;
  }
  if (flashcardsBtn) flashcardsBtn.disabled = true;

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
      generateBtn.innerHTML = originalText;
    }
    if (flashcardsBtn) flashcardsBtn.disabled = false;
  }
  createIcons({ icons: { FileText, FileUp, Link, Plus, Play } });
});

renderWorkspace();

flashcardsBtn?.addEventListener("click", async (event) => {
  event.preventDefault();
  errorNode.hidden = true;
  const originalHTML = flashcardsBtn.innerHTML;
  flashcardsBtn.innerHTML = `<i data-lucide="plus" style="width: 16px; height: 16px; margin-right: 4px;"></i> Generating...`;
  flashcardsBtn.disabled = true;

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
    window.location.href = "./flashcards.html";

  } catch (error) {
    errorNode.hidden = false;
    errorNode.textContent = error.message || "Failed to generate flashcards.";
    flashcardsBtn.innerHTML = originalHTML;
    flashcardsBtn.disabled = false;
  }
  createIcons({ icons: { FileText, FileUp, Link, Plus, Play } });
});
