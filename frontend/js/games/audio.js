let correctAudio = null;
let wrongAudio = null;

try {
  correctAudio = new Audio("/assets/correct.mp3");
  wrongAudio = new Audio("/assets/wrong.mp3");
} catch (e) {
  console.warn("Audio initialization failed", e);
}

function play(audio) {
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function playCorrectSound() {
  play(correctAudio);
}

export function playWrongSound() {
  play(wrongAudio);
}
