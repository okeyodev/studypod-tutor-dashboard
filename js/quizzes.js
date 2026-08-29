/**
 * QUIZZES.JS - StudyPod Tutor Dashboard v2.0
 * List quizzes from Store. Stats, Search/filter, Cards, CRUD.
 * Collections: quizzes, questions, attempts, courses
 * Helpers: toast, escapeHtml, formatDate, confirmDelete, setActiveNav
 */

(function () {
  "use strict";

  const COLLECTIONS = {
    QUIZZES: "quizzes",
    QUESTIONS: "questions",
    ATTEMPTS: "attempts",
    COURSES: "courses",
  };

  // State
  let allQuizzes = [];
  let filteredQuizzes = [];
  let coursesMap = new Map();
  let searchQuery = "";
  let statusFilter = "all";
  let courseFilter = "all";

  // DOM Cache
  let els = {};

  function safeEscape(str) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(str);
    if (typeof str !== "string") return str;
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function getStore() {
    return window.Store || window.StudyPodStore || null;
  }

  function qAny(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function cacheElements() {
    els = {
      grid: qAny([
        "#quizGrid",
        "#quizzesGrid",
        ".quiz-grid",
        "#quiz-list",
        "[data-quiz-grid]",
      ]),
      searchInput: qAny([
        "#quizSearch",
        "#searchQuizzes",
        "#searchInput",
        "#q-search",
        'input[type="search"]',
        '[data-search="quizzes"]',
      ]),
      statusFilter: qAny([
        "#statusFilter",
        "#quizStatusFilter",
        '[data-filter="status"]',
        'select[data-filter="quiz-status"]',
      ]),
      courseFilter: qAny([
        "#courseFilter",
        "#quizCourseFilter",
        '[data-filter="course"]',
      ]),
      totalEl: qAny([
        "#totalQuizzes",
        "#total-quizzes",
        '[data-stat="total"]',
        "#kpi-total",
        "#stat-total",
      ]),
      publishedEl: qAny([
        "#publishedQuizzes",
        "#published-quizzes",
        '[data-stat="published"]',
        "#kpi-published",
        "#stat-published",
      ]),
      draftsEl: qAny([
        "#draftQuizzes",
        "#draft-quizzes",
        '[data-stat="drafts"]',
        "#kpi-drafts",
        "#stat-drafts",
      ]),
      avgScoreEl: qAny([
        "#avgScore",
        "#averageScore",
        "#avg-score",
        '[data-stat="avgScore"]',
        "#kpi-avg",
        "#stat-avg",
      ]),
      statsContainer: qAny([
        "#quizStats",
        ".kpi-grid",
        "#statsGrid",
        "[data-stats]",
      ]),
      emptyState: qAny(["#emptyState", ".empty-state", "[data-empty]"]),
      createBtn: qAny([
        "#createQuizBtn",
        "#newQuizBtn",
        '[data-action="create-quiz"]',
      ]),
    };
  }

  function init() {
    if (typeof setActiveNav === "function") {
      try {
        setActiveNav("quizzes");
      } catch (e) {}
    }
    cacheElements();
    loadData();
    renderCourseFilterOptions();
    bindEvents();
    applyFilters();
  }

  function loadData() {
    const Store = getStore();
    if (!Store) {
      console.warn("[quizzes] Store not found");
      allQuizzes = [];
      return;
    }
    try {
      allQuizzes = Store.get(COLLECTIONS.QUIZZES) || [];
      // Sort by updatedAt desc
      allQuizzes.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || 0) -
          new Date(a.updatedAt || a.createdAt || 0),
      );

      const courses = Store.get(COLLECTIONS.COURSES) || [];
      coursesMap = new Map(courses.map((c) => [c.id, c]));
    } catch (e) {
      console.error("[quizzes] loadData failed", e);
      allQuizzes = [];
    }
  }

  function getQuestionsCount(quizId) {
    const Store = getStore();
    if (!Store) return 0;
    try {
      const list = Store.filter(
        COLLECTIONS.QUESTIONS,
        (q) => q.quizId === quizId,
      );
      return list.length;
    } catch (e) {
      const all = Store.get(COLLECTIONS.QUESTIONS) || [];
      return all.filter((q) => q.quizId === quizId).length;
    }
  }

  function getAttemptsForQuiz(quizId) {
    const Store = getStore();
    if (!Store) return [];
    try {
      return Store.filter(
        COLLECTIONS.ATTEMPTS,
        (a) => a.quizId === quizId && a.status !== "in-progress",
      );
    } catch (e) {
      const all = Store.get(COLLECTIONS.ATTEMPTS) || [];
      return all.filter((a) => a.quizId === quizId);
    }
  }

  function calcAvgScore(attempts) {
    if (!attempts || attempts.length === 0) return null;
    const valid = attempts.filter((a) => typeof a.score === "number");
    if (valid.length === 0) return null;
    const sum = valid.reduce((acc, cur) => acc + cur.score, 0);
    return Math.round(sum / valid.length);
  }

  function calcGlobalAvgScore() {
    const Store = getStore();
    if (!Store) return 0;
    const allAttempts = Store.get(COLLECTIONS.ATTEMPTS) || [];
    if (allAttempts.length === 0) return 0;
    const valid = allAttempts.filter((a) => typeof a.score === "number");
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, cur) => acc + cur.score, 0);
    return Math.round(sum / valid.length);
  }

  function renderStats() {
    const total = allQuizzes.length;
    const published = allQuizzes.filter((q) => q.status === "published").length;
    const drafts = allQuizzes.filter(
      (q) => q.status === "draft" || !q.status,
    ).length;
    const avgScore = calcGlobalAvgScore();

    if (els.totalEl) els.totalEl.textContent = total;
    if (els.publishedEl) els.publishedEl.textContent = published;
    if (els.draftsEl) els.draftsEl.textContent = drafts;
    if (els.avgScoreEl) {
      // If element expects % or raw
      const text =
        allQuizzes.length &&
        (getStore()?.get(COLLECTIONS.ATTEMPTS)?.length || 0) > 0
          ? `${avgScore}%`
          : "—";
      // If it's a kpi card with inner strong, handle both
      if (
        els.avgScoreEl.tagName === "STRONG" ||
        els.avgScoreEl.querySelector("strong")
      ) {
        els.avgScoreEl.textContent = text;
      } else {
        els.avgScoreEl.textContent = text;
      }
    }

    // If stats container exists and has kpi-card structure, try to update via data attributes inside
    if (els.statsContainer) {
      const totalCard = els.statsContainer.querySelector(
        '[data-stat="total"] strong, #totalQuizzes, #total-quizzes',
      );
      const pubCard = els.statsContainer.querySelector(
        '[data-stat="published"] strong, #publishedQuizzes',
      );
      const draftCard = els.statsContainer.querySelector(
        '[data-stat="drafts"] strong, #draftQuizzes',
      );
      const avgCard = els.statsContainer.querySelector(
        '[data-stat="avgScore"] strong, #avgScore',
      );
      // No-op if not found, we already updated els
    }

    // Dispatch stats ready
    window.dispatchEvent(
      new CustomEvent("quizzes:statsUpdated", {
        detail: { total, published, drafts, avgScore },
      }),
    );
  }

  function renderCourseFilterOptions() {
    if (!els.courseFilter) return;
    const Store = getStore();
    if (!Store) return;
    const courses = Store.get(COLLECTIONS.COURSES) || [];
    // Preserve current value
    const currentVal = els.courseFilter.value || "all";

    // Clear existing options except first if it's All
    const existingAll = els.courseFilter.querySelector('option[value="all"]');
    els.courseFilter.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Courses";
    els.courseFilter.appendChild(allOption);

    courses.forEach((course) => {
      const opt = document.createElement("option");
      opt.value = course.id;
      opt.textContent = course.name || course.title || course.id;
      els.courseFilter.appendChild(opt);
    });

    els.courseFilter.value = currentVal;
  }

  function applyFilters() {
    const s = (searchQuery || "").toLowerCase().trim();
    filteredQuizzes = allQuizzes.filter((quiz) => {
      const matchStatus =
        statusFilter === "all" || (quiz.status || "draft") === statusFilter;
      const matchCourse =
        courseFilter === "all" || quiz.courseId === courseFilter;

      if (!matchStatus || !matchCourse) return false;

      if (!s) return true;

      const course = coursesMap.get(quiz.courseId);
      const courseName = course ? course.name || course.title || "" : "";
      const haystack = [
        quiz.title,
        quiz.token,
        quiz.description,
        courseName,
        quiz.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });

    renderStats();
    renderQuizzes();
  }

  function renderQuizzes() {
    if (!els.grid) {
      console.warn("[quizzes] grid container not found");
      return;
    }

    els.grid.innerHTML = "";

    if (filteredQuizzes.length === 0) {
      if (allQuizzes.length === 0) {
        els.grid.innerHTML = getEmptyStateHTML();
      } else {
        els.grid.innerHTML = getNoResultsHTML();
      }
      return;
    }

    const fragment = document.createDocumentFragment();

    filteredQuizzes.forEach((quiz) => {
      const card = createQuizCard(quiz);
      fragment.appendChild(card);
    });

    els.grid.appendChild(fragment);
  }

  function getEmptyStateHTML() {
    return `
      <div class="empty-state" style="grid-column:1/-1; text-align:center; padding:48px 24px; background:var(--bg-card); border:1px dashed var(--border-light); border-radius:var(--radius-xl);">
        <div style="font-size:36px; margin-bottom:12px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
        <h3 style="font-size:16px; font-weight:600; margin-bottom:8px;">No quizzes yet</h3>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:20px;">Create your first quiz to assess student understanding.</p>
        <a href="quiz-form.html" class="btn-primary" style="display:inline-flex; text-decoration:none; padding:10px 16px; border-radius:8px; background: var(--color-primary, #4F46E5); color:#fff;">+ Create Quiz</a>
      </div>
    `;
  }

  function getNoResultsHTML() {
    return `
      <div class="empty-state" style="grid-column:1/-1; text-align:center; padding:40px 24px; background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-xl);">
        <div style="font-size:28px; margin-bottom:12px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
        <h3 style="font-size:15px; font-weight:600; margin-bottom:6px;">No matching quizzes</h3>
        <p style="font-size:12px; color:var(--text-secondary);">Try adjusting search or filters.</p>
        <button onclick="document.getElementById('quizSearch') && (document.getElementById('quizSearch').value=''); window.QuizPage && window.QuizPage.clearFilters && window.QuizPage.clearFilters();" class="btn-secondary" style="margin-top:12px; padding:8px 12px; border-radius:8px; border:1px solid var(--border-light); background:var(--bg-card); cursor:pointer;">Clear filters</button>
      </div>
    `;
  }

  // ---------- Create Quiz Card - REFACTORED for PHP deployment ----------
  // HTML moved to quizzes.html <template id="quiz-card-template">
  // Original logic preserved: course-card-top with token, status, title, course, meta, stats, actions
  function createQuizCard(quiz) {
    const course = coursesMap.get(quiz.courseId);
    const courseName = course
      ? course.name || course.title || "Unlinked Course"
      : "—";
    const questionCount = getQuestionsCount(quiz.id);
    const attempts = getAttemptsForQuiz(quiz.id);
    const attemptsCount = attempts.length;
    const avg = calcAvgScore(attempts);
    const avgDisplay = avg !== null ? `${avg}%` : "—";
    const status = (quiz.status || "draft").toLowerCase();
    const statusClass = status === "published" ? "published" : "draft";
    const token = quiz.token || "—";
    const passingScore = quiz.passingScore != null ? quiz.passingScore : "—";
    const timeLimit = quiz.timeLimit != null ? quiz.timeLimit : "—";

    const template = document.getElementById("quiz-card-template");

    if (template && template.content) {
      // PHP-ready path: clone from HTML template
      const clone = template.content.cloneNode(true);
      const cardEl = clone.querySelector(".quiz-card");
      if (!cardEl) {
        // Fallback
        const card = document.createElement("div");
        card.className = "quiz-card course-card";
        card.dataset.quizId = quiz.id;
        return card;
      }

      cardEl.dataset.quizId = quiz.id;

      // Token
      const tokenEl = clone.querySelector(".quiz-token");
      if (tokenEl) tokenEl.textContent = token;

      // Status
      const statusEl = clone.querySelector(".quiz-status");
      if (statusEl) {
        statusEl.textContent = status;
        statusEl.classList.add(statusClass);
        statusEl.style.background =
          status === "published"
            ? "var(--color-success-bg, #DCFCE7)"
            : "var(--bg-track, #F1F5F9)";
        statusEl.style.color =
          status === "published"
            ? "var(--color-success-text, #15803D)"
            : "var(--text-secondary, #64748B)";
      }

      // Title
      const titleEl = clone.querySelector(".quiz-title");
      if (titleEl) titleEl.textContent = quiz.title || "Untitled Quiz";

      // Course
      const courseEl = clone.querySelector(".quiz-course");
      if (courseEl) courseEl.textContent = courseName;

      // Meta - Q count, time, pass
      const qcountText = clone.querySelector(".qcount-text");
      if (qcountText) qcountText.textContent = `${questionCount} Qs`;
      else {
        const qcount = clone.querySelector(".quiz-qcount");
        if (qcount) {
          const span = qcount.querySelector("span") || qcount;
          // Keep svg, update text
          const svg = qcount.querySelector("svg");
          qcount.textContent = "";
          if (svg) qcount.appendChild(svg);
          qcount.append(` ${questionCount} Qs`);
        }
      }

      const timeEl = clone.querySelector(".quiz-timelimit");
      if (timeEl) timeEl.textContent = `⏱ ${timeLimit}m`;

      const passEl = clone.querySelector(".quiz-pass");
      if (passEl) passEl.textContent = ` ${passingScore}% Pass`;

      // Stats
      const attemptsEl = clone.querySelector(".quiz-attempts-count");
      if (attemptsEl) attemptsEl.textContent = attemptsCount;

      const avgEl = clone.querySelector(".quiz-avg-score");
      if (avgEl) avgEl.textContent = avgDisplay;

      const questionsEl = clone.querySelector(".quiz-questions-count");
      if (questionsEl) questionsEl.textContent = questionCount;

      // Actions
      const perfLink = clone.querySelector(".quiz-performance-link");
      if (perfLink)
        perfLink.href = `quiz-performance.html?id=${encodeURIComponent(quiz.id)}`;

      const editLink = clone.querySelector(".quiz-edit-link");
      if (editLink)
        editLink.href = `quiz-form.html?id=${encodeURIComponent(quiz.id)}`;

      const duplicateBtn = clone.querySelector(".quiz-duplicate-btn");
      if (duplicateBtn) {
        duplicateBtn.setAttribute("data-id", quiz.id);
        duplicateBtn.setAttribute("data-action", "duplicate");
        // Keep empty as per original
      }

      const publishBtn = clone.querySelector(".quiz-publish-btn");
      if (publishBtn) {
        publishBtn.setAttribute("data-id", quiz.id);
        publishBtn.setAttribute("data-action", "toggle-publish");
        publishBtn.title = status === "published" ? "Unpublish" : "Publish";
        publishBtn.innerHTML =
          status === "published"
            ? ""
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>';
      }

      const deleteBtn = clone.querySelector(".quiz-delete-btn");
      if (deleteBtn) {
        deleteBtn.setAttribute("data-id", quiz.id);
        deleteBtn.setAttribute("data-action", "delete");
      }

      // Create wrapper div to return as element
      const wrapper = document.createElement("div");
      wrapper.appendChild(clone);
      const card = wrapper.firstElementChild;
      // Ensure card has correct classes and dataset
      if (card) {
        card.className = "quiz-card course-card";
        card.dataset.quizId = quiz.id;
        return card;
      }
      return wrapper.firstElementChild || cardEl;
    } else {
      // Fallback: original logic if template not found
      const card = document.createElement("div");
      card.className = "quiz-card course-card";
      card.dataset.quizId = quiz.id;
      card.innerHTML = `
      <div class="course-card-top" style="padding:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
          <span class="quiz-token course-card-token" style="font-size:10px; font-weight:700; letter-spacing:0.08em; color:var(--text-muted); text-transform:uppercase;">${safeEscape(token)}</span>
          <span class="course-status quiz-status ${statusClass}" style="font-size:11px; padding:4px 8px; border-radius:999px; font-weight:600; background:${status === "published" ? "var(--color-success-bg, #DCFCE7)" : "var(--bg-track, #F1F5F9)"}; color:${status === "published" ? "var(--color-success-text, #15803D)" : "var(--text-secondary, #64748B)"};">${safeEscape(status)}</span>
        </div>
        <h3 class="quiz-title course-card-title" style="font-size:16px; font-weight:700; line-height:1.3; margin:8px 0;">${safeEscape(quiz.title || "Untitled Quiz")}</h3>
        <span class="assignment-course quiz-course" style="font-size:12px; color:var(--color-primary, #4F46E5); background:var(--color-primary-light, #EEF2FF); padding:4px 8px; border-radius:999px; display:inline-flex; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeEscape(courseName)}</span>
        <div class="quiz-meta course-card-meta" style="display:flex; gap:12px; font-size:11px; color:var(--text-secondary); margin-top:12px; flex-wrap:wrap;">
          <span> ${questionCount} Qs</span>
          <span>⏱ ${timeLimit}m</span>
          <span> ${passingScore}% Pass</span>
        </div>
        <div class="quiz-stats" style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:16px;">
          <div class="quiz-stat" style="text-align:center; padding:10px; background:var(--bg-page, #F8FAFC); border-radius:8px;">
            <strong style="display:block; font-size:16px;">${attemptsCount}</strong>
            <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Attempts</span>
          </div>
          <div class="quiz-stat" style="text-align:center; padding:10px; background:var(--bg-page, #F8FAFC); border-radius:8px;">
            <strong style="display:block; font-size:16px;">${safeEscape(avgDisplay)}</strong>
            <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Avg Score</span>
          </div>
          <div class="quiz-stat" style="text-align:center; padding:10px; background:var(--bg-page, #F8FAFC); border-radius:8px;">
            <strong style="display:block; font-size:16px;">${questionCount}</strong>
            <span style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Questions</span>
          </div>
        </div>
      </div>
      <div class="course-card-foot quiz-foot" style="margin-top:16px; padding-top:12px; border-top:1px solid var(--border-light, #E2E8F0); display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
        <div class="quiz-actions" style="display:flex; gap:6px; flex-wrap:wrap; flex:1;">
          <a href="quiz-performance.html?id=${encodeURIComponent(quiz.id)}" class="btn-secondary">Performance</a>
          <a href="quiz-form.html?id=${encodeURIComponent(quiz.id)}" class="btn-secondary">Edit</a>
        </div>
      </div>
    `;
      return card;
    }
  }

  function bindEvents() {
    if (els.searchInput) {
      els.searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value || "";
        applyFilters();
      });
    }

    if (els.statusFilter) {
      els.statusFilter.addEventListener("change", (e) => {
        statusFilter = e.target.value || "all";
        applyFilters();
      });
    }

    if (els.courseFilter) {
      els.courseFilter.addEventListener("change", (e) => {
        courseFilter = e.target.value || "all";
        applyFilters();
      });
    }

    // Delegated actions on grid
    if (els.grid) {
      els.grid.addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-action]");
        if (!btn) return;
        const action = btn.getAttribute("data-action");
        const id = btn.getAttribute("data-id");
        if (!id) return;

        switch (action) {
          case "delete":
            handleDelete(id);
            break;
          case "duplicate":
            handleDuplicate(id);
            break;
          case "toggle-publish":
            handleTogglePublish(id);
            break;
        }
      });
    }

    // Create button
    if (els.createBtn) {
      els.createBtn.addEventListener("click", (e) => {
        // If it's a link already, let it go
        if (els.createBtn.tagName === "A") return;
        e.preventDefault();
        window.location.href = "quiz-form.html";
      });
    }

    // Listen to store changes
    window.addEventListener("studypod:datachange", (ev) => {
      const { collection } = ev.detail || {};
      if (
        !collection ||
        ["quizzes", "questions", "attempts", "courses", "all"].includes(
          collection,
        )
      ) {
        loadData();
        renderCourseFilterOptions();
        applyFilters();
      }
    });

    // Keyboard: ESC to clear search
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        els.searchInput &&
        document.activeElement === els.searchInput
      ) {
        els.searchInput.value = "";
        searchQuery = "";
        applyFilters();
      }
    });
  }

  async function handleDelete(id) {
    const Store = getStore();
    if (!Store) return;

    const quiz = Store.getById(COLLECTIONS.QUIZZES, id);
    if (!quiz) {
      if (typeof toast === "function") toast("Quiz not found");
      return;
    }

    const questionCount = getQuestionsCount(id);
    const attemptsCount = getAttemptsForQuiz(id).length;

    let message = `Delete "${quiz.title}"? This will also remove ${questionCount} question(s) and ${attemptsCount} attempt(s). This cannot be undone.`;
    let title = "Delete Quiz?";

    let confirmed = true;
    if (typeof confirmDelete === "function") {
      try {
        confirmed = await confirmDelete(message, title);
      } catch (e) {
        // Fallback to native confirm if promise fails
        confirmed = window.confirm(message);
      }
    } else {
      confirmed = window.confirm(message);
    }

    if (!confirmed) return;

    try {
      // Delete related questions
      const allQuestions = Store.get(COLLECTIONS.QUESTIONS) || [];
      allQuestions
        .filter((q) => q.quizId === id)
        .forEach((q) => {
          try {
            Store.delete(COLLECTIONS.QUESTIONS, q.id);
          } catch (e) {}
        });

      // Delete related attempts
      const allAttempts = Store.get(COLLECTIONS.ATTEMPTS) || [];
      allAttempts
        .filter((a) => a.quizId === id)
        .forEach((a) => {
          try {
            Store.delete(COLLECTIONS.ATTEMPTS, a.id);
          } catch (e) {}
        });

      // Delete quiz
      Store.delete(COLLECTIONS.QUIZZES, id);

      if (typeof toast === "function") toast(`Deleted "${quiz.title}"`);

      // Update local state
      allQuizzes = allQuizzes.filter((q) => q.id !== id);
      applyFilters();

      window.dispatchEvent(
        new CustomEvent("quizzes:deleted", { detail: { id, quiz } }),
      );
    } catch (e) {
      console.error("[quizzes] delete failed", e);
      if (typeof toast === "function") toast("Failed to delete quiz");
    }
  }

  function handleDuplicate(id) {
    const Store = getStore();
    if (!Store) return;

    const original = Store.getById(COLLECTIONS.QUIZZES, id);
    if (!original) {
      if (typeof toast === "function") toast("Quiz not found");
      return;
    }

    try {
      // Clone quiz without id/token
      const {
        id: _origId,
        token: _origToken,
        createdAt: _ca,
        updatedAt: _ua,
        ...rest
      } = original;
      const duplicated = Store.create(COLLECTIONS.QUIZZES, {
        ...rest,
        title: `${original.title} (Copy)`,
        status: "draft",
      });

      // Duplicate questions
      const relatedQuestions = Store.filter(
        COLLECTIONS.QUESTIONS,
        (q) => q.quizId === id,
      );
      relatedQuestions.forEach((q) => {
        const { id: qId, ...qRest } = q;
        Store.create(COLLECTIONS.QUESTIONS, {
          ...qRest,
          quizId: duplicated.id,
        });
      });

      if (typeof toast === "function")
        toast(`Duplicated "${original.title}" as draft`);

      allQuizzes.unshift(duplicated);
      applyFilters();

      window.dispatchEvent(
        new CustomEvent("quizzes:duplicated", {
          detail: { originalId: id, duplicated },
        }),
      );
    } catch (e) {
      console.error("[quizzes] duplicate failed", e);
      if (typeof toast === "function") toast("Failed to duplicate quiz");
    }
  }

  function handleTogglePublish(id) {
    const Store = getStore();
    if (!Store) return;

    const quiz = Store.getById(COLLECTIONS.QUIZZES, id);
    if (!quiz) {
      if (typeof toast === "function") toast("Quiz not found");
      return;
    }

    const newStatus = quiz.status === "published" ? "draft" : "published";

    // Basic validation: if publishing, need at least 1 question
    if (newStatus === "published") {
      const qCount = getQuestionsCount(id);
      if (qCount === 0) {
        if (typeof toast === "function")
          toast("Add at least one question before publishing");
        return;
      }
    }

    try {
      Store.update(COLLECTIONS.QUIZZES, id, { status: newStatus });
      if (typeof toast === "function") {
        toast(
          newStatus === "published"
            ? `Published "${quiz.title}"`
            : `Moved "${quiz.title}" to drafts`,
        );
      }

      // Update local array
      const idx = allQuizzes.findIndex((q) => q.id === id);
      if (idx !== -1) {
        allQuizzes[idx] = {
          ...allQuizzes[idx],
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };
      }

      applyFilters();

      window.dispatchEvent(
        new CustomEvent("quizzes:statusChanged", {
          detail: { id, status: newStatus },
        }),
      );
    } catch (e) {
      console.error("[quizzes] toggle publish failed", e);
      if (typeof toast === "function") toast("Failed to update status");
    }
  }

  function clearFilters() {
    searchQuery = "";
    statusFilter = "all";
    courseFilter = "all";
    if (els.searchInput) els.searchInput.value = "";
    if (els.statusFilter) els.statusFilter.value = "all";
    if (els.courseFilter) els.courseFilter.value = "all";
    applyFilters();
  }

  // Public API
  window.QuizPage = window.QuizPage || {
    init,
    render: applyFilters,
    clearFilters,
    handleDelete,
    handleDuplicate,
    handleTogglePublish,
  };

  // Auto-init on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // Defer to allow Store to init
    setTimeout(init, 0);
  }
})();
