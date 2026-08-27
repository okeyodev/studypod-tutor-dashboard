/**
 * assignments.js - StudyPod Tutor Dashboard v2.0
 * Manages Assignments listing with live Store data
 * Collections: assignments, submissions, courses
 * Helpers: toast, escapeHtml, formatDate, confirmDelete, setActiveNav (from common.js)
 * Store: window.Store.get, getById, delete, filter
 */

(function () {
  "use strict";

  // --- State ---
  let allAssignments = [];
  let allSubmissions = [];
  let coursesMap = new Map();
  let coursesList = [];
  let filteredAssignments = [];

  let state = {
    search: "",
    courseId: "all",
    status: "all",
    submissionStatus: "all",
  };

  // --- Helpers ---
  function safeEscape(str) {
    try {
      if (typeof escapeHtml === "function") return escapeHtml(str);
    } catch (e) {}
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function safeFormatDate(d) {
    try {
      if (typeof formatDate === "function") return formatDate(d);
    } catch (e) {}
    if (!d) return "-";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return d;
    }
  }

  function isNeedsReviewStatus(status) {
    if (!status) return false;
    const n = String(status).toLowerCase().replace(/_/g, "-").trim();
    return (
      n === "needs-review" ||
      n === "needs review" ||
      n === "pending-review" ||
      n === "pending review" ||
      n.includes("needs-review") ||
      n === "review" ||
      n === "needsreview"
    );
  }

  function normalizeStatus(status) {
    if (!status) return "";
    return String(status).toLowerCase().replace(/_/g, "-").trim();
  }

  function getCourseName(courseId) {
    if (!courseId) return "Unassigned Course";
    if (coursesMap.has(courseId)) return coursesMap.get(courseId);
    // fallback lookup
    try {
      const c = Store.getById("courses", courseId);
      if (c && c.name) {
        coursesMap.set(courseId, c.name);
        return c.name;
      }
    } catch (e) {}
    return "Unknown Course";
  }

  function getSubmissionsForAssignment(assignmentId) {
    return allSubmissions.filter((s) => s.assignmentId === assignmentId);
  }

  // --- Data Loading ---
  function loadData() {
    try {
      allAssignments = Store ? Store.get("assignments") : [];
    } catch (e) {
      allAssignments = [];
    }
    try {
      allSubmissions = Store ? Store.get("submissions") : [];
    } catch (e) {
      allSubmissions = [];
    }
    try {
      coursesList = Store ? Store.get("courses") : [];
    } catch (e) {
      coursesList = [];
    }
    coursesMap = new Map();
    coursesList.forEach((c) => {
      if (c && c.id)
        coursesMap.set(c.id, c.name || c.title || "Untitled Course");
    });
  }

  // --- Summary ---
  function calculateSummary() {
    const total = allAssignments.length;
    const published = allAssignments.filter(
      (a) => normalizeStatus(a.status) === "published",
    ).length;
    const drafts = allAssignments.filter(
      (a) => normalizeStatus(a.status) === "draft",
    ).length;
    // Needs Review = submissions where status needs-review
    const needsReview = allSubmissions.filter((s) =>
      isNeedsReviewStatus(s.status),
    ).length;

    return { total, published, drafts, needsReview };
  }

  function updateStatBySelectors(selectors, value) {
    let updated = false;
    selectors.forEach((sel) => {
      try {
        const els = document.querySelectorAll(sel);
        els.forEach((el) => {
          // If element contains extra text like label, try to keep structure
          // If it has strong child, update strong? Otherwise textContent
          if (el.dataset.count !== undefined) {
            el.textContent = String(value);
          } else {
            // If metric-card strong
            const strong = el.querySelector("strong");
            if (strong && el.matches(".metric-card")) {
              strong.textContent = String(value);
            } else {
              // For simplicity, replace numeric part or whole text if numeric
              if (
                /^\d+$/.test(el.textContent.trim()) ||
                el.textContent.trim() === "" ||
                !isNaN(parseInt(el.textContent.trim(), 10))
              ) {
                // preserve element but update
              }
              el.textContent = String(value);
            }
          }
          updated = true;
        });
      } catch (e) {}
    });
    return updated;
  }

  function renderSummary() {
    const summary = calculateSummary();

    // Try direct selectors
    updateStatBySelectors(
      [
        "#total-assignments",
        "#stat-total",
        '[data-stat="total"]',
        "#total-count",
        "[data-count-total]",
      ],
      summary.total,
    );
    updateStatBySelectors(
      [
        "#published-assignments",
        "#stat-published",
        '[data-stat="published"]',
        "#published-count",
      ],
      summary.published,
    );
    updateStatBySelectors(
      [
        "#draft-assignments",
        "#stat-drafts",
        "#stat-draft",
        '[data-stat="drafts"]',
        "#draft-count",
        '[data-stat="draft"]',
      ],
      summary.drafts,
    );
    updateStatBySelectors(
      [
        "#needs-review-count",
        "#stat-needs-review",
        '[data-stat="needs-review"]',
        "#needs-review",
        "#review-count",
        '[data-stat="needsReview"]',
      ],
      summary.needsReview,
    );

    // Fallback: update .page-grid metric cards in order [Total, Published, Drafts, Needs Review]
    const metricCards = document.querySelectorAll(
      ".page-grid .metric-card, .stats-grid .metric-card, .conf-stats-grid .metric-card, [data-summary-grid] .metric-card",
    );
    if (metricCards.length >= 4) {
      const values = [
        summary.total,
        summary.published,
        summary.drafts,
        summary.needsReview,
      ];
      metricCards.forEach((card, idx) => {
        if (idx < values.length) {
          const strong = card.querySelector(
            "strong, .metric-value, [data-value]",
          );
          if (strong) strong.textContent = String(values[idx]);
          else {
            // try first numeric looking element
            const numEl = card.querySelector("[data-count]");
            if (numEl) {
              numEl.textContent = String(values[idx]);
              numEl.setAttribute("data-count", String(values[idx]));
            }
          }
        }
      });
    } else if (metricCards.length > 0 && metricCards.length < 4) {
      // Single summary may be handled differently: we still try to update if summary cards have ids or data-stat
      metricCards.forEach((card) => {
        const stat = card.getAttribute("data-stat");
        if (!stat) return;
        if (stat === "total") {
          const s = card.querySelector("strong");
          if (s) s.textContent = String(summary.total);
        } else if (stat === "published") {
          const s = card.querySelector("strong");
          if (s) s.textContent = String(summary.published);
        } else if (stat === "drafts" || stat === "draft") {
          const s = card.querySelector("strong");
          if (s) s.textContent = String(summary.drafts);
        } else if (stat.includes("review")) {
          const s = card.querySelector("strong");
          if (s) s.textContent = String(summary.needsReview);
        }
      });
    }

    // Also update any element with specific data attributes like data-summary=total
    document.querySelectorAll("[data-summary]").forEach((el) => {
      const key = el.getAttribute("data-summary");
      if (key === "total") el.textContent = String(summary.total);
      if (key === "published") el.textContent = String(summary.published);
      if (key === "drafts" || key === "draft")
        el.textContent = String(summary.drafts);
      if (key === "needs-review" || key === "needsReview")
        el.textContent = String(summary.needsReview);
    });

    // Trigger event for external listeners
    window.dispatchEvent(
      new CustomEvent("assignments:summaryUpdated", { detail: summary }),
    );
  }

  // --- Filters ---
  function renderCourseFilter() {
    const courseFilter = document.querySelector(
      '#filter-course, #course-filter, [data-filter="course"], #filter-course-id',
    );
    if (!courseFilter) return;

    const currentVal = courseFilter.value || state.courseId;
    const existingOptions = courseFilter.querySelectorAll("option");
    const hasAll = Array.from(existingOptions).some((o) => o.value === "all");

    // Preserve first All option
    courseFilter.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All Courses";
    courseFilter.appendChild(allOpt);

    coursesList.forEach((course) => {
      const opt = document.createElement("option");
      opt.value = course.id;
      opt.textContent =
        course.name || course.title || course.token || course.id;
      courseFilter.appendChild(opt);
    });

    if (currentVal) courseFilter.value = currentVal;
  }

  function applyFilters() {
    const search = state.search.toLowerCase().trim();
    const courseId = state.courseId;
    const status = normalizeStatus(state.status);
    const subStatus = normalizeStatus(state.submissionStatus);

    filteredAssignments = allAssignments.filter((assignment) => {
      // Search
      if (search) {
        const courseName = (
          getCourseName(assignment.courseId) || ""
        ).toLowerCase();
        const haystack = [
          assignment.title,
          assignment.token,
          assignment.description,
          courseName,
          assignment.id,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      // Course filter
      if (courseId && courseId !== "all") {
        if (assignment.courseId !== courseId) return false;
      }

      // Status filter
      if (status && status !== "all") {
        if (normalizeStatus(assignment.status) !== status) return false;
      }

      // Submission status filter
      if (subStatus && subStatus !== "all") {
        const subs = getSubmissionsForAssignment(assignment.id);
        if (subStatus === "no-submissions") {
          if (subs.length !== 0) return false;
        } else if (subStatus === "has-submissions") {
          if (subs.length === 0) return false;
        } else if (subStatus === "needs-review") {
          if (!subs.some((s) => isNeedsReviewStatus(s.status))) return false;
        } else {
          // graded, submitted, etc
          const match = subs.some(
            (s) => normalizeStatus(s.status) === subStatus,
          );
          if (!match) return false;
        }
      }

      return true;
    });

    // Sort by dueDate descending, then updatedAt
    filteredAssignments.sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      if (da && db && da !== db) return da - db;
      const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return ub - ua;
    });
  }

  // --- Render ---
  function getStatusTag(status) {
    const s = normalizeStatus(status);
    if (s === "published") return { label: "Published", cls: "good" };
    if (s === "draft") return { label: "Draft", cls: "warn" };
    if (s === "archived") return { label: "Archived", cls: "" };
    return {
      label: status
        ? status.charAt(0).toUpperCase() + status.slice(1)
        : "Unknown",
      cls: "",
    };
  }

  function renderAssignments() {
    const grid =
      document.querySelector("#assignment-grid") ||
      document.querySelector("#assignments-grid") ||
      document.querySelector(".assignment-grid") ||
      document.querySelector("#page-list") ||
      document.querySelector("#assignment-list") ||
      document.querySelector(".data-list") ||
      document.querySelector('[data-list="assignments"]');

    if (!grid) {
      console.warn("[assignments.js] No grid container found for assignments");
      return;
    }

    if (filteredAssignments.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div style="font-size:36px;margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
          <h3 style="font-size:16px;font-weight:600;margin-bottom:6px">No assignments found</h3>
          <p style="font-size:13px;color:var(--text-secondary);max-width:360px;margin:0 auto">We couldn't find any assignments matching your filters. Try adjusting your search or create a new assignment.</p>
          <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
            <a href="assignment-form.html" class="btn-primary" style="text-decoration:none">+ Create Assignment</a>
            <button class="btn-secondary" onclick="document.getElementById('search-input') && (document.getElementById('search-input').value=''); document.getElementById('assignment-search') && (document.getElementById('assignment-search').value=''); window.AssignmentsApp && window.AssignmentsApp.clearFilters && window.AssignmentsApp.clearFilters()">Clear Filters</button>
          </div>
        </div>
      `;
      return;
    }

    const isDataRowMode =
      grid.classList.contains("data-list") || grid.id === "page-list";

    const html = filteredAssignments
      .map((assignment) => {
        const courseName = getCourseName(assignment.courseId);
        const subs = getSubmissionsForAssignment(assignment.id);
        const submissionCount = subs.length;
        const needsReviewCount = subs.filter((s) =>
          isNeedsReviewStatus(s.status),
        ).length;
        const statusInfo = getStatusTag(assignment.status);
        const dueDateFormatted = safeFormatDate(assignment.dueDate);
        const token = safeEscape(
          assignment.token || assignment.id.slice(0, 12).toUpperCase(),
        );
        const title = safeEscape(assignment.title || "Untitled Assignment");
        const courseEsc = safeEscape(courseName);
        const points =
          assignment.totalPoints != null ? `${assignment.totalPoints} pts` : "";
        const gradedCount = subs.filter(
          (s) => normalizeStatus(s.status) === "graded",
        ).length;

        if (isDataRowMode) {
          // Render as data-row for tutor-pages.css compatibility
          return `
          <div class="data-row" data-id="${safeEscape(assignment.id)}">
            <div class="row-main">
              <div class="row-title"><span class="assignment-token" style="margin-right:8px">${token}</span> ${title}</div>
              <div class="row-meta">
                <span class="tag">${courseEsc}</span>
                <span>Due: ${safeEscape(dueDateFormatted)}</span>
                <span>${submissionCount} submission${submissionCount !== 1 ? "s" : ""}</span>
                ${needsReviewCount > 0 ? `<span style="color:var(--color-warning-text)">• ${needsReviewCount} needs review</span>` : ""}
                ${points ? `<span>• ${safeEscape(points)}</span>` : ""}
              </div>
            </div>
            <div class="row-actions">
              <span class="tag ${statusInfo.cls}">${safeEscape(statusInfo.label)}</span>
              <a href="assignment-submissions.html?id=${safeEscape(assignment.id)}" class="btn-secondary btn-sm">View Submissions (${submissionCount})</a>
              <a href="assignment-form.html?id=${safeEscape(assignment.id)}" class="btn-secondary btn-sm">Edit</a>
              <button class="btn-secondary btn-sm" style="color:var(--color-danger, #ef4444)" data-action="delete" data-id="${safeEscape(assignment.id)}">Delete</button>
            </div>
          </div>
        `;
        }

        // Card mode (assignments.css)
        return `
        <div class="assignment-card" data-id="${safeEscape(assignment.id)}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
            <div class="assignment-token">${token}</div>
            <span class="tag ${statusInfo.cls}">${safeEscape(statusInfo.label)}</span>
          </div>
          <div class="assignment-title" title="${title}">${title}</div>
          <div class="assignment-course">${courseEsc}</div>
          <div class="assignment-meta">
            <span> Due: ${safeEscape(dueDateFormatted)}</span>
            <span> ${submissionCount} submission${submissionCount !== 1 ? "s" : ""}</span>
            ${needsReviewCount > 0 ? `<span style="color:var(--color-warning-text);font-weight:600">! ${needsReviewCount} needs review</span>` : `<span style="color:var(--color-success-text)"> ${gradedCount} graded</span>`}
            ${points ? `<span> ${safeEscape(points)}</span>` : ""}
          </div>
          <div class="assignment-foot">
            <div>
              <span>${submissionCount} total</span>
              <span>•</span>
              <span>${needsReviewCount} pending</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">
              <a href="assignment-submissions.html?id=${safeEscape(assignment.id)}" class="btn-secondary btn-sm" style="text-decoration:none;font-size:12px;padding:6px 10px;border:1px solid var(--border-light);border-radius:6px;background:var(--bg-page);">View Submissions</a>
              <a href="assignment-form.html?id=${safeEscape(assignment.id)}" class="btn-secondary btn-sm" style="text-decoration:none;font-size:12px;padding:6px 10px;border:1px solid var(--border-light);border-radius:6px;">Edit</a>
              <button class="btn-secondary btn-sm" data-action="delete" data-id="${safeEscape(assignment.id)}" style="font-size:12px;padding:6px 10px;border:1px solid var(--border-light);border-radius:6px;color:var(--color-danger, #ef4444);background:transparent;cursor:pointer">Delete</button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    grid.innerHTML = html;

    // Bind delete buttons via delegation (also direct binding fallback)
    grid.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = btn.getAttribute("data-id");
        if (id) deleteAssignment(id);
      });
    });
  }

  // --- Delete ---
  async function deleteAssignment(id) {
    if (!id) return;
    const assignment = allAssignments.find((a) => a.id === id);
    const title = assignment ? assignment.title : "this assignment";

    let confirmed = false;
    try {
      if (typeof confirmDelete === "function") {
        confirmed = await confirmDelete(
          `Are you sure you want to delete "${title}"? All related submissions will remain but will be orphaned. This action cannot be undone.`,
          "Delete Assignment?",
        );
      } else {
        confirmed = window.confirm(`Delete "${title}"? This cannot be undone.`);
      }
    } catch (e) {
      confirmed = window.confirm(`Delete "${title}"?`);
    }

    if (!confirmed) return;

    try {
      if (Store) Store.delete("assignments", id);
      // Optionally also clean submissions? Spec says keep but we leave them
      // Refresh data
      loadData();
      renderSummary();
      applyFilters();
      renderAssignments();
      if (typeof toast === "function") toast(`Assignment "${title}" deleted`);
      window.dispatchEvent(
        new CustomEvent("assignments:deleted", { detail: { id } }),
      );
    } catch (e) {
      console.error("Failed to delete assignment", e);
      if (typeof toast === "function") toast("Failed to delete assignment");
      else alert("Failed to delete assignment");
    }
  }

  // --- Event Listeners ---
  function initSearchAndFilters() {
    const searchInputs = document.querySelectorAll(
      '#search-input, #assignment-search, #search-assignments, [data-search="assignments"], .search-input, input[type="search"]',
    );
    const courseFilters = document.querySelectorAll(
      '#filter-course, #course-filter, [data-filter="course"], #filter-course-id',
    );
    const statusFilters = document.querySelectorAll(
      '#filter-status, #status-filter, [data-filter="status"], #assignment-status-filter',
    );
    const submissionStatusFilters = document.querySelectorAll(
      '#filter-submission-status, #submission-status-filter, [data-filter="submission-status"], #filter-submission, #assignment-submission-filter',
    );

    let debounceTimer;

    function onSearchChange(e) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.search = e.target.value || "";
        applyFilters();
        renderAssignments();
        // Sync other search inputs
        searchInputs.forEach((inp) => {
          if (inp !== e.target) inp.value = state.search;
        });
      }, 250);
    }

    searchInputs.forEach((input) => {
      input.addEventListener("input", onSearchChange);
      input.addEventListener("search", onSearchChange);
    });

    courseFilters.forEach((sel) => {
      sel.addEventListener("change", (e) => {
        state.courseId = e.target.value || "all";
        // Sync
        courseFilters.forEach((other) => {
          if (other !== e.target) other.value = state.courseId;
        });
        applyFilters();
        renderAssignments();
      });
    });

    statusFilters.forEach((sel) => {
      sel.addEventListener("change", (e) => {
        state.status = e.target.value || "all";
        statusFilters.forEach((other) => {
          if (other !== e.target) other.value = state.status;
        });
        applyFilters();
        renderAssignments();
      });
    });

    submissionStatusFilters.forEach((sel) => {
      sel.addEventListener("change", (e) => {
        state.submissionStatus = e.target.value || "all";
        submissionStatusFilters.forEach((other) => {
          if (other !== e.target) other.value = state.submissionStatus;
        });
        applyFilters();
        renderAssignments();
      });
    });

    // Clear filters button if exists
    const clearBtns = document.querySelectorAll(
      '#clear-filters, [data-action="clear-filters"], .clear-filters',
    );
    clearBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        clearFilters();
      });
    });
  }

  function clearFilters() {
    state.search = "";
    state.courseId = "all";
    state.status = "all";
    state.submissionStatus = "all";

    document
      .querySelectorAll(
        '#search-input, #assignment-search, #search-assignments, [data-search="assignments"], .search-input, input[type="search"]',
      )
      .forEach((el) => (el.value = ""));
    document
      .querySelectorAll(
        '#filter-course, #course-filter, [data-filter="course"], #filter-course-id',
      )
      .forEach((el) => (el.value = "all"));
    document
      .querySelectorAll(
        '#filter-status, #status-filter, [data-filter="status"], #assignment-status-filter',
      )
      .forEach((el) => (el.value = "all"));
    document
      .querySelectorAll(
        '#filter-submission-status, #submission-status-filter, [data-filter="submission-status"], #filter-submission, #assignment-submission-filter',
      )
      .forEach((el) => (el.value = "all"));

    applyFilters();
    renderAssignments();
  }

  // --- Init ---
  function init() {
    // Active nav
    try {
      if (typeof setActiveNav === "function") setActiveNav("assignments");
    } catch (e) {}

    // Ensure Store ready
    if (!window.Store) {
      console.warn("[assignments.js] Store not found, retrying in 100ms");
      setTimeout(init, 100);
      return;
    }

    loadData();
    renderSummary();
    renderCourseFilter();
    applyFilters();
    renderAssignments();
    initSearchAndFilters();

    // Listen for external data changes
    window.addEventListener("studypod:datachange", (e) => {
      const col = e.detail && e.detail.collection;
      if (
        !col ||
        col === "assignments" ||
        col === "submissions" ||
        col === "courses" ||
        col === "all"
      ) {
        loadData();
        renderSummary();
        renderCourseFilter();
        applyFilters();
        renderAssignments();
      }
    });

    // Global delegation for delete (in case cards re-render or other containers)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="delete"][data-id]');
      if (!btn) return;
      // Avoid double handling if already bound inside grid
      const grid = document.querySelector(
        "#assignment-grid, #assignments-grid, .assignment-grid, #page-list",
      );
      if (grid && grid.contains(btn)) return; // handled by direct binding, but also allow
      // Actually still handle if outside
      if (btn.closest(".assignment-card") || btn.closest(".data-row")) {
        // Only handle if not already prevented
        const id = btn.getAttribute("data-id");
        if (id) {
          e.preventDefault();
          deleteAssignment(id);
        }
      }
    });

    console.log(
      "[assignments.js] Initialized with",
      allAssignments.length,
      "assignments,",
      allSubmissions.length,
      "submissions",
    );
  }

  // Expose API for HTML inline handlers and debugging
  window.AssignmentsApp = {
    init,
    loadData,
    render: () => {
      applyFilters();
      renderAssignments();
    },
    renderSummary,
    deleteAssignment,
    clearFilters,
    getFiltered: () => filteredAssignments.slice(),
    getSummary: calculateSummary,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
