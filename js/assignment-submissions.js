/**
 * ASSIGNMENT-SUBMISSIONS.JS
 */

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav("assignments");
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
  const asgId = getId();
  if (!asgId) {
    toast("No assignment selected");
    location.href = "assignments.html";
    return;
  }
  const assignment = Store.getById("assignments", asgId);
  if (!assignment) {
    toast("Assignment not found");
    location.href = "assignments.html";
    return;
  }

  document.getElementById("asg-title").textContent = assignment.title;
  document.getElementById("asg-token").textContent = assignment.token;
  const course = Store.getById("courses", assignment.courseId);
  if (course) document.getElementById("asg-course").textContent = course.name;

  render(asgId);
}

function render(asgId) {
  const submissions = Store.filter(
    "submissions",
    (s) => s.assignmentId === asgId,
  );
  const students = Store.get("students");

  const tbody = document.getElementById("subs-body");
  if (!tbody) return;

  if (!submissions.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No submissions yet</td></tr>`;
    return;
  }

  tbody.innerHTML = submissions
    .map((sub) => {
      const stu = students.find((s) => s.id === sub.studentId);
      const name = stu ? `${stu.firstName} ${stu.lastName}` : "Unknown";
      const initials = stu
        ? (stu.firstName[0] + stu.lastName[0]).toUpperCase()
        : "UN";
      return `
      <tr>
        <td><div style="display:flex;align-items:center;gap:8px"><div class="student-avatar" style="width:28px;height:28px;border-radius:50%;background:var(--color-avatar-light-blue);display:grid;place-items:center;font-size:10px;font-weight:600">${initials}</div><span>${escapeHtml(name)}</span></div></td>
        <td>${formatDateTime(sub.submittedAt)}</td>
        <td>${sub.score !== null ? sub.score : "-"}</td>
        <td><span class="tag ${sub.status === "graded" ? "good" : sub.status === "needs-review" ? "warn" : ""}">${sub.status}</span></td>
        <td>
          <button class="btn-light" onclick="openReview('${sub.id}')">Review</button>
          <button class="btn-light" onclick="gradeSubmission('${sub.id}')">Grade</button>
        </td>
      </tr>`;
    })
    .join("");
}

window.openReview = function (subId) {
  const sub = Store.getById("submissions", subId);
  if (!sub) return;
  const student = Store.getById("students", sub.studentId);
  const modal = document.getElementById("review-modal");
  const body = document.getElementById("review-body");
  body.innerHTML = `
    <div style="margin-bottom:16px"><strong>Student:</strong> ${escapeHtml(student ? student.firstName + " " + student.lastName : "Unknown")}<br><strong>Submitted:</strong> ${formatDateTime(sub.submittedAt)}<br><strong>Status:</strong> ${sub.status}</div>
    <div class="form-group"><label class="form-label">Score</label><input type="number" id="review-score" class="form-input" value="${sub.score || ""}" min="0" max="100"></div>
    <div class="form-group" style="margin-top:12px"><label class="form-label">Feedback</label><textarea id="review-feedback" class="form-textarea">${escapeHtml(sub.feedback || "")}</textarea></div>
    <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px"><button class="btn-light" onclick="closeModal('review-modal')">Cancel</button><button class="btn-primary" onclick="saveReview('${subId}')">Save Grade</button></div>
  `;
  openModal("review-modal");
};

window.saveReview = function (subId) {
  const score = parseInt(document.getElementById("review-score").value);
  const feedback = document.getElementById("review-feedback").value;
  Store.update("submissions", subId, {
    score: isNaN(score) ? null : score,
    feedback,
    status: "graded",
  });
  toast("Submission graded");
  closeModal("review-modal");
  render(getId());
};

window.gradeSubmission = function (id) {
  openReview(id);
};
