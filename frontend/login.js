import auth from "./auth.js";
const form = document.getElementById("loginForm");
const message = document.getElementById("message");

if (auth?.getSession()) {
  window.location.href = "./index.html";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "";
  message.className = "auth-msg";

  const email = form.email.value;
  const password = form.password.value;
  const result = await auth.login({ email, password });

  if (!result.ok) {
    message.textContent = result.error;
    message.classList.add("error");
    return;
  }

  message.textContent = "Login successful. Redirecting...";
  message.classList.add("success");
  setTimeout(() => {
    window.location.href = "./index.html";
  }, 500);
});
