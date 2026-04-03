import { playCorrectSound, playWrongSound } from "./audio.js";
import { isLoggedIn, recordMemoryWin, spawnFloatingXP } from "../shared.js";

// DOM
const board = document.getElementById("memoryBoard");
const movesNode = document.getElementById("movesCount");
const timeNode = document.getElementById("timeCount");
const restartBtn = document.getElementById("restartGameBtn");
const statusNode = document.getElementById("memoryStatus");

// ✅ FIXED IMAGE PATHS
const MEMORY_IMAGES = [
  "/assets/memory-game/image1.jpg",
  "/assets/memory-game/image2.jpg",
  "/assets/memory-game/image3.jpg",
  "/assets/memory-game/image4.jpg",
  "/assets/memory-game/image5.jpg",
  "/assets/memory-game/image6.jpg",
  "/assets/memory-game/image7.jpg",
  "/assets/memory-game/image8.jpg"
];

const FALLBACK_EMOJIS = ["🚀", "🎸", "👾", "🌟", "🍔", "🏆", "🔥", "💎"];

// STATE
let cards = [];
let firstPick = null;
let secondPick = null;
let lockBoard = false;
let moves = 0;
let seconds = 0;
let timerId = null;
let gameState = "START";

// UTIL
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function setStatus(msg, tone = "") {
  if (!statusNode) return;
  statusNode.textContent = msg;
  statusNode.className = `arcade-feedback ${tone}`;
}

function updateStats() {
  if (movesNode) movesNode.textContent = moves;
  if (timeNode) timeNode.textContent = `${seconds}s`;
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    seconds++;
    updateStats();
  }, 1000);
}

// GAME SETUP
function createCards() {
  const selected = shuffle(MEMORY_IMAGES).slice(0, 8);

  const deck = [];
  selected.forEach((content, pairIndex) => {
    deck.push({ content, pairIndex, flipped: false, matched: false });
    deck.push({ content, pairIndex, flipped: false, matched: false });
  });

  return shuffle(deck).map((card, id) => ({ ...card, id }));
}

function resetGame() {
  gameState = "PLAYING";

  cards = createCards();
  firstPick = null;
  secondPick = null;
  lockBoard = false;
  moves = 0;
  seconds = 0;

  updateStats();
  setStatus("Game started 🔥");

  startTimer();
  renderBoard();
}

// RENDER (FIXED STRUCTURE)
function renderBoard() {
  board.innerHTML = cards
    .map(
      (card, i) => `
      <div class="memory-card ${card.flipped ? "is-flipped" : ""} ${card.matched ? "is-matched" : ""}" data-index="${i}">
        <div class="memory-card-shell">
          <div class="memory-card-face memory-card-front">?</div>
          <div class="memory-card-face memory-card-back">
            <img src="${card.content}" class="memory-card-img" data-pair="${card.pairIndex}" />
          </div>
        </div>
      </div>
    `
    )
    .join("");

  document.querySelectorAll(".memory-card").forEach((el) => {
    el.addEventListener("click", () => flipCard(+el.dataset.index));
  });

  // fallback
  document.querySelectorAll(".memory-card-img").forEach((img) => {
    img.addEventListener("error", function () {
      const fallback = document.createElement("span");
      fallback.className = "emoji-card";
      fallback.textContent = FALLBACK_EMOJIS[this.dataset.pair];
      this.replaceWith(fallback);
    });
  });
}

// GAME LOGIC
function flipCard(index) {
  if (gameState !== "PLAYING") return;

  const card = cards[index];
  if (!card || lockBoard || card.flipped || card.matched) return;

  card.flipped = true;
  updateCardDOM(index);

  if (firstPick === null) {
    firstPick = index;
    return;
  }

  secondPick = index;
  lockBoard = true;

  moves++;
  updateStats();

  const first = cards[firstPick];
  const second = cards[secondPick];

  if (first.content === second.content) {
    first.matched = true;
    second.matched = true;

    try { playCorrectSound(); } catch {}

    resetTurn();
    checkWin();
  } else {
    try { playWrongSound(); } catch {}

    setTimeout(() => {
      first.flipped = false;
      second.flipped = false;
      updateCardDOM(firstPick);
      updateCardDOM(secondPick);
      resetTurn();
    }, 800);
  }
}

function updateCardDOM(index) {
  const el = document.querySelector(`.memory-card[data-index="${index}"]`);
  if (!el) return;

  const card = cards[index];

  el.classList.toggle("is-flipped", card.flipped);
  el.classList.toggle("is-matched", card.matched);
}

function resetTurn() {
  firstPick = null;
  secondPick = null;
  lockBoard = false;
}

// WIN + XP (ALREADY CONNECTED)
async function checkWin() {
  if (cards.every((c) => c.matched)) {
    gameState = "OVER";
    clearInterval(timerId);

    setStatus(`🎉 Completed in ${moves} moves & ${seconds}s`);

    if (isLoggedIn()) {
      const res = await recordMemoryWin({ moves, seconds });

      if (res?.gamification?.xpEarned) {
        spawnFloatingXP(res.gamification.xpEarned);
      }
    }
  }
}

// EVENTS
restartBtn?.addEventListener("click", resetGame);

// INIT
resetGame();