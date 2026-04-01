const stage = document.getElementById("reactionStage");
const statusNode = document.getElementById("reactionStatus");
const bestNode = document.getElementById("bestReaction");
const startBtn = document.getElementById("startReactionBtn");

let timeoutId = null;
let startedAt = 0;
let waiting = false;
let ready = false;
let bestTime = null;

function resetStage() {
  stage.className = "reaction-stage";
  statusNode.textContent = "Tap start when you're ready.";
  ready = false;
  waiting = false;
  startedAt = 0;
}

function beginRound() {
  clearTimeout(timeoutId);
  resetStage();
  waiting = true;
  stage.classList.add("waiting");
  statusNode.textContent = "Wait...";

  const delay = 1500 + Math.floor(Math.random() * 2500);
  timeoutId = window.setTimeout(() => {
    waiting = false;
    ready = true;
    startedAt = performance.now();
    stage.classList.remove("waiting");
    stage.classList.add("ready");
    statusNode.textContent = "TAP!";
  }, delay);
}

startBtn?.addEventListener("click", beginRound);

stage?.addEventListener("click", () => {
  if (waiting) {
    clearTimeout(timeoutId);
    resetStage();
    statusNode.textContent = "Too early. Tap start to try again.";
    return;
  }

  if (!ready) return;

  const reaction = Math.round(performance.now() - startedAt);
  ready = false;
  stage.classList.remove("ready");
  statusNode.innerHTML = `<span class="reaction-time">${reaction} ms</span>`;

  if (bestTime == null || reaction < bestTime) {
    bestTime = reaction;
    bestNode.textContent = `${bestTime} ms`;
  }
});

resetStage();
