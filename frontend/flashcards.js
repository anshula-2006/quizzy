import { getFlashDecks } from "./js/shared.js";

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
      <div class="empty-state-mini flash-empty-state">
        <h2 class="section-title">No flashcards found</h2>
        <p class="section-copy">Generate a deck first to start studying.</p>
        <a href="./generate.html" class="btn">Go Generate</a>
      </div>
    `;
    return;
  }

  let currentIndex = 0;

  function render() {
    const card = activeDeck.flashcards[currentIndex];
    const safeFront = String(card.front).replace(/"/g, "&quot;");
    root.innerHTML = `
      <p class="eyebrow">Flashcards</p>
      <h1 class="section-title flash-title">${activeDeck.title || "Study Deck"}</h1>
      <p class="section-copy flash-copy">Hover or focus the card to reveal the answer.</p>
      
      <div class="fc-board">
        <div class="fc-container" tabindex="0" role="button" aria-label="Flashcard: ${safeFront}. Focus to reveal answer.">
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
