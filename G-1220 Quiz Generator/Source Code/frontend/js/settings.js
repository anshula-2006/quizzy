import { apiRequest, getSession, SESSION_KEY } from "./shared.js";

async function init() {
  const accountName = document.getElementById("accountName");
  const accountEmail = document.getElementById("accountEmail");
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutAllBtn = document.getElementById("logoutAllBtn");
  const changePasswordForm = document.getElementById("changePasswordForm");
  const deleteAccountBtn = document.getElementById("deleteAccountBtn");

  const session = getSession();
  if (session?.user) {
    accountName.textContent = session.user.name || session.user.email || "User";
    accountEmail.textContent = session.user.email || "";
  } else {
    accountName.textContent = "Not signed in";
    accountEmail.textContent = "";
  }

  logoutBtn?.addEventListener("click", () => {
    // Logout current session (client-side)
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    location.reload();
  });

  logoutAllBtn?.addEventListener("click", async () => {
    const ok = confirm("Logout all sessions? This will invalidate tokens elsewhere.");
    if (!ok) return;
    const res = await apiRequest("/auth/logout-all", { method: "POST" });
    // clear local session regardless
    try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    alert(res ? "Logged out from all sessions." : "Request failed.");
    location.reload();
  });

  changePasswordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const oldPassword = document.getElementById("oldPassword").value || "";
    const newPassword = document.getElementById("newPassword").value || "";
    const confirmPassword = document.getElementById("confirmPassword").value || "";
    if (!oldPassword || !newPassword) return alert("Please fill both fields.");
    if (newPassword !== confirmPassword) return alert("New passwords do not match.");

    const resp = await apiRequest("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword }),
      headers: { "Content-Type": "application/json" }
    });

    if (resp) {
      alert("Password changed successfully. Please log in again.");
      try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
      location.href = "./login.html";
    } else {
      alert("Failed to change password.");
    }
  });

  deleteAccountBtn?.addEventListener("click", async () => {
    const ok = confirm("Delete your account permanently? This cannot be undone.");
    if (!ok) return;
    const resp = await apiRequest("/auth/delete-account", { method: "DELETE" });
    if (resp) {
      alert("Account deleted.");
      try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
      location.href = "./index.html";
    } else {
      alert("Failed to delete account.");
    }
  });

  // Theme controls
  const radios = Array.from(document.querySelectorAll('input[name="theme"]'));
  const current = localStorage.getItem("quizzy-theme") || "system";
  radios.forEach(r => { r.checked = r.value === current; });
  radios.forEach(r => r.addEventListener("change", (e) => {
    localStorage.setItem("quizzy-theme", e.target.value);
    applyTheme(e.target.value);
  }));
  applyTheme(current);
}

function applyTheme(value) {
  try {
    if (value === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", value);
    }
  } catch (e) {}
}

init();
