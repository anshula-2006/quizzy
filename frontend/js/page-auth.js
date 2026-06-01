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
    color-scheme: light;
    --bg: #F8FAFC;
    --bg-deep: #E8EEF6;
    --bg-secondary: #EEF2F7;
    --panel: #FFFFFF;
    --panel-strong: #FFFFFF;
    --panel-soft: #F8FAFC;
    --glass-overlay: rgba(255, 255, 255, 0.72);
    --line: rgba(15, 23, 42, 0.12);
    --line-strong: rgba(15, 23, 42, 0.18);
    --primary: #4F46E5;
    --secondary: #0E7490;
    --accent: #BE185D;
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
    color-scheme: dark;
    --bg: #0B1220;
    --bg-deep: #0B1220;
    --bg-secondary: #111827;
    --panel: #101622;
    --panel-strong: #151C2B;
    --panel-soft: #111827;
    --glass-overlay: rgba(255, 255, 255, 0.03);
    --line: rgba(226, 232, 240, 0.10);
    --line-strong: rgba(226, 232, 240, 0.16);
    --primary: #6366F1;
    --secondary: #3B82F6;
    --accent: #6366F1;
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

  .page-container {
    max-width: 1440px;
    margin: 0 auto;
    padding: 2rem;
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
    background-color: var(--panel) !important;
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
    background: rgba(99, 102, 241, 0.14) !important;
    border-color: rgba(99, 102, 241, 0.28) !important;
  }

  .navbar-account-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .nav-action-button {
    font: inherit;
    cursor: pointer;
  }

  .theme-toggle-btn {
    min-width: 78px;
  }

  body.dark .theme-label-light,
  body:not(.dark) .theme-label-dark {
    display: none;
  }

  .glass-card {
    background: var(--panel) !important;
    background-image: none !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
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

  /* Arcade & Mini-Game Styles */
  .speed-option, .memory-card {
    background: var(--bg-secondary);
    border: 1px solid var(--line);
    color: var(--text);
    padding: 12px 16px;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 600;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    width: 100%;
  }
  .speed-option:hover, .memory-card:not([disabled]):hover {
    background: var(--panel-soft);
    border-color: var(--primary);
    color: var(--primary);
    box-shadow: var(--glow-shadow);
  }
  .memory-card {
    min-height: 80px;
    font-size: 1.2rem;
  }
  .memory-card.revealed {
    background: rgba(6, 182, 212, 0.1);
    border-color: var(--secondary);
    color: var(--secondary);
  }
  .memory-card.matched {
    background: rgba(34, 197, 94, 0.1);
    border-color: var(--success);
    color: var(--success);
    opacity: 0.6;
    cursor: default;
  }
  .speed-options { display: grid; gap: 12px; margin-top: 16px; }
  .memory-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; margin-top: 16px; }
  .mini-input {
    width: 100%; padding: 12px; border-radius: var(--radius-md);
    background: var(--bg-secondary); border: 1px solid var(--line);
    color: var(--text); font-size: 1rem; margin: 16px 0;
    outline: none; transition: all 0.2s;
  }
  .mini-input:focus { border-color: var(--primary); box-shadow: var(--glow-shadow); }
  .challenge-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .challenge-state { font-size: 0.8rem; font-weight: 700; color: var(--muted); text-transform: uppercase; }
  .challenge-card.done { border-color: rgba(34, 197, 94, 0.3); }
  .challenge-card.done .challenge-state { color: var(--success); }
  .speed-stats { display: flex; gap: 12px; margin-top: 8px; font-size: 0.85rem; font-weight: 600; color: var(--primary); }
  .speed-stats span {
    background: rgba(139, 92, 246, 0.1);
    padding: 4px 10px;
    border-radius: 12px;
  }

  /* Global Page Transitions */
  @keyframes pageFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .page-fade {
    animation: pageFadeIn 250ms ease forwards;
  }

  .neon-text, .section-title, .saas-stat-value, .auth-brand span:not(.auth-brand-icon) {
    background: none;
    -webkit-background-clip: initial;
    -webkit-text-fill-color: currentColor;
    text-shadow: none;
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
      padding: 16px;
    }
    .dash-sidebar {
      position: fixed;
      left: -100%;
      top: 0;
      bottom: 0;
      width: 280px;
      z-index: 10000;
      transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: var(--panel-soft);
      backdrop-filter: blur(24px);
      border-right: 1px solid var(--line);
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

  /* Quizzy Design System: slate surfaces, indigo accent, restrained SaaS styling. */
  :root {
    --ds-bg: #F8FAFC;
    --ds-bg-subtle: #F1F5F9;
    --ds-surface: rgba(255, 255, 255, 0.82);
    --ds-surface-2: rgba(248, 250, 252, 0.95);
    --ds-border: rgba(15, 23, 42, 0.12);
    --ds-border-strong: rgba(15, 23, 42, 0.18);
    --ds-text: #0f172a;
    --ds-muted: #64748b;
    --ds-accent: #4F46E5;
    --ds-accent-hover: #4338CA;
    --ds-accent-soft: rgba(79, 70, 229, 0.10);
    --ds-success: #16a34a;
    --ds-warning: #d97706;
    --ds-danger: #dc2626;
    --ds-radius-sm: 8px;
    --ds-radius: 12px;
    --ds-radius-lg: 18px;
    --ds-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
    --bg: var(--ds-bg);
    --bg-deep: var(--ds-bg-subtle);
    --bg-secondary: var(--ds-bg-subtle);
    --panel: var(--ds-surface);
    --panel-strong: var(--ds-surface);
    --panel-soft: var(--ds-surface-2);
    --text: var(--ds-text);
    --muted: var(--ds-muted);
    --line: var(--ds-border);
    --line-strong: var(--ds-border-strong);
    --primary: var(--ds-accent);
    --secondary: var(--ds-accent);
    --accent: var(--ds-accent);
    --purple: var(--ds-accent);
    --cyan: var(--ds-accent);
    --blue: var(--ds-accent);
    --green: var(--ds-success);
    --red: var(--ds-danger);
    --amber: var(--ds-warning);
    --radius-md: var(--ds-radius);
    --radius-lg: var(--ds-radius-lg);
    --radius-xl: var(--ds-radius-lg);
    --shadow: var(--ds-shadow);
    --shadow-soft: var(--ds-shadow);
    --glow-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
  }

  body.dark {
    --ds-bg: #0B1220;
    --ds-bg-subtle: #172033;
    --ds-surface: rgba(31, 41, 55, 0.78);
    --ds-surface-2: rgba(37, 50, 71, 0.9);
    --ds-border: rgba(148, 163, 184, 0.18);
    --ds-border-strong: rgba(148, 163, 184, 0.26);
    --ds-text: #f8fafc;
    --ds-muted: #94a3b8;
    --ds-accent: #6366F1;
    --ds-accent-hover: #4F46E5;
    --ds-accent-soft: rgba(99, 102, 241, 0.14);
    --ds-success: #22c55e;
    --ds-warning: #f59e0b;
    --ds-danger: #f87171;
  }

  html,
  body {
    background: var(--ds-bg) !important;
    color: var(--ds-text) !important;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    letter-spacing: 0 !important;
  }

  body.arcade-body {
    background: var(--ds-bg) !important;
    color: var(--ds-text) !important;
  }

  .page-shell,
  .arcade-shell {
    background: transparent !important;
  }

  .panel,
  .glass-card,
  .auth-hero,
  .auth-card,
  .arcade-panel,
  .arcade-game-card,
  .source-card,
  .setting-card,
  .stat-card,
  .saas-stat-card,
  .chart-card,
  .analytics-card,
  .flow-card,
  .game-card,
  .quiz-card,
  .result-card,
  .timeline-item,
  .challenge-card,
  .mini-game-panel,
  .lb-row,
  .auth-feature-card {
    background: var(--ds-surface) !important;
    background-image: none !important;
    border: 1px solid var(--ds-border) !important;
    border-radius: var(--ds-radius-lg) !important;
    box-shadow: var(--ds-shadow) !important;
    color: var(--ds-text) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
  }

  .top-nav,
  .global-auth-bar,
  .arcade-header {
    background: rgba(17, 24, 39, 0.78) !important;
    border: 1px solid var(--ds-border) !important;
    border-radius: var(--ds-radius-lg) !important;
    box-shadow: var(--ds-shadow) !important;
    color: var(--ds-text) !important;
    backdrop-filter: blur(18px) !important;
    -webkit-backdrop-filter: blur(18px) !important;
  }

  body:not(.dark) .top-nav,
  body:not(.dark) .global-auth-bar,
  body:not(.dark) .arcade-header {
    background: rgba(255, 255, 255, 0.82) !important;
  }

  body:not(.dark) .top-nav,
  body:not(.dark) .top-nav .brand,
  body:not(.dark) .top-nav .nav-link {
    color: #0f172a !important;
  }

  body.dark .top-nav,
  body.dark .top-nav .brand,
  body.dark .top-nav .nav-link,
  body.dark .top-nav .nav-action-button {
    color: #f8fafc !important;
  }

  .brand-badge,
  .auth-brand-icon,
  .arcade-icon-tile,
  .stat-orb,
  .avatar-chip span,
  .profile-avatar-large {
    background: var(--ds-accent) !important;
    background-image: none !important;
    color: #ffffff !important;
    box-shadow: none !important;
    border-color: transparent !important;
  }

  h1, h2, h3, h4, h5, h6,
  .page-title,
  .section-title,
  .arcade-title,
  .arcade-card-title,
  .auth-hero h1,
  .auth-card h2 {
    color: var(--ds-text) !important;
    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
    letter-spacing: 0 !important;
    text-shadow: none !important;
    -webkit-text-fill-color: currentColor !important;
    background: none !important;
  }

  p,
  .helper-text,
  .meta-copy,
  .section-copy,
  .page-subtitle,
  .arcade-subtitle,
  .arcade-card-copy,
  .auth-hero p,
  .auth-card-head p,
  .auth-footer,
  .auth-feature-card span,
  .cabinet-note,
  .empty-copy,
  .empty-state-mini span,
  .timeline-item span {
    color: var(--ds-muted) !important;
    text-shadow: none !important;
  }

  .eyebrow,
  .auth-pill,
  .auth-eyebrow,
  .field-label,
  .saas-stat-label,
  .arcade-mark,
  .meta-chip,
  .challenge-state {
    color: var(--ds-accent) !important;
    background: var(--ds-surface-2) !important;
    border-color: var(--ds-border) !important;
    letter-spacing: 0 !important;
  }

  .btn,
  .auth-btn,
  .arcade-btn,
  .global-auth-link-strong {
    background: var(--ds-accent) !important;
    background-image: none !important;
    color: #ffffff !important;
    border: 1px solid var(--ds-accent) !important;
    box-shadow: none !important;
    border-radius: var(--ds-radius) !important;
  }

  .btn:hover,
  .auth-btn:hover,
  .arcade-btn:hover,
  .global-auth-link-strong:hover {
    background: var(--ds-accent-hover) !important;
    border-color: var(--ds-accent-hover) !important;
    transform: translateY(-1px) !important;
    box-shadow: none !important;
  }

  .btn-outline,
  .arcade-btn-secondary,
  .arcade-back,
  .nav-link,
  .global-auth-link,
  .global-auth-logout,
  .global-auth-theme-toggle,
  .source-card,
  .challenge-cta {
    background: transparent !important;
    color: var(--ds-text) !important;
    border: 1px solid var(--ds-border) !important;
    border-radius: var(--ds-radius) !important;
    box-shadow: none !important;
  }

  .btn-outline:hover,
  .arcade-btn-secondary:hover,
  .arcade-back:hover,
  .nav-link:hover,
  .nav-link.is-active,
  .global-auth-link:hover,
  .global-auth-logout:hover,
  .global-auth-theme-toggle:hover,
  .source-card:hover,
  .source-card.is-active,
  .challenge-cta:hover {
    background: var(--ds-accent-soft) !important;
    color: var(--ds-accent) !important;
    border-color: var(--ds-accent) !important;
    transform: translateY(-1px) !important;
    box-shadow: none !important;
  }

  body:not(.dark) .top-nav .nav-action-button {
    color: #0f172a !important;
  }

  input,
  textarea,
  select,
  .text-input,
  .select-input,
  .file-input,
  .answer-input,
  .auth-field input,
  .auth-select,
  .recall-input,
  .mini-input,
  .leaderboard-search,
  .leaderboard-sort {
    background: var(--ds-surface-2) !important;
    color: var(--ds-text) !important;
    border: 1px solid var(--ds-border) !important;
    border-radius: var(--ds-radius) !important;
    box-shadow: none !important;
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--ds-muted) !important;
  }

  :is(a, button, input, textarea, select, [tabindex]):focus-visible {
    outline: 2px solid var(--ds-accent) !important;
    outline-offset: 2px !important;
  }

  .neon-text,
  .saas-stat-value,
  .score-big {
    background: none !important;
    color: var(--ds-text) !important;
    -webkit-text-fill-color: currentColor !important;
    text-shadow: none !important;
  }

  .glow-hover:hover,
  .stat-card-premium:hover,
  .badge-card:hover,
  .chart-card:hover,
  .arcade-card-link:hover .arcade-game-card {
    transform: translateY(-4px) !important;
    border-color: rgba(99, 102, 241, 0.45) !important;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.28) !important;
  }

  .panel:hover,
  .glass-card:hover,
  .auth-card:hover,
  .saas-stat-card:hover,
  .chart-card:hover,
  .flow-card:hover,
  .game-card:hover,
  .result-card:hover,
  .challenge-card:hover,
  .mini-game-panel:hover,
  .lb-row:hover {
    transform: translateY(-4px) !important;
    border-color: rgba(99, 102, 241, 0.45) !important;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.28) !important;
  }

  .hero-orbit-ring,
  .hero-orbit-core,
  .hero-floating-card,
  .arcade-preview,
  .reaction-stage,
  .recall-stage,
  .question-panel {
    background: var(--ds-surface-2) !important;
    background-image: none !important;
    border: 1px solid var(--ds-border) !important;
    box-shadow: none !important;
  }

  .arcade-preview::after {
    background: rgba(15, 23, 42, 0.28) !important;
  }

  .line-chart polyline,
  .mini-progress span,
  .progress-fill,
  .chart-bar span {
    stroke: var(--ds-accent) !important;
    background: var(--ds-accent) !important;
    box-shadow: none !important;
  }

  .empty-state,
  .empty-state-mini {
    background: var(--ds-surface-2) !important;
    border: 1px dashed var(--ds-border-strong) !important;
    opacity: 1 !important;
    box-shadow: none !important;
  }

  .row-badge.gold,
  .badge-card.gold.is-unlocked,
  .row-badge.special,
  .badge-card.special.is-unlocked {
    box-shadow: none !important;
  }

  .memory-card .front,
  .memory-card-front {
    background: var(--ds-surface-2) !important;
    color: var(--ds-muted) !important;
    border: 1px solid var(--ds-border) !important;
  }

  .memory-card .back,
  .memory-card-back {
    background: var(--ds-surface) !important;
    border: 1px solid var(--ds-border) !important;
  }

  .reaction-stage.waiting {
    background: #312e1f !important;
  }
  .reaction-stage.ready {
    background: #064e3b !important;
  }
  .reaction-stage.error {
    background: #450a0a !important;
  }
  .reaction-stage.result {
    background: #1e1b4b !important;
  }

  body:not(.dark) .reaction-stage.waiting {
    background: #fef3c7 !important;
  }
  body:not(.dark) .reaction-stage.ready {
    background: #dcfce7 !important;
  }
  body:not(.dark) .reaction-stage.error {
    background: #fee2e2 !important;
  }
  body:not(.dark) .reaction-stage.result {
    background: #e0e7ff !important;
  }

  .reaction-label,
  .reaction-time,
  .reaction-caption,
  .reaction-note,
  .recall-sequence,
  .recall-hidden {
    color: var(--ds-text) !important;
  }

  body.dark .reaction-stage.waiting .reaction-label,
  body.dark .reaction-stage.ready .reaction-label,
  body.dark .reaction-stage.error .reaction-label,
  body.dark .reaction-stage.result .reaction-label,
  body.dark .reaction-stage.waiting .reaction-time,
  body.dark .reaction-stage.ready .reaction-time,
  body.dark .reaction-stage.error .reaction-time,
  body.dark .reaction-stage.result .reaction-time,
  body.dark .reaction-stage.waiting .reaction-caption,
  body.dark .reaction-stage.ready .reaction-caption,
  body.dark .reaction-stage.error .reaction-caption,
  body.dark .reaction-stage.result .reaction-caption,
  body.dark .reaction-stage.waiting .reaction-note,
  body.dark .reaction-stage.ready .reaction-note,
  body.dark .reaction-stage.error .reaction-note,
  body.dark .reaction-stage.result .reaction-note {
    color: #f8fafc !important;
  }

  @media (max-width: 760px) {
    .page-container,
    .dash-main {
      padding: 0 !important;
    }

    .top-nav,
    .global-auth-bar {
      border-radius: var(--ds-radius) !important;
    }

    .navbar-account-actions {
      width: 100%;
      justify-content: flex-start;
    }
  }
