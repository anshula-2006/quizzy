import { getFlashDecks, escapeHtml } from "./js/shared.js";

const root = document.getElementById("flashcardsRoot");

function init() {
  const decks = getFlashDecks();
  let activeDeck = null;
  try {
    const raw = localStorage.getItem("quizzy-active-deck");
    if (raw) activeDeck = JSON.parse(raw);
  } catch (e) {
  }

  if (!activeDeck || !activeDeck.flashcards) {
    if (decks.length > 0) activeDeck = decks[0];
  }

  if (!activeDeck || !activeDeck.flashcards || activeDeck.flashcards.length === 0) {
    root.innerHTML = `
      <div class="center-page flashcards-shell">
        <div class="panel flow-card empty-state flash-study-hero">
          <div>
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
            </div>
            <h3 class="section-title">No Flashcards</h3>
            <p class="section-copy">Generate a deck from a topic, URL, or PDF to start studying.</p>
          </div>
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
    const isWiki = activeDeck.sourceType === "wikipedia";
    const wikiLink = isWiki && activeDeck.sourceInput ? `<a href="${escapeHtml(activeDeck.sourceInput)}" target="_blank" style="display:inline-block; margin-top:8px; font-size:0.85rem; color:#3b82f6; text-decoration:underline;">Read Wikipedia Article</a>` : "";
    const progress = Math.round(((currentIndex + 1) / activeDeck.flashcards.length) * 100);
    const totalCards = decks.reduce((sum, deck) => sum + (Array.isArray(deck.flashcards) ? deck.flashcards.length : 0), 0);
    const sourceLabel = escapeHtml(activeDeck.sourceType || "Study");
    const deckRail = decks.length > 1 ? `
      <div class="deck-rail">
        ${decks.slice(0, 8).map((deck, index) => `
          <button class="btn-outline deck-switch-btn" data-deck-index="${index}" type="button" ${deck.id === activeDeck.id ? "aria-pressed=\"true\"" : ""}>
            ${escapeHtml(deck.title || `Deck ${index + 1}`)}
          </button>
        `).join("")}
      </div>
    ` : "";

    root.innerHTML = `
      <div class="flashcards-shell">
        <section class="panel flow-card flash-study-hero">
          <div>
            <span class="eyebrow">Study Deck</span>
            <h1 class="section-title">${escapeHtml(activeDeck.title || "Flashcards")}</h1>
            <p class="section-copy">Flip, review, and switch between your generated decks from one focused workspace.</p>
            ${wikiLink}
          </div>
          <div class="flash-study-actions">
            <a class="btn btn-primary" href="./generate.html">Create New Deck</a>
            <a class="btn btn-secondary" href="./dashboard.html">View Progress</a>
          </div>
        </section>

        ${deckRail}

        <div class="flash-study-stats">
          <article class="flash-study-stat">
            <span class="saas-stat-label">Current deck</span>
            <strong>${activeDeck.flashcards.length}</strong>
            <span class="section-copy">cards ready</span>
          </article>
          <article class="flash-study-stat">
            <span class="saas-stat-label">Library</span>
            <strong>${decks.length}</strong>
            <span class="section-copy">${totalCards} total cards</span>
          </article>
          <article class="flash-study-stat">
            <span class="saas-stat-label">Source</span>
            <strong>${sourceLabel}</strong>
            <span class="section-copy">generated deck</span>
          </article>
        </div>

        <div class="flash-study-grid">
          <section class="panel flow-card">
            <div class="progress-wrap">
              <div class="progress-head">
                <span>${currentIndex + 1} / ${activeDeck.flashcards.length}</span>
                <span class="fc-status">${progress}% complete</span>
              </div>
              <div class="mini-progress" aria-label="Flashcard progress"><span style="width:${progress}%"></span></div>
            </div>
            <div class="flash-viewer">
              <div class="flash-scene" id="fcContainer">
                <div class="flash-card-3d${isFlipped ? " is-flipped" : ""}" id="fcInner">
                  <div class="flash-face">
                    <span class="flash-face-badge">Question</span>
                    <div class="flash-face-copy">
                      <strong>${escapeHtml(card.front)}</strong>
                    </div>
                  </div>
                  <div class="flash-face flash-face-back">
                    <span class="flash-face-badge">Answer</span>
                    <div class="flash-face-copy">
                      <strong>${escapeHtml(card.back)}</strong>
                      ${card.hint ? `<span class="flash-answer-hint">Hint: ${escapeHtml(card.hint)}</span>` : ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="fc-controls">
              <button id="fcPrev" class="btn-outline" type="button" ${currentIndex === 0 ? "disabled" : ""}>Previous</button>
              <span class="fc-status">Card ${currentIndex + 1} of ${activeDeck.flashcards.length}</span>
              <button id="fcNext" class="btn-outline" type="button" ${currentIndex === activeDeck.flashcards.length - 1 ? "disabled" : ""}>Next</button>
            </div>
          </section>

          <aside class="flash-study-tip">
            <div>
              <span class="eyebrow">Study flow</span>
              <h2 class="heading-5" style="margin: 6px 0 0;">Use this deck actively</h2>
            </div>
            <p class="section-copy">Read the question, answer from memory, then click the card to reveal the answer.</p>
            <p class="section-copy">Move through the deck once, then generate another deck from the same topic for spaced practice.</p>
            <a class="btn btn-secondary" href="./generate.html">Generate More Cards</a>
          </aside>
        </div>
      </div>
    `;

    document.getElementById("fcContainer")?.addEventListener("click", () => {
      isFlipped = !isFlipped;
      render();
    });

    document.querySelectorAll(".deck-switch-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const nextDeck = decks[Number(button.dataset.deckIndex || 0)];
        if (!nextDeck) return;
        activeDeck = nextDeck;
        localStorage.setItem("quizzy-active-deck", JSON.stringify(nextDeck));
        currentIndex = 0;
        isFlipped = false;
        render();
      });
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
