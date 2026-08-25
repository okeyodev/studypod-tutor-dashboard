/**
 * QUIZ-PERFORMANCE.JS
 */

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav("quizzes");
  init();
});

function getId() {
  return new URLSearchParams(location.search).get("id");
}

function init() {
  if (typeof Store === "undefined") {
    setTimeout(init, 200);
    return;
  }
  const id = getId();
  if (!id) {
    toast("No quiz selected");
    location.href = "quizzes.html";
    return;
  }
  const quiz = Store.getById("quizzes", id);
  if (!quiz) {
    toast("Quiz not found");
    location.href = "quizzes.html";
    return;
  }

  document.getElementById("quiz-title").textContent = quiz.title;
  document.getElementById("quiz-token").textContent = quiz.token;
  const course = Store.getById("courses", quiz.courseId);
  if (course) document.getElementById("quiz-course").textContent = course.name;

  const questions = Store.filter("questions", (q) => q.quizId === id);
  const attempts = Store.filter("attempts", (a) => a.quizId === id);

  setText("q-count", questions.length);
  setText("attempts-count", attempts.length);

  const avg = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
    : 0;
  const highest = attempts.length
    ? Math.max(...attempts.map((a) => a.score))
    : 0;
  const passRate = attempts.length
    ? Math.round(
        (attempts.filter((a) => a.score >= quiz.passingScore).length /
          attempts.length) *
          100,
      )
    : 0;

  setText("avg-score", avg + "%");
  setText("pass-rate", passRate + "%");
  setText("highest-score", highest + "%");

  const tbody = document.getElementById("perf-body");
  if (!tbody) return;
  if (!attempts.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No attempts yet</td></tr>`;
    return;
  }
  const students = Store.get("students");
  tbody.innerHTML = attempts
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .map((att) => {
      const stu = students.find((s) => s.id === att.studentId);
      const name = stu ? `${stu.firstName} ${stu.lastName}` : "Unknown";
      return `
      <tr>
        <td><div style="font-weight:500">${escapeHtml(name)}</div><div style="font-size:11px;color:var(--text-muted)">${escapeHtml(stu?.email || "")}</div></td>
        <td>${att.score}%</td>
        <td>${att.correctAnswers}/${att.totalQuestions}</td>
        <td>${att.duration} min</td>
        <td><span class="tag ${att.score >= quiz.passingScore ? "good" : "warn"}">${att.score >= quiz.passingScore ? "Passed" : "Failed"}</span></td>
        <td><button class="btn-light" onclick="viewAttempt('${att.id}')">View</button></td>
      </tr>`;
    })
    .join("");
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

window.viewAttempt = function (id) {
  const att = Store.getById("attempts", id);
  if (!att) return;
  const stu = Store.getById("students", att.studentId);
  const modal = document.getElementById("attempt-modal");
  const body = document.getElementById("attempt-body");
  body.innerHTML = `
    <div style="margin-bottom:16px"><strong>Student:</strong> ${escapeHtml(stu ? stu.firstName + " " + stu.lastName : "Unknown")}<br><strong>Score:</strong> ${att.score}% (${att.correctAnswers}/${att.totalQuestions})<br><strong>Duration:</strong> ${att.duration} min<br><strong>Completed:</strong> ${formatDateTime(att.completedAt)}</div>
    <div style="display:flex;justify-content:flex-end"><button class="btn-light" onclick="closeModal('attempt-modal')">Close</button></div>
  `;
  openModal("attempt-modal");
};
