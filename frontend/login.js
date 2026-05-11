import auth from "./auth.js";
const form = document.getElementById("loginForm");
const message = document.getElementById("message");
const submitBtn = document.getElementById("loginSubmitBtn");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");

if (auth?.getSession()) {
  window.location.href = "./index.html";
}

if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    togglePasswordBtn.textContent = type === "password" ? "👁" : "🙈";
  });
}

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", (e) => {
    e.preventDefault();
    message.textContent = "Forgot password instructions sent to your email/phone.";
    message.className = "auth-msg success";
  });
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "";
  message.className = "auth-msg";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";
  }

  const identifier = form.email.value;
  const password = form.password.value;
  const rememberMe = form.rememberMe?.checked ?? true;
  const result = await auth.login({ identifier, password, rememberMe });

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
