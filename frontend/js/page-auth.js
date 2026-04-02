import auth from "../auth.js";

const onGamePage = window.location.pathname.includes("/games/");
const baseHref = onGamePage ? ".." : ".";
const THEME_KEY = "quizzy-theme";

function buildHref(file) {
  return `${baseHref}/${file}`;
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark") document.body.classList.add("dark");
  if (saved === "light") document.body.classList.remove("dark");
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, document.body.classList.contains("dark") ? "dark" : "light");
  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.textContent = document.body.classList.contains("dark") ? "Light" : "Dark";
}

function renderAuthBar() {
  if (document.querySelector(".global-auth-bar")) return;

  const user = auth?.getSession?.();
  const bar = document.createElement("div");
  bar.className = "global-auth-bar";

  bar.innerHTML = `
    <a class="global-auth-home" href="${buildHref("index.html")}">Quizzy</a>
    <div class="global-auth-actions">
      ${user ? `<span class="global-auth-user">Hi, ${user.name}</span>` : ""}
      ${user ? "" : `<a class="global-auth-link" href="${buildHref("login.html")}">Login</a>`}
      ${user ? "" : `<a class="global-auth-link global-auth-link-strong" href="${buildHref("register.html")}">Register</a>`}
      <button id="themeToggle" class="theme-toggle" type="button">Dark</button>
      ${user ? `<button class="global-auth-logout" type="button">Logout</button>` : ""}
    </div>
  `;

  document.body.prepend(bar);

  bar.querySelector(".global-auth-logout")?.addEventListener("click", () => {
    auth?.logout?.();
  });

  const themeToggle = bar.querySelector("#themeToggle");
  if (themeToggle) {
    themeToggle.textContent = document.body.classList.contains("dark") ? "Light" : "Dark";
    themeToggle.addEventListener("click", toggleTheme);
  }
}

applySavedTheme();
renderAuthBar();
