import { playCorrectSound, playWrongSound } from "./audio.js";

const sequenceNode = document.getElementById("sequenceDisplay");
const levelNode = document.getElementById("levelValue");
const form = document.getElementById("recallForm");
const input = document.getElementById("recallInput");
const feedback = document.getElementById("recallFeedback");
const startBtn = document.getElementById("startRecallBtn");

let level = 3;
let currentSequence = "";
let showing = false;
let revealTimeout = null;

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
  sequenceNode.className = "recall-hidden";
  sequenceNode.textContent = "Now type the sequence";
}

function startRound() {
  clearTimeout(revealTimeout);
  currentSequence = buildSequence(level);
  input.value = "";
  feedback.textContent = "";
  feedback.className = "arcade-feedback";
  showing = true;
  sequenceNode.className = "recall-sequence";
  sequenceNode.textContent = currentSequence;
  revealTimeout = window.setTimeout(hideSequence, 2600);
}

startBtn?.addEventListener("click", startRound);

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!currentSequence || showing) return;

  if (input.value.trim() === currentSequence) {
    playCorrectSound();
    feedback.textContent = "Correct. Next level unlocked.";
    feedback.className = "arcade-feedback good";
    level += 1;
  } else {
    playWrongSound();
    feedback.textContent = `Wrong. The correct sequence was ${currentSequence}.`;
    feedback.className = "arcade-feedback bad";
    level = Math.max(3, level - 1);
  }

  updateLevel();
  currentSequence = "";
  input.value = "";
});

updateLevel();
