/**
 * courses.js - StudyPod Tutor Dashboard v2.0
 * Courses Listing Page: CRUD via Store, search/filter, summary, cards, actions
 * Dependencies: window.Store (js/store.js), helpers from common.js (toast, escapeHtml, formatCurrency, formatDate, confirmDelete, setActiveNav)
 * Collections used: courses, enrollments
 */

(function () {
  "use strict";

  // ---------- Helpers (fallbacks if common.js not loaded) ----------
  const h = {
    toast: (msg, type) => {
      if (typeof window.toast === "function") return window.toast(msg, type);
      console.log("[toast]", msg);
    },
    escape: (str) => {
      if (typeof window.escapeHtml === "function")
        return window.escapeHtml(str);
      if (typeof str !== "string") return str;
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    },
    formatCurrency: (amount, currency) => {
      if (typeof window.formatCurrency === "function") {
        // fee may be object {amount,currency}
        if (typeof amount === "object" && amount !== null) {
          return window.formatCurrency(
            amount.amount,
            amount.currency || currency,
          );
        }
        return window.formatCurrency(amount, currency);
      }
      const val =
        typeof amount === "object" && amount !== null ? amount.amount : amount;
      const cur =
        (typeof amount === "object" && amount.currency) || currency || "NGN";
      const symbols = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" };
      const sym = symbols[cur] || cur;
      return `${sym}${Number(val || 0).toLocaleString()}`;
    },
    formatDate: (str) => {
      if (typeof window.formatDate === "function")
        return window.formatDate(str);
      if (!str) return "-";
      try {
        return new Date(str).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return str;
      }
    },
    confirmDelete: (msg, title) => {
      if (typeof window.confirmDelete === "function")
        return window.confirmDelete(msg, title);
      return Promise.resolve(window.confirm(msg || "Are you sure?"));
    },
  };

  // ---------- State ----------
  const state = {
    allCourses: [],
    filteredCourses: [],
    filters: {
      search: "",
      status: "all",
      field: "all",
      delivery: "all",
    },
  };

  // ---------- DOM Refs (resilient lookup) ----------
  let refs = {};

  function resolveRefs() {
    refs = {
      totalEl:
        document.getElementById("stat-total") ||
        document.getElementById("kpi-total") ||
        document.getElementById("total-courses") ||
        document.querySelector('[data-stat="total"]') ||
        document.querySelector('[data-kpi="total"]') ||
        document.getElementById("courses-total-count"),

      publishedEl:
        document.getElementById("stat-published") ||
        document.getElementById("kpi-published") ||
        document.querySelector('[data-stat="published"]') ||
        document.getElementById("published-count"),

      draftsEl:
        document.getElementById("stat-drafts") ||
        document.getElementById("kpi-drafts") ||
        document.querySelector('[data-stat="drafts"]') ||
        document.getElementById("drafts-count"),

      learnersEl:
        document.getElementById("stat-learners") ||
        document.getElementById("stat-active-learners") ||
        document.getElementById("kpi-learners") ||
        document.querySelector('[data-stat="learners"]') ||
        document.querySelector('[data-stat="active-learners"]') ||
        document.getElementById("active-learners-count"),

      searchEl:
        document.getElementById("search-courses") ||
        document.getElementById("course-search") ||
        document.getElementById("courses-search") ||
        document.querySelector('input[data-role="course-search"]') ||
        document.querySelector('.courses-toolbar input[type="search"]') ||
        document.querySelector("#courses-filter-search") ||
        document.querySelector('input[placeholder*="Search" i]'),

      statusEl:
        document.getElementById("filter-status") ||
        document.getElementById("status-filter") ||
        document.querySelector('select[data-filter="status"]') ||
        document.querySelector("#courses-status-filter"),

      fieldEl:
        document.getElementById("filter-field") ||
        document.getElementById("field-filter") ||
        document.querySelector('select[data-filter="field"]') ||
        document.querySelector("#courses-field-filter"),

      deliveryEl:
        document.getElementById("filter-delivery") ||
        document.getElementById("delivery-filter") ||
        document.getElementById("filter-deliveryMethod") ||
        document.querySelector('select[data-filter="delivery"]') ||
        document.querySelector("#courses-delivery-filter"),

      gridEl:
        document.getElementById("courses-grid") ||
        document.getElementById("course-grid") ||
        document.getElementById("courses-list") ||
        document.getElementById("course-list") ||
        document.getElementById("page-list") ||
        document.querySelector(".course-grid") ||
        document.querySelector(".courses-grid"),

      emptyEl:
        document.getElementById("courses-empty") ||
        document.getElementById("empty-state") ||
        document.getElementById("courses-empty-state") ||
        document.querySelector(".courses-empty"),

      summaryWrap:
        document.querySelector(".kpi-grid") ||
        document.querySelector(".courses-summary") ||
        document.getElementById("courses-summary"),

      countLabelEl:
        document.getElementById("courses-count-label") ||
        document.querySelector('[data-role="courses-count"]'),
    };
  }

  // ---------- Data Access ----------
  function getCourses() {
    if (!window.Store || typeof Store.get !== "function") return [];
    try {
      return Store.get("courses") || [];
    } catch {
      return [];
    }
  }

  function getEnrollments() {
    if (!window.Store || typeof Store.get !== "function") return [];
    try {
      return Store.get("enrollments") || [];
    } catch {
      return [];
    }
  }

  function getCourseFee(course) {
    if (!course.fee) return { amount: 0, currency: "NGN" };
    if (typeof course.fee === "object") return course.fee;
    if (typeof course.fee === "number")
      return { amount: course.fee, currency: course.currency || "NGN" };
    return { amount: 0, currency: "NGN" };
  }

  /**
   * Get course image - supports uploaded base64 or URL, or returns null for placeholder
   * @param {object} course - course object
   * @returns {string|null} image data URL or null
   */
  function getCourseImage(course) {
    if (!course) return null;
    // Check various possible image fields (for backward compatibility)
    if (course.image) return course.image;
    if (course.coverImage) return course.coverImage;
    if (course.imageUrl) return course.imageUrl;
    if (course.thumbnail) return course.thumbnail;
    return null;
  }

  /**
   * Get course gradient placeholder based on course field for visual recognition
   * @param {string} field - course field
   * @returns {string} gradient style
   */
  function getCourseGradient(field) {
    const gradients = {
      Programming: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
      Design: "linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)",
      Marketing: "linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)",
      Business: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
      "Data Science": "linear-gradient(135deg, #F5F3FF 0%, #DDD6FE 100%)",
      Product: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
    };
    return (
      gradients[field] || "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)"
    );
  }

  /**
   * Get animated SVG icon for course field
   */
  function getFieldIcon(field) {
    const icons = {
      Programming:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
      Design:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>',
      Marketing:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
      Business:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
      "Data Science":
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
      Product:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    };
    return icons[field] || icons["Programming"];
  }

  // ---------- Summary ----------
  function renderSummary() {
    const courses = state.allCourses;
    const enrollments = getEnrollments();

    const total = courses.length;
    const published = courses.filter(
      (c) => (c.status || "").toLowerCase() === "published",
    ).length;
    const drafts = courses.filter((c) => {
      const s = (c.status || "draft").toLowerCase();
      return s === "draft" || s !== "published";
    }).length;
    // Active learners: spec says enrollments count. Use unique students if possible, else total.
    const activeLearners = enrollments.length;

    if (refs.totalEl) refs.totalEl.textContent = String(total);
    if (refs.publishedEl) refs.publishedEl.textContent = String(published);
    if (refs.draftsEl) refs.draftsEl.textContent = String(drafts);
    if (refs.learnersEl) refs.learnersEl.textContent = String(activeLearners);
    if (refs.countLabelEl)
      refs.countLabelEl.textContent = `${state.filteredCourses.length} ${state.filteredCourses.length === 1 ? "course" : "courses"}`;

    // Fallback: if summary cards built with .metric-card value spans, update via data attributes
    // Look for elements with data attributes inside summaryWrap
    if (refs.summaryWrap) {
      // Try generic
      const genericMap = {
        total: total,
        published: published,
        drafts: drafts,
        learners: activeLearners,
      };
      Object.entries(genericMap).forEach(([key, val]) => {
        const el =
          refs.summaryWrap.querySelector(`[data-value="${key}"]`) ||
          refs.summaryWrap.querySelector(`.kpi-value[data-kpi="${key}"]`);
        if (el) el.textContent = String(val);
      });
    }

    // Dispatch event for dashboard/other listeners
    try {
      window.dispatchEvent(
        new CustomEvent("studypod:stats:update", {
          detail: {
            collection: "courses",
            total,
            published,
            drafts,
            activeLearners,
            timestamp: Date.now(),
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("studypod:dashboard:refresh", {
          detail: { source: "courses" },
        }),
      );
    } catch (e) {}
  }

  // ---------- Filters population ----------
  function populateFilterOptions() {
    const courses = state.allCourses;
    const fields = [
      ...new Set(courses.map((c) => c.field).filter(Boolean)),
    ].sort();
    const deliveries = [
      ...new Set(
        courses
          .map((c) => c.deliveryMethod || c.delivery || "")
          .filter(Boolean),
      ),
    ].sort();

    if (refs.fieldEl) {
      const current = refs.fieldEl.value || state.filters.field;
      // Keep 'all' option
      const keepAll = refs.fieldEl.querySelector('option[value="all"]');
      refs.fieldEl.innerHTML = "";
      const allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "All Fields";
      refs.fieldEl.appendChild(allOpt);
      fields.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = f;
        opt.textContent = f;
        refs.fieldEl.appendChild(opt);
      });
      // Restore
      if ([...refs.fieldEl.options].some((o) => o.value === current)) {
        refs.fieldEl.value = current;
      } else {
        refs.fieldEl.value = "all";
      }
    }

    if (refs.deliveryEl) {
      const current = refs.deliveryEl.value || state.filters.delivery;
      refs.deliveryEl.innerHTML = "";
      const allOpt = document.createElement("option");
      allOpt.value = "all";
      allOpt.textContent = "All Delivery";
      refs.deliveryEl.appendChild(allOpt);
      deliveries.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        refs.deliveryEl.appendChild(opt);
      });
      if ([...refs.deliveryEl.options].some((o) => o.value === current)) {
        refs.deliveryEl.value = current;
      } else {
        refs.deliveryEl.value = "all";
      }
    }

    // Status filter static if empty
    if (refs.statusEl && refs.statusEl.options.length <= 1) {
      const current = refs.statusEl.value || state.filters.status;
      refs.statusEl.innerHTML = "";
      [
        { value: "all", label: "All Status" },
        { value: "published", label: "Published" },
        { value: "draft", label: "Drafts" },
      ].forEach((item) => {
        const opt = document.createElement("option");
        opt.value = item.value;
        opt.textContent = item.label;
        refs.statusEl.appendChild(opt);
      });
      refs.statusEl.value = current || "all";
    }
  }

  // ---------- Filtering ----------
  function applyFilters() {
    const { search, status, field, delivery } = state.filters;
    const q = (search || "").trim().toLowerCase();

    let filtered = [...state.allCourses];

    if (q) {
      filtered = filtered.filter((c) => {
        const hay = [
          c.name || "",
          c.field || "",
          c.location || "",
          c.venue || "",
          c.token || "",
          c.description || "",
          c.deliveryMethod || "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (status && status !== "all") {
      filtered = filtered.filter(
        (c) => (c.status || "draft").toLowerCase() === status.toLowerCase(),
      );
    }

    if (field && field !== "all") {
      filtered = filtered.filter((c) => (c.field || "") === field);
    }

    if (delivery && delivery !== "all") {
      filtered = filtered.filter(
        (c) => (c.deliveryMethod || c.delivery || "") === delivery,
      );
    }

    // Sort: published first? Then newest updatedAt first
    filtered.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      // If same status group, newest first
      // Prioritize draft vs published? Keep published on top by default when all
      if (state.filters.status === "all") {
        if (a.status !== b.status) {
          if ((a.status || "").toLowerCase() === "published") return -1;
          if ((b.status || "").toLowerCase() === "published") return 1;
        }
      }
      return dateB - dateA;
    });

    state.filteredCourses = filtered;
  }

  // ---------- Empty State ----------
  function renderEmptyState(isSearchEmpty) {
    if (!refs.gridEl) return;
    const hasCourses = state.allCourses.length > 0;
    if (refs.emptyEl) {
      refs.emptyEl.style.display = "block";
      refs.gridEl.style.display = "none";
      return;
    }

    if (!hasCourses) {
      refs.gridEl.innerHTML = `
        <div class="courses-empty-state" style="
          grid-column:1/-1;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          padding:48px 24px;text-align:center;
          background:var(--bg-card, #fff);
          border:1px dashed var(--border-light, #e2e8f0);
          border-radius:var(--radius-xl, 12px);
        ">
          <div style="width:64px;height:64px;border-radius:16px;background:var(--color-primary-light, #eff6ff);display:grid;place-items:center;font-size:28px;margin-bottom:16px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>
          <h3 style="font-size:18px;font-weight:700;margin:0 0 8px">No courses yet</h3>
          <p style="max-width:400px;font-size:14px;color:var(--text-secondary, #64748b);margin:0 0 20px;line-height:1.5">
            Get started by creating your first course. Add course details, schedule, and fee to publish it for learners.
          </p>
          <a href="course-form.html" class="btn-primary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;padding:10px 18px;border-radius:8px;background:var(--color-primary, #2563eb);color:#fff;font-weight:600">
            <span>+</span> Create Course
          </a>
        </div>
      `;
    } else if (isSearchEmpty) {
      refs.gridEl.innerHTML = `
        <div class="courses-empty-state" style="
          grid-column:1/-1;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          padding:48px 24px;text-align:center;
          background:var(--bg-card, #fff);
          border:1px solid var(--border-light, #e2e8f0);
          border-radius:var(--radius-xl, 12px);
        ">
          <div style="width:64px;height:64px;border-radius:16px;background:var(--bg-page, #f8fafc);display:grid;place-items:center;font-size:28px;margin-bottom:16px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <h3 style="font-size:16px;font-weight:600;margin:0 0 8px">No matches found</h3>
          <p style="max-width:380px;font-size:13px;color:var(--text-secondary, #64748b);margin:0 0 16px">
            No courses match your search or filters. Try adjusting your keywords or clear filters.
          </p>
          <button class="btn-secondary" data-action="clear-filters" style="padding:8px 14px;border:1px solid var(--border-light);border-radius:8px;background:#fff;font-weight:500;cursor:pointer">Clear filters</button>
        </div>
      `;
      const clearBtn = refs.gridEl.querySelector(
        '[data-action="clear-filters"]',
      );
      if (clearBtn)
        clearBtn.addEventListener("click", () => {
          clearFilters();
        });
    }
  }

  // ---------- Card Rendering ----------
  
  // ---------- Card Rendering - REFACTORED for PHP deployment ----------
  // HTML moved to courses.html <template id="course-card-template">
  // Logic preserved: image, gradient, badge, status, enroll count, meta, actions
  function renderCards() {
    if (!refs.gridEl) return;

    if (state.allCourses.length === 0) {
      renderEmptyState(false);
      if (refs.emptyEl) {
        refs.emptyEl.innerHTML = `
          <div class="courses-empty-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center">
            <div style="width:64px;height:64px;border-radius:16px;background:var(--color-primary-light,#eff6ff);display:grid;place-items:center;font-size:28px;margin-bottom:16px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>
            <h3 style="font-size:18px;font-weight:700;margin:0 0 8px">No courses yet</h3>
            <p style="max-width:400px;font-size:14px;color:var(--text-secondary,#64748b);margin:0 0 20px;line-height:1.5">
              Get started by creating your first course.
            </p>
            <a href="course-form.html" class="btn-primary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;padding:10px 18px;border-radius:8px;background:var(--color-primary,#2563eb);color:#fff;font-weight:600">+ Create Course</a>
          </div>
        `;
        refs.emptyEl.style.display = "block";
        refs.gridEl.style.display = "none";
      }
      return;
    }

    if (state.filteredCourses.length === 0) {
      renderEmptyState(true);
      if (refs.emptyEl) refs.emptyEl.style.display = "none";
      else return;
      return;
    }

    if (refs.emptyEl) {
      refs.emptyEl.style.display = "none";
      refs.gridEl.style.display = "";
    }

    // Try to use template from HTML for PHP-ready deployment
    const template = document.getElementById("course-card-template");
    
    // Clear grid
    refs.gridEl.innerHTML = "";

    state.filteredCourses.forEach((course) => {
      const feeObj = getCourseFee(course);
      const feeDisplay = h.formatCurrency(feeObj.amount, feeObj.currency);
      const status = (course.status || "draft").toLowerCase();
      const isPublished = status === "published";
      const token = course.token || "—";
      const name = course.name || "Untitled Course";
      const field = course.field || "General";
      const location = course.location || "—";
      const deliveryMethod = course.deliveryMethod || course.delivery || "Virtual";
      const creditHours = course.creditHours != null ? `${course.creditHours} hrs` : "—";
      const start = h.formatDate(course.startDate);
      const end = h.formatDate(course.endDate);
      const schedule = course.startDate || course.endDate ? `${start} – ${end}` : "—";
      const enrollCount = getEnrollments().filter((e) => e.courseId === course.id).length;

      const courseImage = getCourseImage(course);
      const fieldGradient = getCourseGradient(course.field);
      const fieldIcon = getFieldIcon(course.field);

      let cardEl;

      if (template && template.content) {
        // PHP-ready path: clone from HTML template
        const clone = template.content.cloneNode(true);
        cardEl = clone.querySelector(".course-card");
        
        // Data attribute
        cardEl.setAttribute("data-course-id", course.id);
        
        // Image section
        const imgWrap = cardEl.querySelector(".course-card-image");
        if (imgWrap) imgWrap.style.background = fieldGradient;
        
        const imgEl = cardEl.querySelector(".course-card-img");
        const placeholderEl = cardEl.querySelector(".course-card-image-placeholder");
        if (courseImage) {
          if (imgEl) {
            imgEl.src = courseImage;
            imgEl.alt = name;
            imgEl.style.display = "block";
          }
          if (placeholderEl) placeholderEl.style.display = "none";
        } else {
          if (placeholderEl) {
            placeholderEl.innerHTML = fieldIcon;
            placeholderEl.style.display = "grid";
          }
          if (imgEl) imgEl.style.display = "none";
        }
        
        // Badge
        const badgeEl = cardEl.querySelector(".course-card-badge");
        if (badgeEl) badgeEl.textContent = field;
        
        // Status
        const statusEl = cardEl.querySelector(".course-status");
        if (statusEl) {
          statusEl.textContent = status;
          statusEl.classList.add(isPublished ? "published" : "draft");
        }
        
        // Token
        const tokenEl = cardEl.querySelector(".course-card-token");
        if (tokenEl) {
          tokenEl.textContent = token;
          tokenEl.title = token;
        }
        
        // Enroll count
        const enrollEl = cardEl.querySelector(".course-card-enroll");
        if (enrollEl) {
          if (enrollCount > 0) {
            enrollEl.textContent = `• ${enrollCount} learner${enrollCount > 1 ? "s" : ""}`;
            enrollEl.style.display = "inline-flex";
          } else {
            enrollEl.style.display = "none";
          }
        }
        
        // Title
        const titleEl = cardEl.querySelector(".course-card-title");
        if (titleEl) {
          titleEl.textContent = name;
          titleEl.title = name;
        }
        
        // Meta
        const locEl = cardEl.querySelector('[data-field="location"]');
        if (locEl) {
          locEl.textContent = location;
          locEl.title = location;
        }
        const delEl = cardEl.querySelector('[data-field="delivery"]');
        if (delEl) delEl.textContent = deliveryMethod;
        const credEl = cardEl.querySelector('[data-field="credit"]');
        if (credEl) credEl.textContent = creditHours;
        const schedEl = cardEl.querySelector('[data-field="schedule"]');
        if (schedEl) schedEl.textContent = schedule;
        
        // Price
        const priceEl = cardEl.querySelector(".course-price");
        if (priceEl) {
          priceEl.textContent = feeDisplay;
          priceEl.title = feeDisplay;
        }
        
        // Links and actions - preserve data-id and href logic
        const viewLink = cardEl.querySelector(".course-view-link");
        if (viewLink) {
          viewLink.href = `course-performance.html?id=${encodeURIComponent(course.id)}`;
          viewLink.setAttribute("data-id", course.id);
        }
        
        const editLink = cardEl.querySelector(".course-edit-link");
        if (editLink) {
          editLink.href = `course-form.html?id=${encodeURIComponent(course.id)}`;
          editLink.setAttribute("data-id", course.id);
        }
        
        const dropdownTrigger = cardEl.querySelector("[data-dropdown-trigger]");
        if (dropdownTrigger) dropdownTrigger.setAttribute("data-dropdown-trigger", course.id);
        
        const dropdown = cardEl.querySelector(".course-dropdown");
        if (dropdown) {
          dropdown.id = `dropdown-${course.id}`;
          // Update inner buttons data-id
          dropdown.querySelectorAll("[data-action]").forEach(btn => {
            btn.setAttribute("data-id", course.id);
          });
          const publishBtn = dropdown.querySelector(".course-publish-btn");
          if (publishBtn) publishBtn.textContent = isPublished ? "Unpublish" : "Publish";
        }
        
        refs.gridEl.appendChild(clone);
      } else {
        // Fallback: original string template (should not happen if HTML template exists)
        const fallbackHtml = `
        <div class="course-card" data-course-id="${h.escape(course.id)}">
          <div class="course-card-image" style="background:${fieldGradient}">
            ${courseImage ? `<img src="${courseImage}" alt="${h.escape(name)}" loading="lazy">` : `<div class="course-card-image-placeholder">${fieldIcon}</div>`}
            <div class="course-card-image-overlay"></div>
            <div class="course-card-badge">${h.escape(field)}</div>
            <div style="position:absolute;bottom:10px;right:10px;display:flex;gap:6px">
              <span class="course-status ${isPublished ? "published" : "draft"}" style="background:rgba(255,255,255,0.95);backdrop-filter:blur(8px);padding:4px 8px;border-radius:999px;font-size:10px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.1)">${h.escape(status)}</span>
            </div>
          </div>
          <div class="course-card-content">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px">
              <div class="course-card-token" title="${h.escape(token)}" style="font-size:10px;font-weight:700;letter-spacing:0.05em;color:var(--text-muted)">${h.escape(token)}</div>
              ${enrollCount > 0 ? `<span style="font-size:11px;color:var(--text-muted);font-weight:500;background:var(--bg-track);padding:2px 6px;border-radius:999px">• ${enrollCount} learner${enrollCount > 1 ? "s" : ""}</span>` : ""}
            </div>
            <h3 class="course-card-title" title="${h.escape(name)}" style="font-size:15px;font-weight:700;line-height:1.3;margin-bottom:10px;letter-spacing:-0.01em">${h.escape(name)}</h3>
            <div class="course-card-meta" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;font-size:11px">
              <div class="meta-item"><span class="meta-label" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);display:block;margin-bottom:2px">Location</span><span class="meta-value" title="${h.escape(location)}" style="font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${h.escape(location)}</span></div>
              <div class="meta-item"><span class="meta-label" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);display:block;margin-bottom:2px">Delivery</span><span class="meta-value" style="font-weight:500;color:var(--text-primary)">${h.escape(deliveryMethod)}</span></div>
              <div class="meta-item"><span class="meta-label" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);display:block;margin-bottom:2px">Credit Hours</span><span class="meta-value" style="font-weight:500;color:var(--text-primary)">${h.escape(creditHours)}</span></div>
              <div class="meta-item"><span class="meta-label" style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);display:block;margin-bottom:2px">Schedule</span><span class="meta-value" style="font-weight:500;color:var(--text-primary);font-size:10px">${h.escape(schedule)}</span></div>
            </div>
          </div>
          <div class="course-card-foot">
            <div class="course-price" title="${h.escape(feeDisplay)}" style="font-weight:700;font-size:14px;color:var(--text-primary)">${h.escape(feeDisplay)}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <a href="course-performance.html?id=${h.escape(course.id)}" class="btn-view-primary" data-action="view" data-id="${h.escape(course.id)}">View</a>
            </div>
          </div>
        </div>
        `;
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = fallbackHtml.trim();
        cardEl = tempDiv.firstElementChild;
        if (cardEl) refs.gridEl.appendChild(cardEl);
      }
    });

    // Add dropdown toggle logic
    refs.gridEl.querySelectorAll("[data-dropdown-trigger]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-dropdown-trigger");
        const dd = document.getElementById(`dropdown-${id}`);
        if (!dd) return;
        document.querySelectorAll(".action-dropdown").forEach((other) => {
          if (other !== dd) {
            other.style.display = "none";
            other.classList.remove("show");
          }
        });
        const isShowing = dd.style.display === "flex" || dd.classList.contains("show");
        if (isShowing) {
          dd.style.display = "none";
          dd.classList.remove("show");
        } else {
          dd.style.display = "flex";
          dd.classList.add("show");
          dd.style.flexDirection = "column";
        }
      });
    });
  }


  // ---------- Actions ----------
  async function handleAction(action, id) {
    const course = window.Store ? Store.getById("courses", id) : null;
    if (!course && action !== "clear-filters") {
      h.toast("Course not found");
      return;
    }

    switch (action) {
      case "view": {
        window.location.href = `course-performance.html?id=${encodeURIComponent(id)}`;
        break;
      }
      case "edit": {
        window.location.href = `course-form.html?id=${encodeURIComponent(id)}`;
        break;
      }
      case "performance": {
        window.location.href = `course-performance.html?id=${encodeURIComponent(id)}`;
        break;
      }
      case "duplicate": {
        duplicateCourse(course);
        break;
      }
      case "toggle-publish": {
        togglePublish(course);
        break;
      }
      case "delete": {
        await deleteCourse(course);
        break;
      }
      default:
        break;
    }
  }

  function duplicateCourse(course) {
    try {
      // Build cloned payload without id/token/createdAt
      const cloned = {
        name: `${course.name} (Copy)`,
        field: course.field,
        location: course.location,
        venue: course.venue,
        creditHours: course.creditHours,
        fee: course.fee ? { ...course.fee } : { amount: 0, currency: "NGN" },
        currency:
          course.currency || (course.fee && course.fee.currency) || "NGN",
        startDate: course.startDate,
        endDate: course.endDate,
        startTime: course.startTime,
        endTime: course.endTime,
        deliveryMethod: course.deliveryMethod || course.delivery || "Virtual",
        description: course.description,
        status: "draft",
      };

      // Ensure amount/currency split compatibility
      if (course.fee && typeof course.fee === "object") {
        cloned.fee = {
          amount: course.fee.amount,
          currency: course.fee.currency || "NGN",
        };
      }

      const created = Store.create("courses", cloned);
      h.toast(`Duplicated: ${created.name} is now in drafts`, "success");
      // Re-render is via store event, but force immediate
      refreshData();
    } catch (err) {
      console.error("Duplicate failed", err);
      h.toast("Failed to duplicate course", "error");
    }
  }

  function togglePublish(course) {
    try {
      const newStatus =
        (course.status || "draft").toLowerCase() === "published"
          ? "draft"
          : "published";
      Store.update("courses", course.id, { status: newStatus });
      h.toast(`${course.name} is now ${newStatus}`, "success");
      // Summary + grid will update via datachange listener, but also do immediate
      refreshData();
    } catch (err) {
      console.error("Toggle publish failed", err);
      h.toast("Failed to update status", "error");
    }
  }

  async function deleteCourse(course) {
    try {
      const confirmed = await h.confirmDelete(
        `Delete "${course.name}"? This will permanently remove the course and its related data references. This action cannot be undone.`,
        "Delete Course",
      );
      if (!confirmed) return;

      const ok = Store.delete("courses", course.id);
      if (ok) {
        h.toast(`"${course.name}" deleted`, "success");
        refreshData();
      } else {
        h.toast("Delete failed - course not found", "error");
      }
    } catch (err) {
      console.error("Delete failed", err);
      h.toast("Failed to delete course", "error");
    }
  }

  function clearFilters() {
    state.filters.search = "";
    state.filters.status = "all";
    state.filters.field = "all";
    state.filters.delivery = "all";
    if (refs.searchEl) refs.searchEl.value = "";
    if (refs.statusEl) refs.statusEl.value = "all";
    if (refs.fieldEl) refs.fieldEl.value = "all";
    if (refs.deliveryEl) refs.deliveryEl.value = "all";
    applyFilters();
    renderSummary();
    renderCards();
  }

  // ---------- Data Refresh ----------
  function refreshData() {
    state.allCourses = getCourses();
    populateFilterOptions();
    applyFilters();
    renderSummary();
    renderCards();
  }

  function filterAndRender() {
    applyFilters();
    renderSummary();
    renderCards();
  }

  // ---------- Event Wiring ----------
  function bindEvents() {
    if (refs.searchEl) {
      let debounceT;
      refs.searchEl.addEventListener("input", (e) => {
        clearTimeout(debounceT);
        debounceT = setTimeout(() => {
          state.filters.search = e.target.value || "";
          filterAndRender();
        }, 180);
      });
    }

    if (refs.statusEl) {
      refs.statusEl.addEventListener("change", (e) => {
        state.filters.status = e.target.value || "all";
        filterAndRender();
      });
    }

    if (refs.fieldEl) {
      refs.fieldEl.addEventListener("change", (e) => {
        state.filters.field = e.target.value || "all";
        filterAndRender();
      });
    }

    if (refs.deliveryEl) {
      refs.deliveryEl.addEventListener("change", (e) => {
        state.filters.delivery = e.target.value || "all";
        filterAndRender();
      });
    }

    // Delegated action clicks for dynamically rendered cards
    document.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("[data-action]");
      if (!actionBtn) {
        // Also click outside closes dropdowns (enhance common.js handler)
        if (
          !e.target.closest(".action-menu") &&
          !e.target.closest("[data-dropdown-trigger]")
        ) {
          document.querySelectorAll(".action-dropdown").forEach((dd) => {
            dd.style.display = "none";
            dd.classList.remove("show");
          });
        }
        return;
      }

      // Prevent anchor navigation for buttons; we handle manually to keep SPA feel for some actions
      const action = actionBtn.getAttribute("data-action");
      const id = actionBtn.getAttribute("data-id");

      if (action === "view" || action === "edit" || action === "performance") {
        // Allow default anchor navigation if it's an <a>, but close dropdown
        document.querySelectorAll(".action-dropdown").forEach((dd) => {
          dd.style.display = "none";
          dd.classList.remove("show");
        });
        // If anchor, let it navigate; if button fallback, handle
        if (actionBtn.tagName.toLowerCase() !== "a") {
          e.preventDefault();
          handleAction(action, id);
        }
        return;
      }

      e.preventDefault();
      // Close dropdowns immediately for UX
      document.querySelectorAll(".action-dropdown").forEach((dd) => {
        dd.style.display = "none";
        dd.classList.remove("show");
      });
      handleAction(action, id);
    });

    // Store change listener -> live refresh if courses or enrollments mutated elsewhere
    window.addEventListener("studypod:datachange", (e) => {
      const coll = e.detail && e.detail.collection;
      if (!coll) return;
      if (coll === "courses" || coll === "enrollments" || coll === "all") {
        // Small delay to allow localStorage to settle
        setTimeout(() => refreshData(), 30);
      }
    });

    // External clear filters trigger
    document.addEventListener("studypod:filters:clear", () => clearFilters());
  }

  // ---------- Init ----------
  function initCoursesPage() {
    // Layout active nav (if common.js loaded)
    if (typeof window.setActiveNav === "function") {
      try {
        setActiveNav("courses");
      } catch {}
    } else if (window.Layout && typeof Layout.initLayout === "function") {
      // Layout auto-detects, but ensure courses
      try {
        window.dispatchEvent(
          new CustomEvent("layout:ready", { detail: { parentNav: "courses" } }),
        );
      } catch {}
    }

    resolveRefs();

    if (!window.Store) {
      console.warn("[courses.js] Store not found - waiting for Store to load");
      // Retry a few times
      let retries = 0;
      const timer = setInterval(() => {
        if (window.Store || retries > 20) {
          clearInterval(timer);
          if (window.Store) {
            initCoursesPage();
          } else if (refs.gridEl) {
            refs.gridEl.innerHTML =
              '<div style="padding:24px;color:#ef4444">Store failed to load. Please refresh.</div>';
          }
        }
        retries++;
      }, 100);
      return;
    }

    // Initial data load
    state.allCourses = getCourses();
    // Capture initial filter values from DOM if present
    if (refs.searchEl) state.filters.search = refs.searchEl.value || "";
    if (refs.statusEl) state.filters.status = refs.statusEl.value || "all";
    if (refs.fieldEl) state.filters.field = refs.fieldEl.value || "all";
    if (refs.deliveryEl)
      state.filters.delivery = refs.deliveryEl.value || "all";

    bindEvents();
    populateFilterOptions();
    applyFilters();
    renderSummary();
    renderCards();

    console.log(
      `[courses.js] Initialized with ${state.allCourses.length} courses, ${getEnrollments().length} enrollments`,
    );
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCoursesPage);
  } else {
    initCoursesPage();
  }

  // Expose for debugging / external hooks
  window.CoursesPage = {
    init: initCoursesPage,
    refresh: refreshData,
    clearFilters,
    getState: () => ({ ...state }),
    getFiltered: () => [...state.filteredCourses],
  };
})();
