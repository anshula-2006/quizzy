const sequenceNode = document.getElementById("sequenceDisplay");
const levelNode = document.getElementById("levelValue");
const form = document.getElementById("recallForm");
const input = document.getElementById("recallInput");
const feedback = document.getElementById("recallFeedback");
const startBtn = document.getElementById("startRecallBtn");

let level = 3;
let currentSequence = "";
let showing = false;

function buildSequence(length) {
  let value = "";
  for (let i = 0; i < length; i++) {
    value += String(Math.floor(Math.random() * 10));
  }
  return value;
}

function updateLevel() {
  levelNode.textContent = level;
}

function hideSequence() {
  showing = false;
  sequenceNode.innerHTML = `<span class="hidden-sequence">Now type the sequence</span>`;
}

function startRound() {
  currentSequence = buildSequence(level);
  input.value = "";
  feedback.textContent = "";
  showing = true;
  sequenceNode.innerHTML = `<span class="recall-sequence">${currentSequence}</span>`;
  window.setTimeout(hideSequence, 3000);
}

startBtn?.addEventListener("click", startRound);

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentSequence || showing) return;

  if (input.value.trim() === currentSequence) {
    feedback.textContent = "Correct ✅ Next level unlocked.";
    level += 1;
  } else {
    feedback.textContent = `Wrong ❌ The sequence was ${currentSequence}.`;
    level = Math.max(3, level - 1);
  }

  updateLevel();
  currentSequence = "";
  input.value = "";
});

updateLevel();
