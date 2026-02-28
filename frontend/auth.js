import API_BASE from "./src/config.js";

const SESSION_KEY = "quizzy-session-v2";

function setSession(token, user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    token,
    user,
    createdAt: new Date().toISOString()
  }));
}

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
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
  async register({ name, email, password }) {
    const result = await request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });
    if (!result.ok) return result;
    setSession(result.data.token, result.data.user);
    return { ok: true, user: result.data.user };
  },

  async login({ email, password }) {
    const result = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!result.ok) return result;
    setSession(result.data.token, result.data.user);
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
    setSession(session.token, result.data.user);
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
