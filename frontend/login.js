import auth from "./auth.js";
const form = document.getElementById("loginForm");
const message = document.getElementById("message");
const submitBtn = document.getElementById("loginSubmitBtn");

if (auth?.getSession()) {
  window.location.href = "./index.html";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "";
  message.className = "auth-msg";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";
  }

  const email = form.email.value;
  const password = form.password.value;
  const result = await auth.login({ email, password });

  if (!result.ok) {
    message.textContent = result.error;
    message.classList.add("error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log In";
    }
    return;
  }

  message.textContent = "Login successful. Redirecting...";
  message.classList.add("success");
  setTimeout(() => {
    window.location.href = "./index.html";
  }, 500);
});
