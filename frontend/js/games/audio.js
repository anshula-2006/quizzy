const correctAudio = new Audio(new URL("../../assets/correct.mp3", import.meta.url).href);
const wrongAudio = new Audio(new URL("../../assets/wrong.mp3", import.meta.url).href);

function play(audio) {
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function playCorrectSound() {
  play(correctAudio);
}

export function playWrongSound() {
  play(wrongAudio);
}
