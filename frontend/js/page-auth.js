import auth from "../auth.js";

const onGamePage = window.location.pathname.includes("/games/");
const baseHref = onGamePage ? ".." : ".";

function buildHref(file) {
  return `${baseHref}/${file}`;
}

const toggleStyles = document.createElement("style");
toggleStyles.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600;700;800;900&display=swap');

  :root {
    --bg: #F8FAFC;
    --bg-secondary: #F1F5F9;
    --panel-soft: rgba(255, 255, 255, 0.85);
    --glass-overlay: rgba(255, 255, 255, 0.6);
    --line: rgba(15, 23, 42, 0.1);
    --primary: #7C3AED;
    --secondary: #0891B2;
    --accent: #DB2777;
    --success: #16A34A;
    --warning: #D97706;
    --error: #DC2626;
    --text: #0F172A;
    --muted: #475569;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 24px;
    --glow-shadow: 0 4px 20px rgba(124, 58, 237, 0.15);
    --font-heading: 'Poppins', sans-serif;
    --font-body: 'Inter', sans-serif;
  }

  body.dark {
    --bg: #050816;
    --bg-secondary: #0B1120;
    --panel-soft: rgba(17, 24, 39, 0.85);
    --glass-overlay: rgba(255, 255, 255, 0.03);
    --line: rgba(139, 92, 246, 0.15);
    --primary: #8B5CF6;
    --secondary: #06B6D4;
    --accent: #EC4899;
    --success: #22C55E;
    --warning: #F59E0B;
    --error: #EF4444;
    --text: #F9FAFB;
    --muted: #9CA3AF;
    --glow-shadow: 0 0 20px rgba(139, 92, 246, 0.15), 0 0 40px rgba(6, 182, 212, 0.1);
  }

  body {
    background-color: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  h1, h2, h3, h4, h5, h6, .poppins {
    font-family: var(--font-heading) !important;
  }

  /* Global Light/Dark Mode Styling Fixes */
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--primary) transparent;
  }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 10px; }
  ::-webkit-scrollbar-track { background: transparent; }

  .panel, .card, .dash-sidebar, .dash-topbar, .top-nav, .auth-card {
    background-color: var(--panel-soft) !important;
    border-color: var(--line) !important;
    color: var(--text) !important;
  }
  
  .text-input, .select-input, .file-wrap, .source-card, .search-bar, .dash-search input {
    background-color: var(--bg-secondary) !important;
    border-color: var(--line) !important;
    color: var(--text) !important;
  }

  .btn-outline, .ghost {
    color: var(--text) !important;
    border-color: var(--line) !important;
  }

  .btn-outline:hover, .ghost:hover {
    background-color: var(--bg-secondary) !important;
    border-color: var(--primary) !important;
    color: var(--primary) !important;
  }

  .nav-link, .side-nav a, .auth-brand, .brand, .global-auth-link {
    color: var(--text) !important;
  }

  .nav-link:hover, .side-nav a:hover, .global-auth-link:hover, .side-nav a.active, .nav-link.is-active {
    color: var(--primary) !important;
  }

  .glass-card {
    background: var(--panel-soft) !important;
    background-image: linear-gradient(135deg, var(--glass-overlay) 0%, transparent 100%) !important;
    backdrop-filter: blur(24px) !important;
    -webkit-backdrop-filter: blur(24px) !important;
    border: 1px solid var(--line) !important;
    border-radius: var(--radius-lg);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
  }
  body.dark .glass-card {
    border-color: rgba(255, 255, 255, 0.05) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
  }

  .glow-hover {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease !important;
  }
  .glow-hover:hover {
    transform: translateY(-4px);
    box-shadow: var(--glow-shadow) !important;
    border-color: var(--primary) !important;
  }

  .empty-state, .empty-state-mini {
    background: var(--bg-secondary) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px dashed var(--primary) !important;
    opacity: 0.85;
    transition: opacity 0.3s ease, box-shadow 0.3s ease;
  }
  .empty-state:hover, .empty-state-mini:hover {
    opacity: 1;
    box-shadow: var(--glow-shadow);
  }

  /* Global Page Transitions */
  @keyframes pageFadeIn {
    from { opacity: 0; transform: translateY(10px); filter: brightness(0.9); }
    to { opacity: 1; transform: translateY(0); filter: brightness(1); }
  }
  .page-fade {
    animation: pageFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .neon-text {
    color: var(--primary) !important;
    text-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
  }

  /* Premium SaaS Navbar Styling */
  .global-auth-bar {
    position: sticky;
    top: 0;
    z-index: 9999;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    background: var(--panel-soft);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-bottom: 1px solid var(--line);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  }
  .global-auth-home {
    font-family: var(--font-heading);
    font-weight: 800;
    font-size: 1.25rem;
    color: var(--text);
    text-decoration: none;
    letter-spacing: -0.02em;
  }
  .global-auth-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .global-auth-link {
    font-size: 0.9rem;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.2s ease;
  }
  .global-auth-link-strong {
    background: var(--primary);
    color: #fff !important;
    padding: 6px 16px;
    border-radius: 20px;
    font-weight: 600;
  }
  .global-auth-link-strong:hover {
    box-shadow: var(--glow-shadow);
  }
  .global-auth-user {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--muted);
  }
  .global-auth-logout {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--text);
    padding: 6px 12px;
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .global-auth-logout:hover {
    background: rgba(239, 68, 68, 0.1);
    color: var(--error);
    border-color: var(--error);
  }

  /* Global Responsive Adjustments */
  @media (max-width: 768px) {
    .dashboard-content-grid, .split-grid.two-col, .auth-hero-grid, .mini-games-grid {
      grid-template-columns: 1fr !important;
    }
    .dash-main, .page-container {
      padding: 16px !important;
    }
    .panel, .card, .glass-card {
      padding: 16px !important;
    }
    .dash-sidebar {
      position: fixed;
      left: -100%;
      top: 0;
      bottom: 0;
      width: 280px;
      z-index: 10000;
      transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: var(--panel-soft) !important;
      backdrop-filter: blur(24px);
      border-right: 1px solid var(--line) !important;
      box-shadow: 4px 0 24px rgba(0,0,0,0.5);
    }
    .dashboard-platform-shell.sidebar-open .dash-sidebar {
      left: 0;
    }
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .dashboard-platform-shell.sidebar-open .sidebar-overlay {
      display: block;
      opacity: 1;
    }
  }

  .toast-rack {
    position: fixed;
    bottom: 32px;
    right: 32px;
    display: flex;
    flex-direction: column-reverse;
    gap: 12px;
    z-index: 99999;
    pointer-events: none;
  }
  .toast-item {
    background: var(--panel-soft);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--line);
    color: var(--text);
    padding: 16px 20px;
    border-radius: var(--radius-md);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    font-size: 0.9rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 12px;
    animation: toastSlideIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    pointer-events: auto;
    max-width: 400px;
  }
  .toast-item.leaving {
    animation: toastSlideOut 0.3s ease-in forwards;
  }
  .toast-item.success { border-bottom: 3px solid var(--success); }
  .toast-item.error { border-bottom: 3px solid var(--error); }
  .toast-item.xp { border-bottom: 3px solid var(--primary); box-shadow: var(--glow-shadow); }

  .toast-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }
  .toast-item.success .toast-icon { color: var(--success); background: rgba(34, 197, 94, 0.15); }
  .toast-item.error .toast-icon { color: var(--error); background: rgba(239, 68, 68, 0.15); }
  .toast-item.xp .toast-icon { color: var(--primary); background: rgba(124, 58, 237, 0.15); }
  
  @keyframes toastSlideIn {
    from { opacity: 0; transform: translateX(100%); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes toastSlideOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100%); }
  }

  .global-auth-theme-toggle {
    background: transparent;
    border: 1px solid var(--line, #ccc);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text, #333);
    transition: all 0.2s ease;
    margin-left: 12px;
    vertical-align: middle;
  }
  .global-auth-theme-toggle:hover {
    color: var(--primary, #000);
    border-color: var(--primary, #000);
  }
  .global-auth-theme-toggle svg {
    width: 16px;
    height: 16px;
  }
  .sun-icon { display: block; }
  .moon-icon { display: none; }
  body.dark .sun-icon { display: none; }
  body.dark .moon-icon { display: block; }
`;
document.head.appendChild(toggleStyles);

function applySavedTheme() {
  const theme = localStorage.getItem("quizzy-theme") || "dark";
  if (theme === "dark") {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("quizzy-theme", isDark ? "dark" : "light");
}

function renderAuthBar() {
  if (document.querySelector(".global-auth-bar")) return;

  const user = auth?.getSession?.();
  const bar = document.createElement("div");
  bar.className = "global-auth-bar";

  bar.innerHTML = `
    <a class="global-auth-home" href="${buildHref("index.html")}">Quizzy</a>
    <div class="global-auth-actions">
      ${user ? `<span class="global-auth-user">Hi, ${user.name}</span>` : ""}
      ${user ? `<a class="global-auth-link" href="${buildHref("profile.html")}">Profile</a>` : ""}
      ${user ? "" : `<a class="global-auth-link" href="${buildHref("login.html")}">Login</a>`}
      ${user ? "" : `<a class="global-auth-link global-auth-link-strong" href="${buildHref("register.html")}">Register</a>`}
      ${user ? `<button class="global-auth-logout" type="button">Logout</button>` : ""}
      <button class="global-auth-theme-toggle" type="button" aria-label="Toggle Theme">
        <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      </button>
    </div>
  `;

  document.body.prepend(bar);

  bar.querySelector(".global-auth-theme-toggle")?.addEventListener("click", toggleTheme);

  bar.querySelector(".global-auth-logout")?.addEventListener("click", () => {
    auth?.logout?.();
  });
}

// Global Mobile Sidebar Toggle
document.addEventListener("click", (e) => {
  const shell = document.querySelector(".dashboard-platform-shell");
  if (e.target.closest(".mobile-menu-btn")) {
    shell?.classList.toggle("sidebar-open");
    if (shell && !document.querySelector(".sidebar-overlay")) {
      const overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      overlay.addEventListener("click", () => shell.classList.remove("sidebar-open"));
      shell.appendChild(overlay);
    }
  }
});

applySavedTheme();
renderAuthBar();
