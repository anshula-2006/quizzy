import { playCorrectSound, playWrongSound } from "./audio.js";
import { isLoggedIn, recordReactionAttempt, spawnFloatingXP } from "../shared.js";

const stage = document.getElementById("reactionStage");
const statusNode = document.getElementById("reactionStatus");
const bestNode = document.getElementById("bestReaction");
const startBtn = document.getElementById("startReactionBtn");

let timeoutId = null;
let startedAt = 0;
let waiting = false;
let ready = false;
let bestTime = null;

function renderStatus(title, copy = "", result = "") {
  if (!statusNode) return;

  if (result) {
    statusNode.innerHTML = `
      <div class="reaction-result fade-in">
        <div class="reaction-time">${result}</div>
        <p class="reaction-note">${copy}</p>
      </div>
    `;
    return;
  }

  statusNode.innerHTML = `
    <div class="reaction-stage-inner fade-in">
      <div class="reaction-label">${title}</div>
      ${copy ? `<p class="reaction-caption">${copy}</p>` : ""}
    </div>
  `;
}

function resetStage() {
  if (!stage) return;
  stage.className = "reaction-stage idle";
  ready = false;
  waiting = false;
  startedAt = 0;
  renderStatus("Reaction Tap", "Press start to begin a round.");
  if (startBtn) {
    startBtn.style.display = "inline-block";
    startBtn.textContent = "Start Game";
  }
}

function beginRound() {
  clearTimeout(timeoutId);
  if (startBtn) startBtn.style.display = "none";
  waiting = true;
  ready = false;
  if (stage) stage.className = "reaction-stage waiting";
  renderStatus("Wait for Green...", "Do not click until the screen changes.");

  const delay = 2000 + Math.floor(Math.random() * 3000);
  timeoutId = window.setTimeout(() => {
    waiting = false;
    ready = true;
    startedAt = performance.now();
    if (stage) stage.className = "reaction-stage ready";
    renderStatus("TAP NOW!", "Click as fast as you can!");
  }, delay);
}

startBtn?.addEventListener("click", beginRound);

stage?.addEventListener("click", async (e) => {
  if (stage.classList.contains('idle')) return; // Ignore early pre-game clicks

  if (waiting) {
    clearTimeout(timeoutId);
    waiting = false;
    ready = false;
    if (stage) stage.className = "reaction-stage error";
    renderStatus("Too early!", "Wait for the green signal before tapping.");
    playWrongSound();
    if (startBtn) {
      startBtn.style.display = "inline-block";
      startBtn.textContent = "Try Again";
    }
    return;
  }

  if (!ready) return;

  const reaction = Math.round(performance.now() - startedAt);
  ready = false;
  if (stage) stage.className = "reaction-stage result";
  
  renderStatus(`${reaction} ms`, "Saving...", `${reaction} ms`);
  const res = await recordReactionAttempt(reaction);
  if (res?.gamification?.xpEarned) {
    spawnFloatingXP(res.gamification.xpEarned, e.clientX, e.clientY);
  }

  if (bestTime == null || reaction < bestTime) {
    playCorrectSound();
    bestTime = reaction;
    if (bestNode) bestNode.textContent = `${bestTime} ms`;
    renderStatus(`${reaction} ms`, isLoggedIn() ? "New Best Time!" : "Log in to save your best time.", `${reaction} ms`);
  } else {
    playCorrectSound();
    renderStatus(`${reaction} ms`, isLoggedIn() ? "Solid response time." : "Log in to save your history.", `${reaction} ms`);
  }

  if (startBtn) {
    startBtn.style.display = "inline-block";
    startBtn.textContent = "Play Again";
  }
});

// INIT
resetStage();
