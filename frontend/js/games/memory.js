const board = document.getElementById("memoryBoard");
const movesNode = document.getElementById("movesCount");
const timeNode = document.getElementById("timeCount");
const restartBtn = document.getElementById("restartGameBtn");

const ICONS = ["🌙", "⚡", "🧠", "🎯", "🌈", "🛰", "🎵", "⭐"];
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

function startTimer() {
  clearInterval(timerId);
  timerId = window.setInterval(() => {
    seconds += 1;
    timeNode.textContent = `${seconds}s`;
  }, 1000);
}

function updateStats() {
  movesNode.textContent = moves;
  timeNode.textContent = `${seconds}s`;
}

function resetGame() {
  clearInterval(timerId);
  cards = shuffle([...ICONS, ...ICONS]).map((icon, index) => ({ id: `${icon}-${index}`, icon, flipped: false, matched: false }));
  firstPick = null;
  secondPick = null;
  lockBoard = false;
  moves = 0;
  seconds = 0;
  updateStats();
  startTimer();
  render();
}

function render() {
  board.innerHTML = cards.map((card, index) => `
    <button class="memory-card ${card.flipped || card.matched ? "is-flipped" : ""} ${card.matched ? "is-matched" : ""}" data-index="${index}">
      <span class="memory-card-face memory-card-back">?</span>
      <span class="memory-card-face memory-card-front">${card.icon}</span>
    </button>
  `).join("");

  board.querySelectorAll(".memory-card").forEach((button) => {
    button.addEventListener("click", () => flipCard(Number(button.dataset.index)));
  });
}

function finishIfDone() {
  if (cards.every((card) => card.matched)) {
    clearInterval(timerId);
  }
}

function flipCard(index) {
  const card = cards[index];
  if (!card || lockBoard || card.flipped || card.matched) return;

  card.flipped = true;
  if (!firstPick) {
    firstPick = index;
    render();
    return;
  }

  secondPick = index;
  moves += 1;
  updateStats();
  render();

  const firstCard = cards[firstPick];
  const secondCard = cards[secondPick];

  if (firstCard.icon === secondCard.icon) {
    firstCard.matched = true;
    secondCard.matched = true;
    firstPick = null;
    secondPick = null;
    render();
    finishIfDone();
    return;
  }

  lockBoard = true;
  window.setTimeout(() => {
    firstCard.flipped = false;
    secondCard.flipped = false;
    firstPick = null;
    secondPick = null;
    lockBoard = false;
    render();
  }, 700);
}

restartBtn?.addEventListener("click", resetGame);
resetGame();
