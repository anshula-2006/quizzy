import { playCorrectSound, playWrongSound } from "./audio.js";
import { isLoggedIn, recordRecallAttempt, spawnFloatingXP } from "../shared.js";

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
  if (levelNode) levelNode.textContent = level;
}

function hideSequence() {
  showing = false;
  if (sequenceNode) {
    sequenceNode.className = "recall-hidden fade-in";
    sequenceNode.textContent = "Now type the sequence";
  }
  if (input) {
    input.disabled = false;
    input.focus();
  }
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = false;
  }
}

function initGame() {
  level = 3;
  updateLevel();
  if (sequenceNode) {
    sequenceNode.textContent = "Ready to test your memory?";
    sequenceNode.className = "recall-hidden";
  }
  if (input) {
    input.disabled = true;
    input.value = "";
  }
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
  }
  if (startBtn) {
    startBtn.style.display = "inline-block";
    startBtn.textContent = "Start Game";
  }
  if (feedback) {
    feedback.textContent = "";
    feedback.className = "arcade-feedback";
  }
}

function startRound() {
  clearTimeout(revealTimeout);
  currentSequence = buildSequence(level);

  if (startBtn) startBtn.style.display = "none";
  if (input) {
    input.value = "";
    input.disabled = true;
  }
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
  }
  if (feedback) {
    feedback.textContent = "";
    feedback.className = "arcade-feedback";
  }

  showing = true;
  if (sequenceNode) {
    sequenceNode.className = "recall-sequence fade-in";
    sequenceNode.textContent = currentSequence;
  }

  const displayTime = 1500 + (level * 400); // Scales slightly with difficulty
  revealTimeout = window.setTimeout(hideSequence, displayTime);
}

startBtn?.addEventListener("click", startRound);

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentSequence || showing) return;

  const userGuess = input.value.trim();

  if (userGuess === currentSequence) {
    playCorrectSound();
    if (feedback) {
      feedback.textContent = "Checking...";
      feedback.className = "arcade-feedback good fade-in";
    }
    const res = await recordRecallAttempt(level);
    if (res?.gamification?.xpEarned) {
      spawnFloatingXP(res.gamification.xpEarned);
    }

    if (feedback) {
      feedback.textContent = "Correct! Next level unlocked.";
      feedback.className = "arcade-feedback good fade-in";
    }
    level += 1;
  } else {
    playWrongSound();
    if (feedback) {
      feedback.textContent = `Wrong! The correct sequence was ${currentSequence}.`;
      feedback.className = "arcade-feedback bad fade-in";
    }
    level = Math.max(3, level - 1); // Fallback to min level 3
  }

  if (!isLoggedIn() && feedback) {
    feedback.textContent += " Log in to save progress.";
  }

  updateLevel();
  currentSequence = "";

  if (input) {
    input.value = "";
    input.disabled = true;
  }
  if (form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
  }

  if (startBtn) {
    startBtn.style.display = "inline-block";
    startBtn.textContent = "Next Round";
  }
});

// INIT
initGame();
