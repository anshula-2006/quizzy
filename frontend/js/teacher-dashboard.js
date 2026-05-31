import auth from "../auth.js";
import { apiRequest, escapeHtml } from "./shared.js";

const root = document.getElementById("teacherDashboardRoot");

function formatDate(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "No activity";
  return dt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statCard(label, value, helper) {
  return `
    <article class="dash-stat-card teacher-stat-card">
      <span class="saas-stat-label">${label}</span>
      <strong class="saas-stat-value">${value}</strong>
      <span class="saas-stat-helper">${helper}</span>
    </article>
  `;
}

function renderAccessMessage() {
  root.innerHTML = `
    <section class="panel flow-card teacher-hero">
      <div>
        <p class="eyebrow">Teacher Dashboard</p>
        <h1 class="section-title">Teacher account required</h1>
        <p class="section-copy">Create or sign in with a Teacher account to view real classroom quiz activity.</p>
      </div>
      <div class="dashboard-actions">
        <a class="btn btn-primary" href="./register.html">Create Teacher Account</a>
        <a class="btn btn-secondary" href="./login.html">Sign In</a>
      </div>
    </section>
  `;
}

function renderEmpty(data) {
  root.innerHTML = `
    <section class="panel flow-card teacher-hero">
      <div>
        <p class="eyebrow">Teacher Dashboard</p>
        <h1 class="section-title">No student activity yet</h1>
        <p class="section-copy">This dashboard uses real registered learners and submitted quiz attempts. Student rows will appear after learners complete quizzes.</p>
      </div>
      <a class="btn btn-primary" href="./generate.html">Create a Quiz</a>
    </section>
    <div class="dashboard-stat-grid teacher-stat-grid">
      ${statCard("Registered learners", data?.summary?.totalStudents || 0, "Real accounts")}
      ${statCard("Active learners", data?.summary?.activeStudents || 0, "Completed quizzes")}
      ${statCard("Quiz attempts", data?.summary?.totalAttempts || 0, "Submitted attempts")}
      ${statCard("Average accuracy", `${data?.summary?.averageAccuracy || 0}%`, "Across attempts")}
    </div>
  `;
}

function renderDashboard(data) {
  const summary = data.summary || {};
  const students = Array.isArray(data.students) ? data.students : [];
  const recentAttempts = Array.isArray(data.recentAttempts) ? data.recentAttempts : [];
  const topicStats = Array.isArray(data.topicStats) ? data.topicStats : [];

  if (!students.length && !recentAttempts.length) {
    renderEmpty(data);
    return;
  }

  root.innerHTML = `
    <section class="panel flow-card teacher-hero">
      <div>
        <p class="eyebrow">Teacher Dashboard</p>
        <h1 class="section-title">Classroom insights</h1>
        <p class="section-copy">Real quiz activity for registered Quizzy learners. No sample students or fake rows are shown.</p>
      </div>
      <div class="dashboard-actions">
        <a class="btn btn-primary" href="./generate.html">Create Assessment</a>
        <a class="btn btn-secondary" href="./scoreboard.html">Open Leaderboard</a>
      </div>
    </section>

    <div class="dashboard-stat-grid teacher-stat-grid">
      ${statCard("Registered learners", summary.totalStudents || 0, "Student/self learner accounts")}
      ${statCard("Active learners", summary.activeStudents || 0, "With quiz progress")}
      ${statCard("Quiz attempts", summary.totalAttempts || 0, "Latest stored attempts")}
      ${statCard("Average accuracy", `${summary.averageAccuracy || 0}%`, `${summary.totalQuestions || 0} answered questions`)}
    </div>

    <div class="teacher-grid">
      <section class="panel flow-card">
        <div class="card-title-row">
          <div>
            <strong class="section-title">Learner Progress</strong>
            <span class="section-copy">Actual registered learners and their stored progress.</span>
          </div>
        </div>
        <div class="teacher-table-wrap">
          <table class="teacher-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Type</th>
                <th>Quizzes</th>
                <th>Accuracy</th>
                <th>Best</th>
                <th>XP</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              ${students.map((student) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(student.name)}</strong>
                    <span>${escapeHtml(student.email)}</span>
                  </td>
                  <td>${escapeHtml(student.grade || student.userType || "student")}</td>
                  <td>${student.totalQuizzes}</td>
                  <td>${student.accuracy}%</td>
                  <td>${student.bestPercentage}%</td>
                  <td>${student.totalXp}</td>
                  <td>${formatDate(student.lastAttemptAt)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>

      <div class="dashboard-side-grid">
        <section class="panel flow-card">
          <div class="dashboard-block">
            <div>
              <strong class="section-title">Topic Signals</strong>
              <p class="section-copy">Most attempted topics from real submissions.</p>
            </div>
            <div class="teacher-topic-list">
              ${topicStats.length ? topicStats.map((topic) => `
                <article class="teacher-topic-row">
                  <div>
                    <strong>${escapeHtml(topic.topic)}</strong>
                    <span>${topic.attempts} attempt${topic.attempts === 1 ? "" : "s"}</span>
                  </div>
                  <b>${topic.accuracy}%</b>
                </article>
              `).join("") : `<p class="section-copy">No topic attempts recorded yet.</p>`}
            </div>
          </div>
        </section>

        <section class="panel flow-card">
          <div class="dashboard-block">
            <div>
              <strong class="section-title">Recent Attempts</strong>
              <p class="section-copy">Latest submitted quizzes by learners.</p>
            </div>
            <div class="dashboard-list">
              ${recentAttempts.length ? recentAttempts.map((attempt) => `
                <article class="dashboard-activity-item">
                  <div style="display:flex; justify-content:space-between; gap:12px;">
                    <div>
                      <strong>${escapeHtml(attempt.studentName)}</strong>
                      <span class="section-copy">${escapeHtml(attempt.topic)}</span>
                    </div>
                    <b>${attempt.percentage}%</b>
                  </div>
                  <span class="section-copy">${attempt.score}/${attempt.total} correct · ${escapeHtml(attempt.difficulty)} · ${formatDate(attempt.createdAt)}</span>
                </article>
              `).join("") : `<p class="section-copy">No quiz attempts submitted yet.</p>`}
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
}

async function init() {
  const session = auth?.getSession?.();
  if (!session) {
    renderAccessMessage();
    return;
  }

  if ((session.userType || "student") !== "teacher") {
    renderAccessMessage();
    return;
  }

  const data = await apiRequest("/data/teacher-dashboard");
  if (!data) {
    renderAccessMessage();
    return;
  }

  renderDashboard(data);
}

init();
