import { getFlashDecks, escapeHtml } from "./js/shared.js";

const root = document.getElementById("flashcardsRoot");

function init() {
  let activeDeck = null;
  try {
    const raw = localStorage.getItem("quizzy-active-deck");
    if (raw) activeDeck = JSON.parse(raw);
  } catch (e) {
  }

  if (!activeDeck || !activeDeck.flashcards) {
    const decks = getFlashDecks();
    if (decks.length > 0) activeDeck = decks[0];
  }

  if (!activeDeck || !activeDeck.flashcards || activeDeck.flashcards.length === 0) {
    root.innerHTML = `
      <div class="center-page">
        <div class="panel flow-card empty-state" style="padding: 48px 32px; text-align: center; border: 1px dashed var(--line); max-width: 500px; width: 100%;">
          <div style="width: 48px; height: 48px; background: var(--panel-soft); border-radius: 50%; display: grid; place-items: center; margin: 0 auto 16px; border: 1px solid var(--line);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
          </div>
          <h3 style="font-size: 1.25rem; margin: 0 0 8px; font-weight: 600;">No Flashcards</h3>
          <p style="color: var(--muted); font-size: 0.9rem; margin: 0 0 24px;">Generate a deck from a topic, URL, or PDF to start studying.</p>
          <a href="./generate.html" class="btn">Create Deck</a>
        </div>
      </div>
    `;
    return;
  }

  let currentIndex = 0;
  let isFlipped = false;

  function render() {
    const card = activeDeck.flashcards[currentIndex];
    root.innerHTML = `
      <div style="max-width: 720px; margin: 0 auto; padding-top: 2vh;">
        <div style="text-align: center; margin-bottom: 32px;">
          <span class="saas-stat-label">Study Deck</span>
          <h1 style="font-size: 2rem; font-weight: 700; margin: 8px 0 0; letter-spacing: -0.03em;">${escapeHtml(activeDeck.title || "Flashcards")}</h1>
          <p style="color: var(--muted); font-size: 0.95rem; margin: 8px 0 0;">Tap the card to reveal the answer.</p>
        </div>
        
        <div style="perspective: 1000px; width: 100%; height: min(400px, 60vh); cursor: pointer;" id="fcContainer">
          <div id="fcInner" style="position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); transform-style: preserve-3d; ${isFlipped ? 'transform: rotateY(180deg);' : ''}">
            
            <!-- Front -->
            <div class="panel" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; border-radius: var(--radius-xl);">
              <span class="meta-chip" style="position: absolute; top: 24px; left: 24px;">Question</span>
              <h2 style="font-size: clamp(1.5rem, 4vw, 2.2rem); font-weight: 600; line-height: 1.4;">${escapeHtml(card.front)}</h2>
            </div>

            <!-- Back -->
            <div class="panel" style="position: absolute; width: 100%; height: 100%; backface-visibility: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; border-radius: var(--radius-xl); transform: rotateY(180deg); background: var(--panel-soft);">
              <span class="meta-chip" style="position: absolute; top: 24px; left: 24px; background: rgba(34, 197, 94, 0.15); color: var(--green);">Answer</span>
              <h2 style="font-size: clamp(1.5rem, 4vw, 2.2rem); font-weight: 600; line-height: 1.4;">${escapeHtml(card.back)}</h2>
              ${card.hint ? `<p style="margin: 24px 0 0; font-size: 0.95rem; color: var(--muted); padding: 12px 16px; background: rgba(255,255,255,0.03); border-radius: var(--radius-md); border: 1px solid var(--line);">💡 ${escapeHtml(card.hint)}</p>` : ""}
            </div>

          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 32px;">
          <button id="fcPrev" class="btn-outline" style="min-width: 100px;" ${currentIndex === 0 ? "disabled" : ""}>Previous</button>
          <span style="font-size: 0.9rem; font-weight: 600; color: var(--muted);">Card ${currentIndex + 1} of ${activeDeck.flashcards.length}</span>
          <button id="fcNext" class="btn-outline" style="min-width: 100px;" ${currentIndex === activeDeck.flashcards.length - 1 ? "disabled" : ""}>Next</button>
        </div>
      </div>
    `;

    document.getElementById("fcContainer")?.addEventListener("click", () => {
      isFlipped = !isFlipped;
      render();
    });

    document.getElementById("fcPrev")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentIndex > 0) {
        currentIndex--;
        isFlipped = false;
        render();
      }
    });

    document.getElementById("fcNext")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentIndex < activeDeck.flashcards.length - 1) {
        currentIndex++;
        isFlipped = false;
        render();
      }
    });
  }

  render();
}

init();