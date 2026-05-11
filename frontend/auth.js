import API_BASE from "./js/config.js";

const SESSION_KEY = "quizzy-session-v2";

function setSession(token, user, rememberMe = true) {
  const payload = JSON.stringify({
    token,
    user,
    createdAt: new Date().toISOString()
  });
  if (rememberMe) {
    localStorage.setItem(SESSION_KEY, payload);
    sessionStorage.removeItem(SESSION_KEY);
  } else {
    sessionStorage.setItem(SESSION_KEY, payload);
    localStorage.removeItem(SESSION_KEY);
  }
}

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: data.error || "Request failed" };
  }
  return { ok: true, data };
}

const QuizzyAuth = {
  async register(userData) {
    const result = await request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData)
    });
    if (!result.ok) return result;
    if (userData.userType) localStorage.setItem("quizzy-userType", userData.userType);
    setSession(result.data.token, result.data.user, true);
    return { ok: true, user: result.data.user };
  },

  async login({ identifier, email, phone, userId, password, rememberMe }) {
    const payload = { password };
    if (identifier) payload.email = identifier; // Fallback mapping for existing APIs
    if (email) payload.email = email;
    if (phone) payload.phone = phone;
    if (userId) payload.userId = userId;

    const result = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!result.ok) return result;
    if (result.data.user?.userType) localStorage.setItem("quizzy-userType", result.data.user.userType);
    setSession(result.data.token, result.data.user, rememberMe !== false);
    return { ok: true, user: result.data.user };
  },

  async me() {
    const session = getSession();
    if (!session?.token) return { ok: false, error: "No session" };
    const result = await request("/auth/me", {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    if (!result.ok) {
      clearSession();
      return result;
    }
    setSession(session.token, result.data.user, !!localStorage.getItem(SESSION_KEY));
    return { ok: true, user: result.data.user };
  },

  async changePassword({ currentPassword, newPassword }) {
    const session = getSession();
    if (!session?.token) return { ok: false, error: "No session" };
    const result = await request("/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (!result.ok) return result;
    setSession(result.data.token, result.data.user);
    return { ok: true, user: result.data.user };
  },

  async logoutAll() {
    const session = getSession();
    if (!session?.token) return { ok: false, error: "No session" };
    const result = await request("/auth/logout-all", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` }
    });
    clearSession();
    return result.ok ? { ok: true } : result;
  },

  async deleteAccount({ password, confirmation }) {
    const session = getSession();
    if (!session?.token) return { ok: false, error: "No session" };
    const result = await request("/auth/delete-account", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`
      },
      body: JSON.stringify({ password, confirmation })
    });
    clearSession();
    return result;
  },

  getSession() {
    const session = getSession();
    return session?.user || null;
  },

  logout() {
    clearSession();
    window.location.href = "./login.html";
  }
};

window.QuizzyAuth = QuizzyAuth;

export default QuizzyAuth;
