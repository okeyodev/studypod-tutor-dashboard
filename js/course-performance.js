/**
 * COURSE-PERFORMANCE.JS - Course Performance Detail
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof Store === "undefined") {
    setTimeout(() => location.reload(), 500);
    return;
  }
  setActiveNav("courses");
  init();
});

function getQueryId() {
  return new URLSearchParams(location.search).get("id");
}

function init() {
  const id = getQueryId();
  if (!id) {
    toast("No course selected");
    setTimeout(() => (location.href = "courses.html"), 1000);
    return;
  }
  const course = Store.getById("courses", id);
  if (!course) {
    toast("Course not found");
    setTimeout(() => (location.href = "courses.html"), 1000);
    return;
  }

  document.getElementById("course-name").textContent = course.name;
  document.getElementById("course-token").textContent = course.token;
  const editBtn = document.getElementById("edit-course-btn");
  if (editBtn) editBtn.href = `course-form.html?id=${course.id}`;

  const enrollments = Store.filter(
    "enrollments",
    (e) => e.courseId === course.id,
  );
  const students = Store.get("students");
  const assignments = Store.filter(
    "assignments",
    (a) => a.courseId === course.id,
  );
  const submissions = Store.filter("submissions", (s) => {
    const asg = Store.get("assignments").find((a) => a.id === s.assignmentId);
    return asg && asg.courseId === course.id;
  });
  const quizzes = Store.filter("quizzes", (q) => q.courseId === course.id);
  const attempts = Store.filter("attempts", (a) => {
    const q = Store.get("quizzes").find((qu) => qu.id === a.quizId);
    return q && q.courseId === course.id;
  });

  // KPIs
  const learners = enrollments.length;
  const avgScore = (() => {
    let total = 0,
      cnt = 0;
    submissions
      .filter((s) => s.score !== null)
      .forEach((s) => {
        total += s.score;
        cnt++;
      });
    attempts.forEach((a) => {
      total += a.score;
      cnt++;
    });
    return cnt ? Math.round(total / cnt) : 0;
  })();
  const completion = (() => {
    if (!learners) return 0;
    const graded =
      submissions.filter((s) => s.status === "graded").length + attempts.length;
    return Math.min(100, Math.round((graded / (learners * 2 || 1)) * 100));
  })();
  const revenue = enrollments.reduce(
    (sum, e) => sum + (e.amountPaid?.amount || 0),
    0,
  );

  setText("kpi-learners", learners);
  setText("kpi-completion", completion + "%");
  setText("kpi-score", avgScore);
  setText(
    "kpi-revenue",
    formatCurrency(revenue, course.fee?.currency || "NGN"),
  );

  // Learner Progress
  const progressList = document.getElementById("learner-progress");
  if (progressList) {
    if (!enrollments.length) {
      progressList.innerHTML = `<div class="empty-state"><div class="empty-title">No learners yet</div><div class="empty-sub">Enroll students to see progress</div></div>`;
    } else {
      progressList.innerHTML = enrollments
        .map((en) => {
          const stu = students.find((s) => s.id === en.studentId);
          if (!stu) return "";
          const stuSubs = submissions.filter(
            (s) => s.studentId === stu.id && s.score !== null,
          );
          const stuAtt = attempts.filter((a) => a.studentId === stu.id);
          let total = 0,
            cnt = 0;
          stuSubs.forEach((s) => {
            total += s.score;
            cnt++;
          });
          stuAtt.forEach((a) => {
            total += a.score;
            cnt++;
          });
          const avg = cnt ? Math.round(total / cnt) : 0;
          const initials = (stu.firstName[0] + stu.lastName[0]).toUpperCase();
          return `
          <div class="data-row">
            <div class="row-main">
              <div style="display:flex;align-items:center;gap:10px">
                <div class="student-avatar" style="width:32px;height:32px;border-radius:50%;background:var(--color-avatar-light-blue);display:grid;place-items:center;font-weight:600;font-size:11px">${initials}</div>
                <div><div class="row-title">${escapeHtml(stu.firstName + " " + stu.lastName)}</div><div class="row-meta">${escapeHtml(stu.email)}</div></div>
              </div>
              <div class="progress-line" style="margin-top:8px"><i style="width:${avg}%"></i></div>
            </div>
            <div class="row-actions"><span class="tag good">${avg}%</span><a href="student-profile.html?id=${stu.id}" class="btn-light">View</a></div>
          </div>`;
        })
        .join("");
    }
  }

  // Assignments list
  const asgList = document.getElementById("assignments-list");
  if (asgList) {
    asgList.innerHTML = assignments.length
      ? assignments
          .map((a) => {
            const subs = submissions.filter((s) => s.assignmentId === a.id);
            const needs = subs.filter(
              (s) => s.status === "needs-review",
            ).length;
            return `<div class="data-row"><div class="row-main"><div class="row-title">${escapeHtml(a.title)}</div><div class="row-meta">${subs.length} submissions • ${needs} needs review • Due ${formatDate(a.dueDate)}</div></div><div class="row-actions"><a href="assignment-submissions.html?id=${a.id}" class="btn-light">View</a></div></div>`;
          })
          .join("")
      : `<div class="empty-state"><div class="empty-sub">No assignments for this course</div><a href="assignment-form.html?courseId=${course.id}" class="btn-primary" style="margin-top:12px">Create Assignment</a></div>`;
  }

  // Quizzes
  const quizList = document.getElementById("quizzes-list");
  if (quizList) {
    quizList.innerHTML = quizzes.length
      ? quizzes
          .map((q) => {
            const qAttempts = attempts.filter((a) => a.quizId === q.id);
            const avg = qAttempts.length
              ? Math.round(
                  qAttempts.reduce((s, a) => s + a.score, 0) / qAttempts.length,
                )
              : 0;
            return `<div class="data-row"><div class="row-main"><div class="row-title">${escapeHtml(q.title)}</div><div class="row-meta">${qAttempts.length} attempts • Avg ${avg}%</div></div><div class="row-actions"><a href="quiz-performance.html?id=${q.id}" class="btn-light">Performance</a></div></div>`;
          })
          .join("")
      : `<div class="empty-state"><div class="empty-sub">No quizzes for this course</div></div>`;
  }

  // Top students
  const topList = document.getElementById("top-students");
  if (topList) {
    const studentScores = enrollments
      .map((en) => {
        const stu = students.find((s) => s.id === en.studentId);
        if (!stu) return null;
        let total = 0,
          cnt = 0;
        submissions
          .filter((s) => s.studentId === stu.id)
          .forEach((s) => {
            if (s.score !== null) {
              total += s.score;
              cnt++;
            }
          });
        attempts
          .filter((a) => a.studentId === stu.id)
          .forEach((a) => {
            total += a.score;
            cnt++;
          });
        return { stu, avg: cnt ? Math.round(total / cnt) : 0 };
      })
      .filter(Boolean)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
    topList.innerHTML =
      studentScores
        .map(
          ({ stu, avg }) => `
      <div class="data-row"><div class="row-main"><div class="row-title">${escapeHtml(stu.firstName + " " + stu.lastName)}</div><div class="row-meta">Score ${avg}</div></div><span class="tag good">${avg}%</span></div>
    `,
        )
        .join("") || `<div class="empty-sub">No performance data yet</div>`;
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
