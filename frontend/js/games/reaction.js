import { playCorrectSound, playWrongSound } from "./audio.js";
import { isLoggedIn, recordReactionAttempt } from "../shared.js";

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
  if (result) {
    statusNode.innerHTML = `
      <div class="reaction-result">
        <div class="reaction-time">${result}</div>
        <p class="reaction-note">${copy}</p>
      </div>
    `;
    return;
  }

  statusNode.innerHTML = `
    <div class="reaction-stage-inner">
      <div class="reaction-label">${title}</div>
      ${copy ? `<p class="reaction-caption">${copy}</p>` : ""}
    </div>
  `;
}

function resetStage() {
  stage.className = "reaction-stage";
  ready = false;
  waiting = false;
  startedAt = 0;
  renderStatus("Wait...", "Press start to begin a round.");
}

function beginRound() {
  clearTimeout(timeoutId);
  resetStage();
  waiting = true;
  stage.classList.add("waiting");
  renderStatus("Wait...", "Do not click until the screen changes.");

  const delay = 2000 + Math.floor(Math.random() * 3000);
  timeoutId = window.setTimeout(() => {
    waiting = false;
    ready = true;
    startedAt = performance.now();
    stage.classList.remove("waiting");
    stage.classList.add("ready");
    renderStatus("Tap", "Click immediately.");
  }, delay);
}

startBtn?.addEventListener("click", beginRound);

stage?.addEventListener("click", () => {
  if (waiting) {
    clearTimeout(timeoutId);
    resetStage();
    renderStatus("Too early", "Wait for the green signal before tapping.");
    return;
  }

  if (!ready) return;

  const reaction = Math.round(performance.now() - startedAt);
  ready = false;
  stage.classList.remove("ready");
  renderStatus(`${reaction} ms`, "Solid response time.", `${reaction} ms`);
  recordReactionAttempt(reaction);

  if (bestTime == null || reaction < bestTime) {
    playCorrectSound();
    bestTime = reaction;
    bestNode.textContent = `${bestTime} ms`;
    if (!isLoggedIn()) {
      renderStatus(`${reaction} ms`, "Log in to save your best reaction time.", `${reaction} ms`);
    }
    return;
  }

  playWrongSound();
  if (!isLoggedIn()) {
    renderStatus(`${reaction} ms`, "Log in to save your reaction history.", `${reaction} ms`);
  }
});

resetStage();
