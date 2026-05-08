import auth from "./auth.js";
const form = document.getElementById("registerForm");
const message = document.getElementById("message");
const submitBtn = document.getElementById("registerSubmitBtn");
const passwordInput = document.getElementById("password");
const strengthText = document.getElementById("passwordStrengthText");
const strengthBar = document.querySelector(".password-strength span");

if (auth?.getSession()) {
  window.location.href = "./index.html";
}

passwordInput?.addEventListener("input", () => {
  const value = passwordInput.value || "";
  const score = [
    value.length >= 6,
    /[A-Z]/.test(value),
    /[0-9]/.test(value),
    /[^A-Za-z0-9]/.test(value)
  ].filter(Boolean).length;
  const labels = ["Use 6+ characters", "Basic", "Good", "Strong", "Excellent"];
  if (strengthText) strengthText.textContent = labels[score] || labels[0];
  if (strengthBar) strengthBar.style.width = `${Math.max(10, score * 25)}%`;
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "";
  message.className = "auth-msg";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";
  }

  const name = form.name.value;
  const email = form.email.value;
  const password = form.password.value;
  const result = await auth.register({ name, email, password });

  if (!result.ok) {
    message.textContent = result.error;
    message.classList.add("error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Account";
    }
    return;
  }

  message.textContent = "Registration successful. Redirecting...";
  message.classList.add("success");
  setTimeout(() => {
    window.location.href = "./index.html";
  }, 500);
});
