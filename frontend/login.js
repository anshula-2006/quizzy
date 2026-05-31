import auth from "./auth.js";
const form = document.getElementById("loginForm");
const message = document.getElementById("message");
const submitBtn = document.getElementById("loginSubmitBtn");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const userTypeSelect = document.getElementById("loginUserType");
const userTypeHint = document.getElementById("loginUserTypeHint");

const userTypeHints = {
  student: "Practice quizzes, flashcards, streaks, and progress insights.",
  teacher: "Create assessments and use dashboard summaries for class review.",
  self_learner: "Build independent study sessions with revision and mastery tracking."
};

function updateUserTypeHint() {
  if (!userTypeHint || !userTypeSelect) return;
  userTypeHint.textContent = userTypeHints[userTypeSelect.value] || userTypeHints.student;
}

if (auth?.getSession()) {
  window.location.href = "./index.html";
}

userTypeSelect?.addEventListener("change", updateUserTypeHint);
updateUserTypeHint();

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

  const identifier = form.identifier.value;
  const password = form.password.value;
  const rememberMe = form.rememberMe?.checked ?? true;
  localStorage.setItem("quizzy-userType", userTypeSelect?.value || "student");
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
