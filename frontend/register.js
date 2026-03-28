import auth from "./auth.js";
const form = document.getElementById("registerForm");
const message = document.getElementById("message");
const submitBtn = document.getElementById("registerSubmitBtn");

if (auth?.getSession()) {
  window.location.href = "./index.html";
}

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
