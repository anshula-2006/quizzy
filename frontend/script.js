import API_BASE from "./src/config.js";

const input = document.getElementById("inputText");
const btn = document.getElementById("generateBtn");
const quiz = document.getElementById("quiz");
const toggle = document.getElementById("themeToggle");
const robot = document.getElementById("robotMascot");
const loader = document.getElementById("loader");
const cursorGlow = document.querySelector(".cursor-glow");
const cursorTrail = document.getElementById("cursorTrail");

const correctSound = new Audio("assets/correct.mp3");
const wrongSound = new Audio("assets/wrong.mp3");

let questions = [], index = 0, score = 0, timer, timeLeft = 15, answered = {}, choices = {};

input.oninput = () => btn.disabled = input.value.trim() === "";

toggle.onclick = () => {
  document.body.classList.toggle("dark");
  if (robot) {
    robot.src = document.body.classList.contains("dark")
      ? "assets/robot-dark.png"
      : "assets/robot-light.png";
  }
  setThemeIcon();
};

function setThemeIcon() {
  toggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

setThemeIcon();

/* CURSOR GLOW (SMOOTH FOLLOW) */
if (cursorGlow) {
  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  window.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  const follow = () => {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    cursorGlow.style.left = `${currentX}px`;
    cursorGlow.style.top = `${currentY}px`;
    requestAnimationFrame(follow);
  };

  follow();
}

/* CURSOR TRAIL (COLOR-CHANGING) */
if (cursorTrail) {
  const ctx = cursorTrail.getContext("2d");
  let points = [];

  const resize = () => {
    cursorTrail.width = window.innerWidth;
    cursorTrail.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  window.addEventListener("mousemove", (e) => {
    points.push({ x: e.clientX, y: e.clientY, life: 1 });
  });

  const getPalette = () => {
    const isDark = document.body.classList.contains("dark");
    return isDark
      ? ["#fbcfe8", "#c7d2fe", "#a5f3fc", "#fecdd3"]
      : ["#f5d0fe", "#c7d2fe", "#bae6fd", "#bbf7d0"];
  };

  const draw = () => {
    ctx.clearRect(0, 0, cursorTrail.width, cursorTrail.height);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      p.life -= 0.008;
    }
    points = points.filter(p => p.life > 0);

    const palette = getPalette();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const alpha = Math.max(0, Math.min(p2.life, 1));
      const colorIndex = Math.floor(i / 10) % palette.length;
      ctx.strokeStyle = `${palette[colorIndex]}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
      ctx.lineWidth = 6 * alpha + 1;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  };

  draw();
}

btn.onclick = async () => {
  loader.classList.remove("hidden");
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/generate-quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.value })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to generate quiz");
    }
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error("No questions were returned");
    }

    questions = data.questions;
    index = score = 0;
    answered = {};
    choices = {};

    setTimeout(() => {
      loader.classList.add("hidden");
      quiz.scrollIntoView({ behavior: "smooth" });
      showQuestion();
    }, 1200);
  } catch (err) {
    loader.classList.add("hidden");
    quiz.innerHTML = `
      <div class="card quiz-card">
        <h2>Could not generate quiz</h2>
        <p>${err.message}</p>
      </div>
    `;
  } finally {
    btn.disabled = input.value.trim() === "";
  }
};

function showQuestion() {
  clearInterval(timer);
  timeLeft = 15;
  const q = questions[index];
  const progress = Math.round(((index + 1) / questions.length) * 100);

  quiz.innerHTML = `
    <div class="card quiz-card">
      <div class="quiz-top">
        <span>Q ${index + 1}/${questions.length}</span>
        <span>${timeLeft}s</span>
      </div>
      <div class="progress">
        <div class="progress-fill" style="width:${progress}%"></div>
      </div>
      <h2>${q.question}</h2>
      ${q.options.map((o,i)=>`
        <div class="option" data-o="${String.fromCharCode(65+i)}">
          ${String.fromCharCode(65+i)}. ${o}
        </div>`).join("")}
      <div class="quiz-actions">
        <button id="prevBtn" class="ghost" ${index === 0 ? "disabled" : ""}>Previous</button>
        <button id="finishBtn" class="ghost">Finish</button>
        <button id="nextBtn">Next</button>
      </div>
    </div>
  `;

  document.querySelectorAll(".option").forEach(opt =>
    opt.onclick = () => answer(opt, q)
  );
  document.getElementById("prevBtn")?.addEventListener("click", prev);
  document.getElementById("finishBtn")?.addEventListener("click", finish);
  document.getElementById("nextBtn")?.addEventListener("click", next);

  if (answered[index]) {
    clearInterval(timer);
    document.querySelector(".quiz-top span:last-child").innerText = "Done";
    reveal(q, choices[index], true);
    return;
  }

  timer = setInterval(() => {
    timeLeft--;
    document.querySelector(".quiz-top span:last-child").innerText = timeLeft + "s";
    if (timeLeft <= 0 && !answered[index]) {
      answered[index] = true;
      choices[index] = null;
      reveal(q, null, false);
      clearInterval(timer);
    }
  }, 1000);
}

function answer(el, q) {
  if (answered[index]) return;
  answered[index] = true;
  choices[index] = el.dataset.o;
  clearInterval(timer);
  reveal(q, el.dataset.o, false);
}

function reveal(q, choice, isReview) {
  document.querySelectorAll(".option").forEach(o => {
    o.classList.add("disabled");
    if (o.dataset.o === q.correct) o.classList.add("correct");
  });

  if (choice) {
    const chosen = document.querySelector(`.option[data-o="${choice}"]`);
    if (choice === q.correct) {
      if (!isReview) {
        score++;
        correctSound.play();
      }
    } else {
      chosen?.classList.add("wrong");
      if (!isReview) {
        wrongSound.play();
      }
    }
  }

  if (!quiz.querySelector(".explanation")) {
    quiz.querySelector(".quiz-card").insertAdjacentHTML(
      "beforeend",
      `<div class="explanation">${q.explanation}</div>`
    );
  }
}

function next() {
  index++;
  index < questions.length ? showQuestion() : finish();
}

function prev() {
  if (index === 0) return;
  index--;
  showQuestion();
}

function finish() {
  confetti();
  quiz.innerHTML = `
    <div class="card quiz-card">
      <h2>Quiz Completed</h2>
      <h1>${score} / ${questions.length}</h1>
    </div>
  `;
}

function confetti() {
  for (let i = 0; i < 120; i++) {
    const c = document.createElement("div");
    c.className = "confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = `hsl(${Math.random()*360},100%,60%)`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3000);
  }
}

document.querySelectorAll("[data-count]").forEach(counter => {
  let target = +counter.dataset.count, c = 0;
  const run = () => {
    c += Math.ceil(target / 60);
    counter.innerText = c < target ? c : target;
    if (c < target) requestAnimationFrame(run);
  };
  run();
});
