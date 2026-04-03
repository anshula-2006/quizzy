import { playCorrectSound, playWrongSound } from "./audio.js";
import { isLoggedIn, recordMemoryWin, spawnFloatingXP } from "../shared.js";

// DOM
const board = document.getElementById("memoryBoard");
const movesNode = document.getElementById("movesCount");
const timeNode = document.getElementById("timeCount");
const restartBtn = document.getElementById("restartGameBtn");
const statusNode = document.getElementById("memoryStatus");

// ✅ STATIC PATHS FOR VERCEL
// Files placed in /public/assets/ will correctly resolve to /assets/... in production
const MEMORY_IMAGES = [
  "/assets/memory-game/1.png",
  "/assets/memory-game/2.png",
  "/assets/memory-game/3.png",
  "/assets/memory-game/4.png",
  "/assets/memory-game/5.png",
  "/assets/memory-game/6.png",
  "/assets/memory-game/7.png",
  "/assets/memory-game/8.png"
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
let gameState = "START"; // START, PLAYING, OVER

// UTIL
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function setStatus(msg, tone = "") {
  if (!statusNode) return;
  statusNode.textContent = msg;
  statusNode.className = `arcade-feedback fade-in ${tone}`;
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
    // Store pairIndex so fallback emojis always visually match for identical image paths
    deck.push({ content, pairIndex, isEmoji: false, flipped: false, matched: false });
    deck.push({ content, pairIndex, isEmoji: false, flipped: false, matched: false });
  });

  return shuffle(deck).map((card, id) => ({ ...card, id }));
}

function initGame() {
  gameState = "START";
  setStatus("Ready to play? Click Start!", "info");
  if (board) {
    board.innerHTML = `
      <div class="game-start-screen">
        <h2>Memory Match</h2>
        <p>Find all the matching pairs as quickly as possible!</p>
        <button id="startGameBtn" class="arcade-btn primary">Start Game</button>
      </div>
    `;
    document.getElementById("startGameBtn")?.addEventListener("click", resetGame);
  }
}

function resetGame() {
  if (!board) return;

  gameState = "PLAYING";
  clearInterval(timerId);

  cards = createCards();
  firstPick = null;
  secondPick = null;
  lockBoard = false;
  moves = 0;
  seconds = 0;

  updateStats();
  setStatus("Game started. Match the pairs 🔥", "info");
  startTimer();
  renderBoard();
}

// RENDER
function renderBoard() {
  if (!board) return;

  board.innerHTML = cards
    .map(
      (card, i) => `
      <div class="memory-card" data-index="${i}">
        <div class="front">?</div>
        <div class="back">
          ${
            card.isEmoji
              ? `<span class="emoji-card">${card.content}</span>`
              : `<img src="${card.content}" alt="card" onerror="this.outerHTML='<span class=&quot;emoji-card&quot;>${FALLBACK_EMOJIS[card.pairIndex]}</span>'"/>`
          }
        </div>
      </div>
    `
    )
    .join("");

  document.querySelectorAll(".memory-card").forEach((el) => {
    el.addEventListener("click", () => flipCard(+el.dataset.index));
  });
}

// GAME LOGIC
function flipCard(index) {
  if (gameState !== "PLAYING") return;
  const card = cards[index];

  // Prevent clicking matched, flipped, or clicking when board is locked
  if (!card || lockBoard || card.flipped || card.matched) return;

  card.flipped = true;
  updateCardDOM(index);

  if (firstPick === null) {
    firstPick = index;
    return;
  }

  secondPick = index;
  lockBoard = true; // Lock board explicitly
  moves++;
  updateStats();

  const first = cards[firstPick];
  const second = cards[secondPick];

  if (first.content === second.content) {
    first.matched = true;
    second.matched = true;
    try { playCorrectSound(); } catch (e) {}

    resetTurn();
    checkWin();
  } else {
    try { playWrongSound(); } catch (e) {}

    setTimeout(() => {
      first.flipped = false;
      second.flipped = false;
      updateCardDOM(firstPick);
      updateCardDOM(secondPick);
      resetTurn();
    }, 1000);
  }
}

function updateCardDOM(index) {
  const el = document.querySelector(`.memory-card[data-index="${index}"]`);
  if (!el) return;

  const card = cards[index];
  el.classList.toggle("flip", card.flipped || card.matched);
}

function resetTurn() {
  firstPick = null;
  secondPick = null;
  lockBoard = false;
}

async function checkWin() {
  if (cards.every((c) => c.matched)) {
    gameState = "OVER";
    clearInterval(timerId);

    setStatus(`🎉 Completed in ${moves} moves & ${seconds}s. Saving...`, "good");

    setTimeout(() => {
      if (board) {
        board.innerHTML = `
          <div class="game-over-screen">
            <h2>Victory! 🎉</h2>
            <p>Moves: ${moves}</p>
            <p>Time: ${seconds}s</p>
            <button id="playAgainBtn" class="arcade-btn primary">Play Again</button>
          </div>
        `;
        document.getElementById("playAgainBtn")?.addEventListener("click", resetGame);
      }
    }, 800);

    if (isLoggedIn()) {
      const res = await recordMemoryWin({ moves, seconds });
      if (res?.gamification?.xpEarned) {
        spawnFloatingXP(res.gamification.xpEarned);
      }
      setStatus(`🎉 Completed in ${moves} moves & ${seconds}s`, "good");
    } else {
      setStatus(`🎉 Completed in ${moves} moves & ${seconds}s`, "good");
    }
  }
}

// EVENTS
restartBtn?.addEventListener("click", resetGame);

// INIT
initGame();