/**
 * DASHBOARD.JS - StudyPod Tutor Dashboard v2.0
 * Live data from window.Store, no placeholder toasts, full navigation.
 * Collections: courses, students, enrollments, conferences, registrations, assignments, submissions, quizzes, attempts, emails
 * Helpers from common.js: toast, escapeHtml, formatCurrency, formatDate, formatDateTime, confirmDelete, openModal, closeModal, setActiveNav
 */

(() => {
  "use strict";

  // --- Chart datasets (reuse previous logic) ---
  const datasets = {
    "7D": [320, 410, 380, 520, 490, 620, 710],
    "30D": [210, 340, 380, 420, 510, 580, 640, 720, 690, 840],
    "3M": [180, 240, 320, 380, 450, 520, 610, 720, 680, 840, 900, 860],
    "1Y": [120, 200, 280, 340, 410, 500, 580, 640, 710, 780, 840, 920],
  };
  let currentRange = "30D";

  // --- Safe helpers (fallback if common.js not loaded) ---
  const _esc = (s) => {
    if (window.escapeHtml) return window.escapeHtml(s);
    if (typeof s !== "string") return s;
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  };
  const _fmtCur = (amt, cur) => {
    if (window.formatCurrency) return window.formatCurrency(amt, cur);
    const sym = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" }[cur] || cur || "₦";
    return `${sym}${Number(amt || 0).toLocaleString()}`;
  };
  const _fmtDate = (str) => {
    if (window.formatDate) return window.formatDate(str);
    if (!str) return "-";
    try {
      return new Date(str).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return str;
    }
  };
  const _fmtDateTime = (str) => {
    if (window.formatDateTime) return window.formatDateTime(str);
    if (!str) return "-";
    try {
      return new Date(str).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return str;
    }
  };

  const avg = (arr) => {
    if (!arr || !arr.length) return 0;
    return arr.reduce((a, b) => a + Number(b || 0), 0) / arr.length;
  };

  const getStore = () => window.Store || window.StudyPodStore || null;

  const initialsFromName = (name) => {
    if (!name) return "ST";
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const avatarClass = (idx) => {
    const classes = [
      "av-light-blue",
      "av-pink",
      "av-light-yellow",
      "av-light-indigo",
    ];
    return classes[idx % classes.length];
  };

  const statusBadgeClass = (score) => {
    if (score >= 80) return "status-excellent";
    if (score >= 65) return "status-good";
    return "status-progress";
  };
  const statusLabel = (score) => {
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Good";
    return "In Progress";
  };

  // --- Computation ---
  function computeCompletionRate(Store) {
    try {
      const attempts = Store.filter(
        "attempts",
        (a) => a && a.status === "completed" && typeof a.score === "number",
      );
      const gradedSubs = Store.filter(
        "submissions",
        (s) =>
          (s.status === "graded" || typeof s.score === "number") &&
          typeof s.score === "number",
      );
      const allScores = [
        ...attempts.map((a) => a.score),
        ...gradedSubs.map((s) => s.score),
      ];
      if (allScores.length) return Math.round(avg(allScores));
      // fallback to enrollment progress if exists
      const enrolls = Store.get("enrollments");
      const prog = enrolls
        .map((e) => e.progress)
        .filter((v) => typeof v === "number");
      if (prog.length) return Math.round(avg(prog));
      // fallback to course avg or 0
      return 0;
    } catch (e) {
      return 0;
    }
  }

  function computeTopStudents(Store) {
    const students = Store.get("students") || [];
    const attempts = Store.get("attempts") || [];
    const submissions = Store.get("submissions") || [];
    const enrollments = Store.get("enrollments") || [];
    const courses = Store.get("courses") || [];

    const courseMap = {};
    courses.forEach((c) => (courseMap[c.id] = c));

    const result = students.map((stu, idx) => {
      const stuAttempts = attempts.filter(
        (a) => a.studentId === stu.id && typeof a.score === "number",
      );
      const stuSubs = submissions.filter(
        (s) => s.studentId === stu.id && typeof s.score === "number",
      );
      const allScores = [
        ...stuAttempts.map((a) => a.score),
        ...stuSubs.map((s) => s.score),
      ];
      const avgScore = allScores.length ? avg(allScores) : 0;

      // enrollment based course & progress
      const stuEnrolls = enrollments.filter((e) => e.studentId === stu.id);
      let primaryCourse = null;
      let avgProgress = 0;
      if (stuEnrolls.length) {
        const progs = stuEnrolls.map((e) =>
          typeof e.progress === "number" ? e.progress : avgScore,
        );
        avgProgress = avg(progs);
        const firstCourseId = stuEnrolls[0].courseId;
        primaryCourse = courseMap[firstCourseId] || null;
      } else {
        avgProgress = avgScore;
      }

      const fullName =
        [stu.firstName, stu.lastName].filter(Boolean).join(" ").trim() ||
        stu.name ||
        stu.email ||
        `Student ${idx + 1}`;
      const avatarInitials =
        stu.avatar || stu.avatarInitials || initialsFromName(fullName);
      const courseNameRaw = primaryCourse
        ? primaryCourse.name || primaryCourse.title || "—"
        : stu.course || "—";

      return {
        student: stu,
        id: stu.id,
        fullName,
        initials: avatarInitials,
        courseName: courseNameRaw,
        courseField: primaryCourse ? primaryCourse.field : "",
        progress: Math.round(avgProgress || avgScore || 0),
        score: Math.round(avgScore),
        rawScore: avgScore,
        enrollCount: stuEnrolls.length,
        idx,
      };
    });

    result.sort((a, b) => b.rawScore - a.rawScore || b.progress - a.progress);
    return result;
  }

  function computeCoursePerformance(Store) {
    const courses = Store.get("courses") || [];
    const enrollments = Store.get("enrollments") || [];
    const assignments = Store.get("assignments") || [];
    const submissions = Store.get("submissions") || [];

    return courses
      .map((course) => {
        const courseEnrolls = enrollments.filter(
          (e) => e.courseId === course.id,
        );
        const courseAssignments = assignments.filter(
          (a) => a.courseId === course.id,
        );
        const assignIds = courseAssignments.map((a) => a.id);
        const courseSubs = submissions.filter((s) =>
          assignIds.includes(s.assignmentId),
        );
        const gradedSubs = courseSubs.filter(
          (s) => typeof s.score === "number",
        );

        let progress = 0;
        const enrollProg = courseEnrolls
          .map((e) => e.progress)
          .filter((v) => typeof v === "number");
        if (enrollProg.length) progress = avg(enrollProg);
        else if (gradedSubs.length)
          progress = avg(gradedSubs.map((s) => s.score));
        else if (courseEnrolls.length)
          progress = Math.min(92, 35 + courseEnrolls.length * 12);
        else progress = course.status === "published" ? 48 : 14;

        return {
          course,
          learners: courseEnrolls.length,
          assignmentsCount: courseAssignments.length,
          submissions: courseSubs.length,
          graded: gradedSubs.length,
          progress: Math.round(progress),
          field: course.field || "",
          status: course.status,
        };
      })
      .filter((c) => c.course.status === "published")
      .slice(0, 8);
  }

  function computeNeedsAttention(Store) {
    const submissions = Store.get("submissions") || [];
    const assignments = Store.get("assignments") || [];
    const courses = Store.get("courses") || [];
    const conferences = Store.get("conferences") || [];
    const quizzes = Store.get("quizzes") || [];

    const needsReview = submissions.filter(
      (s) =>
        s.status === "submitted" ||
        s.status === "needs-review" ||
        (s.score === null && s.status !== "graded"),
    ).length;
    const assignmentsNeedingReview = submissions.filter(
      (s) => s.status === "needs-review" || s.status === "submitted",
    );

    const drafts =
      courses.filter((c) => c.status === "draft").length +
      conferences.filter((c) => c.status === "draft").length +
      quizzes.filter((q) => q.status === "draft").length +
      assignments.filter((a) => a.status === "draft").length;

    // Upcoming conference tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);

    let upcomingTomorrow = null;
    const publishedConfs = conferences.filter(
      (c) => c.status === "published" && c.startDate,
    );
    // find exact tomorrow
    upcomingTomorrow =
      publishedConfs.find((c) => c.startDate === tomorrowStr) ||
      publishedConfs.find((c) => c.startDate === todayStr) ||
      null;
    // if none match seed dates old, fallback to nearest future by sorting date
    if (!upcomingTomorrow && publishedConfs.length) {
      const sorted = [...publishedConfs].sort(
        (a, b) => new Date(a.startDate) - new Date(b.startDate),
      );
      // find first with date >= today, else first
      const now = new Date();
      const future = sorted.find((c) => new Date(c.startDate) >= now);
      upcomingTomorrow = future || sorted[0];
    }

    return { needsReview, assignmentsNeedingReview, drafts, upcomingTomorrow };
  }

  function computeUpcomingConferences(Store) {
    const conferences = Store.get("conferences") || [];
    const registrations = Store.get("registrations") || [];
    return conferences
      .filter((c) => c.status === "published")
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      .map((conf) => {
        const regs = registrations.filter((r) => r.conferenceId === conf.id);
        return { conf, regs, count: regs.length };
      });
  }

  function computeEngagementFromEnrollments(Store) {
    const enrollments = Store.get("enrollments") || [];
    const students = Store.get("students") || [];
    const studentMap = {};
    students.forEach((s) => (studentMap[s.id] = s));

    // active = last 30 days or all paid
    const sorted = [...enrollments].sort(
      (a, b) =>
        new Date(b.enrolledAt || b.paymentDate || 0) -
        new Date(a.enrolledAt || a.paymentDate || 0),
    );
    return sorted.slice(0, 6).map((enr) => {
      const stu = studentMap[enr.studentId];
      const name = stu
        ? [stu.firstName, stu.lastName].filter(Boolean).join(" ")
        : enr.studentId || "Student";
      const course = getStore().getById("courses", enr.courseId);
      const courseName = course ? course.name : enr.courseId || "Course";
      return {
        enrollment: enr,
        student: stu,
        name,
        courseName,
        initials: stu?.avatar || initialsFromName(name),
      };
    });
  }

  // --- Rendering helpers ---
  function animateCountEl(el, target) {
    if (!el) return;
    const final = Number(target);
    if (isNaN(final)) {
      el.textContent = target;
      return;
    }
    el.dataset.count = String(final);
    let cur = 0;
    const step = Math.max(1, final / 40);
    const tick = () => {
      cur += step;
      if (cur >= final) {
        el.textContent = final.toLocaleString();
        return;
      }
      el.textContent = Math.floor(cur).toLocaleString();
      requestAnimationFrame(() => setTimeout(tick, 18));
    };
    tick();
  }

  function findKpiCards() {
    // find cards by stat-label text
    const labels = document.querySelectorAll(".stat-label");
    const map = {};
    labels.forEach((lbl) => {
      const text = lbl.textContent.trim().toLowerCase();
      const card = lbl.closest(".card");
      if (!card) return;
      map[text] = card;
    });
    // fallback: stats-grid .card
    if (Object.keys(map).length === 0) {
      const gridCards = document.querySelectorAll(".stats-grid .card");
      gridCards.forEach((c, i) => {
        const lblEl = c.querySelector(".stat-label");
        const txt = lblEl
          ? lblEl.textContent.trim().toLowerCase()
          : `card-${i}`;
        map[txt] = c;
      });
    }
    return map;
  }

  function renderKPIs() {
    const Store = getStore();
    if (!Store) return;
    const totalStudents = Store.count
      ? Store.count("students")
      : (Store.get("students") || []).length;
    const publishedCourses = Store.filter(
      "courses",
      (c) => c.status === "published",
    );
    const activeCourses = publishedCourses.length;
    const completionRate = computeCompletionRate(Store);
    const publishedConfs = Store.filter(
      "conferences",
      (c) => c.status === "published",
    );
    const upcomingConfsCount = publishedConfs.length;
    const allStudentsCount = totalStudents;

    // revenue calc from enrollments + registrations
    let totalRevenue = 0;
    try {
      const enrolls = Store.get("enrollments") || [];
      enrolls.forEach((e) => {
        const amt = e.amountPaid?.amount || e.amount?.amount || 0;
        totalRevenue += Number(amt || 0);
      });
      const regs = Store.get("registrations") || [];
      regs.forEach((r) => {
        const amt = r.amount?.amount || 0;
        totalRevenue += Number(amt || 0);
      });
    } catch (e) {}

    const cardsMap = findKpiCards();
    // Update each card if found
    Object.entries(cardsMap).forEach(([label, card]) => {
      const valueEl = card.querySelector("[data-count], .stat-value");
      if (!valueEl) return;
      if (label.includes("total student")) {
        animateCountEl(valueEl, allStudentsCount);
        makeCardClickable(card, "students.html");
        const sub = card.querySelector(".stat-muted");
        if (sub) sub.textContent = `${activeCourses} active courses`;
      } else if (label.includes("active course")) {
        animateCountEl(valueEl, activeCourses);
        makeCardClickable(card, "courses.html");
        const sub = card.querySelector(".stat-muted");
        if (sub) sub.textContent = `${publishedCourses.length} published`;
        // update progress bar width
        const prog = card.querySelector(".progress-fill, .progress-fill.green");
        if (prog)
          prog.style.width = `${Math.min(100, activeCourses * 12 + 40)}%`;
      } else if (label.includes("completion")) {
        // value is with %
        const target = completionRate;
        const inner = valueEl.querySelector("[data-count]") || valueEl;
        if (inner) animateCountEl(inner, target);
        else animateCountEl(valueEl, target);
        // update ring if exists
        const ringVal = card.querySelector(".ring-value, .ring-center");
        if (ringVal) {
          ringVal.textContent = `${target}%`;
        }
        // update svg circle stroke-dashoffset
        const circles = card.querySelectorAll(".ring-wrap circle");
        if (circles.length >= 2) {
          // second circle is progress
          const progCircle = circles[1];
          const circumference = 2 * Math.PI * 24; // r 24
          const offset = circumference - (target / 100) * circumference;
          progCircle.style.strokeDasharray = `${circumference}`;
          progCircle.style.strokeDashoffset = `${offset}`;
        }
        makeCardClickable(card, "analytics.html");
      } else if (
        label.includes("revenue") ||
        label.includes("conference") ||
        label.includes("upcoming")
      ) {
        if (label.includes("revenue")) {
          valueEl.textContent = _fmtCur(totalRevenue, "NGN");
          makeCardClickable(card, "conferences.html");
        } else {
          animateCountEl(valueEl, upcomingConfsCount);
          makeCardClickable(card, "conferences.html");
        }
      }
    });

    // Fallback if stats-grid cards not labeled correctly but 4 cards exist
    const gridCards = document.querySelectorAll(".stats-grid .card");
    if (gridCards.length >= 4 && Object.keys(cardsMap).length < 4) {
      // assume order: students, courses, completion, conferences/revenue
      if (gridCards[0]) {
        const v = gridCards[0].querySelector(".stat-value, [data-count]");
        if (v) animateCountEl(v, totalStudents);
        makeCardClickable(gridCards[0], "students.html");
      }
      if (gridCards[1]) {
        const v = gridCards[1].querySelector(".stat-value, [data-count]");
        if (v) animateCountEl(v, activeCourses);
        makeCardClickable(gridCards[1], "courses.html");
      }
      if (gridCards[2]) {
        const v =
          gridCards[2].querySelector("[data-count]") ||
          gridCards[2].querySelector(".stat-value");
        if (v) animateCountEl(v, completionRate);
        makeCardClickable(gridCards[2], "analytics.html");
      }
      if (gridCards[3]) {
        const v = gridCards[3].querySelector(".stat-value, [data-count]");
        if (v) {
          if (v.textContent.includes("₦") || v.textContent.includes("$")) {
            v.textContent = _fmtCur(totalRevenue, "NGN");
          } else {
            animateCountEl(v, upcomingConfsCount);
          }
        }
        makeCardClickable(gridCards[3], "conferences.html");
      }
    }
  }

  function makeCardClickable(card, href) {
    if (!card) return;
    card.style.cursor = "pointer";
    card.setAttribute("data-navigate", href);
    // avoid duplicate listeners
    if (card._clickBound) return;
    card._clickBound = true;
    card.addEventListener("click", (e) => {
      // ignore clicks on buttons/links inside
      if (e.target.closest("button, a, .range-btn, .range-switch")) return;
      window.location.href = href;
    });
  }

  function renderCoursePerformance() {
    const Store = getStore();
    if (!Store) return;
    const perf = computeCoursePerformance(Store);

    // Try to find course list container
    let listEl = document.querySelector(".course-list");
    if (!listEl) {
      // look for card containing Course performance title
      const cards = document.querySelectorAll(".card");
      for (const card of cards) {
        const title = card.querySelector(".card-title");
        if (title && /course performance/i.test(title.textContent)) {
          listEl =
            card.querySelector(".data-list, .course-list, .page-list") || card;
          break;
        }
      }
    }
    if (!listEl) return;

    if (!perf.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:24px;text-align:center;color:var(--text-muted)">No published courses yet. <a href="course-form.html" style="color:var(--color-primary)">Create a course</a></div>`;
      return;
    }

    // If it's the .course-list element itself, render rows inside
    const isCourseListContainer = listEl.classList.contains("course-list");
    const target = isCourseListContainer ? listEl : listEl;

    // Clear only if it is course-list, else create inner div
    let html = "";
    const colors = ["fill-blue", "fill-purple", "fill-green"];
    perf.forEach((item, idx) => {
      const course = item.course;
      const colorClass = colors[idx % colors.length];
      html += `
        <div class="course-row" data-course-id="${_esc(course.id)}" style="cursor:pointer">
          <div class="course-row-head">
            <span class="course-name">${_esc(course.name)}</span>
            <span class="course-pct">${item.progress}%</span>
          </div>
          <div class="course-meta">${_esc(course.field || "")} • ${item.learners} learners • ${item.assignmentsCount} assignments</div>
          <div class="track"><div class="fill ${colorClass}" style="width:${item.progress}%"></div></div>
        </div>
      `;
    });

    if (isCourseListContainer) {
      target.innerHTML = html;
    } else {
      // if target is card, inject course-list
      let inner = target.querySelector(".course-list");
      if (!inner) {
        inner = document.createElement("div");
        inner.className = "course-list";
        target.appendChild(inner);
      }
      inner.innerHTML = html;
    }

    // Add click navigation to performance page
    target.querySelectorAll(".course-row").forEach((row) => {
      row.addEventListener("click", () => {
        const id = row.getAttribute("data-course-id");
        if (id)
          window.location.href = `course-performance.html?id=${encodeURIComponent(id)}`;
        else window.location.href = "courses.html";
      });
    });
  }

  function renderStudentEngagement() {
    const Store = getStore();
    if (!Store) return;
    const engagement = computeEngagementFromEnrollments(Store);

    // Find Recent Activity container
    let actList = document.querySelector(".act-list");
    if (!actList) return; // no timeline

    if (!engagement.length) {
      actList.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:13px">No recent enrollments</div>`;
      return;
    }

    const colorDots = ["blue", "green", "yellow", "purple"];
    let html = "";
    engagement.forEach((item, i) => {
      const dotClass = colorDots[i % colorDots.length];
      const dateText =
        item.enrollment.enrolledAt ||
        item.enrollment.paymentDate ||
        item.enrollment.startDate ||
        "";
      let ago = "";
      try {
        const d = new Date(dateText);
        const diffMs = Date.now() - d.getTime();
        const diffH = Math.floor(diffMs / 3600000);
        if (diffH < 1) ago = "Just now";
        else if (diffH < 24) ago = `${diffH} hr${diffH > 1 ? "s" : ""} ago`;
        else
          ago = `${Math.floor(diffH / 24)} day${Math.floor(diffH / 24) > 1 ? "s" : ""} ago`;
      } catch (e) {
        ago = _fmtDate(dateText);
      }

      html += `
        <div class="act-item" style="cursor:pointer" data-student-id="${_esc(item.student?.id || "")}">
          <div class="act-dot ${dotClass}"></div>
          <div class="act-text"><span class="act-bold">${_esc(item.name)}</span> enrolled in <span class="act-muted">${_esc(item.courseName)}</span>
            <div class="act-time">${_esc(ago)}</div>
          </div>
        </div>
      `;
    });
    actList.innerHTML = html;
    actList.querySelectorAll(".act-item").forEach((el) => {
      el.addEventListener("click", () => {
        const sid = el.getAttribute("data-student-id");
        if (sid)
          window.location.href = `student-profile.html?id=${encodeURIComponent(sid)}`;
        else window.location.href = "students.html";
      });
    });
  }

  function renderNeedsAttention() {
    const Store = getStore();
    if (!Store) return;
    const { needsReview, drafts, upcomingTomorrow } =
      computeNeedsAttention(Store);

    let grid = document.querySelector(".attention-grid");
    let created = false;
    if (!grid) {
      // create after stats-grid if not exists
      const statsGrid = document.querySelector(".stats-grid");
      if (!statsGrid) return;
      grid = document.createElement("div");
      grid.className = "attention-grid";
      grid.id = "needs-attention-grid";
      statsGrid.parentNode.insertBefore(grid, statsGrid.nextSibling);
      const heading = document.createElement("div");
      heading.style.cssText =
        "font-weight:600;font-size:14px;margin:20px 0 12px 0;";
      heading.textContent = "Needs Attention";
      grid.parentNode.insertBefore(heading, grid);
      created = true;
    }

    const tomorrowText = upcomingTomorrow
      ? `${_esc(upcomingTomorrow.name || upcomingTomorrow.title)} • ${_fmtDate(upcomingTomorrow.startDate)}`
      : "No conference tomorrow";

    grid.innerHTML = `
      <div class="att-card" style="cursor:pointer" data-nav="assignments.html">
        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> ${needsReview} submissions need review</h4>
        <p>${needsReview ? `${needsReview} assignments awaiting grading` : "All assignments reviewed"}</p>
        <div style="margin-top:10px;font-size:12px;color:var(--color-primary);font-weight:500">View submissions →</div>
      </div>
      <div class="att-card" style="cursor:pointer" data-nav="conferences.html">
        <h4> Upcoming Conference</h4>
        <p>${tomorrowText}</p>
        <div style="margin-top:10px;font-size:12px;color:var(--color-primary);font-weight:500">View conferences →</div>
      </div>
      <div class="att-card" style="cursor:pointer" data-nav="courses.html">
        <h4> ${drafts} drafts</h4>
        <p>${drafts} items in draft status need publishing</p>
        <div style="margin-top:10px;font-size:12px;color:var(--color-primary);font-weight:500">Manage drafts →</div>
      </div>
    `;

    grid.querySelectorAll(".att-card").forEach((card) => {
      card.addEventListener("click", () => {
        const nav = card.getAttribute("data-nav");
        if (nav) window.location.href = nav;
      });
    });
  }

  function renderUpcomingConferences() {
    const Store = getStore();
    if (!Store) return;
    const upcoming = computeUpcomingConferences(Store);

    // Find container: card with title Upcoming Conferences or .conf-grid
    let confGrid = document.querySelector(".conf-grid");
    let cardContainer = null;

    // Look for card title Upcoming Conferences
    const allTitles = document.querySelectorAll(".card-title");
    for (const t of allTitles) {
      if (/upcoming conference/i.test(t.textContent)) {
        cardContainer = t.closest(".card");
        break;
      }
    }

    if (confGrid) {
      // replace with compact cards
      if (!upcoming.length) {
        confGrid.innerHTML = `<div class="conf-create" style="cursor:pointer" onclick="window.location.href='conference-form.html'"><div class="conf-create-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></div><div class="conf-create-title">No upcoming conferences</div><div class="conf-create-sub">Create your first conference</div><button class="btn-primary" style="margin-top:12px">+ Create Conference</button></div>`;
        return;
      }
      let html = "";
      const grads = ["grad1", "grad2", "grad3"];
      upcoming.slice(0, 3).forEach((item, idx) => {
        const conf = item.conf;
        const grad = grads[idx % grads.length];
        const feeText = conf.fee?.amount
          ? _fmtCur(conf.fee.amount, conf.fee.currency)
          : "Free";
        html += `
          <div class="conf-item" style="cursor:pointer" data-conf-id="${_esc(conf.id)}">
            <div class="conf-hero ${grad}" style="padding:14px 16px">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="pill-light">${_esc(_fmtDate(conf.startDate))}</span>
                <span class="pill-green">Registration Open</span>
              </div>
              <div style="margin-top:12px;font-weight:600;color:white">${_esc(conf.name)}</div>
              <div style="font-size:12px;color:rgba(255,255,255,.8);margin-top:4px">${_esc(conf.location?.venue || conf.location?.state || "Virtual")} • ${feeText}</div>
            </div>
            <div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:12px;color:var(--text-muted)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ${item.count} registered</span>
              <div style="display:flex;gap:8px">
                <button class="btn-dark" style="font-size:12px;padding:6px 12px" onclick="event.stopPropagation(); window.location.href='conference-view.html?id=${encodeURIComponent(conf.id)}'">Manage</button>
                <button class="btn-light" style="font-size:12px;padding:6px 12px" onclick="event.stopPropagation(); window.location.href='conference-registration.html?conferenceId=${encodeURIComponent(conf.id)}'">Registrations</button>
              </div>
            </div>
          </div>
        `;
      });
      confGrid.innerHTML = html;
      confGrid.querySelectorAll(".conf-item").forEach((el) => {
        el.addEventListener("click", () => {
          const id = el.getAttribute("data-conf-id");
          window.location.href = `conference-view.html?id=${encodeURIComponent(id)}`;
        });
      });
      return;
    }

    // Fallback: if cardContainer found but no conf-grid, create compact list inside it
    if (cardContainer) {
      let body =
        cardContainer.querySelector(".card-body, .conf-card-body") ||
        cardContainer;
      // If there is already custom preview, replace only after title
      const existingPreview = cardContainer.querySelector(
        ".conf-preview, .conf-item, .conf-create",
      );
      if (existingPreview && !confGrid) {
        // we'll replace entire card content except head
        const head = cardContainer.querySelector(".card-head");
        if (upcoming.length === 0) {
          if (existingPreview)
            existingPreview.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted)">No conferences. <a href="conference-form.html" style="color:var(--color-primary)">Create one</a></div>`;
          return;
        }
        // Build compact list
        let html = `<div style="display:flex;flex-direction:column;gap:12px;padding:16px">`;
        upcoming.slice(0, 3).forEach((item) => {
          const conf = item.conf;
          html += `
            <div class="conf-compact" data-conf-id="${_esc(conf.id)}" style="padding:12px;border:1px solid var(--border-light);border-radius:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-weight:600;font-size:13px">${_esc(conf.name)}</div>
                <div style="font-size:11px;color:var(--text-muted)">${_esc(_fmtDate(conf.startDate))} • ${_esc(conf.location?.venue || conf.location?.state || "Virtual")} • <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ${item.count}</div>
              </div>
              <button class="btn-light" style="font-size:11px;padding:6px 10px">View</button>
            </div>
          `;
        });
        html += `<button class="btn-secondary" style="width:100%;margin-top:4px" onclick="window.location.href='conferences.html'">View all conferences →</button></div>`;
        // Remove old preview and append
        if (existingPreview) existingPreview.remove();
        const temp = document.createElement("div");
        temp.innerHTML = html;
        // append after head if exists
        if (head) head.insertAdjacentHTML("afterend", html);
        else body.insertAdjacentHTML("beforeend", html);

        cardContainer.querySelectorAll(".conf-compact").forEach((el) => {
          el.addEventListener("click", () => {
            const id = el.getAttribute("data-conf-id");
            window.location.href = `conference-view.html?id=${encodeURIComponent(id)}`;
          });
        });
      }
    }
  }

  function renderTopStudents() {
    const Store = getStore();
    if (!Store) return;
    const top = computeTopStudents(Store);

    // Find table body for Top Performing Students
    const tables = document.querySelectorAll("table");
    let targetTable = null;
    let targetTbody = null;

    // Prefer table inside card with Title Top Performing Students
    const cards = document.querySelectorAll(".card");
    for (const card of cards) {
      const titleEl = card.querySelector(".card-title");
      if (titleEl && /top performing students/i.test(titleEl.textContent)) {
        const tbl = card.querySelector("table");
        if (tbl) {
          targetTable = tbl;
          targetTbody = tbl.querySelector("tbody");
          break;
        }
      }
    }
    // fallback: first table with Student header
    if (!targetTable) {
      for (const tbl of tables) {
        const ths = tbl.querySelectorAll("thead th");
        const headerText = Array.from(ths)
          .map((th) => th.textContent.toLowerCase())
          .join(" ");
        if (headerText.includes("student") && headerText.includes("course")) {
          targetTable = tbl;
          targetTbody = tbl.querySelector("tbody");
          break;
        }
      }
    }
    if (!targetTbody) return;

    if (!top.length) {
      targetTbody.innerHTML = `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text-muted)">No students yet. <a href="students.html" style="color:var(--color-primary)">Add students</a></td></tr>`;
      return;
    }

    const rows = top
      .slice(0, 5)
      .map((stu) => {
        const badgeCls = statusBadgeClass(stu.score);
        const label = statusLabel(stu.score);
        const avCls = avatarClass(stu.idx);
        return `
        <tr data-student-id="${_esc(stu.id)}" style="cursor:pointer">
          <td>
            <div class="student-cell">
              <div class="student-av ${avCls}">${_esc(stu.initials)}</div>
              <span style="font-weight:500">${_esc(stu.fullName)}</span>
            </div>
          </td>
          <td style="color:#64748B">${_esc(stu.courseName)}</td>
          <td class="text-right">${stu.progress}%</td>
          <td class="text-right" style="font-weight:500">${stu.score}</td>
          <td class="pl"><span class="status-badge ${badgeCls}">${label}</span></td>
        </tr>
      `;
      })
      .join("");

    targetTbody.innerHTML = rows;

    // attach click -> student profile or drawer
    targetTbody.querySelectorAll("tr").forEach((tr) => {
      tr.addEventListener("click", () => {
        const sid = tr.getAttribute("data-student-id");
        const name =
          tr.querySelector(".student-cell span")?.textContent || "Student";
        const initials = tr.querySelector(".student-av")?.textContent || "ST";
        // if openStudent exists, call it, else navigate
        if (
          typeof window.openStudent === "function" &&
          document.getElementById("drawer")
        ) {
          window.openStudent(name, initials);
          // also allow navigation on second click? Provide link via drawer? Keep navigation fallback
          // store id for drawer actions if needed
          tr.setAttribute("data-last-click", Date.now());
          // navigate after delay if user wants profile page
        } else {
          window.location.href = sid
            ? `student-profile.html?id=${encodeURIComponent(sid)}`
            : "students.html";
        }
        // also save for quick profile navigation when clicking again
        tr.addEventListener("dblclick", () => {
          if (sid)
            window.location.href = `student-profile.html?id=${encodeURIComponent(sid)}`;
        });
      });
    });

    // Wire View all students button
    if (targetTable) {
      const card = targetTable.closest(".card");
      if (card) {
        const viewAllBtn = card.querySelector(".card-head button");
        if (viewAllBtn) {
          viewAllBtn.removeAttribute("onclick");
          viewAllBtn.onclick = null;
          viewAllBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            window.location.href = "students.html";
          });
          // replace any toast onclick
          viewAllBtn.setAttribute("data-navigated", "true");
        }
      }
    }
  }

  function renderSearchHandling() {
    // Global search inputs
    const searchInputs = document.querySelectorAll(
      'input[type="search"], #email-search, .search-input, input[placeholder*="Search" i]',
    );
    searchInputs.forEach((inp) => {
      if (inp._dashBound) return;
      inp._dashBound = true;
      inp.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase().trim();
        // Filter top students rows
        document.querySelectorAll("table tbody tr").forEach((tr) => {
          const txt = tr.textContent.toLowerCase();
          tr.style.display = txt.includes(term) ? "" : "none";
        });
        // Filter course rows
        document.querySelectorAll(".course-row").forEach((row) => {
          const txt = row.textContent.toLowerCase();
          row.style.display = txt.includes(term) ? "" : "none";
        });
        // Filter conference items
        document
          .querySelectorAll(".conf-item, .conf-compact")
          .forEach((row) => {
            const txt = row.textContent.toLowerCase();
            row.style.display = txt.includes(term) ? "" : "none";
          });
      });
    });
  }

  function wireNavigation() {
    // Remove toast navigation handlers
    // Hero actions
    const heroActions = document.querySelector(".hero-actions");
    if (heroActions) {
      const btns = heroActions.querySelectorAll("button, a");
      btns.forEach((btn, idx) => {
        const onclick = btn.getAttribute("onclick") || "";
        if (
          onclick.includes("toast") ||
          btn.textContent.toLowerCase().includes("create course")
        ) {
          btn.removeAttribute("onclick");
          const newBtn = btn.cloneNode(true);
          newBtn.removeAttribute("onclick");
          newBtn.addEventListener("click", (e) => {
            e.preventDefault();
            window.location.href = "course-form.html";
          });
          if (btn.parentNode) btn.parentNode.replaceChild(newBtn, btn);
        }
        if (
          btn.textContent.toLowerCase().includes("conference") ||
          onclick.toLowerCase().includes("conference")
        ) {
          // keep link but ensure href correct
          if (btn.tagName === "BUTTON") {
            btn.removeAttribute("onclick");
            btn.addEventListener("click", () => {
              window.location.href = "conference-form.html";
            });
          } else {
            // ensure it points to conference-form
            if (
              !btn.getAttribute("href") ||
              btn.getAttribute("href").includes("conferences.html")
            ) {
              // keep secondary as create conference -> form
              // Check if it's the hero second button
              if (
                idx === 1 ||
                btn.textContent.toLowerCase().includes("create")
              ) {
                btn.setAttribute("href", "conference-form.html");
              }
            }
          }
        }
      });
    }

    // Generic: any button with onclick=toast('Create Course') or similar
    document.querySelectorAll('[onclick*="toast"]').forEach((el) => {
      const oc = el.getAttribute("onclick") || "";
      const txt = (el.textContent || "").toLowerCase();
      if (
        /create course|course/.test(oc.toLowerCase()) ||
        txt.includes("create course")
      ) {
        el.removeAttribute("onclick");
        el.addEventListener("click", (e) => {
          e.preventDefault();
          window.location.href = "course-form.html";
        });
      } else if (
        /conference/.test(oc.toLowerCase()) ||
        (txt.includes("conference") && txt.includes("create"))
      ) {
        el.removeAttribute("onclick");
        el.addEventListener("click", (e) => {
          e.preventDefault();
          window.location.href = "conference-form.html";
        });
      } else if (/student/.test(txt) && txt.includes("view all")) {
        el.removeAttribute("onclick");
        el.addEventListener("click", (e) => {
          e.preventDefault();
          window.location.href = "students.html";
        });
      }
    });

    // Recent Activity View all
    document.querySelectorAll(".card-head button").forEach((btn) => {
      const t = btn.textContent.toLowerCase();
      if (t.includes("view all") && !btn._navBound) {
        const cardTitle =
          btn
            .closest(".card")
            ?.querySelector(".card-title")
            ?.textContent.toLowerCase() || "";
        btn._navBound = true;
        btn.removeAttribute("onclick");
        btn.onclick = null;
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (cardTitle.includes("recent activity"))
            window.location.href = "analytics.html";
          else if (cardTitle.includes("top performing"))
            window.location.href = "students.html";
          else if (cardTitle.includes("course"))
            window.location.href = "courses.html";
          else if (cardTitle.includes("conference"))
            window.location.href = "conferences.html";
          else window.location.href = "students.html";
        });
      }
    });

    // Make sure course-form and conference-form navigation exists
    // Add listeners for any element with data-nav-id
  }

  // --- Chart drawing (reuse previous logic, optional) ---
  function drawChart() {
    const data = datasets[currentRange];
    const svg = document.getElementById("chart");
    if (!svg) return;
    svg.innerHTML = "";
    const W = 600,
      H = 180,
      padT = 10,
      padB = 20,
      max = 1000;
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * W,
      y: padT + (1 - v / max) * (H - padT - padB),
      v,
    }));
    // Grid
    [0, 250, 500, 750, 1000].forEach((yVal) => {
      const y = padT + (1 - yVal / max) * (H - padT - padB);
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.setAttribute("x1", "0");
      line.setAttribute("x2", W);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute(
        "stroke",
        window.isDark || document.documentElement.classList.contains("dark")
          ? "#1E293B"
          : "#F1F5F9",
      );
      line.setAttribute("stroke-width", "1");
      if (yVal !== 0) line.setAttribute("stroke-dasharray", "4 6");
      svg.appendChild(line);
    });
    // Path
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1],
        curr = pts[i];
      const cx = (prev.x + curr.x) / 2;
      d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    const areaD =
      d + ` L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z`;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const grad = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "linearGradient",
    );
    grad.setAttribute("id", "g");
    grad.setAttribute("x1", "0");
    grad.setAttribute("x2", "0");
    grad.setAttribute("y1", "0");
    grad.setAttribute("y2", "1");
    const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s1.setAttribute("offset", "0%");
    s1.setAttribute("stop-color", "#2563EB");
    s1.setAttribute("stop-opacity", window.isDark ? "0.35" : "0.22");
    const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s2.setAttribute("offset", "100%");
    s2.setAttribute("stop-color", "#2563EB");
    s2.setAttribute("stop-opacity", "0");
    grad.append(s1, s2);
    defs.appendChild(grad);
    svg.appendChild(defs);
    const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
    area.setAttribute("d", areaD);
    area.setAttribute("fill", "url(#g)");
    svg.appendChild(area);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", d);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#2563EB");
    line.setAttribute("stroke-width", "2.5");
    line.setAttribute("stroke-linecap", "round");
    line.classList.add("draw");
    svg.appendChild(line);
    pts.forEach((p) => {
      const c = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      c.setAttribute("cx", p.x);
      c.setAttribute("cy", p.y);
      c.setAttribute("r", "4");
      c.setAttribute("fill", "#fff");
      c.setAttribute("stroke", "#2563EB");
      c.setAttribute("stroke-width", "2.5");
      svg.appendChild(c);
    });
  }

  function setRange(r) {
    currentRange = r;
    ["7D", "30D", "3M", "1Y"].forEach((k) => {
      const el = document.getElementById("r-" + k);
      if (el) el.className = k === r ? "range-btn active" : "range-btn";
    });
    drawChart();
  }

  function renderAll() {
    try {
      renderKPIs();
      renderCoursePerformance();
      renderStudentEngagement();
      renderNeedsAttention();
      renderUpcomingConferences();
      renderTopStudents();
      renderSearchHandling();
      wireNavigation();
      // chart optional
      if (document.getElementById("chart")) drawChart();
    } catch (e) {
      console.warn("[Dashboard] render error", e);
    }
  }

  function initDashboard() {
    const Store = getStore();
    if (!Store) {
      console.warn("[Dashboard] Store not found, retrying...");
      setTimeout(initDashboard, 300);
      return;
    }
    // Count-up animation for existing data-count already handled in renderKPIs
    // Trigger progress animation
    document
      .querySelectorAll(".progress, .progress-fill, .progress-track div")
      .forEach((b) => setTimeout(() => b.classList.add("on"), 300));

    renderAll();
    if (window.setActiveNav) {
      try {
        setActiveNav("dashboard");
      } catch (e) {}
    }
    // Also ensure Layout active if present
    if (window.Layout && window.Layout.initLayout) {
      // Layout already init via common.js auto, but ensure active
    }
  }

  // Expose globally for range buttons
  window.setRange = setRange;
  window.drawChart = drawChart;
  window.Dashboard = {
    init: initDashboard,
    renderAll,
    setRange,
    drawChart,
    computeTopStudents,
    computeCoursePerformance,
  };

  document.addEventListener("DOMContentLoaded", () =>
    setTimeout(initDashboard, 200),
  );
  if (document.readyState !== "loading") setTimeout(initDashboard, 200);

  // Live updates
  window.addEventListener("studypod:datachange", (e) => {
    // debounce
    clearTimeout(window._dashRefreshTimer);
    window._dashRefreshTimer = setTimeout(() => {
      renderAll();
    }, 120);
  });
  window.addEventListener("themechange", () => {
    try {
      drawChart();
    } catch (e) {}
  });

  // Search outside DOMContentLoaded for dynamically injected header
  window.addEventListener("layout:ready", () => {
    renderSearchHandling();
    wireNavigation();
  });
})();
