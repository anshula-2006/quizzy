import { getFlashDecks } from "./shared.js";

const root = document.getElementById("flashcardsRoot");

function init() {
  let activeDeck = null;
  try {
    const raw = localStorage.getItem("quizzy-active-deck");
    if (raw) activeDeck = JSON.parse(raw);
  } catch (e) {
    // ignore parsing errors
  }

  if (!activeDeck || !activeDeck.flashcards) {
    const decks = getFlashDecks();
    if (decks.length > 0) activeDeck = decks[0];
  }

  if (!activeDeck || !activeDeck.flashcards || activeDeck.flashcards.length === 0) {
    root.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem;">
        <h2 class="section-title">No flashcards found</h2>
        <p class="section-copy" style="margin-top: 1rem;">Generate a deck first to start studying.</p>
        <a href="./generate.html" class="btn" style="margin-top: 2rem; display: inline-block;">Go Generate</a>
      </div>
    `;
    return;
  }

  let currentIndex = 0;

  function render() {
    const card = activeDeck.flashcards[currentIndex];
    root.innerHTML = `
      <p class="eyebrow">Flashcards</p>
      <h1 class="section-title" style="text-align:center;">${activeDeck.title || "Study Deck"}</h1>
      <p class="section-copy" style="text-align:center; margin-bottom: 2rem;">Hover your mouse over the card to reveal the answer.</p>
      
      <div class="fc-board">
        <div class="fc-container">
          <div class="fc-inner">
            <div class="fc-front">
              <span class="fc-badge">Question</span>
              <strong>${card.front}</strong>
            </div>
            <div class="fc-back">
              <span class="fc-badge">Answer</span>
              <strong>${card.back}</strong>
              ${card.hint ? `<p class="fc-hint">Hint: ${card.hint}</p>` : ""}
            </div>
          </div>
        </div>
        
        <div class="fc-controls">
          <button id="fcPrev" class="btn-outline" ${currentIndex === 0 ? "disabled" : ""}>Previous</button>
          <span class="fc-status">Card ${currentIndex + 1} of ${activeDeck.flashcards.length}</span>
          <button id="fcNext" class="btn" ${currentIndex === activeDeck.flashcards.length - 1 ? "disabled" : ""}>Next</button>
        </div>
      </div>
    `;
    document.getElementById("fcPrev")?.addEventListener("click", () => { if (currentIndex > 0) { currentIndex--; render(); } });
    document.getElementById("fcNext")?.addEventListener("click", () => { if (currentIndex < activeDeck.flashcards.length - 1) { currentIndex++; render(); } });
  }
  render();
}

init();