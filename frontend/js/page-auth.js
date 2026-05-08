import auth from "../auth.js";

const onGamePage = window.location.pathname.includes("/games/");
const baseHref = onGamePage ? ".." : ".";

function buildHref(file) {
  return `${baseHref}/${file}`;
}

function applySavedTheme() {
  document.body.classList.add("dark");
}

function renderAuthBar() {
  if (document.querySelector(".global-auth-bar")) return;

  const user = auth?.getSession?.();
  const bar = document.createElement("div");
  bar.className = "global-auth-bar";

  bar.innerHTML = `
    <a class="global-auth-home" href="${buildHref("index.html")}">Quizzy</a>
    <label class="global-auth-search"><span>Search</span><input type="search" placeholder="Jump to dashboard, quiz, leaderboard" /></label>
    <div class="global-auth-actions">
      ${user ? `<span class="global-auth-user">Hi, ${user.name}</span>` : ""}
      ${user ? `<a class="global-auth-link" href="${buildHref("profile.html")}">Profile</a>` : ""}
      ${user ? "" : `<a class="global-auth-link" href="${buildHref("login.html")}">Login</a>`}
      ${user ? "" : `<a class="global-auth-link global-auth-link-strong" href="${buildHref("register.html")}">Register</a>`}
      ${user ? `<button class="global-auth-logout" type="button">Logout</button>` : ""}
    </div>
  `;

  document.body.prepend(bar);

  bar.querySelector(".global-auth-logout")?.addEventListener("click", () => {
    auth?.logout?.();
  });

  bar.querySelector(".global-auth-search input")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const query = String(event.currentTarget.value || "").trim().toLowerCase();
    const routes = [
      ["dashboard", "dashboard.html"],
      ["quiz", "generate.html"],
      ["generate", "generate.html"],
      ["flashcards", "flashcards.html"],
      ["leaderboard", "scoreboard.html"],
      ["scoreboard", "scoreboard.html"],
      ["profile", "profile.html"],
      ["arcade", "arcade.html"]
    ];
    const match = routes.find(([label]) => label.includes(query) || query.includes(label));
    if (match) window.location.href = buildHref(match[1]);
  });
}

// Global Mobile Sidebar Toggle
document.addEventListener("click", (e) => {
  if (e.target.closest(".mobile-menu-btn")) {
    document.querySelector(".dashboard-platform-shell")?.classList.toggle("sidebar-open");
  }
});

applySavedTheme();
renderAuthBar();