`;
document.head.appendChild(toggleStyles);

function applySavedTheme() {
  const theme = localStorage.getItem("quizzy-theme") || "light";
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
  return;
}

function ensureNavbarActions() {
  const nav = document.querySelector(".top-nav");
  if (!nav || nav.querySelector(".navbar-account-actions")) return;

  const user = auth?.getSession?.();
  const actions = document.createElement("div");
  actions.className = "navbar-account-actions";
  actions.innerHTML = `
    ${user ? `<a class="nav-link" href="${buildHref("profile.html")}">Profile</a>` : ""}
    ${user ? `<button class="nav-link nav-action-button" type="button" data-nav-logout>Logout</button>` : ""}
    ${user ? "" : `<a class="nav-link" href="${buildHref("login.html")}">Login</a>`}
    ${user ? "" : `<a class="nav-link" href="${buildHref("register.html")}">Register</a>`}
    <button class="nav-link nav-action-button theme-toggle-btn" type="button" aria-label="Toggle theme" title="Toggle theme">
      <span class="theme-label-light">Light</span>
      <span class="theme-label-dark">Dark</span>
    </button>
  `;

  nav.appendChild(actions);
  actions.querySelector("[data-nav-logout]")?.addEventListener("click", () => auth?.logout?.());
  actions.querySelector(".theme-toggle-btn")?.addEventListener("click", toggleTheme);
}

function applyRoleAwareNavigation() {
  const user = auth?.getSession?.();
  const isTeacher = user?.userType === "teacher";

  document.querySelectorAll('a[href$="teacher-dashboard.html"], a[href$="teacher-review.html"]').forEach((link) => {
    if (!isTeacher) link.remove();
  });

  if (!isTeacher && window.location.pathname.endsWith("/teacher-dashboard.html")) {
    window.location.replace(buildHref("login.html"));
  }
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
ensureNavbarActions();
applyRoleAwareNavigation();
