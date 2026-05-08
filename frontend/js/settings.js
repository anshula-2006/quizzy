const root = document.getElementById("settingsRoot");

const defaults = {
  emailDigest: true,
  badgeAlerts: true,
  leaderboardPrivacy: false,
  compactMode: true,
  reducedMotion: false
};

function readSettings() {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem("quizzy-settings-v1") || "{}")) };
  } catch {
    return defaults;
  }
}

function saveSettings(settings) {
  localStorage.setItem("quizzy-settings-v1", JSON.stringify(settings));
}

let settings = readSettings();

function row(key, title, copy) {
  return `
    <label class="settings-row">
      <span><strong>${title}</strong><em>${copy}</em></span>
      <input type="checkbox" data-setting="${key}" ${settings[key] ? "checked" : ""} />
      <i></i>
    </label>
  `;
}

function render() {
  root.innerHTML = `
    <section class="panel dashboard-command">
      <div>
        <p class="eyebrow">Settings</p>
        <h1>Workspace preferences</h1>
        <p>Compact account, notification, privacy, and interface controls.</p>
      </div>
    </section>
    <section class="settings-layout">
      <article class="panel flow-card">
        <div class="card-title-row"><div><strong>Notifications</strong><span>Control product updates and progress alerts</span></div></div>
        ${row("emailDigest", "Weekly digest", "Receive a summary of quizzes, XP, and progress.")}
        ${row("badgeAlerts", "Badge alerts", "Show achievement unlock notifications.")}
      </article>
      <article class="panel flow-card">
        <div class="card-title-row"><div><strong>Privacy</strong><span>Choose how your competitive profile appears</span></div></div>
        ${row("leaderboardPrivacy", "Private leaderboard name", "Hide your full name from public ranking views.")}
      </article>
      <article class="panel flow-card">
        <div class="card-title-row"><div><strong>Interface</strong><span>Keep the product compact and professional</span></div></div>
        ${row("compactMode", "Compact mode", "Use denser cards and shorter page sections.")}
        ${row("reducedMotion", "Reduced motion", "Minimize page and card transitions.")}
      </article>
    </section>
  `;

  document.querySelectorAll("[data-setting]").forEach((input) => {
    input.addEventListener("change", () => {
      settings = { ...settings, [input.dataset.setting]: input.checked };
      saveSettings(settings);
    });
  });
}

render();
