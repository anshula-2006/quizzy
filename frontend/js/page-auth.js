import auth from "../auth.js";

const onGamePage = window.location.pathname.includes("/games/");
const baseHref = onGamePage ? ".." : ".";

function buildHref(file) {
  return `${baseHref}/${file}`;
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
      ${user ? `<button class="global-auth-logout" type="button">Logout</button>` : ""}
    </div>
  `;

  document.body.prepend(bar);

  bar.querySelector(".global-auth-logout")?.addEventListener("click", () => {
    auth?.logout?.();
  });
}

renderAuthBar();
