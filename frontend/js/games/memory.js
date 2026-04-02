import { playCorrectSound, playWrongSound } from "./audio.js";
import { isLoggedIn, recordMemoryWin } from "../shared.js";

const board = document.getElementById("memoryBoard");
const movesNode = document.getElementById("movesCount");
const timeNode = document.getElementById("timeCount");
const restartBtn = document.getElementById("restartGameBtn");
const statusNode = document.getElementById("memoryStatus");

const imageModules = import.meta.glob("../../assets/memory-game/*.{jpg,jpeg,png,webp}", { eager: true, as: "url" });
const MEMORY_IMAGES = Object.values(imageModules)
  .map((mod) => (typeof mod === "string" ? mod : mod?.default))
  .filter(Boolean);

let cards = [];
let firstPick = null;
let secondPick = null;
let lockBoard = false;
let moves = 0;
let seconds = 0;
let timerId = null;

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function setStatus(message, tone = "") {
  if (!statusNode) return;
  statusNode.textContent = message;
  statusNode.className = `arcade-feedback${tone ? ` ${tone}` : ""}`;
}

function updateStats() {
  if (movesNode) movesNode.textContent = moves;
  if (timeNode) timeNode.textContent = `${seconds}s`;
}

function startTimer() {
  clearInterval(timerId);
  timerId = window.setInterval(() => {
    seconds += 1;
    updateStats();
  }, 1000);
}

function finishIfDone() {
  if (cards.every((card) => card.matched)) {
    clearInterval(timerId);
    recordMemoryWin({ moves, seconds });
    setStatus(`Board cleared in ${moves} moves and ${seconds}s.`, "good");
    if (!isLoggedIn()) {
      setStatus(`Board cleared in ${moves} moves and ${seconds}s. Log in to save this run.`, "good");
    }
  }
}

function buildDeck() {
  return shuffle(MEMORY_IMAGES)
    .slice(0, 8)
    .map((image, index) => ({
      pairId: `pair-${index}`,
      image
    }));
}

async function resetGame() {
  if (!board) return;

  clearInterval(timerId);
  const basePairs = buildDeck();

  cards = shuffle([...basePairs, ...basePairs].map((entry, index) => ({
    id: `${entry.pairId}-${index}`,
    pairId: entry.pairId,
    image: entry.image,
    flipped: false,
    matched: false,
    wrong: false
  })));

  firstPick = null;
  secondPick = null;
  lockBoard = false;
  moves = 0;
  seconds = 0;
  updateStats();
  setStatus("Deck ready. Flip cards to reveal the images.");
  startTimer();
  render();
}

function render() {
  if (!board) return;

  board.innerHTML = cards.map((card, index) => `
    <button class="memory-card ${card.flipped || card.matched ? "is-flipped" : ""} ${card.matched ? "is-matched" : ""} ${card.wrong ? "is-wrong" : ""}" data-index="${index}" type="button">
      <span class="memory-card-shell">
        <span class="memory-card-face memory-card-front">Flip</span>
        <span class="memory-card-face memory-card-back"><img src="${card.image}" alt="Memory tile" loading="lazy" decoding="async" /></span>
      </span>
    </button>
  `).join("");

  board.querySelectorAll(".memory-card").forEach((button) => {
    button.addEventListener("click", () => flipCard(Number(button.dataset.index)));
  });
}

function clearWrongState() {
  cards.forEach((card, index) => {
    if (card.wrong) {
      card.wrong = false;
      updateCardDOM(index);
    }
  });
}

function updateCardDOM(index) {
  const card = cards[index];
  const node = board.querySelector(`[data-index="${index}"]`);
  if (!node) return;

  node.classList.toggle("is-flipped", card.flipped || card.matched);
  node.classList.toggle("is-matched", card.matched);
  node.classList.toggle("is-wrong", card.wrong);
}

function flipCard(index) {
  const card = cards[index];
  if (!card || lockBoard || card.flipped || card.matched) return;

  clearWrongState();
  card.flipped = true;
  updateCardDOM(index);

  if (firstPick == null) {
    firstPick = index;
    return;
  }

  secondPick = index;
  moves += 1;
  updateStats();

  const firstCard = cards[firstPick];
  const secondCard = cards[secondPick];
  const currentFirstPick = firstPick;
  const currentSecondPick = secondPick;

  if (firstCard.pairId === secondCard.pairId) {
    firstCard.matched = true;
    secondCard.matched = true;
    playCorrectSound();
    setStatus("Match found.", "good");
    firstPick = null;
    secondPick = null;
    updateCardDOM(currentFirstPick);
    updateCardDOM(currentSecondPick);
    finishIfDone();
    return;
  }

  firstCard.wrong = true;
  secondCard.wrong = true;
  lockBoard = true;
  playWrongSound();
  setStatus("Not a match. Try again.", "bad");
  updateCardDOM(currentFirstPick);
  updateCardDOM(currentSecondPick);

  window.setTimeout(() => {
    firstCard.flipped = false;
    secondCard.flipped = false;
    firstCard.wrong = false;
    secondCard.wrong = false;
    firstPick = null;
    secondPick = null;
    lockBoard = false;
    updateCardDOM(currentFirstPick);
    updateCardDOM(currentSecondPick);
  }, 720);
}

restartBtn?.addEventListener("click", () => {
  resetGame();
});

resetGame();
