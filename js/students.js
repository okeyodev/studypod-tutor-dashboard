/**
 * STUDENTS.JS - StudyPod Tutor Dashboard v2.0
 * Implements: Tabs All Students, Paid Enrollments, Payment Records
 * Data Layer: window.Store (students, enrollments, courses, submissions, attempts)
 * Helpers: toast, escapeHtml, formatCurrency, formatDate, formatDateTime, setActiveNav
 * Features: search/filter, empty states, top-performance filter, drawer + profile nav
 */

(function () {
  "use strict";

  const STATE = {
    activeTab: "all", // all | paid | records
    search: "",
    isTopPerformance: false,
    sortBy: "recent",
  };

  // ---- helpers safe wrappers ----
  const safeEscape = (s) =>
    typeof window.escapeHtml === "function"
      ? window.escapeHtml(s)
      : String(s ?? "").replace(
          /[&<>"']/g,
          (m) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[m],
        );
  const safeCurrency = (amt, curr) =>
    typeof window.formatCurrency === "function"
      ? window.formatCurrency(amt, curr)
      : `${curr || "₦"}${Number(amt || 0).toLocaleString()}`;
  const safeDate = (str) =>
    typeof window.formatDate === "function"
      ? window.formatDate(str)
      : str
        ? new Date(str).toLocaleDateString()
        : "-";
  const safeDateTime = (str) =>
    typeof window.formatDateTime === "function"
      ? window.formatDateTime(str)
      : safeDate(str);
  const safeToast = (msg) =>
    typeof window.toast === "function" ? window.toast(msg) : console.log(msg);

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }
  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function getDisplayName(student) {
    if (!student) return "Unknown";
    if (student.firstName || student.lastName)
      return `${student.firstName || ""} ${student.lastName || ""}`.trim();
    if (student.name) return student.name;
    if (student.fullName) return student.fullName;
    return student.email || student.id;
  }

  function getInitials(student) {
    if (student.avatar && student.avatar.length <= 3)
      return student.avatar.toUpperCase();
    const name = getDisplayName(student);
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function getAvatarColorClass(name) {
    const colors = [
      "student-avatar",
      "av-light-blue",
      "av-light-pink",
      "av-light-yellow",
      "av-light-indigo",
      "av-light-green",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  function getCourseName(courseId) {
    if (!window.Store) return courseId;
    const c = window.Store.getById("courses", courseId);
    if (!c) return "-";
    return c.name || c.title || courseId;
  }

  function getCourse(courseId) {
    if (!window.Store) return null;
    return window.Store.getById("courses", courseId);
  }

  function enrichStudent(student) {
    if (!window.Store)
      return {
        enrollmentCount: 0,
        totalPaid: 0,
        avgScore: 0,
        courses: [],
        membership: "-",
        delivery: "-",
        startDate: "",
        paymentStatus: "-",
        enrollments: [],
      };
    const enrollments = window.Store.filter(
      "enrollments",
      (e) => e.studentId === student.id,
    ).sort(
      (a, b) =>
        new Date(b.enrolledAt || b.paymentDate || 0) -
        new Date(a.enrolledAt || a.paymentDate || 0),
    );
    const submissions = window.Store.filter(
      "submissions",
      (s) => s.studentId === student.id && s.score != null && s.score !== "",
    );
    const attempts = window.Store.filter(
      "attempts",
      (a) => a.studentId === student.id && a.score != null,
    );
    const allScores = [
      ...submissions.map((s) => Number(s.score)),
      ...attempts.map((a) => Number(a.score)),
    ].filter((n) => !isNaN(n));
    const avgScore = allScores.length
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : typeof student.averageScore === "number"
        ? student.averageScore
        : 0;
    const totalPaid = enrollments.reduce((sum, e) => {
      const v =
        e.amountPaid?.amount ??
        e.amount?.amount ??
        e.amountPaid ??
        e.amount ??
        0;
      return sum + (Number(v) || 0);
    }, 0);
    const currency =
      enrollments[0]?.amountPaid?.currency ||
      enrollments[0]?.amount?.currency ||
      "NGN";
    const courses = Array.from(new Set(enrollments.map((e) => e.courseId)))
      .map((id) => getCourse(id))
      .filter(Boolean);
    const courseNames = courses.map((c) => c.name);
    const deliveries = Array.from(
      new Set(
        enrollments
          .map((e) => e.deliveryMethod || e.delivery || "")
          .filter(Boolean),
      ),
    );
    const membership =
      student.membershipNo ||
      student.membership ||
      student.token ||
      student.id.slice(0, 12).toUpperCase();
    const startDate =
      enrollments[enrollments.length - 1]?.startDate ||
      enrollments[0]?.startDate ||
      student.createdAt;
    // aggregated payment status
    let aggStatus = "-";
    if (enrollments.length) {
      if (enrollments.every((e) => e.paymentStatus === "paid"))
        aggStatus = "paid";
      else if (enrollments.some((e) => e.paymentStatus === "partial"))
        aggStatus = "partial";
      else if (enrollments.some((e) => e.paymentStatus === "pending"))
        aggStatus = "pending";
      else aggStatus = enrollments[0].paymentStatus || "-";
    }
    return {
      enrollmentCount: enrollments.length,
      totalPaid,
      currency,
      avgScore,
      courses,
      courseNames,
      deliveryList: deliveries,
      membership,
      startDate,
      paymentStatus: aggStatus,
      enrollments,
      allScoresCount: allScores.length,
    };
  }

  function getFilteredStudents() {
    const all = window.Store ? window.Store.get("students") : [];
    let enriched = all.map((s) => ({ student: s, meta: enrichStudent(s) }));
    // search
    if (STATE.search) {
      const q = STATE.search.toLowerCase().trim();
      enriched = enriched.filter(({ student, meta }) => {
        const name = getDisplayName(student).toLowerCase();
        const email = (student.email || "").toLowerCase();
        const membership = (meta.membership || "").toLowerCase();
        const courses = meta.courseNames.join(" ").toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          membership.includes(q) ||
          courses.includes(q)
        );
      });
    }
    // top-performance
    if (STATE.isTopPerformance) {
      enriched = enriched
        .filter((e) => e.meta.avgScore > 0)
        .sort((a, b) => b.meta.avgScore - a.meta.avgScore)
        .slice(0, 10);
    } else {
      enriched.sort(
        (a, b) =>
          new Date(b.student.createdAt || 0) -
          new Date(a.student.createdAt || 0),
      );
    }
    return enriched;
  }

  function getFilteredEnrollments(mode) {
    if (!window.Store) return [];
    let enrolls = window.Store.get("enrollments");
    if (mode === "paid") {
      enrolls = enrolls.filter((e) => e.paymentStatus === "paid");
    }
    if (STATE.search) {
      const q = STATE.search.toLowerCase();
      enrolls = enrolls.filter((e) => {
        const st = window.Store.getById("students", e.studentId);
        const name = st ? getDisplayName(st).toLowerCase() : "";
        const email = st?.email?.toLowerCase() || "";
        const course = getCourseName(e.courseId).toLowerCase();
        const txn = (e.transactionReference || "").toLowerCase();
        const membership = (st?.membershipNo || "").toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          course.includes(q) ||
          txn.includes(q) ||
          membership.includes(q)
        );
      });
    }
    enrolls.sort(
      (a, b) =>
        new Date(b.enrolledAt || b.paymentDate || 0) -
        new Date(a.enrolledAt || a.paymentDate || 0),
    );
    return enrolls;
  }

  function renderEmpty(icon, title, subtitle) {
    return `
      <div class="empty-state" style="padding:48px 20px;text-align:center;color:var(--text-muted);display:flex;flex-direction:column;align-items:center;gap:12px">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--bg-page);display:grid;place-items:center;font-size:28px">${icon || "Inbox"}</div>
        <div style="font-weight:600;color:var(--text-primary);font-size:14px">${safeEscape(title || "No records")}</div>
        <div style="font-size:13px;max-width:320px">${safeEscape(subtitle || "Try adjusting your search or filters.")}</div>
      </div>`;
  }

  // ---- TABLE ROW BUILDERS ----

  // ---- TABLE ROW BUILDERS - REFACTORED for PHP deployment ----
  // HTML moved to students.html <template> tags for PHP-ready reusable tables
  // Logic preserved: student info, courses, membership, amount, payment status, delivery, start date

  function buildAllStudentsRow(student, meta) {
    const templateRow = document.getElementById("student-row-template");
    const templateCard = document.getElementById("student-card-template");

    const initials = getInitials(student);
    const displayName = getDisplayName(student);
    const email = student.email || "";
    const membership = meta.membership;
    const coursesText = meta.courseNames.length
      ? meta.courseNames.slice(0, 2).join(", ") +
        (meta.courseNames.length > 2 ? ` +${meta.courseNames.length - 2}` : "")
      : "—";
    const coursesFull = meta.courseNames.join(", ");
    const amount = safeCurrency(meta.totalPaid, meta.currency);
    const delivery = meta.deliveryList.length
      ? meta.deliveryList.join(", ")
      : "-";
    const start = safeDate(meta.startDate);
    const statusClass =
      meta.paymentStatus === "paid"
        ? "paid"
        : meta.paymentStatus === "partial"
          ? "partial"
          : meta.paymentStatus === "pending"
            ? "pending"
            : "";
    const statusLabel = meta.paymentStatus === "-" ? "—" : meta.paymentStatus;
    const enrollmentBadge = meta.enrollmentCount
      ? `${meta.enrollmentCount}`
      : "";
    const avgScore = meta.avgScore ? `${meta.avgScore}%` : "—";
    const allScoresCount = meta.allScoresCount || 0;

    // PHP-ready path: use templates from HTML
    if (templateRow && templateRow.content) {
      const clone = templateRow.content.cloneNode(true);
      const tr = clone.querySelector("tr");
      if (tr) {
        tr.setAttribute("data-student-id", student.id);

        const avatarEl = clone.querySelector(".student-avatar");
        if (avatarEl) avatarEl.textContent = safeEscape(initials);

        const nameEl = clone.querySelector(".student-name");
        if (nameEl) {
          nameEl.textContent = safeEscape(displayName);
          if (enrollmentBadge) {
            const badge = document.createElement("span");
            badge.style.cssText =
              "font-size:11px;background:var(--bg-page);padding:2px 6px;border-radius:999px;margin-left:6px";
            badge.textContent = enrollmentBadge;
            nameEl.appendChild(badge);
          }
        }

        const emailEl = clone.querySelector(".student-email");
        if (emailEl) emailEl.textContent = safeEscape(email);

        const coursesEl = clone.querySelector(".student-courses");
        if (coursesEl) {
          coursesEl.textContent = safeEscape(coursesText);
          coursesEl.title = safeEscape(coursesFull);
        }

        const avgEl = clone.querySelector(".student-avg");
        if (avgEl) {
          if (meta.avgScore) {
            avgEl.innerHTML = `Avg: <span title="${allScoresCount} graded items" style="font-weight:600">${safeEscape(avgScore)}</span>`;
          } else {
            avgEl.innerHTML = `Avg: <span style="color:var(--text-muted)">—</span>`;
          }
        }

        const membershipEl = clone.querySelector(".student-membership");
        if (membershipEl) membershipEl.textContent = safeEscape(membership);

        const amountEl = clone.querySelector(".student-amount");
        if (amountEl) amountEl.textContent = amount;

        const statusEl = clone.querySelector(".student-payment-status");
        if (statusEl) {
          statusEl.textContent = safeEscape(statusLabel);
          statusEl.className = `payment-badge ${statusClass}`;
        }

        const deliveryEl = clone.querySelector(".student-delivery");
        if (deliveryEl) deliveryEl.textContent = delivery || "-";

        const startEl = clone.querySelector(".student-start-date");
        if (startEl) startEl.textContent = start;

        const viewBtn = clone.querySelector(".view-student-btn");
        if (viewBtn) viewBtn.setAttribute("data-student-id", student.id);

        // Create card version
        let cardEl = null;
        if (templateCard && templateCard.content) {
          const cardClone = templateCard.content.cloneNode(true);
          cardEl =
            cardClone.querySelector(".student-row") ||
            cardClone.firstElementChild;
          if (cardEl) {
            cardEl.setAttribute("data-student-id", student.id);
            const cAvatar = cardEl.querySelector(".student-avatar");
            if (cAvatar) cAvatar.textContent = safeEscape(initials);
            const cName = cardEl.querySelector(".student-name-card");
            if (cName) {
              cName.textContent = safeEscape(displayName);
              const badge = document.createElement("span");
              badge.className = `payment-badge ${statusClass}`;
              badge.style.fontSize = "10px";
              badge.textContent = safeEscape(statusLabel);
              cName.appendChild(badge);
            }
            const cEmail = cardEl.querySelector(".student-email-membership");
            if (cEmail)
              cEmail.textContent = `${safeEscape(email)} • ${safeEscape(membership)}`;
            const cMeta = cardEl.querySelector(".student-meta-card");
            if (cMeta)
              cMeta.textContent = `${safeEscape(coursesText)} • ${delivery} • ${start} • ${amount}`;
            const cView = cardEl.querySelector(".view-student-btn");
            if (cView) cView.setAttribute("data-student-id", student.id);
          }
        }

        return {
          tableEl: tr,
          cardEl: cardEl,
          table: tr.outerHTML,
          card: cardEl ? cardEl.outerHTML : "",
        };
      }
    }

    // Fallback: original string template
    const initialsEsc = safeEscape(initials);
    const displayNameEsc = safeEscape(displayName);
    const emailEsc = safeEscape(email);
    const membershipEsc = safeEscape(membership);
    const coursesEsc = meta.courseNames.length
      ? safeEscape(coursesText)
      : '<span style="color:var(--text-muted)">—</span>';
    const amountEsc = amount;
    const deliveryEsc = delivery || "-";
    const startEsc = start;
    const statusClassEsc = statusClass;
    const statusLabelEsc = statusLabel === "—" ? "—" : safeEscape(statusLabel);
    const enrollmentBadgeHtml = enrollmentBadge
      ? `<span style="font-size:11px;background:var(--bg-page);padding:2px 6px;border-radius:999px;margin-left:6px">${enrollmentBadge}</span>`
      : "";
    const scoreHtml = meta.avgScore
      ? `<span title="${allScoresCount} graded items" style="font-weight:600">${meta.avgScore}%</span>`
      : '<span style="color:var(--text-muted)">—</span>';

    return {
      table: `
        <tr class="student-row" data-student-id="${safeEscape(student.id)}">
          <td>
            <div class="student-info">
              <div class="student-avatar" style="background:var(--color-avatar-light-blue);color:var(--color-primary)">${initialsEsc}</div>
              <div>
                <div class="student-name">${displayNameEsc} ${enrollmentBadgeHtml}</div>
                <div class="student-email">${emailEsc}</div>
              </div>
            </div>
          </td>
          <td><div style="font-size:13px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${safeEscape(coursesFull)}">${coursesEsc}</div><div style="font-size:11px;color:var(--text-muted)">Avg: ${scoreHtml}</div></td>
          <td><span style="font-family:monospace;font-size:12px;background:var(--bg-page);padding:4px 8px;border-radius:6px">${membershipEsc}</span></td>
          <td style="font-weight:600">${amountEsc}</td>
          <td><span class="payment-badge ${statusClassEsc}">${statusLabelEsc}</span></td>
          <td>${deliveryEsc}</td>
          <td>${startEsc}</td>
          <td><button class="btn-light view-student-btn" data-student-id="${safeEscape(student.id)}" style="padding:6px 10px;font-size:12px">View</button></td>
        </tr>`,
      card: `
        <div class="data-row student-row" data-student-id="${safeEscape(student.id)}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border-light)">
          <div style="display:flex;gap:12px;align-items:center;min-width:0">
            <div class="student-avatar">${initialsEsc}</div>
            <div style="min-width:0">
              <div style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px">${displayNameEsc} <span class="payment-badge ${statusClassEsc}" style="font-size:10px">${statusLabelEsc}</span></div>
              <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${emailEsc} • ${membershipEsc}</div>
              <div style="font-size:11px;margin-top:4px">${coursesEsc} • ${deliveryEsc} • ${startEsc} • ${amountEsc}</div>
            </div>
          </div>
          <button class="btn-primary view-student-btn" data-student-id="${safeEscape(student.id)}" style="padding:6px 10px;font-size:12px;flex:none">View</button>
        </div>`,
    };
  }

  function buildEnrollmentRow(enroll, mode) {
    const templatePaidRow = document.getElementById(
      "paid-enrollment-row-template",
    );
    const templateRecordRow = document.getElementById(
      "payment-record-row-template",
    );
    const templateEnrollCard = document.getElementById(
      "enrollment-card-template",
    );

    const student = window.Store
      ? window.Store.getById("students", enroll.studentId)
      : null;
    const name = student ? getDisplayName(student) : "Unknown Student";
    const email = student ? student.email || "" : "";
    const initials = student ? getInitials(student) : "??";
    const courseName = getCourseName(enroll.courseId);
    const amountObj = enroll.amountPaid ||
      enroll.amount || { amount: 0, currency: "NGN" };
    const amountVal =
      typeof amountObj === "number" ? amountObj : amountObj.amount;
    const currency = typeof amountObj === "object" ? amountObj.currency : "NGN";
    const amount = safeCurrency(amountVal, currency);
    const delivery = enroll.deliveryMethod || enroll.delivery || "-";
    const start = safeDate(
      enroll.startDate || enroll.paymentDate || enroll.enrolledAt,
    );
    const paymentDate = safeDate(enroll.paymentDate || enroll.enrolledAt);
    const txn =
      enroll.transactionReference ||
      enroll.transactionRef ||
      `TXN-${enroll.id.slice(0, 8).toUpperCase()}`;
    const statusClass =
      enroll.paymentStatus === "paid"
        ? "paid"
        : enroll.paymentStatus === "partial"
          ? "partial"
          : enroll.paymentStatus === "pending"
            ? "pending"
            : "";
    const statusLabel = enroll.paymentStatus || "-";
    const membership = student
      ? student.membershipNo || student.token || "-"
      : "-";

    if (mode === "payment-records") {
      // PHP-ready path for Payment Records tab
      if (templateRecordRow && templateRecordRow.content) {
        const clone = templateRecordRow.content.cloneNode(true);
        const tr = clone.querySelector("tr");
        if (tr) {
          tr.setAttribute("data-enroll-id", enroll.id);
          tr.setAttribute("data-student-id", enroll.studentId);

          const avatar = clone.querySelector(".student-avatar");
          if (avatar) avatar.textContent = safeEscape(initials);
          const nameEl = clone.querySelector(".student-name");
          if (nameEl) nameEl.textContent = safeEscape(name);
          const emailEl = clone.querySelector(".student-email");
          if (emailEl) emailEl.textContent = safeEscape(email);
          const txnEl = clone.querySelector(".payment-txn");
          if (txnEl) txnEl.textContent = safeEscape(txn);
          const courseEl = clone.querySelector(".payment-course");
          if (courseEl) courseEl.textContent = safeEscape(courseName);
          const amountEl = clone.querySelector(".payment-amount");
          if (amountEl) amountEl.textContent = amount;
          const dateEl = clone.querySelector(".payment-date");
          if (dateEl) dateEl.textContent = paymentDate;
          const statusEl = clone.querySelector(".payment-status");
          if (statusEl) {
            statusEl.textContent = safeEscape(statusLabel);
            statusEl.className = `payment-badge ${statusClass}`;
          }
          const viewBtn = clone.querySelector(".view-student-btn");
          if (viewBtn)
            viewBtn.setAttribute("data-student-id", enroll.studentId);

          // Card version
          let cardEl = null;
          if (templateEnrollCard && templateEnrollCard.content) {
            const cardClone = templateEnrollCard.content.cloneNode(true);
            cardEl =
              cardClone.querySelector(".enrollment-card") ||
              cardClone.firstElementChild;
            if (cardEl) {
              const cName = cardEl.querySelector(".enroll-name");
              if (cName) cName.textContent = safeEscape(name);
              const cMeta = cardEl.querySelector(".enroll-meta");
              if (cMeta)
                cMeta.textContent = `${safeEscape(txn)} • ${safeEscape(courseName)}`;
              const cDetails = cardEl.querySelector(".enroll-details");
              if (cDetails)
                cDetails.textContent = `${amount} • ${paymentDate} • ${safeEscape(statusLabel)}`;
              const cView = cardEl.querySelector(".view-student-btn");
              if (cView)
                cView.setAttribute("data-student-id", enroll.studentId);
            }
          }

          return {
            tableEl: tr,
            cardEl: cardEl,
            table: tr.outerHTML,
            card: cardEl ? cardEl.outerHTML : "",
          };
        }
      }

      // Fallback
      return {
        table: `
          <tr data-enroll-id="${safeEscape(enroll.id)}" data-student-id="${safeEscape(enroll.studentId)}">
            <td><div class="student-info"><div class="student-avatar">${safeEscape(initials)}</div><div><div class="student-name">${safeEscape(name)}</div><div class="student-email">${safeEscape(email)}</div></div></div></td>
            <td><span style="font-family:monospace;font-size:12px;background:var(--bg-page);padding:4px 8px;border-radius:6px">${safeEscape(txn)}</span></td>
            <td>${safeEscape(courseName)}</td>
            <td style="font-weight:600">${amount}</td>
            <td>${paymentDate}</td>
            <td><span class="payment-badge ${statusClass}">${safeEscape(statusLabel)}</span></td>
            <td><button class="btn-light view-student-btn" data-student-id="${safeEscape(enroll.studentId)}" style="padding:6px 10px;font-size:12px">View</button></td>
          </tr>`,
        card: `
          <div class="data-row" style="padding:14px 16px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;gap:10px">
            <div><div style="font-weight:600;font-size:13px">${safeEscape(name)}</div><div style="font-size:11px;color:var(--text-muted)">${safeEscape(txn)} • ${safeEscape(courseName)}</div><div style="font-size:11px;margin-top:4px">${amount} • ${paymentDate} • <span class="payment-badge ${statusClass}">${safeEscape(statusLabel)}</span></div></div>
            <button class="btn-light view-student-btn" data-student-id="${safeEscape(enroll.studentId)}" style="padding:6px 10px;font-size:12px;height:fit-content">View</button>
          </div>`,
      };
    }

    // Paid Enrollments mode
    if (templatePaidRow && templatePaidRow.content) {
      const clone = templatePaidRow.content.cloneNode(true);
      const tr = clone.querySelector("tr");
      if (tr) {
        tr.setAttribute("data-enroll-id", enroll.id);
        tr.setAttribute("data-student-id", enroll.studentId);

        const avatar = clone.querySelector(".student-avatar");
        if (avatar) avatar.textContent = safeEscape(initials);
        const nameEl = clone.querySelector(".student-name");
        if (nameEl) nameEl.textContent = safeEscape(name);
        const emailEl = clone.querySelector(".student-email");
        if (emailEl) emailEl.textContent = safeEscape(email);
        const courseEl = clone.querySelector(".enroll-course");
        if (courseEl) {
          courseEl.textContent = safeEscape(courseName);
          courseEl.title = safeEscape(courseName);
        }
        const membershipEl = clone.querySelector(".enroll-membership");
        if (membershipEl) membershipEl.textContent = safeEscape(membership);
        const amountEl = clone.querySelector(".enroll-amount");
        if (amountEl) amountEl.textContent = amount;
        const statusEl = clone.querySelector(".enroll-status");
        if (statusEl) {
          statusEl.textContent = safeEscape(statusLabel);
          statusEl.className = `payment-badge ${statusClass}`;
        }
        const deliveryEl = clone.querySelector(".enroll-delivery");
        if (deliveryEl) deliveryEl.textContent = safeEscape(delivery);
        const startEl = clone.querySelector(".enroll-start-date");
        if (startEl) startEl.textContent = start;
        const viewBtn = clone.querySelector(".view-student-btn");
        if (viewBtn) viewBtn.setAttribute("data-student-id", enroll.studentId);

        let cardEl = null;
        if (templateEnrollCard && templateEnrollCard.content) {
          const cardClone = templateEnrollCard.content.cloneNode(true);
          cardEl =
            cardClone.querySelector(".enrollment-card") ||
            cardClone.firstElementChild;
          if (cardEl) {
            const cName = cardEl.querySelector(".enroll-name");
            if (cName) cName.textContent = safeEscape(name);
            const cMeta = cardEl.querySelector(".enroll-meta");
            if (cMeta)
              cMeta.textContent = `${safeEscape(courseName)} • ${safeEscape(membership)}`;
            const cDetails = cardEl.querySelector(".enroll-details");
            if (cDetails)
              cDetails.textContent = `${amount} • ${safeEscape(delivery)} • ${start} • ${safeEscape(statusLabel)}`;
            const cView = cardEl.querySelector(".view-student-btn");
            if (cView) cView.setAttribute("data-student-id", enroll.studentId);
          }
        }

        return {
          tableEl: tr,
          cardEl: cardEl,
          table: tr.outerHTML,
          card: cardEl ? cardEl.outerHTML : "",
        };
      }
    }

    // Fallback original
    return {
      table: `
        <tr data-enroll-id="${safeEscape(enroll.id)}" data-student-id="${safeEscape(enroll.studentId)}">
          <td><div class="student-info"><div class="student-avatar">${safeEscape(initials)}</div><div><div class="student-name">${safeEscape(name)}</div><div class="student-email">${safeEscape(email)}</div></div></div></td>
          <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${safeEscape(courseName)}">${safeEscape(courseName)}</td>
          <td><span style="font-family:monospace;font-size:12px;background:var(--bg-page);padding:4px 8px;border-radius:6px">${safeEscape(membership)}</span></td>
          <td style="font-weight:600">${amount}</td>
          <td><span class="payment-badge ${statusClass}">${safeEscape(statusLabel)}</span></td>
          <td>${safeEscape(delivery)}</td>
          <td>${start}</td>
          <td><button class="btn-light view-student-btn" data-student-id="${safeEscape(enroll.studentId)}" style="padding:6px 10px;font-size:12px">View</button></td>
        </tr>`,
      card: `
        <div class="data-row" style="padding:14px 16px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;gap:10px">
          <div><div style="font-weight:600;font-size:13px">${safeEscape(name)}</div><div style="font-size:11px;color:var(--text-muted)">${safeEscape(courseName)} • ${safeEscape(membership)}</div><div style="font-size:11px;margin-top:4px">${amount} • ${safeEscape(delivery)} • ${start} • <span class="payment-badge ${statusClass}">${safeEscape(statusLabel)}</span></div></div>
          <button class="btn-light view-student-btn" data-student-id="${safeEscape(enroll.studentId)}" style="padding:6px 10px;font-size:12px;height:fit-content">View</button>
        </div>`,
    };
  }

  function renderAllStudents() {
    const containerTableBody =
      qs("#students-table-body") ||
      qs("tbody#students-tbody") ||
      qs(".student-table tbody");
    const containerList =
      qs("#page-list") ||
      qs("#students-list") ||
      qs("#all-students-list") ||
      qs(".data-list");
    const wrapper = containerTableBody || containerList;
    if (!wrapper) return;

    const data = getFilteredStudents();

    const totalEl =
      qs("#total-students-count") || qs('[data-kpi="total-students"]');
    if (totalEl)
      totalEl.textContent = (
        window.Store ? window.Store.get("students").length : data.length
      ).toLocaleString();
    const visibleEl =
      qs("#visible-students-count") || qs('[data-kpi="visible"]');
    if (visibleEl) visibleEl.textContent = data.length.toString();

    if (data.length === 0) {
      const emptyHtml = renderEmpty(
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        STATE.search ? "No students found" : "No students yet",
        STATE.search
          ? `No match for "${STATE.search}" in name, email or membership.`
          : "Invite students or wait for enrollments to populate the list.",
      );
      if (containerTableBody) {
        qs(".student-table")?.setAttribute("style", "");
        containerTableBody.innerHTML = `<tr><td colspan="8">${emptyHtml}</td></tr>`;
      } else if (containerList) {
        containerList.innerHTML = emptyHtml;
      }
      return;
    }

    // PHP-ready path: use templates with DocumentFragment for performance
    if (containerTableBody) {
      containerTableBody.innerHTML = "";
      const fragment = document.createDocumentFragment();
      data.forEach(({ student, meta }) => {
        const row = buildAllStudentsRow(student, meta);
        if (row.tableEl) {
          fragment.appendChild(row.tableEl);
        } else {
          // Fallback string
          const temp = document.createElement("tbody");
          temp.innerHTML = row.table;
          if (temp.firstElementChild)
            fragment.appendChild(temp.firstElementChild);
        }
      });
      containerTableBody.appendChild(fragment);
    } else if (containerList) {
      containerList.innerHTML = "";
      const fragment = document.createDocumentFragment();
      data.forEach(({ student, meta }) => {
        const row = buildAllStudentsRow(student, meta);
        if (row.cardEl) {
          fragment.appendChild(row.cardEl);
        } else {
          const temp = document.createElement("div");
          temp.innerHTML = row.card;
          if (temp.firstElementChild)
            fragment.appendChild(temp.firstElementChild);
        }
      });
      if (STATE.isTopPerformance) {
        const note = document.createElement("div");
        note.style.cssText =
          "padding:12px;text-align:center;font-size:12px;color:var(--text-muted)";
        note.textContent = `Showing top ${data.length} performers sorted by average score.`;
        fragment.appendChild(note);
      }
      containerList.appendChild(fragment);
    }
  }

  function renderPaidEnrollments() {
    const containerTableBody =
      qs("#students-table-body") ||
      qs("tbody#students-tbody") ||
      qs(".student-table tbody");
    const containerList =
      qs("#page-list") ||
      qs("#paid-enrollments-list") ||
      qs("#students-list") ||
      qs(".data-list");
    const wrapper = containerTableBody || containerList;
    if (!wrapper) return;
    const data = getFilteredEnrollments("paid");
    if (data.length === 0) {
      const emptyHtml = renderEmpty(
        "",
        STATE.search ? "No paid enrollments found" : "No paid enrollments yet",
        STATE.search
          ? `No match for "${STATE.search}".`
          : "Paid enrollments will appear here once payments are confirmed.",
      );
      if (containerTableBody)
        containerTableBody.innerHTML = `<tr><td colspan="8">${emptyHtml}</td></tr>`;
      else if (containerList) containerList.innerHTML = emptyHtml;
      return;
    }
    if (containerTableBody) {
      containerTableBody.innerHTML = "";
      const fragment = document.createDocumentFragment();
      data.forEach((e) => {
        const row = buildEnrollmentRow(e, "paid");
        if (row.tableEl) fragment.appendChild(row.tableEl);
        else {
          const temp = document.createElement("tbody");
          temp.innerHTML = row.table;
          if (temp.firstElementChild)
            fragment.appendChild(temp.firstElementChild);
        }
      });
      containerTableBody.appendChild(fragment);
    } else if (containerList) {
      containerList.innerHTML = "";
      const fragment = document.createDocumentFragment();
      data.forEach((e) => {
        const row = buildEnrollmentRow(e, "paid");
        if (row.cardEl) fragment.appendChild(row.cardEl);
        else {
          const temp = document.createElement("div");
          temp.innerHTML = row.card;
          if (temp.firstElementChild)
            fragment.appendChild(temp.firstElementChild);
        }
      });
      containerList.appendChild(fragment);
    }
  }

  function renderPaymentRecords() {
    const containerTableBody =
      qs("#students-table-body") ||
      qs("tbody#students-tbody") ||
      qs(".student-table tbody");
    const containerList =
      qs("#page-list") ||
      qs("#payment-records-list") ||
      qs("#students-list") ||
      qs(".data-list");
    if (!containerTableBody && !containerList) return;
    const data = getFilteredEnrollments("all");
    if (data.length === 0) {
      const emptyHtml = renderEmpty(
        "",
        "No payment records",
        "Transaction records will appear here.",
      );
      if (containerTableBody)
        containerTableBody.innerHTML = `<tr><td colspan="7">${emptyHtml}</td></tr>`;
      else if (containerList) containerList.innerHTML = emptyHtml;
      return;
    }
    if (containerTableBody) {
      containerTableBody.innerHTML = "";
      const fragment = document.createDocumentFragment();
      data.forEach((e) => {
        const row = buildEnrollmentRow(e, "payment-records");
        if (row.tableEl) fragment.appendChild(row.tableEl);
        else {
          const temp = document.createElement("tbody");
          temp.innerHTML = row.table;
          if (temp.firstElementChild)
            fragment.appendChild(temp.firstElementChild);
        }
      });
      containerTableBody.appendChild(fragment);
    } else if (containerList) {
      containerList.innerHTML = "";
      const fragment = document.createDocumentFragment();
      data.forEach((e) => {
        const row = buildEnrollmentRow(e, "payment-records");
        if (row.cardEl) fragment.appendChild(row.cardEl);
        else {
          const temp = document.createElement("div");
          temp.innerHTML = row.card;
          if (temp.firstElementChild)
            fragment.appendChild(temp.firstElementChild);
        }
      });
      containerList.appendChild(fragment);
    }
  }

  function updateTableHeaders() {
    const thead = qs("#students-table-head");
    if (!thead) return;

    // PHP-ready path: use templates from HTML
    const templateAll = document.getElementById("table-header-all-template");
    const templatePaid = document.getElementById("table-header-paid-template");
    const templateRecords = document.getElementById(
      "table-header-records-template",
    );

    if (templateAll && templateAll.content && templatePaid && templateRecords) {
      let template = null;
      if (STATE.activeTab === "paid") template = templatePaid;
      else if (STATE.activeTab === "records") template = templateRecords;
      else template = templateAll;

      if (template && template.content) {
        thead.innerHTML = "";
        const clone = template.content.cloneNode(true);
        thead.appendChild(clone);
        return;
      }
    }

    // Fallback
    const headers = {
      all: `<tr><th>Student</th><th>Course</th><th>Membership</th><th>Amount Paid</th><th>Payment</th><th>Delivery</th><th>Start Date</th><th>Action</th></tr>`,
      paid: `<tr><th>Student</th><th>Course</th><th>Membership</th><th>Amount Paid</th><th>Payment</th><th>Delivery</th><th>Start Date</th><th>Action</th></tr>`,
      records: `<tr><th>Student</th><th>Transaction Ref</th><th>Course</th><th>Amount</th><th>Payment Date</th><th>Status</th><th>Action</th></tr>`,
    };
    thead.innerHTML = headers[STATE.activeTab] || headers.all;
  }

  function renderActiveTab() {
    updateTableHeaders();
    switch (STATE.activeTab) {
      case "paid":
        renderPaidEnrollments();
        break;
      case "records":
        renderPaymentRecords();
        break;
      case "all":
      default:
        renderAllStudents();
        break;
    }
    updateTabUI();
    updateHeaderContext();
  }

  function updateTabUI() {
    const tabs = qsa(".tab-btn, [data-tab], .students-tab-btn");
    tabs.forEach((t) => {
      const id = (
        t.getAttribute("data-tab") ||
        t.id ||
        t.textContent ||
        ""
      ).toLowerCase();
      const isActive =
        id.includes(STATE.activeTab) ||
        (STATE.activeTab === "all" &&
          (id.includes("all") || id.includes("student"))) ||
        (STATE.activeTab === "paid" && id.includes("paid")) ||
        (STATE.activeTab === "records" &&
          (id.includes("record") || id.includes("payment")));
      // also support explicit data-active
      if (t.dataset.tab) {
        t.classList.toggle("active", t.dataset.tab === STATE.activeTab);
      } else if (
        id.includes("all") ||
        id.includes("paid") ||
        id.includes("record")
      ) {
        t.classList.toggle("active", isActive);
      }
    });
    // Fallback for tab buttons with id pattern
    ["all", "paid", "records"].forEach((k) => {
      const el =
        qs(`#tab-${k}`) || qs(`#tab-${k}-students`) || qs(`[data-tab="${k}"]`);
      if (el) el.classList.toggle("active", STATE.activeTab === k);
    });
  }

  function updateHeaderContext() {
    const titleEl = qs("#students-tab-title") || qs(".tab-context-title");
    if (!titleEl) return;
    const map = {
      all: "All Students",
      paid: "Paid Enrollments",
      records: "Payment Records",
    };
    titleEl.textContent = map[STATE.activeTab] || "Students";
    const banner = qs("#top-performance-banner");
    if (banner) banner.style.display = STATE.isTopPerformance ? "flex" : "none";
  }

  function ensureDrawer() {
    let drawer = qs("#drawer");
    if (drawer) return drawer;
    // create minimal drawer if missing
    const overlayHost = qs("#layout-overlays") || document.body;
    const div = document.createElement("div");
    div.id = "drawer";
    div.className = "drawer";
    div.innerHTML = `
      <div class="drawer-backdrop" onclick="closeStudent()" style="position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:40"></div>
      <div class="drawer-panel" style="position:fixed;right:0;top:0;bottom:0;width:420px;max-width:92vw;background:var(--bg-card);border-left:1px solid var(--border-light);z-index:50;display:flex;flex-direction:column;overflow:auto;transform:translateX(100%);transition:transform .28s ease">
        <div class="drawer-head" style="padding:20px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center">
          <div style="display:flex;gap:12px;align-items:center"><div id="d-av" style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--color-primary-light);font-weight:700">--</div><div><div id="d-name" style="font-weight:700;font-size:15px">Student</div><div id="d-email" style="font-size:12px;color:var(--text-muted)"></div></div></div>
          <button class="drawer-close" onclick="closeStudent()" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--border-light);background:var(--bg-page)">×</button>
        </div>
        <div id="d-body" style="padding:20px;display:flex;flex-direction:column;gap:16px"></div>
        <div style="padding:16px 20px;margin-top:auto;border-top:1px solid var(--border-light)"><button class="btn-primary" style="width:100%;justify-content:center" onclick="document.getElementById('drawer')?.classList.remove('show')">Close</button></div>
      </div>
    `;
    overlayHost.appendChild(div);
    // basic show/hide logic if common.js not loaded
    if (typeof window.closeStudent !== "function") {
      window.closeStudent = () => drawer.classList.remove("show");
      const style = document.createElement("style");
      style.textContent = `.drawer.show .drawer-panel{transform:translateX(0)!important} .drawer:not(.show){pointer-events:none;opacity:0} .drawer.show{pointer-events:auto;opacity:1}`;
      document.head.appendChild(style);
      window.openStudent = (name, init) => {
        const n = qs("#d-name");
        if (n) n.textContent = name;
        const a = qs("#d-av");
        if (a) a.textContent = init;
        drawer.classList.add("show");
      };
    }
    return drawer;
  }

  function viewStudentProfile(studentId) {
    if (!studentId) return;
    const student = window.Store
      ? window.Store.getById("students", studentId)
      : null;
    if (!student) {
      safeToast("Student not found");
      return;
    }
    const meta = enrichStudent(student);
    const displayName = getDisplayName(student);
    const initials = getInitials(student);

    // Prefer drawer if available, else navigate
    const hasDrawer = !!qs("#drawer") || !!qs("#student-drawer");
    const profilePageExists = true; // assume student-profile.html exists

    // If drawer element exists in DOM, use it
    if (hasDrawer || qs("#layout-overlays")) {
      const drawer = ensureDrawer();
      const panel = drawer.querySelector(".drawer-panel");
      if (panel) {
        /* ensure transition */
      }
      window.openStudent && window.openStudent(displayName, initials);
      drawer.classList.add("show");
      const dName = qs("#d-name");
      if (dName) dName.textContent = displayName;
      const dAv = qs("#d-av");
      if (dAv) dAv.textContent = initials;
      const dEmail = qs("#d-email");
      if (dEmail) dEmail.textContent = student.email || "";
      const dBody = qs("#d-body");
      if (dBody) {
        dBody.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="padding:12px;background:var(--bg-page);border-radius:10px"><div style="font-size:11px;color:var(--text-muted)">Avg Score</div><div style="font-weight:700;font-size:18px;margin-top:4px">${meta.avgScore ? meta.avgScore + "%" : "—"}</div></div>
            <div style="padding:12px;background:var(--bg-page);border-radius:10px"><div style="font-size:11px;color:var(--text-muted)">Enrollments</div><div style="font-weight:700;font-size:18px;margin-top:4px">${meta.enrollmentCount}</div></div>
            <div style="padding:12px;background:var(--bg-page);border-radius:10px"><div style="font-size:11px;color:var(--text-muted)">Total Paid</div><div style="font-weight:700;font-size:14px;margin-top:4px">${safeCurrency(meta.totalPaid, meta.currency)}</div></div>
            <div style="padding:12px;background:var(--bg-page);border-radius:10px"><div style="font-size:11px;color:var(--text-muted)">Membership</div><div style="font-weight:600;font-size:12px;margin-top:4px;word-break:break-all">${safeEscape(meta.membership)}</div></div>
          </div>
          <div style="border:1px solid var(--border-light);border-radius:12px;padding:12px"><div style="font-weight:600;font-size:13px;margin-bottom:8px">Enrolled Courses</div>${meta.courses.length ? meta.courses.map((c) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bg-track)"><span style="font-size:13px">${safeEscape(c.name)}</span><span style="font-size:11px;color:var(--text-muted)">${safeEscape(c.deliveryMethod || "")}</span></div>`).join("") : '<div style="font-size:12px;color:var(--text-muted)">No enrollments</div>'}</div>
          <div style="border:1px solid var(--border-light);border-radius:12px;padding:12px"><div style="font-weight:600;font-size:13px;margin-bottom:8px">Payment History</div>${meta.enrollments.length ? meta.enrollments.map((e) => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bg-track)"><span style="font-size:12px;font-family:monospace">${safeEscape(e.transactionReference || "—")}</span><span style="font-size:12px">${safeCurrency(e.amountPaid?.amount || e.amount?.amount || 0, e.amountPaid?.currency || "NGN")} <span class="payment-badge ${e.paymentStatus === "paid" ? "paid" : e.paymentStatus === "partial" ? "partial" : "pending"}" style="margin-left:6px">${safeEscape(e.paymentStatus || "-")}</span></span></div>`).join("") : '<div style="font-size:12px;color:var(--text-muted)">No payments</div>'}</div>
          <div style="display:flex;gap:8px"><button class="btn-primary" style="flex:1" onclick="window.location.href='student-profile.html?id=${safeEscape(student.id)}'">Open Full Profile</button><button class="btn-secondary" style="flex:1" onclick="closeStudent()">Close</button></div>
        `;
      }
      // Dispatch view event
      window.dispatchEvent(
        new CustomEvent("studypod:view-student", { detail: { studentId } }),
      );
    } else {
      // Fallback navigate
      const target = `student-profile.html?id=${encodeURIComponent(studentId)}`;
      window.location.href = target;
    }
  }

  function bindEvents() {
    // Search
    const searchInputs = qsa(
      '#student-search, #students-search, .search-input, input[placeholder*="Search students"], input[placeholder*="Search Student"]',
    );
    searchInputs.forEach((inp) => {
      inp.addEventListener("input", (e) => {
        STATE.search = e.target.value;
        // sync other inputs
        searchInputs.forEach((other) => {
          if (other !== e.target) other.value = e.target.value;
        });
        renderActiveTab();
      });
    });

    // Tabs
    const tabSelectors = [
      { sel: '[data-tab="all"]', tab: "all" },
      { sel: '[data-tab="paid"]', tab: "paid" },
      { sel: '[data-tab="records"]', tab: "records" },
      { sel: "#tab-all", tab: "all" },
      { sel: "#tab-all-students", tab: "all" },
      { sel: "#tab-paid", tab: "paid" },
      { sel: "#tab-paid-enrollments", tab: "paid" },
      { sel: "#tab-records", tab: "records" },
      { sel: "#tab-payment-records", tab: "records" },
      { sel: "#tab-payment", tab: "records" },
    ];
    tabSelectors.forEach(({ sel, tab }) => {
      qsa(sel).forEach((el) => {
        el.addEventListener("click", (e) => {
          e.preventDefault();
          STATE.activeTab = tab;
          // update URL without reload
          const url = new URL(window.location.href);
          url.searchParams.set("tab", tab);
          window.history.replaceState({}, "", url);
          renderActiveTab();
        });
      });
    });
    // generic .tab-btn with text
    qsa(".students-tabs .tab-btn, .tab-btn").forEach((btn) => {
      if (btn.dataset.tab) return; // already bound
      btn.addEventListener("click", () => {
        const txt = btn.textContent.toLowerCase();
        if (txt.includes("paid") && txt.includes("enroll"))
          STATE.activeTab = "paid";
        else if (txt.includes("payment") || txt.includes("record"))
          STATE.activeTab = "records";
        else STATE.activeTab = "all";
        renderActiveTab();
      });
    });

    // View buttons delegation
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(
        ".view-student-btn, [data-student-id].btn-light, [data-student-id].btn-primary",
      );
      if (!btn) {
        const row = e.target.closest(".student-row[data-student-id]");
        if (row && !e.target.closest("button")) {
          const id = row.getAttribute("data-student-id");
          if (id) viewStudentProfile(id);
        }
        return;
      }
      const sid =
        btn.getAttribute("data-student-id") ||
        btn.closest("[data-student-id]")?.getAttribute("data-student-id");
      if (sid) {
        e.preventDefault();
        viewStudentProfile(sid);
      }
    });

    // Invite students - functional implementation
    // Handles both old and new invite button selectors
    const inviteBtn =
      document.getElementById("btn-invite-students") ||
      document.querySelector("button#btn-invite-students");
    if (inviteBtn && !inviteBtn.dataset.boundInvite) {
      inviteBtn.dataset.boundInvite = "1";
      inviteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        // Simple prompt-based invite that creates a student record
        try {
          const name = prompt("Enter student full name:");
          if (!name) return;
          const email = prompt("Enter student email:");
          if (!email) return;
          const parts = name.trim().split(/\s+/);
          const firstName = parts[0] || name;
          const lastName = parts.slice(1).join(" ") || "";
          const newStudent = {
            firstName: firstName,
            lastName: lastName,
            name: name,
            email: email,
            avatar: (firstName[0] + (lastName[0] || "")).toUpperCase(),
            createdAt: new Date().toISOString(),
            membershipNo: "MEM-" + Date.now().toString().slice(-6),
          };
          if (window.Store) {
            const created = Store.create("students", newStudent);
            safeToast("Student " + name + " invited successfully");
            renderActiveTab();
            renderSummaryCards();
            // Optionally navigate to profile
            setTimeout(() => {
              if (confirm("View new student profile?"))
                viewStudentProfile(created.id);
            }, 500);
          }
        } catch (err) {
          console.error("Invite failed", err);
          safeToast("Failed to invite student");
        }
      });
    }

    // Legacy fallback for any other invite buttons
    qsa("button").forEach((b) => {
      if (
        b.textContent &&
        /invite student/i.test(b.textContent) &&
        b.id !== "btn-invite-students"
      ) {
        if (b.dataset.boundInvite) return;
        b.dataset.boundInvite = "1";
        b.addEventListener("click", (e) => {
          e.preventDefault();
          const mainBtn = document.getElementById("btn-invite-students");
          if (mainBtn) mainBtn.click();
          else safeToast("Use the main Invite button to add students");
        });
      }
    });

    // Store data change re-render
    window.addEventListener("studypod:datachange", (e) => {
      const col = e.detail?.collection;
      if (
        [
          "students",
          "enrollments",
          "courses",
          "submissions",
          "attempts",
        ].includes(col) ||
        col === "all"
      ) {
        renderActiveTab();
        renderSummaryCards();
      }
    });
  }

  function renderSummaryCards() {
    if (!window.Store) return;
    const students = window.Store.get("students");
    const enrollments = window.Store.get("enrollments");
    const paid = enrollments.filter((en) => en.paymentStatus === "paid");
    const totalRevenue = paid.reduce(
      (s, en) => s + Number(en.amountPaid?.amount || en.amount?.amount || 0),
      0,
    );
    const uniqueCourses = new Set(enrollments.map((e) => e.courseId)).size;

    const setText = (sel, val) => {
      const el = qs(sel);
      if (el) el.textContent = val;
    };

    setText("#total-students-kpi", students.length.toLocaleString());
    setText('[data-kpi="total-students"]', students.length.toLocaleString());
    setText("#total-enrollments-kpi", enrollments.length.toLocaleString());
    setText("#total-revenue-kpi", safeCurrency(totalRevenue, "NGN"));
    setText("#paid-enrollments-kpi", paid.length.toLocaleString());
    setText("#active-courses-count", uniqueCourses.toLocaleString());
  }

  function parseUrl() {
    const url = new URL(window.location.href);
    const tabParam = url.searchParams.get("tab");
    if (
      ["all", "paid", "records", "payment", "payment-records"].includes(
        tabParam,
      )
    ) {
      STATE.activeTab =
        tabParam.includes("payment") || tabParam === "records"
          ? "records"
          : tabParam;
      if (tabParam === "paid") STATE.activeTab = "paid";
    }
    const filterParam = url.searchParams.get("filter");
    if (
      filterParam === "top-performance" ||
      url.searchParams.get("top") === "1"
    ) {
      STATE.isTopPerformance = true;
      STATE.activeTab = "all";
    }
    const searchParam =
      url.searchParams.get("q") || url.searchParams.get("search");
    if (searchParam) STATE.search = searchParam;
  }

  function init() {
    if (typeof window.setActiveNav === "function") setActiveNav("students");
    if (!window.Store) {
      console.warn("[students.js] Store not found. Waiting...");
      const empty = qs("#page-list") || qs(".data-list");
      if (empty)
        empty.innerHTML = renderEmpty(
          "!",
          "Store not ready",
          "Try reloading after common.js and store.js have loaded. Make sure js/common.js and js/store.js are included before students.js.",
        );
      setTimeout(init, 500);
      return;
    }
    parseUrl();
    // sync search inputs initial value
    if (STATE.search) {
      qsa("#student-search, #students-search, .search-input").forEach(
        (inp) => (inp.value = STATE.search),
      );
    }
    // ensure tabs markup exists even for old template
    const tabsHost = qs(".students-tabs") || qs(".tabs");
    if (!tabsHost && qs("#page-list")) {
      const pageHead = qs(".page-head") || qs(".content");
      if (pageHead) {
        // inject tabs if missing
        const injected = document.createElement("div");
        injected.className = "students-tabs";
        injected.style.cssText =
          "display:flex;gap:8px;border-bottom:1px solid var(--border-light);margin:16px 0;padding-bottom:0;overflow:auto";
        injected.innerHTML = `
          <button data-tab="all" class="tab-btn ${STATE.activeTab === "all" ? "active" : ""}">All Students</button>
          <button data-tab="paid" class="tab-btn ${STATE.activeTab === "paid" ? "active" : ""}">Paid Enrollments</button>
          <button data-tab="records" class="tab-btn ${STATE.activeTab === "records" ? "active" : ""}">Payment Records</button>
        `;
        const card = qs(".card") || qs("#page-list")?.parentElement;
        if (card && card.parentElement)
          card.parentElement.insertBefore(injected, card);
      }
    }
    bindEvents();
    renderSummaryCards();
    renderActiveTab();

    // top-performance banner
    if (STATE.isTopPerformance) {
      const host = qs(".page-head") || qs(".content") || document.body;
      if (host && !qs("#top-performance-banner")) {
        const banner = document.createElement("div");
        banner.id = "top-performance-banner";
        banner.style.cssText =
          "display:flex;gap:12px;align-items:center;padding:12px 16px;background:var(--color-warning-bg, #FFF7ED);border:1px solid var(--border-light);border-radius:10px;margin:12px 0;font-size:13px";
        banner.innerHTML = `<span></span><span>Showing <strong>Top Performance</strong> students sorted by average score (submissions + quiz attempts). <a href="${window.location.pathname}?tab=all" style="margin-left:8px;text-decoration:underline;color:var(--color-primary)">Clear filter</a></span>`;
        host.insertAdjacentElement("afterend", banner);
      }
    }

    console.log(
      "[students.js] Initialized",
      STATE,
      "students:",
      window.Store.get("students").length,
    );
    window.dispatchEvent(
      new CustomEvent("studypod:page-ready", {
        detail: { page: "students", state: STATE },
      }),
    );
  }

  // Expose for debugging / external calls
  window.StudentsPage = {
    init,
    renderActiveTab,
    viewStudentProfile,
    getState: () => ({ ...STATE }),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
