import { playCorrectSound, playWrongSound } from "./audio.js";
import { isLoggedIn, recordMemoryWin } from "../shared.js";

const board = document.getElementById("memoryBoard");
const movesNode = document.getElementById("movesCount");
const timeNode = document.getElementById("timeCount");
const restartBtn = document.getElementById("restartGameBtn");
const statusNode = document.getElementById("memoryStatus");

const MEMORY_IMAGES = [
  "aleksandr-isaev-rgP5gqM9INo-unsplash.jpg",
  "bryam-blanco-o3o3dq-nODE-unsplash.jpg",
  "christy-hinko-aE-gyTpRU2c-unsplash.jpg",
  "david-trinks-DT32nVCMXKk-unsplash.jpg",
  "debbie-molle-6DSID8Ey9-U-unsplash.jpg",
  "diane-helentjaris-tSseNCVa-Yo-unsplash.jpg",
  "elianna-friedman-uDeMugA9ojU-unsplash.jpg",
  "giorgio-trovato-fczCr7MdE7U-unsplash.jpg",
  "hamad-alahamad-6QaCUioE_nE-unsplash.jpg",
  "hamad-alahamad-bNuil3PcTSM-unsplash.jpg",
  "henry-fraczek-eByZOJr4pbE-unsplash.jpg",
  "maheera-kulsoom-lEpdF8D18zc-unsplash.jpg",
  "mockup-graphics-7qU176TIxDk-unsplash.jpg",
  "mockup-graphics-lDhhUl3Gp3Q-unsplash.jpg",
  "mockup-graphics-nZUQgW0FVnc-unsplash.jpg",
  "mockup-graphics-q7BJL1qZ1Bw-unsplash.jpg",
  "mockup-graphics-xIfhcoVwAjc-unsplash.jpg",
  "mockup-graphics-XiWQbLEhFyo-unsplash.jpg",
  "personalgraphic-com-_Ef2SUNv468-unsplash.jpg",
  "phuong-nguyen-O6bVl2bmgAA-unsplash.jpg",
  "rich-dahlgren--MMRAIrqgUE-unsplash.jpg"
].map((filename) => new URL(`../../assets/memory-game/${filename}`, import.meta.url).href);

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

function preloadImages(images) {
  return Promise.all(images.map((src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  })));
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
  setStatus("Loading image deck...");
  board.innerHTML = "";

  try {
    await preloadImages(basePairs.map((pair) => pair.image));
  } catch {
    setStatus("Memory images could not load. Please try restarting.", "bad");
    return;
  }

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
  setStatus("Match every pair as fast as you can.");
  startTimer();
  render();
}

function render() {
  if (!board) return;

  board.innerHTML = cards.map((card, index) => `
    <button class="memory-card ${card.flipped || card.matched ? "is-flipped" : ""} ${card.matched ? "is-matched" : ""} ${card.wrong ? "is-wrong" : ""}" data-index="${index}" type="button">
      <span class="memory-card-shell">
        <span class="memory-card-face memory-card-front">Flip</span>
        <span class="memory-card-face memory-card-back"><img src="${card.image}" alt="Memory tile" /></span>
      </span>
    </button>
  `).join("");

  board.querySelectorAll(".memory-card").forEach((button) => {
    button.addEventListener("click", () => flipCard(Number(button.dataset.index)));
  });
}

function clearWrongState() {
  cards.forEach((card) => {
    card.wrong = false;
  });
}

function flipCard(index) {
  const card = cards[index];
  if (!card || lockBoard || card.flipped || card.matched) return;

  clearWrongState();
  card.flipped = true;
  render();

  if (firstPick == null) {
    firstPick = index;
    return;
  }

  secondPick = index;
  moves += 1;
  updateStats();

  const firstCard = cards[firstPick];
  const secondCard = cards[secondPick];

  if (firstCard.pairId === secondCard.pairId) {
    firstCard.matched = true;
    secondCard.matched = true;
    playCorrectSound();
    setStatus("Match found.", "good");
    firstPick = null;
    secondPick = null;
    render();
    finishIfDone();
    return;
  }

  firstCard.wrong = true;
  secondCard.wrong = true;
  lockBoard = true;
  playWrongSound();
  setStatus("Not a match. Try again.", "bad");
  render();

  window.setTimeout(() => {
    firstCard.flipped = false;
    secondCard.flipped = false;
    firstCard.wrong = false;
    secondCard.wrong = false;
    firstPick = null;
    secondPick = null;
    lockBoard = false;
    render();
  }, 720);
}

restartBtn?.addEventListener("click", () => {
  resetGame();
});

resetGame();
