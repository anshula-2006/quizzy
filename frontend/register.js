import auth from "./auth.js";
const form = document.getElementById("registerForm");
const message = document.getElementById("message");
const submitBtn = document.getElementById("registerSubmitBtn");
const passwordInput = document.getElementById("password");
const strengthText = document.getElementById("passwordStrengthText");
const strengthBar = document.querySelector(".password-strength span");
const confirmPasswordInput = document.getElementById("confirmPassword");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const toggleConfirmPasswordBtn = document.getElementById("toggleConfirmPasswordBtn");

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

if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    togglePasswordBtn.textContent = type === "password" ? "👁" : "🙈";
  });
}

if (toggleConfirmPasswordBtn && confirmPasswordInput) {
  toggleConfirmPasswordBtn.addEventListener("click", () => {
    const type = confirmPasswordInput.getAttribute("type") === "password" ? "text" : "password";
    confirmPasswordInput.setAttribute("type", type);
    toggleConfirmPasswordBtn.textContent = type === "password" ? "👁" : "🙈";
  });
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "";
  message.className = "auth-msg";

  const password = form.password.value;
  const confirmPassword = form.confirmPassword?.value;

  if (confirmPassword && password !== confirmPassword) {
    message.textContent = "Passwords do not match.";
    message.classList.add("error");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account...";
  }

  const name = form.name.value;
  const email = form.email.value;
  const userId = form.userId?.value;
  const phone = form.phone?.value;
  const userType = form.userType?.value || "student";
  const grade = form.grade?.value;
  const result = await auth.register({ name, email, userId, phone, userType, grade, password });

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
