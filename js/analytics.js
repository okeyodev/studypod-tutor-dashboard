/**
 * ANALYTICS.JS - Analytics page with real data from Store
 */

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav("analytics");
  init();
});

function init() {
  if (typeof Store === "undefined") {
    setTimeout(init, 200);
    return;
  }
  renderKPIs();
  renderCharts();
  renderBreakdown();
  window.addEventListener("studypod:datachange", () => {
    renderKPIs();
    renderBreakdown();
  });
}

function renderKPIs() {
  const students = Store.get("students");
  const courses = Store.get("courses");
  const enrollments = Store.get("enrollments");
  const conferences = Store.get("conferences");
  const registrations = Store.get("registrations");
  const assignments = Store.get("assignments");
  const submissions = Store.get("submissions");
  const quizzes = Store.get("quizzes");
  const attempts = Store.get("attempts");

  const totalRevenue =
    enrollments.reduce((sum, e) => sum + (e.amountPaid?.amount || 0), 0) +
    registrations.reduce((sum, r) => sum + (r.amount?.amount || 0), 0);
  const avgQuiz = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length)
    : 0;
  const completionRate = (() => {
    let total = 0,
      cnt = 0;
    attempts.forEach((a) => {
      total += a.score;
      cnt++;
    });
    submissions
      .filter((s) => s.score !== null)
      .forEach((s) => {
        total += s.score;
        cnt++;
      });
    return cnt ? Math.round(total / cnt) : 0;
  })();

  setText("total-students", students.length);
  setText("total-courses", courses.length);
  setText("total-enrollments", enrollments.length);
  setText("total-revenue", formatCurrency(totalRevenue, "NGN"));
  setText("avg-quiz-score", avgQuiz + "%");
  setText("completion-rate", completionRate + "%");
  setText("total-conferences", conferences.length);
  setText("total-registrations", registrations.length);
  setText("total-assignments", assignments.length);
  setText("total-submissions", submissions.length);
}

function renderCharts() {
  const canvas = document.getElementById("enrollment-chart");
  if (!canvas) return;
  const enrollments = Store.get("enrollments");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const counts = new Array(12).fill(0);
  enrollments.forEach((e) => {
    try {
      const d = new Date(e.enrolledAt);
      counts[d.getMonth()]++;
    } catch (e) {}
  });
  const hasData = counts.some((c) => c > 0);
  const data = hasData ? counts : [2, 3, 5, 4, 6, 8, 7, 5, 4, 3, 2, 1];
  const max = Math.max(...data, 1);

  const templateBar = document.getElementById("analytics-chart-bar-template");

  if (templateBar && templateBar.content) {
    // PHP-ready path
    canvas.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "display:flex;align-items:flex-end;gap:8px;height:160px;padding:10px";
    data.forEach((v, i) => {
      const clone = templateBar.content.cloneNode(true);
      const bar = clone.querySelector(".chart-bar");
      if (bar) bar.style.height = `${(v / max) * 120}px`;
      const label = clone.querySelector(".chart-label");
      if (label) label.textContent = months[i];
      wrapper.appendChild(clone);
    });
    canvas.appendChild(wrapper);
  } else {
    // Fallback
    canvas.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:8px;height:160px;padding:10px">
      ${data.map((v, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px"><div style="width:100%;background:var(--color-primary);border-radius:6px 6px 0 0;height:${(v / max) * 120}px;min-height:4px;transition:height 1s ease"></div><span style="font-size:10px;color:var(--text-muted)">${months[i]}</span></div>`).join("")}
    </div>
  `;
  }
}

function renderBreakdown() {
  const container = document.getElementById("course-breakdown");
  if (!container) return;
  const courses = Store.get("courses");
  const enrollments = Store.get("enrollments");
  const submissions = Store.get("submissions");
  const attempts = Store.get("attempts");

  const template = document.getElementById("analytics-course-row-template");
  container.innerHTML = "";

  if (!courses.length) {
    container.innerHTML = `<div class="empty-state">No courses yet</div>`;
    return;
  }

  if (template && template.content) {
    // PHP-ready path: clone from HTML template
    const fragment = document.createDocumentFragment();
    courses.forEach((course) => {
      const courseEnroll = enrollments.filter(
        (e) => e.courseId === course.id,
      ).length;
      const courseSubs = submissions.filter((s) => {
        const asg = Store.getById("assignments", s.assignmentId);
        return asg && asg.courseId === course.id;
      });
      const courseAtt = attempts.filter((a) => {
        const q = Store.getById("quizzes", a.quizId);
        return q && q.courseId === course.id;
      });
      const avg = (() => {
        let t = 0,
          c = 0;
        courseSubs
          .filter((s) => s.score !== null)
          .forEach((s) => {
            t += s.score;
            c++;
          });
        courseAtt.forEach((a) => {
          t += a.score;
          c++;
        });
        return c ? Math.round(t / c) : 0;
      })();

      const clone = template.content.cloneNode(true);
      const row = clone.querySelector(".data-row");
      const titleEl = clone.querySelector(".row-title");
      if (titleEl) titleEl.textContent = course.name;
      const metaEl = clone.querySelector(".row-meta");
      if (metaEl)
        metaEl.textContent = `${courseEnroll} learners • ${courseSubs.length} submissions • ${courseAtt.length} quiz attempts`;
      const progressI = clone.querySelector(".progress-line i");
      if (progressI) progressI.style.width = `${avg}%`;
      const tagEl = clone.querySelector(".tag");
      if (tagEl) tagEl.textContent = `${avg}% avg`;
      const linkEl = clone.querySelector("a.btn-light");
      if (linkEl) linkEl.href = `course-performance.html?id=${course.id}`;

      fragment.appendChild(clone);
    });
    container.appendChild(fragment);
  } else {
    // Fallback original string template
    container.innerHTML =
      courses
        .map((course) => {
          const courseEnroll = enrollments.filter(
            (e) => e.courseId === course.id,
          ).length;
          const courseSubs = submissions.filter((s) => {
            const asg = Store.getById("assignments", s.assignmentId);
            return asg && asg.courseId === course.id;
          });
          const courseAtt = attempts.filter((a) => {
            const q = Store.getById("quizzes", a.quizId);
            return q && q.courseId === course.id;
          });
          const avg = (() => {
            let t = 0,
              c = 0;
            courseSubs
              .filter((s) => s.score !== null)
              .forEach((s) => {
                t += s.score;
                c++;
              });
            courseAtt.forEach((a) => {
              t += a.score;
              c++;
            });
            return c ? Math.round(t / c) : 0;
          })();
          return `
      <div class="data-row">
        <div class="row-main">
          <div class="row-title">${escapeHtml(course.name)}</div>
          <div class="row-meta">${courseEnroll} learners • ${courseSubs.length} submissions • ${courseAtt.length} quiz attempts</div>
          <div class="progress-line"><i style="width:${avg}%"></i></div>
        </div>
        <div class="row-actions"><span class="tag good">${avg}% avg</span><a href="course-performance.html?id=${course.id}" class="btn-light">View</a></div>
      </div>`;
        })
        .join("") || `<div class="empty-state">No courses yet</div>`;
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
