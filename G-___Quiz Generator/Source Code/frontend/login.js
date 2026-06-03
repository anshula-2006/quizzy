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
  window.location.href = auth.getSession()?.userType === "teacher" ? "./teacher-dashboard.html" : "./index.html";
}

userTypeSelect?.addEventListener("change", updateUserTypeHint);
updateUserTypeHint();

if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    togglePasswordBtn.textContent = type === "password" ? "Show" : "Hide";
  });
}

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    message.textContent = "";
    message.className = "auth-msg";

    const identifier = window.prompt("Enter your email, parent phone, or roll number:");
    if (!identifier) return;
    const recovery = window.prompt("Enter a recovery detail from your account, such as parent phone, email, or roll number:");
    if (!recovery) return;

    const requestResult = await auth.forgotPassword({ identifier, recovery });
    if (!requestResult.ok) {
      message.textContent = requestResult.error;
      message.classList.add("error");
      return;
    }

    const code = window.prompt(`Reset code generated. Demo code: ${requestResult.data.demoCode}\nEnter the reset code:`);
    if (!code) return;
    const newPassword = window.prompt("Enter your new password, minimum 6 characters:");
    if (!newPassword) return;

    const resetResult = await auth.resetPassword({ identifier, code, newPassword });
    if (!resetResult.ok) {
      message.textContent = resetResult.error;
      message.classList.add("error");
      return;
    }

    message.textContent = "Password reset successful. Redirecting...";
    message.classList.add("success");
    setTimeout(() => {
      window.location.href = resetResult.user?.userType === "teacher" ? "./teacher-dashboard.html" : "./index.html";
    }, 500);
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
    window.location.href = result.user?.userType === "teacher" ? "./teacher-dashboard.html" : "./index.html";
  }, 500);
});
