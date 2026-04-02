import { playCorrectSound, playWrongSound } from "./audio.js";
import { isLoggedIn, recordMemoryWin } from "../shared.js";

// DOM
const board = document.getElementById("memoryBoard");
const movesNode = document.getElementById("movesCount");
const timeNode = document.getElementById("timeCount");
const restartBtn = document.getElementById("restartGameBtn");
const statusNode = document.getElementById("memoryStatus");

// ✅ LOAD IMAGES FROM frontend/assets
const imageModules = import.meta.glob(
  "../../assets/memory-game/*.{jpg,jpeg,png,webp}",
  { eager: true, import: "default" }
);

const MEMORY_IMAGES = Object.values(imageModules);

// STATE
let cards = [];
let firstPick = null;
let secondPick = null;
let lockBoard = false;
let moves = 0;
let seconds = 0;
let timerId = null;

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
  if (MEMORY_IMAGES.length === 0) {
    console.log("❌ No images loaded:", imageModules);
    setStatus("Images failed to load 💀 Check path.", "bad");
    return [];
  }

  const selected = shuffle(MEMORY_IMAGES).slice(0, 8);

  return shuffle(
    [...selected, ...selected].map((img, i) => ({
      id: i,
      image: img,
      flipped: false,
      matched: false,
    }))
  );
}

function resetGame() {
  if (!board) return;

  clearInterval(timerId);

  cards = createCards();
  firstPick = null;
  secondPick = null;
  lockBoard = false;
  moves = 0;
  seconds = 0;

  updateStats();
  setStatus("Game started. Match the pairs 🔥");
  startTimer();
  render();
}

// RENDER
function render() {
  if (!board) return;

  board.innerHTML = cards
    .map(
      (card, i) => `
      <div class="memory-card ${card.flipped || card.matched ? "flip" : ""}" data-index="${i}">
        <div class="front">?</div>
        <div class="back">
          <img src="${card.image}" alt="card"/>
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
  const card = cards[index];

  if (!card || lockBoard || card.flipped || card.matched) return;

  card.flipped = true;
  updateCard(index);

  if (firstPick === null) {
    firstPick = index;
    return;
  }

  secondPick = index;
  moves++;
  updateStats();

  const first = cards[firstPick];
  const second = cards[secondPick];

  if (first.image === second.image) {
    first.matched = true;
    second.matched = true;
    playCorrectSound();

    resetTurn();
    checkWin();
  } else {
    lockBoard = true;
    playWrongSound();

    setTimeout(() => {
      first.flipped = false;
      second.flipped = false;
      updateCard(firstPick);
      updateCard(secondPick);
      resetTurn();
    }, 800);
  }
}

function updateCard(index) {
  const el = document.querySelector(`[data-index="${index}"]`);
  if (!el) return;

  el.classList.toggle("flip", cards[index].flipped || cards[index].matched);
}

function resetTurn() {
  firstPick = null;
  secondPick = null;
  lockBoard = false;
}

function checkWin() {
  if (cards.every((c) => c.matched)) {
    clearInterval(timerId);

    setStatus(`🎉 Completed in ${moves} moves & ${seconds}s`, "good");

    if (isLoggedIn()) {
      recordMemoryWin({ moves, seconds });
    }
  }
}

// EVENTS
restartBtn?.addEventListener("click", resetGame);

// INIT
resetGame();