/**
 * CONFERENCES.JS - StudyPod Tutor Dashboard v2.0
 * Full CRUD for conferences collection via centralized Store
 * Features:
 *  - Summary: Total, Published, Drafts, Completed (endDate < today)
 *  - Search by name/title/workshop/location
 *  - Filters: status (all/draft/published/completed), workshop, deliveryMethod
 *  - Card grid with grad1/2/3 cycle, pills, registered count, seats, Manage/Share + dropdown actions
 *  - Past list, empty states, toolbar injection, live Store reactivity
 *  - Uses helpers: toast, escapeHtml, formatCurrency, formatDate, confirmDelete, setActiveNav
 */

(function () {
  "use strict";

  const CONF_COL = "conferences";
  const REG_COL = "registrations";
  const GRADIENTS = ["grad1", "grad2", "grad3"];

  const state = {
    search: "",
    status: "all",
    workshop: "all",
    delivery: "all",
    conferences: [],
    registrations: [],
  };

  // ---------- Helpers fallback ----------
  const _escapeHtml = (s) =>
    typeof window.escapeHtml === "function"
      ? window.escapeHtml(s)
      : String(s).replace(
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
  const _toast = (m, t) => {
    if (typeof window.toast === "function") window.toast(m, t);
    else console.log(m);
  };
  const _formatCurrency = (a, c) =>
    typeof window.formatCurrency === "function"
      ? window.formatCurrency(a, c)
      : `${c || "₦"}${Number(a || 0).toLocaleString()}`;
  const _formatDate = (d) =>
    typeof window.formatDate === "function" ? window.formatDate(d) : d || "-";
  const _confirmDelete = (msg, title) => {
    if (typeof window.confirmDelete === "function")
      return window.confirmDelete(msg, title);
    return Promise.resolve(confirm(msg));
  };
  const _setActiveNav = (p) => {
    if (typeof window.setActiveNav === "function") window.setActiveNav(p);
  };

  function todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function parseDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  function isCompleted(conf) {
    const end = parseDate(conf.endDate);
    if (!end) return false;
    // Completed if endDate < today
    return end < todayStart();
  }

  function formatTime12(t) {
    if (!t) return "";
    try {
      const [hStr, mStr] = t.split(":");
      let h = parseInt(hStr, 10);
      const m = mStr ? parseInt(mStr, 10) : 0;
      if (isNaN(h)) return t;
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      return m === 0
        ? `${h}${ampm}`
        : `${h}:${String(m).padStart(2, "0")}${ampm}`;
    } catch (e) {
      return t;
    }
  }

  function formatPillDateTime(conf) {
    const start = parseDate(conf.startDate);
    let datePart = "";
    if (start) {
      datePart = start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } else if (conf.startDate) {
      datePart = conf.startDate;
    } else {
      datePart = _formatDate(conf.startDate || conf.createdAt);
    }
    const sTime = formatTime12(conf.startTime);
    const eTime = formatTime12(conf.endTime);
    if (sTime && eTime) return `${datePart} • ${sTime}-${eTime}`;
    if (sTime) return `${datePart} • ${sTime}`;
    return datePart;
  }

  function getLocationLabel(conf) {
    const loc = conf.location;
    if (!loc) return "-";
    if (typeof loc === "string") return loc;
    const parts = [loc.venue, loc.state, loc.country].filter(Boolean);
    return (
      parts.join(", ") ||
      `${loc.state || ""} ${loc.country || ""}`.trim() ||
      "-"
    );
  }

  function getLocationShort(conf) {
    const loc = conf.location;
    if (!loc) return "-";
    if (typeof loc === "string") return loc.split(",")[0];
    return loc.state || loc.country || loc.venue || "-";
  }

  function getWorkshopLabel(conf) {
    return conf.workshopId || conf.workshop || conf.workshopName || "General";
  }

  function getSeats(conf) {
    // Try several possible keys, fallback 100
    return (
      conf.seats ?? conf.maxSeats ?? conf.capacity ?? conf.maxAttendees ?? 100
    );
  }

  function getRegCount(confId) {
    return state.registrations.filter((r) => r.conferenceId === confId).length;
  }

  function getStatusMeta(conf, regCount, seats) {
    if (isCompleted(conf)) {
      return { label: "Completed", cls: "conf-pill-light", key: "completed" };
    }
    const st = (conf.status || "").toLowerCase();
    if (st === "draft") {
      return { label: "Draft", cls: "conf-pill-light", key: "draft" };
    }
    // Published logic
    const ratio = seats ? regCount / seats : 0;
    if (ratio >= 0.9 && regCount > 0) {
      return { label: "Almost Full", cls: "conf-pill-amber", key: "almost" };
    }
    return {
      label: "Registration Open",
      cls: "conf-pill-green",
      key: "published",
    };
  }

  function getFee(conf) {
    if (conf.fee && typeof conf.fee === "object") {
      return {
        amount: conf.fee.amount || 0,
        currency: conf.fee.currency || "NGN",
      };
    }
    if (typeof conf.fee === "number")
      return { amount: conf.fee, currency: "NGN" };
    return { amount: conf.amount ?? 0, currency: conf.currency ?? "NGN" };
  }

  /**
   * Get conference image - NEW
   */
  function getConfImage(conf) {
    if (!conf) return null;
    if (conf.image) return conf.image;
    if (conf.coverImage) return conf.coverImage;
    if (conf.imageUrl) return conf.imageUrl;
    return null;
  }

  /**
   * Get SVG icons for stats - replaces emojis
   */
  function getConfIcon(type) {
    const icons = {
      people:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
      mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>',
      search:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
      edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
      trash:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    };
    return icons[type] || "";
  }

  // ---------- Data ----------
  function loadData() {
    try {
      if (!window.Store) {
        console.warn("[conferences] Store not found");
        state.conferences = [];
        state.registrations = [];
        return;
      }
      state.conferences = Store.get(CONF_COL) || [];
      state.registrations = Store.get(REG_COL) || [];
    } catch (e) {
      console.warn("[conferences] loadData failed", e);
      state.conferences = [];
      state.registrations = [];
    }
  }

  function filteredConferences() {
    const term = state.search.trim().toLowerCase();
    return state.conferences.filter((conf) => {
      // Status filter
      if (state.status !== "all") {
        if (state.status === "completed") {
          if (!isCompleted(conf)) return false;
        } else if (state.status === "published") {
          if (isCompleted(conf)) return false;
          if ((conf.status || "").toLowerCase() !== "published") return false;
        } else if (state.status === "draft") {
          if (isCompleted(conf)) return false;
          if ((conf.status || "").toLowerCase() !== "draft") return false;
        }
      }
      // Workshop filter
      if (state.workshop !== "all") {
        if (getWorkshopLabel(conf) !== state.workshop) return false;
      }
      // Delivery filter
      if (state.delivery !== "all") {
        if ((conf.deliveryMethod || "") !== state.delivery) return false;
      }
      // Search
      if (term) {
        const hay = [
          conf.name || "",
          conf.title || "",
          getWorkshopLabel(conf) || "",
          typeof conf.location === "string"
            ? conf.location
            : `${conf.location?.state || ""} ${conf.location?.country || ""} ${conf.location?.venue || ""}`,
          conf.token || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }

  // ---------- Toolbar injection ----------
  function ensureToolbar() {
    const listCard = document.querySelector(".conf-list-card");
    if (!listCard) return null;

    let toolbar = document.getElementById("conf-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "conf-toolbar";
      toolbar.className = "toolbar";
      toolbar.style.cssText =
        "display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:18px;";
      toolbar.innerHTML = `
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;flex:1">
          <input id="conf-search" class="search-input" placeholder="Search by name, title, workshop, location..." aria-label="Search conferences" style="min-width:260px;flex:1;max-width:380px" />
          <select id="filter-status" class="select-input" aria-label="Filter status">
            <option value="all">All status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
          </select>
          <select id="filter-workshop" class="select-input" aria-label="Filter workshop">
            <option value="all">All workshops</option>
          </select>
          <select id="filter-delivery" class="select-input" aria-label="Filter delivery">
            <option value="all">All delivery</option>
            <option value="Virtual">Virtual</option>
            <option value="On-Premise">On-Premise</option>
          </select>
        </div>
        <div style="display:flex;gap:8px">
          <button id="btn-create-conf" class="btn-primary" style="white-space:nowrap">+ Create Conference</button>
        </div>
      `;
      // Insert before grid if exists else prepend
      const grid = listCard.querySelector(".conf-grid");
      if (grid) listCard.insertBefore(toolbar, grid);
      else listCard.prepend(toolbar);
    }

    // Populate workshop options
    const wsSelect = toolbar.querySelector("#filter-workshop");
    if (wsSelect) {
      const existingWorkshops = [
        ...new Set(state.conferences.map(getWorkshopLabel).filter(Boolean)),
      ].sort();
      const currentVal = wsSelect.value || state.workshop;
      // Preserve all + dynamic
      wsSelect.innerHTML =
        '<option value="all">All workshops</option>' +
        existingWorkshops
          .map(
            (w) =>
              `<option value="${_escapeHtml(w)}">${_escapeHtml(w)}</option>`,
          )
          .join("");
      wsSelect.value = existingWorkshops.includes(currentVal)
        ? currentVal
        : "all";
      if (!existingWorkshops.includes(state.workshop))
        state.workshop = wsSelect.value;
    }

    // Sync select values with state
    const statusSel = toolbar.querySelector("#filter-status");
    if (statusSel) statusSel.value = state.status;
    const deliverySel = toolbar.querySelector("#filter-delivery");
    if (deliverySel) deliverySel.value = state.delivery;
    const searchInput = toolbar.querySelector("#conf-search");
    if (searchInput && searchInput.value !== state.search)
      searchInput.value = state.search;

    return toolbar;
  }

  function bindToolbarEvents() {
    const toolbar = document.getElementById("conf-toolbar");
    if (!toolbar || toolbar.dataset.bound === "1") return;
    toolbar.dataset.bound = "1";

    const search = toolbar.querySelector("#conf-search");
    const status = toolbar.querySelector("#filter-status");
    const workshop = toolbar.querySelector("#filter-workshop");
    const delivery = toolbar.querySelector("#filter-delivery");
    const createBtn = toolbar.querySelector("#btn-create-conf");

    if (search) {
      search.addEventListener("input", (e) => {
        state.search = e.target.value;
        render();
      });
    }
    if (status) {
      status.addEventListener("change", (e) => {
        state.status = e.target.value;
        render();
      });
    }
    if (workshop) {
      workshop.addEventListener("change", (e) => {
        state.workshop = e.target.value;
        render();
      });
    }
    if (delivery) {
      delivery.addEventListener("change", (e) => {
        state.delivery = e.target.value;
        render();
      });
    }
    if (createBtn) {
      createBtn.addEventListener("click", () => {
        window.location.href = "conference-form.html";
      });
    }
  }

  // ---------- Summary Cards ----------
  function renderSummary() {
    const grid = document.querySelector(".conf-stats-grid");
    if (!grid) return;

    const total = state.conferences.length;
    const published = state.conferences.filter(
      (c) => (c.status || "").toLowerCase() === "published" && !isCompleted(c),
    ).length;
    const drafts = state.conferences.filter(
      (c) => (c.status || "").toLowerCase() === "draft" && !isCompleted(c),
    ).length;
    const completed = state.conferences.filter(isCompleted).length;

    // Use 4 cards layout with animated SVG icons - NEW
    grid.innerHTML = `
      <div class="conf-card metric-card-animated" data-kpi="all" style="cursor:pointer;position:relative;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="conf-card-label">Total Conferences</div>
            <div class="conf-card-value">${total}</div>
            <div class="conf-card-sub">${total === 0 ? "No conferences yet" : "All events"}</div>
          </div>
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg, #EFF6FF, #DBEAFE);display:grid;place-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" style="width:22px;height:22px" class="anim-float-slow"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></div>
        </div>
      </div>
      <div class="conf-card metric-card-animated" data-kpi="published" style="cursor:pointer;position:relative;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="conf-card-label">Published</div>
            <div class="conf-card-value">${published}</div>
            <div class="conf-card-sub">Live & open for registration</div>
          </div>
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg, #F0FDF4, #DCFCE7);display:grid;place-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2" style="width:22px;height:22px" class="anim-pulse"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
        </div>
      </div>
      <div class="conf-card metric-card-animated" data-kpi="draft" style="cursor:pointer;position:relative;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="conf-card-label">Drafts</div>
            <div class="conf-card-value">${drafts}</div>
            <div class="conf-card-sub">In preparation</div>
          </div>
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg, #FFFBEB, #FEF3C7);display:grid;place-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2" style="width:22px;height:22px" class="anim-float"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
        </div>
      </div>
      <div class="conf-card metric-card-animated" data-kpi="completed" style="cursor:pointer;position:relative;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="conf-card-label">Completed</div>
            <div class="conf-card-value">${completed}</div>
            <div class="conf-card-sub">${completed > 0 ? "Past events" : "No past events"}</div>
          </div>
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg, #F5F3FF, #DDD6FE);display:grid;place-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2" style="width:22px;height:22px" class="anim-bounce-subtle"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        </div>
      </div>
    `;

    // Make KPI clickable to filter
    grid.querySelectorAll(".conf-card").forEach((card) => {
      card.addEventListener("click", () => {
        const kpi = card.dataset.kpi;
        if (kpi === "all") {
          state.status = "all";
        } else {
          state.status = kpi;
        }
        const sel = document.getElementById("filter-status");
        if (sel) sel.value = state.status;
        render();
      });
    });

    // If conf-stats-grid was 3 columns in CSS, make it 4 responsive via inline grid override
    grid.style.gridTemplateColumns = "repeat(4,1fr)";
    // Responsive fallback via media query already handles 1fr but we keep JS simple
    const media = window.matchMedia("(max-width:1024px)");
    function handleMedia() {
      grid.style.gridTemplateColumns = media.matches ? "1fr" : "repeat(4,1fr)";
    }
    handleMedia();
  }

  // ---------- Grid Cards ----------
  function renderGrid(conferences) {
    const existingGrid = document.querySelector(".conf-grid");
    if (!existingGrid) {
      console.warn("[conferences] .conf-grid not found");
      return;
    }

    // Separate upcoming (not completed) and completed for grid
    const upcoming = conferences.filter((c) => !isCompleted(c));
    const toShow = upcoming; // grid shows upcoming only, per design

    if (
      toShow.length === 0 &&
      conferences.length === 0 &&
      state.search === "" &&
      state.status === "all" &&
      state.workshop === "all" &&
      state.delivery === "all"
    ) {
      // True empty - no data at all
      existingGrid.innerHTML = `
        <div class="conf-create" style="grid-column:1/-1">
          <div class="conf-create-icon" style="display:grid;place-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px" class="anim-bounce-subtle"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></div>
          <div class="conf-create-title">Create live learning experiences</div>
          <div class="conf-create-sub">Organize workshops, masterclasses, webinars and live sessions. Your conferences will appear here.</div>
          <button class="conf-create-btn" id="empty-create-btn">+ Create Conference</button>
        </div>
      `;
      const btn = existingGrid.querySelector("#empty-create-btn");
      if (btn)
        btn.addEventListener(
          "click",
          () => (window.location.href = "conference-form.html"),
        );
    } else if (toShow.length === 0) {
      existingGrid.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:36px; border:1px dashed var(--border-light); border-radius:var(--radius-xl); background:var(--bg-card)">
          <div style="margin-bottom:10px;display:grid;place-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <div style="font-weight:600; font-size:14px">No conferences found</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:6px; max-width:320px; margin-inline:auto">No conferences match "${_escapeHtml(state.search)}" with current filters. Try adjusting search or <button style="color:var(--color-primary); font-weight:500" onclick="resetFilters()">reset filters</button>.</div>
          <button class="btn-primary" style="margin-top:16px; padding:8px 16px; font-size:13px" onclick="window.location.href='conference-form.html'">+ Create Conference</button>
        </div>
        <div class="conf-create">
          <div class="conf-create-icon" style="display:grid;place-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px" class="anim-bounce-subtle"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></div>
          <div class="conf-create-title">Create live learning experiences</div>
          <div class="conf-create-sub">Organize workshops, masterclasses, webinars and live sessions.</div>
          <button class="conf-create-btn" onclick="window.location.href='conference-form.html'">+ Create Conference</button>
        </div>
      `;
    } else {
      existingGrid.innerHTML =
        toShow
          .map((conf, idx) => {
            const regCount = getRegCount(conf.id);
            const seats = getSeats(conf);
            const grad = GRADIENTS[idx % GRADIENTS.length];
            const statusMeta = getStatusMeta(conf, regCount, seats);
            const fee = getFee(conf);
            const feeLabel =
              fee.amount === 0
                ? "Free"
                : _formatCurrency(fee.amount, fee.currency);
            const workshopLabel = getWorkshopLabel(conf);
            const locShort = getLocationShort(conf);
            const title = conf.title || conf.name || "Untitled Conference";
            const isPub = (conf.status || "").toLowerCase() === "published";

            const confImage = getConfImage(conf);
            const hasImage = !!confImage;

            return `
          <div class="conf-item" data-id="${_escapeHtml(conf.id)}" style="overflow:hidden;border-radius:16px;border:1px solid var(--border-light);background:var(--bg-card);transition:all 0.22s ease">
            <!-- Image section - NEW: supports uploaded conference images -->
            ${
              hasImage
                ? `
            <div style="position:relative;width:100%;height:160px;overflow:hidden;background:linear-gradient(135deg, #F5F3FF 0%, #DDD6FE 100%)">
              <img src="${confImage}" alt="${_escapeHtml(title)}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.display='none'">
              <div style="position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)"></div>
              <div style="position:absolute;top:12px;left:12px;display:flex;gap:6px">
                <span class="conf-pill-light" style="background:rgba(255,255,255,0.95);backdrop-filter:blur(8px)">${_escapeHtml(formatPillDateTime(conf))}</span>
                <span class="${statusMeta.cls}" style="backdrop-filter:blur(8px)">${_escapeHtml(statusMeta.label)}</span>
              </div>
              <div style="position:absolute;bottom:12px;left:16px;right:16px">
                <div class="conf-item-title" style="color:white;font-size:16px;font-weight:700;line-height:1.2;text-shadow:0 1px 2px rgba(0,0,0,0.3)">${_escapeHtml(title)}</div>
                <div style="margin-top:4px;font-size:11px;color:rgba(255,255,255,0.9)"> ${_escapeHtml(conf.name || "")} • ${_escapeHtml(workshopLabel)} </div>
              </div>
            </div>
            `
                : `
            <div class="conf-item-hero ${grad}">
              <div class="conf-item-top">
                <span class="conf-pill-light">${_escapeHtml(formatPillDateTime(conf))}</span>
                <span class="${statusMeta.cls}">${_escapeHtml(statusMeta.label)}</span>
              </div>
              <div>
                <div class="conf-item-title">${_escapeHtml(title)}</div>
                <div style="margin-top:6px; font-size:11px; color:rgba(255,255,255,0.85); line-height:1.3"> ${_escapeHtml(conf.name || "")} • ${_escapeHtml(workshopLabel)} </div>
              </div>
            </div>
            `
            }
            <div class="conf-item-foot">
              <div style="display:flex; flex-direction:column; gap:2px">
                <span style="display:flex;align-items:center;gap:4px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> ${regCount} registered • ${seats} seats</span>
                <span style="font-size:11px; color:var(--text-muted)">${_escapeHtml(feeLabel)} • ${_escapeHtml(conf.deliveryMethod || "-")} • ${_escapeHtml(locShort)}</span>
              </div>
              <div style="display:flex; gap:8px; align-items:center">
                <div class="action-menu">
                  <button class="btn-dark manage-btn" data-id="${_escapeHtml(conf.id)}" style="padding:6px 12px;font-size:12px;border-radius:8px">Manage </button>
                  <div class="action-dropdown" id="dropdown-${_escapeHtml(conf.id)}" style="width:200px">
                    <button class="action-item" data-action="view" data-id="${_escapeHtml(conf.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View</button>
                    <button class="action-item" data-action="edit" data-id="${_escapeHtml(conf.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
                    <button class="action-item" data-action="duplicate" data-id="${_escapeHtml(conf.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8v-2a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg> Duplicate</button>
                    <button class="action-item" data-action="registrations" data-id="${_escapeHtml(conf.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> View Registrations (${regCount})</button>
                    <button class="action-item" data-action="togglePublish" data-id="${_escapeHtml(conf.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> ${isPub ? "Unpublish" : "Publish"}</button>
                    <div style="height:1px; background:var(--border-light); margin:4px 0"></div>
                    <button class="action-item danger" data-action="delete" data-id="${_escapeHtml(conf.id)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete</button>
                  </div>
                </div>
                <button class="btn-light share-btn" data-id="${_escapeHtml(conf.id)}" style="padding:6px 12px;font-size:12px;border-radius:8px">Share</button>
              </div>
            </div>
            <div style="padding:8px 16px; display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); border-top:1px solid var(--bg-track, #F1F5F9); background:rgba(248,250,252,0.5)">
              <span>${_escapeHtml(conf.token || "")}</span>
              <span>${_escapeHtml(conf.deliveryMethod || "")} • ${_escapeHtml(getLocationLabel(conf).slice(0, 30))}</span>
            </div>
          </div>
        `;
          })
          .join("") +
        `
        <div class="conf-create">
          <div class="conf-create-icon" style="display:grid;place-items:center"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:32px;height:32px" class="anim-bounce-subtle"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg></div>
          <div class="conf-create-title">Create live learning experiences</div>
          <div class="conf-create-sub">Organize workshops, masterclasses, webinars and live sessions.</div>
          <button class="conf-create-btn" onclick="window.location.href='conference-form.html'">+ Create Conference</button>
        </div>
      `;
    }

    bindGridEvents(existingGrid);
  }

  // ---------- Past List ----------
  function renderPast(conferences) {
    // Past container: .past-list inside .conf-list-card or second .conf-list-card
    // Try to find .past-list
    let pastList = document.querySelector(".past-list");
    if (!pastList) return; // if page doesn't have past section

    const completed = conferences.filter(isCompleted);
    const pastSection = pastList.closest(".conf-list-card");

    if (completed.length === 0) {
      if (state.status === "completed" || state.status === "all") {
        // Show empty only if filter is completed or all, else hide
        if (state.status === "completed") {
          pastList.innerHTML = `
            <div style="text-align:center; padding:24px; color:var(--text-muted); font-size:13px">
              No completed conferences match current filters.
            </div>
          `;
          if (pastSection) pastSection.style.display = "";
        } else {
          // hide past section when no completed and not filtering completed
          pastList.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12px">No past conferences yet.</div>`;
          if (
            pastSection &&
            state.search === "" &&
            state.workshop === "all" &&
            state.delivery === "all" &&
            state.status === "all"
          ) {
            // keep visible with empty note
            pastSection.style.display = "";
          }
        }
      } else {
        if (pastSection) pastSection.style.display = "none";
      }
      return;
    }

    if (pastSection) pastSection.style.display = "";
    pastList.innerHTML = completed
      .map((conf) => {
        const regCount = getRegCount(conf.id);
        const dateStr = _formatDate(conf.startDate || conf.endDate);
        const fee = getFee(conf);
        const feeTxt =
          fee.amount === 0 ? "Free" : _formatCurrency(fee.amount, fee.currency);
        return `
        <div class="past-item">
          <div>
            <div class="past-title">${_escapeHtml(conf.title || conf.name)}</div>
            <div class="past-sub">${_escapeHtml(dateStr)} • ${regCount} attendees • ${_escapeHtml(conf.token || "")} • ${_escapeHtml(feeTxt)} • ${_escapeHtml(getLocationLabel(conf))}</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center">
            <button class="action-item" data-action="view" data-id="${_escapeHtml(conf.id)}" style="font-size:12px;color:#2563EB;font-weight:500;border:1px solid #E2E8F0;padding:6px 12px;border-radius:8px;width:auto">View</button>
            <button style="font-size:12px;color:#2563EB;font-weight:500;border:1px solid #E2E8F0;padding:6px 12px;border-radius:8px" data-action="registrations" data-id="${_escapeHtml(conf.id)}">Analytics</button>
          </div>
        </div>
      `;
      })
      .join("");

    // Bind actions in past list via delegation later
    pastList.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        handleAction(action, id);
      });
    });
  }

  // ---------- Actions ----------
  function handleAction(action, id) {
    const conf = Store.getById(CONF_COL, id);
    if (!conf && action !== "share") {
      _toast("Conference not found");
      return;
    }

    switch (action) {
      case "view":
        window.location.href = `conference-view.html?id=${encodeURIComponent(id)}`;
        break;
      case "edit":
        window.location.href = `conference-form.html?id=${encodeURIComponent(id)}`;
        break;
      case "duplicate": {
        const clone = { ...conf };
        delete clone.id;
        delete clone.token;
        delete clone.createdAt;
        delete clone.updatedAt;
        clone.name = `${conf.name || conf.title || "Conference"} (Copy)`;
        if (conf.title) clone.title = `${conf.title} (Copy)`;
        clone.status = "draft";
        // Slightly adjust dates to future if completed
        if (isCompleted(clone)) {
          const today = new Date();
          const nextWeek = new Date(today);
          nextWeek.setDate(today.getDate() + 7);
          clone.startDate = nextWeek.toISOString().slice(0, 10);
          clone.endDate = nextWeek.toISOString().slice(0, 10);
        }
        try {
          const created = Store.create(CONF_COL, clone);
          _toast(`Duplicated as ${created.token || "draft"}`);
          // No need manual render, Store event triggers
          refresh();
        } catch (e) {
          console.error(e);
          _toast("Duplicate failed");
        }
        break;
      }
      case "registrations":
        window.location.href = `conference-registration.html?conferenceId=${encodeURIComponent(id)}`;
        break;
      case "togglePublish": {
        const newStatus =
          (conf.status || "").toLowerCase() === "published"
            ? "draft"
            : "published";
        try {
          Store.update(CONF_COL, id, { status: newStatus });
          _toast(
            newStatus === "published"
              ? "Conference published"
              : "Conference unpublished",
          );
          refresh();
        } catch (e) {
          _toast("Status update failed");
        }
        break;
      }
      case "delete": {
        _confirmDelete(
          `Delete "${conf.name || conf.title}"? This action cannot be undone. All registrations will remain but linked conference will be removed.`,
          "Delete Conference?",
        ).then((confirmed) => {
          if (!confirmed) return;
          try {
            Store.delete(CONF_COL, id);
            _toast("Conference deleted");
            refresh();
          } catch (e) {
            _toast("Delete failed");
          }
        });
        break;
      }
      case "share": {
        const url = `${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, "/")}conference-view.html?id=${encodeURIComponent(id)}`;
        const fallbackUrl = `conference-view.html?id=${encodeURIComponent(id)}`;
        const shareText =
          window.location.origin && window.location.origin !== "null"
            ? url
            : fallbackUrl;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(shareText)
            .then(() => {
              _toast("Link copied to clipboard");
            })
            .catch(() => {
              prompt("Copy this link:", shareText);
            });
        } else {
          prompt("Copy this link:", shareText);
        }
        break;
      }
      default:
        _toast(`${action} - ${id}`);
    }

    // Close all dropdowns
    document
      .querySelectorAll(".action-dropdown.show")
      .forEach((d) => d.classList.remove("show"));
  }

  function bindGridEvents(gridEl) {
    if (!gridEl) return;
    // Manage toggle
    gridEl.querySelectorAll(".manage-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const dd =
          document.getElementById(
            `dropdown-${CSS.escape ? CSS.escape(id) : id}`,
          ) || document.querySelector(`#dropdown-${id}`);
        const isOpen = dd && dd.classList.contains("show");
        document
          .querySelectorAll(".action-dropdown.show")
          .forEach((d) => d.classList.remove("show"));
        if (dd && !isOpen) dd.classList.add("show");
      });
    });

    gridEl.querySelectorAll("[data-action]").forEach((btn) => {
      // Avoid double binding manage button itself (it has no data-action? it has manage but we handle)
      if (btn.classList.contains("manage-btn")) return;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        handleAction(action, id);
      });
    });

    gridEl.querySelectorAll(".share-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAction("share", btn.dataset.id);
      });
    });
  }

  function resetFilters() {
    state.search = "";
    state.status = "all";
    state.workshop = "all";
    state.delivery = "all";
    const search = document.getElementById("conf-search");
    const sSel = document.getElementById("filter-status");
    const wSel = document.getElementById("filter-workshop");
    const dSel = document.getElementById("filter-delivery");
    if (search) search.value = "";
    if (sSel) sSel.value = "all";
    if (wSel) wSel.value = "all";
    if (dSel) dSel.value = "all";
    render();
  }
  window.resetFilters = resetFilters;

  // ---------- Main render ----------
  function render() {
    loadData();
    ensureToolbar();
    bindToolbarEvents();
    renderSummary();
    const filtered = filteredConferences();
    renderGrid(filtered);
    renderPast(filtered);

    // Fix header create button (old HTML has toast)
    const headerBtns = document.querySelectorAll(
      ".conf-page-head .btn-primary",
    );
    headerBtns.forEach((btn) => {
      if (btn.id !== "btn-create-conf" && !btn.dataset.fixed) {
        btn.dataset.fixed = "1";
        btn.onclick = () => (window.location.href = "conference-form.html");
      }
    });

    // Dispatch event for other listeners
    window.dispatchEvent(
      new CustomEvent("conferences:rendered", {
        detail: { total: state.conferences.length, filtered: filtered.length },
      }),
    );
  }

  function refresh() {
    loadData();
    render();
  }

  function init() {
    _setActiveNav("conferences");

    // Initial load
    loadData();

    // Toolbar + summary + grids
    // Small delay to allow Store seed and layout injection
    setTimeout(() => {
      render();
    }, 50);

    // Live reactivity
    window.addEventListener("studypod:datachange", (e) => {
      const col = e.detail?.collection;
      if (col === CONF_COL || col === REG_COL || col === "all") {
        refresh();
      }
    });

    // Close dropdowns on outside click
    document.addEventListener("click", () => {
      document
        .querySelectorAll(".action-dropdown.show")
        .forEach((dd) => dd.classList.remove("show"));
    });

    // Handle layout ready
    window.addEventListener("layout:ready", () => {
      setTimeout(render, 30);
    });

    console.log("[conferences] initialized", state.conferences.length);
  }

  // Expose for HTML onclick handlers (legacy)
  window.handleConferenceAction = (action, id) => {
    // Legacy signature from template: handleConferenceAction('manage','React Masterclass')
    // If second param is name, try to find by name
    if (id && !id.startsWith("conference_") && !id.startsWith("conf_")) {
      const found = state.conferences.find(
        (c) => c.name === id || c.title === id,
      );
      if (found) {
        handleAction(action === "manage" ? "view" : action, found.id);
        return;
      }
      _toast(`${action} - ${id}`);
      return;
    }
    handleAction(action, id);
  };

  window.ConferencesPage = {
    init,
    render,
    refresh,
    resetFilters,
    handleAction,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // DOM already ready
    setTimeout(init, 80);
  }
})();
