/**
 * ==========================================================================
 * COMMON.JS - StudyPod v2.2 - Shared Layout + Theme + Navigation
 * ==========================================================================
 * Purpose:
 * - Central layout engine: renders sidebar, header, mobile nav, overlays
 * - Theme system: light/dark toggle with localStorage persistence (now in header)
 * - Navigation: active state detection from URL, parent nav mapping
 * - Sidebar: collapsible with toggle button + double-click, icons only when collapsed,
 *   hover tooltip with transparent background (dark mode compatible)
 * - Helpers: toast, escapeHtml, formatCurrency, formatDate, modals
 * - Animated Icons: replaces all emojis with animated SVG icons
 * - Mobile fixes: logo left, actions right, no duplicate desktop notif/profile
 * - Sticky sidebar: fixed position, remains when page height longer
 *
 * Dependencies:
 * - Store (js/store.js) - for email badge count
 * - CSS: variables.css, common.css, animated-icons.css
 *
 * Changelog v2.2:
 * - Added collapsible sidebar toggle button (modern, does not block content)
 * - Double-click on sidebar toggles collapse
 * - Collapsed shows icons only, hover shows name with transparent bg (dark mode ok)
 * - Moved theme toggle from sidebar to header (visible large + mobile)
 * - Fixed mobile: logo left, notification/profile/theme on right
 * - Fixed duplicate desktop notif/profile showing on mobile
 * - Made sidebar fixed/sticky so it stays on screen when page long
 * - Added logo img everywhere with span studypod
 * - Preserved all existing functionality
 * ==========================================================================
 */

const THEME_KEY = "studypod_theme";
const SIDEBAR_COLLAPSED_KEY = "studypod_sidebar_collapsed";

/* Theme detection - respects saved preference or system */
let isDark = (() => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark") return true;
    if (saved === "light") return false;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    )
      return true;
    return false;
  } catch (e) {
    return false;
  }
})();

function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch (e) {}
  return isDark ? "dark" : "light";
}

/**
 * Apply theme with optional save and chart redraw
 * @param {string} theme - 'light' or 'dark'
 * @param {object} options - {save, redrawChart}
 */
function applyTheme(theme, options = {}) {
  const { save = true, redrawChart = true } = options;
  const dark = theme === "dark";
  isDark = dark;
  document.documentElement.classList.toggle("dark", dark);
  document.body.classList.toggle("dark", dark);

  // Update theme toggle icons - now SVG instead of emoji
  // Support both header and any legacy side icons
  const topIcon = document.getElementById("ico-top");
  const topIconMobile = document.getElementById("ico-top-mobile");
  const sideIcon = document.getElementById("ico-side");
  const headerThemeIcon = document.getElementById("header-theme-icon");
  const sunSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="anim-spin-slow" style="width:16px;height:16px"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`;
  const moonSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

  const iconHTML = dark ? sunSVG : moonSVG;
  if (topIcon) topIcon.innerHTML = iconHTML;
  if (topIconMobile) topIconMobile.innerHTML = iconHTML;
  if (sideIcon) sideIcon.innerHTML = iconHTML;
  if (headerThemeIcon) headerThemeIcon.innerHTML = iconHTML;

  if (save) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
  }

  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = dark ? "#0F172A" : "#F8FAFC";

  if (redrawChart && typeof drawChart === "function") {
    try {
      drawChart();
    } catch (e) {}
  }
  window.dispatchEvent(
    new CustomEvent("themechange", { detail: { theme, isDark: dark } }),
  );
}

function initTheme() {
  const theme = getSavedTheme();
  applyTheme(theme, { save: false, redrawChart: false });
}

function toggleTheme() {
  const newTheme = isDark ? "light" : "dark";
  applyTheme(newTheme, { save: true, redrawChart: true });
}

/* Notification and profile popovers */
function toggleNotif() {
  // Support both old and new IDs
  const notifEl =
    document.getElementById("notif") ||
    document.getElementById("notif-desktop");
  if (!notifEl) return;
  notifEl.classList.toggle("show");
  const profEl =
    document.getElementById("prof") || document.getElementById("prof-desktop");
  if (profEl) profEl.classList.remove("show");
  // Close other notif if duplicate
  const otherNotif = document.getElementById("notif-desktop");
  if (otherNotif && otherNotif !== notifEl) otherNotif.classList.remove("show");
  const otherNotif2 = document.getElementById("notif");
  if (otherNotif2 && otherNotif2 !== notifEl)
    otherNotif2.classList.remove("show");
}

function toggleProfile() {
  const profEl =
    document.getElementById("prof") || document.getElementById("prof-desktop");
  if (!profEl) return;
  profEl.classList.toggle("show");
  const notifEl =
    document.getElementById("notif") ||
    document.getElementById("notif-desktop");
  if (notifEl) notifEl.classList.remove("show");
  // Close duplicates
  const otherProf = document.getElementById("prof-desktop");
  if (otherProf && otherProf !== profEl) otherProf.classList.remove("show");
  const otherProf2 = document.getElementById("prof");
  if (otherProf2 && otherProf2 !== profEl) otherProf2.classList.remove("show");
}

/* Student drawer */
function openStudent(name, init) {
  const nameEl = document.getElementById("d-name");
  if (nameEl) nameEl.textContent = name;
  const avEl = document.getElementById("d-av");
  if (avEl) avEl.textContent = init;
  const drawerEl = document.getElementById("drawer");
  if (drawerEl) drawerEl.classList.add("show");
}

function closeStudent() {
  const drawerEl = document.getElementById("drawer");
  if (drawerEl) drawerEl.classList.remove("show");
}

/* Toast notification */
function toast(msg, type = "info") {
  let toastEl = document.getElementById("toast");
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "toast";
    toastEl.className = "toast";
    toastEl.innerHTML =
      '<span class="toast-dot"></span><span id="toast-msg"></span>';
    document.body.appendChild(toastEl);
  }
  const msgEl = document.getElementById("toast-msg");
  if (msgEl) msgEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3000);
}

/* Escaping and formatting helpers */
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatCurrency(amount, currency = "NGN") {
  const symbols = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" };
  const sym = symbols[currency] || currency;
  return `${sym}${Number(amount).toLocaleString()}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("show");
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("show");
}

function confirmDelete(
  message = "Are you sure? This action cannot be undone.",
  title = "Delete?",
) {
  return new Promise((resolve) => {
    let overlay = document.getElementById("confirm-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "confirm-overlay";
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-head"><h3 id="confirm-title"></h3><button onclick="closeModal('confirm-overlay')" class="drawer-close">×</button></div>
          <div class="modal-body"><p id="confirm-msg"></p></div>
          <div class="modal-foot"><button class="btn-light" onclick="window._confirmResolve(false)">Cancel</button><button class="btn-danger" onclick="window._confirmResolve(true)">Delete</button></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          window._confirmResolve(false);
        }
      });
    }
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-msg").textContent = message;
    overlay.classList.add("show");
    window._confirmResolve = (val) => {
      overlay.classList.remove("show");
      resolve(val);
    };
  });
}

function setActiveNav(activeId) {
  try {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.dataset.navId === activeId || btn.id === "nav-" + activeId,
      );
    });
    document.querySelectorAll(".mob-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mobId === activeId);
    });
  } catch (e) {}
}

// Layout System - Enhanced with collapsible sidebar
(function () {
  /**
   * ICONS - Standard navigation icons (static SVG)
   * Used for sidebar and mobile nav
   */
  const ICONS = {
    home: '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    courses:
      '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    students:
      '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    assignments:
      '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    conferences:
      '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    messages:
      '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
    quizzes:
      '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    analytics:
      '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    email:
      '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    settings:
      '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    bell: '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-6 9-6 9h18s-6-2-6-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    users:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    chart:
      '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    file: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>',
    wave: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8a2 2 0 0 1 2 2v4a2 2 0 1 1-4 0v-4a2 2 0 0 1 2-2z"/><path d="M8 14a2 2 0 0 1 2 2v2a2 2 0 1 1-4 0v-2a2 2 0 0 1 2-2z"/><path d="M16 14a2 2 0 0 1 2 2v2a2 2 0 1 1-4 0v-2a2 2 0 0 1 2-2z"/><path d="M6 10a2 2 0 0 1 2 2v2a2 2 0 1 1-4 0v-2a2 2 0 0 1 2-2z"/><path d="M18 10a2 2 0 0 1 2 2v2a2 2 0 1 1-4 0v-2a2 2 0 0 1 2-2z"/></svg>',
    help: '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" class="anim-help-ring"></circle><path d="M9.2 9.2a3.8 3.8 0 0 1 5.4 5.4c-.6.6-1 1-1.5 1.7-.3.6-.5 1.1-.5 1.9" class="anim-help-q"></path><circle cx="12" cy="17.8" r="1" fill="currentColor" class="anim-help-dot"></circle></svg>',
  };

  const ANIMATED_ICONS = {
    float:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="anim-float"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="anim-wave-continuous"><path d="M12 8a2 2 0 0 1 2 2v4a2 2 0 1 1-4 0v-4a2 2 0 0 1 2-2z"/><path d="M8 14a2 2 0 0 1 2 2v2a2 2 0 1 1-4 0v-2a2 2 0 0 1 2-2z"/><path d="M16 14a2 2 0 0 1 2 2v2a2 2 0 1 1-4 0v-2a2 2 0 0 1 2-2z"/></svg>',
  };

  // Helpers for path resolution
  function sitePath(file) {
    // From pages/* -> ../ or from root -> ./ or pages/
    const path = window.location.pathname;
    if (path.includes("/pages/")) return "../" + file.replace("pages/", "");
    if (file.startsWith("pages/")) return file;
    if (file === "index.html") {
      if (path.includes("/pages/")) return "../index.html";
      return "index.html";
    }
    return file;
  }
  function pagePath(file) {
    const path = window.location.pathname;
    if (path.includes("/pages/")) return file;
    return "pages/" + file;
  }

  /**
   * Get logo HTML with img and span - used everywhere
   */
  function getLogoHTML(size = 32) {
    // Determine base path for assets
    const isInPages = window.location.pathname.includes("/pages/");
    const assetPath = isInPages ? "../assets/logo.svg" : "assets/logo.svg";
    const fallbackPath = isInPages ? "../assets/logo.png" : "assets/logo.png";
    return `
      <div class="logo-box">
        <img src="${assetPath}" alt="StudyPod Logo" onerror="this.onerror=null; this.src='${fallbackPath}'" style="width:${size}px;height:${size}px;border-radius:10px;object-fit:cover">
      </div>
      <span class="brand-name">studyPod</span>
    `;
  }

  function getLogoHTMLCompact(size = 28) {
    const isInPages = window.location.pathname.includes("/pages/");
    const assetPath = isInPages ? "../assets/logo.svg" : "assets/logo.svg";
    const fallbackPath = isInPages ? "../assets/logo.png" : "assets/logo.png";
    return `
      <img src="${assetPath}" alt="StudyPod" onerror="this.onerror=null; this.src='${fallbackPath}'" style="width:${size}px;height:${size}px;border-radius:8px;object-fit:cover">
      <span class="brand-name">studyPod</span>
    `;
  }

  // --- Sidebar Collapse Logic ---
  function isSidebarCollapsed() {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch (e) {
      return false;
    }
  }

  function setSidebarCollapsed(collapsed) {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
    } catch (e) {}
    applySidebarCollapsedState(collapsed);
  }

  function applySidebarCollapsedState(collapsed) {
    const app = document.querySelector(".app");
    const sidebar = document.querySelector(".sidebar");
    if (app) app.classList.toggle("sidebar-collapsed", collapsed);
    if (sidebar) sidebar.classList.toggle("collapsed", collapsed);
    // Update toggle icon
    const toggleBtn = document.getElementById("sidebar-toggle");
    if (toggleBtn) {
      toggleBtn.innerHTML = collapsed
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="9 18 15 12 9 6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="15 18 9 12 15 6"/></svg>';
      toggleBtn.setAttribute(
        "aria-label",
        collapsed ? "Expand sidebar" : "Collapse sidebar",
      );
      toggleBtn.setAttribute(
        "title",
        collapsed
          ? "Expand sidebar (Double-click sidebar to toggle)"
          : "Collapse sidebar (Double-click sidebar to toggle)",
      );
    }
    // Dispatch event
    window.dispatchEvent(
      new CustomEvent("sidebar:toggle", { detail: { collapsed } }),
    );
  }

  function toggleSidebarCollapse() {
    const currentlyCollapsed =
      document.querySelector(".app")?.classList.contains("sidebar-collapsed") ||
      isSidebarCollapsed();
    setSidebarCollapsed(!currentlyCollapsed);
  }

  // Expose globally
  window.toggleSidebarCollapse = toggleSidebarCollapse;

  function renderSidebar(activeId) {
    const isCoursesActive = [
      "courses",
      "course-form",
      "course-performance",
    ].includes(activeId);
    const isStudentsActive = ["students", "student-profile"].includes(activeId);
    const isConferencesActive = [
      "conferences",
      "conference-form",
      "conference-view",
      "conference-registration",
    ].includes(activeId);
    const isAssignmentsActive = [
      "assignments",
      "assignment-form",
      "assignment-submissions",
    ].includes(activeId);
    const isQuizzesActive = [
      "quizzes",
      "quiz-form",
      "quiz-performance",
    ].includes(activeId);
    const isEmailActive = [
      "email",
      "email-compose",
      "email-message",
      "email-sent",
      "email-drafts",
    ].includes(activeId);
    const isAnalyticsActive = ["analytics"].includes(activeId);
    const isDashboardActive = ["dashboard", "index"].includes(activeId);

    // Logo HTML
    const logoHTML = getLogoHTML(32);

    // Theme toggle removed from sidebar per requirement (moved to header)
    return `
      <aside class="sidebar" id="sidebar">
        <button id="sidebar-toggle" class="sidebar-toggle" onclick="toggleSidebarCollapse()" aria-label="Collapse sidebar" title="Collapse sidebar (Double-click sidebar to toggle)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="sidebar-brand">
          ${logoHTML}
        </div>
        <nav class="sidebar-nav" id="sidebar-nav">
          <div class="nav-group">
            <div class="nav-group-title">Main</div>
            <a href="${sitePath("index.html")}" id="nav-dashboard" class="nav-btn ${isDashboardActive ? "active" : ""}" data-nav-id="dashboard">
              ${ICONS.home}<span>Dashboard</span>
              <span class="nav-tooltip">Dashboard</span>
            </a>
          </div>
          <div class="nav-group">
            <div class="nav-group-title">Teaching</div>
            <a href="${pagePath("courses.html")}" id="nav-courses" class="nav-btn ${isCoursesActive ? "active" : ""}" data-nav-id="courses">
              ${ICONS.courses}<span>Courses</span>
              <span class="nav-tooltip">Courses</span>
            </a>
            <a href="${pagePath("students.html")}" id="nav-students" class="nav-btn ${isStudentsActive ? "active" : ""}" data-nav-id="students">
              ${ICONS.students}<span>Students</span>
              <span class="nav-tooltip">Students</span>
            </a>
            <a href="${pagePath("assignments.html")}" id="nav-assignments" class="nav-btn ${isAssignmentsActive ? "active" : ""}" data-nav-id="assignments">
              ${ICONS.assignments}<span>Assignments</span>
              <span class="nav-tooltip">Assignments</span>
            </a>
            <a href="${pagePath("quizzes.html")}" id="nav-quizzes" class="nav-btn ${isQuizzesActive ? "active" : ""}" data-nav-id="quizzes">
              ${ICONS.quizzes}<span>Quizzes</span>
              <span class="nav-tooltip">Quizzes</span>
            </a>
            <a href="${pagePath("conferences.html")}" id="nav-conferences" class="nav-btn ${isConferencesActive ? "active" : ""}" data-nav-id="conferences">
              ${ICONS.conferences}<span>Conferences</span>
              <span class="nav-tooltip">Conferences</span>
            </a>
          </div>
          <div class="nav-group">
            <div class="nav-group-title">Communication</div>
            <a href="${pagePath("email.html")}" id="nav-email" class="nav-btn ${isEmailActive ? "active" : ""}" data-nav-id="email">
              ${ICONS.email}<span>Email</span><span id="email-badge" class="nav-badge" style="display:none">0</span>
              <span class="nav-tooltip">Email</span>
            </a>
          </div>
          <div class="nav-group">
            <div class="nav-group-title">Analytics</div>
            <a href="${pagePath("analytics.html")}" id="nav-analytics" class="nav-btn ${isAnalyticsActive ? "active" : ""}" data-nav-id="analytics">
              ${ICONS.analytics}<span>Analytics</span>
              <span class="nav-tooltip">Analytics</span>
            </a>
            <a href="${pagePath("settings.html")}" id="nav-settings" class="nav-btn ${activeId === "settings" ? "active" : ""}" data-nav-id="settings">
              ${ICONS.settings}<span>Settings</span>
              <span class="nav-tooltip">Messages</span>
            </a>
            <a href="${pagePath("support.html")}" id="nav-support" class="nav-btn ${activeId === "support" ? "active" : ""}" data-nav-id="support">
              ${ICONS.help}<span>Help & Support</span>
              <span class="nav-tooltip">Messages</span>
            </a>
          </div>
        </nav>
        <div class="user-card">
          <div class="user-avatar">SD</div>
          <div class="user-info"><div class="user-name">Sarah Davis</div><div class="user-email">sarah@studypod.com</div></div>
        </div>
      </aside>`;
  }

  function renderHeader(breadcrumb) {
    const parent = breadcrumb.parent || "Dashboard";
    const current = breadcrumb.current || "Overview";
    const bellIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px" class="anim-wiggle"><path d="M18 8A6 6 0 0 0 6 8c0 7-6 9-6 9h18s-6-2-6-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
    const bookIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
    const usersIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`;

    // Logo for header - left side
    const headerLogo = getLogoHTMLCompact(32);
    const themeIconPlaceholder =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

    return `
      <header class="header">
        <!-- Left: Logo (both desktop and mobile) -->
        <div class="pod-logo-container">
          <a href="${sitePath("index.html")}" class="pod-logo" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit">
            ${headerLogo}
          </a>
        </div>

        <!-- Right: Theme toggle + Notifications + Profile (both desktop and mobile) -->
        <div class="header-actions">
          
          <button class="icon-btn theme-toggle-btn" onclick="toggleTheme()" aria-label="Toggle theme" title="Toggle theme">
            <span id="header-theme-icon">${themeIconPlaceholder}</span>
            <span id="ico-top" style="display:none">${themeIconPlaceholder}</span>
          </button>
          <div style="position:relative">
            <button class="icon-btn" onclick="toggleNotif()" aria-label="Notifications">${bellIcon}<span id="notif-badge" style="position:absolute;top:-4px;right:-4px;width:8px;height:8px;background:#EF4444;border-radius:50%;display:none"></span></button>
            <div id="notif" class="popover">
              <div style="font-weight:600;font-size:13px;margin-bottom:12px">Notifications</div>
              <div style="display:flex;flex-direction:column;gap:12px">
                <div style="display:flex;gap:10px"><div style="width:32px;height:32px;border-radius:50%;background:var(--color-blue-icon-bg);display:grid;place-items:center;color:var(--color-primary)">${bookIcon}</div><div><div style="font-size:12px;font-weight:500">New submission</div><div style="font-size:11px;color:var(--text-muted)">Ava Kim submitted assignment</div></div></div>
                <div style="display:flex;gap:10px"><div style="width:32px;height:32px;border-radius:50%;background:var(--color-green-icon-bg);display:grid;place-items:center;color:var(--color-success-text)">${usersIcon}</div><div><div style="font-size:12px;font-weight:500">New registration</div><div style="font-size:11px;color:var(--text-muted)">Michael registered for React Masterclass</div></div></div>
              </div>
            </div>
          </div>
          <div style="position:relative">
            <button class="icon-btn" onclick="toggleProfile()" style="width:36px;height:36px;border-radius:50%;background:var(--color-avatar-light-blue);font-weight:600">SD</button>
            <div id="prof" class="popover" style="width:220px">
              <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px"><div style="width:36px;height:36px;border-radius:50%;background:var(--color-avatar-light-blue);display:grid;place-items:center;font-weight:600">SD</div><div><div style="font-size:13px;font-weight:600">Sarah Davis</div><div style="font-size:11px;color:var(--text-muted)">sarah@studypod.com</div></div></div>
              <button class="nav-btn" onclick="toggleTheme()"><span id="ico-top-mobile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></span><span>Toggle Theme</span></button>
              <button class="nav-btn" onclick="Store.reset(); location.reload()"><span>Reset Demo Data</span></button>
            </div>
          </div>
        </div>
      </header>`;
  }

  function renderPageBreadcrumb(breadcrumb) {
    const parent = breadcrumb.parent || "Dashboard";
    const current = breadcrumb.current || "Overview";
    return `
      <div class="page-breadcrumb">
        <a href="${sitePath("index.html")}">${escapeHtml(parent)}</a>
        <span>›</span>
        <span class="current">${escapeHtml(current)}</span>
      </div>
    `;
  }

  function insertPageBreadcrumb(breadcrumb) {
    try {
      const header = document.querySelector(".header");
      if (!header) return;
      const existing = header.querySelector(":scope > .page-breadcrumb");
      const html = renderPageBreadcrumb(breadcrumb);
      if (existing) existing.outerHTML = html;
      else header.insertAdjacentHTML("afterbegin", html);
    } catch (e) {
      /* silent */
    }
  }

  function renderMobileNav(activeId) {
    const isCoursesActive = [
      "courses",
      "course-form",
      "course-performance",
    ].includes(activeId);
    const isStudentsActive = ["students", "student-profile"].includes(activeId);
    const isConferencesActive = [
      "conferences",
      "conference-form",
      "conference-view",
      "conference-registration",
    ].includes(activeId);
    const isAssignmentsActive = [
      "assignments",
      "assignment-form",
      "assignment-submissions",
    ].includes(activeId);
    const isQuizzesActive = [
      "quizzes",
      "quiz-form",
      "quiz-performance",
    ].includes(activeId);
    const isEmailActive = [
      "email",
      "email-compose",
      "email-message",
      "email-sent",
      "email-drafts",
    ].includes(activeId);
    return `
      <nav class="mobile-nav" id="mobile-nav-scroll">
        <a href="${sitePath("index.html")}" id="m-dashboard" class="mob-btn ${["dashboard", "index"].includes(activeId) ? "active" : ""}" data-mob-id="dashboard">${ICONS.home}<span>Home</span></a>
        <a href="${pagePath("courses.html")}" id="m-courses" class="mob-btn ${isCoursesActive ? "active" : ""}" data-mob-id="courses">${ICONS.courses}<span>Courses</span></a>
        <a href="${pagePath("students.html")}" id="m-students" class="mob-btn ${isStudentsActive ? "active" : ""}" data-mob-id="students">${ICONS.students}<span>Students</span></a>
        <a href="${pagePath("conferences.html")}" id="m-conferences" class="mob-btn ${isConferencesActive ? "active" : ""}" data-mob-id="conferences">${ICONS.conferences}<span>Conf</span></a>
        <a href="${pagePath("assignments.html")}" id="m-assignments" class="mob-btn ${isAssignmentsActive ? "active" : ""}" data-mob-id="assignments">${ICONS.assignments}<span>Tasks</span></a>
        <a href="${pagePath("quizzes.html")}" id="m-quizzes" class="mob-btn ${isQuizzesActive ? "active" : ""}" data-mob-id="quizzes">${ICONS.quizzes}<span>Quizzes</span></a>
        <a href="${pagePath("email.html")}" id="m-email" class="mob-btn ${isEmailActive ? "active" : ""}" data-mob-id="email">${ICONS.email}<span>Email</span></a>
        <a href="${pagePath("analytics.html")}" id="m-analytics" class="mob-btn ${["analytics"].includes(activeId) ? "active" : ""}" data-mob-id="analytics">${ICONS.analytics}<span>Analytics</span></a>
      </nav><div style="height:72px" class="mobile-spacer"></div>`;
  }

  function renderOverlays() {
    const bookIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
    return `
      <div id="drawer" class="drawer">
        <div class="drawer-backdrop" onclick="closeStudent()"></div>
        <div class="drawer-panel">
          <div class="drawer-head"><div style="display:flex;gap:12px;align-items:center"><div id="d-av" class="user-avatar" style="width:40px;height:40px">MJ</div><div><div id="d-name" style="font-weight:600">Michael Johnson</div><div style="font-size:11px;color:var(--text-muted)">Student • Joined Sep 2024</div></div></div><button onclick="closeStudent()" class="drawer-close">×</button></div>
          <div class="drawer-section"><div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:8px">Overall Progress</div><div style="font-weight:600">92% completed</div><div class="progress-line" style="margin-top:8px;height:8px"><i style="width:92%;height:8px"></i></div></div>
          <div class="drawer-section"><div style="display:flex;gap:12px;align-items:center"><div style="width:36px;height:36px;border-radius:8px;background:var(--color-primary-light);display:grid;place-items:center;color:var(--color-primary)">${bookIcon}</div><div><div style="font-size:13px;font-weight:500">Python for Data Science</div><div style="font-size:11px;color:var(--text-muted)">8 modules • 24 lessons</div></div></div></div>
          <div style="padding:16px 20px;margin-top:auto"><button class="btn-primary" style="width:100%;justify-content:center" onclick="window.location.href = pagePath('email.html')">Send Message</button></div>
        </div>
      </div>
      <div id="toast" class="toast"><span class="toast-dot"></span><span id="toast-msg">Action</span></div>
    `;
  }

  function detectActiveFromURL() {
    const path = window.location.pathname.toLowerCase();
    const file = path.split("/").pop() || "index.html";
    if (file.includes("course-performance") || file.includes("course-form"))
      return file.includes("performance")
        ? "course-performance"
        : "course-form";
    if (
      file.includes("conference-registration") ||
      file.includes("conference-form") ||
      file.includes("conference-view")
    ) {
      if (file.includes("registration")) return "conference-registration";
      if (file.includes("form")) return "conference-form";
      return "conference-view";
    }
    if (
      file.includes("assignment-submissions") ||
      file.includes("assignment-form")
    )
      return file.includes("submissions")
        ? "assignment-submissions"
        : "assignment-form";
    if (file.includes("quiz-performance") || file.includes("quiz-form"))
      return file.includes("performance") ? "quiz-performance" : "quiz-form";
    if (file.includes("student-profile")) return "student-profile";
    if (file.includes("email")) {
      if (file.includes("compose")) return "email-compose";
      if (file.includes("message")) return "email-message";
      if (file.includes("sent")) return "email-sent";
      if (file.includes("draft")) return "email-drafts";
      return "email";
    }
    if (file.includes("conference")) return "conferences";
    if (file.includes("index") || file === "" || file === "dashboard")
      return "dashboard";
    if (file.includes("course")) return "courses";
    if (file.includes("student")) return "students";
    if (file.includes("assignment")) return "assignments";
    if (file.includes("quiz")) return "quizzes";
    if (file.includes("message")) return "messages";
    if (file.includes("analytic")) return "analytics";
    const name = file.replace(".html", "");
    if (name) return name;
    return "dashboard";
  }

  function getParentNav(activeId) {
    if (["course-form", "course-performance"].includes(activeId))
      return "courses";
    if (
      [
        "conference-form",
        "conference-view",
        "conference-registration",
      ].includes(activeId)
    )
      return "conferences";
    if (["assignment-form", "assignment-submissions"].includes(activeId))
      return "assignments";
    if (["quiz-form", "quiz-performance"].includes(activeId)) return "quizzes";
    if (["student-profile"].includes(activeId)) return "students";
    if (
      ["email-compose", "email-message", "email-sent", "email-drafts"].includes(
        activeId,
      )
    )
      return "email";
    return activeId;
  }

  function initLayout(config = {}) {
    const activeId = config.active || detectActiveFromURL();
    const parentNav = getParentNav(activeId);
    const breadcrumb = config.breadcrumb || {
      parent: parentNav === "conferences" ? "Teaching" : "Dashboard",
      current: parentNav.charAt(0).toUpperCase() + parentNav.slice(1),
      manual: false,
    };
    if (typeof config.breadcrumb === "string")
      breadcrumb.current = config.breadcrumb;

    const sidebarEl = document.getElementById("layout-sidebar");
    const headerEl = document.getElementById("layout-header");
    const mobileEl = document.getElementById("layout-mobile-nav");
    const overlaysEl = document.getElementById("layout-overlays");

    if (sidebarEl) {
      sidebarEl.innerHTML = renderSidebar(parentNav);
    }
    if (headerEl) {
      headerEl.innerHTML = renderHeader(breadcrumb);
    }
    if (mobileEl) {
      mobileEl.innerHTML = renderMobileNav(parentNav);
    }
    if (overlaysEl) {
      overlaysEl.innerHTML = renderOverlays();
    }

    // Insert page breadcrumb below the header in the page content (top-left)
    try {
      insertPageBreadcrumb(breadcrumb);
    } catch (e) {
      /* silent */
    }

    if (!sidebarEl && !headerEl) {
      setActiveNav(parentNav);
    }

    window.dispatchEvent(
      new CustomEvent("layout:ready", {
        detail: { activeId, parentNav, breadcrumb },
      }),
    );

    setTimeout(() => {
      initTheme();
      // Apply collapsed state from localStorage
      const collapsed = isSidebarCollapsed();
      applySidebarCollapsedState(collapsed);
      // Bind double-click on sidebar to toggle collapse (desktop only)
      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        sidebar.addEventListener("dblclick", (e) => {
          // Only toggle if double-click on sidebar itself or nav area, not on buttons/links
          if (window.innerWidth <= 1024) return; // Don't collapse on mobile
          // Prevent double-click on interactive elements from triggering twice
          const target = e.target;
          if (target.closest("a") || target.closest("button")) {
            // Still allow double-click on nav to toggle, but not single click
            // We'll toggle anyway for any double-click in sidebar per requirement
          }
          toggleSidebarCollapse();
        });
      }

      // Email badge sync
      try {
        const Store = window.Store;
        if (Store) {
          const unread = Store.filter(
            "emails",
            (e) => e.folder === "inbox" && !e.read,
          ).length;
          const badge = document.getElementById("email-badge");
          if (badge) {
            if (unread > 0) {
              badge.textContent = unread;
              badge.style.display = "inline-flex";
            } else badge.style.display = "none";
          }
          const notifBadge = document.getElementById("notif-badge");
          if (notifBadge) {
            notifBadge.style.display = unread > 0 ? "block" : "none";
          }
        }
      } catch (e) {}
      const activeMob = document.querySelector(".mob-btn.active");
      if (activeMob)
        activeMob.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
    }, 0);

    console.log(
      `[Layout] Initialized - active: ${activeId} parent: ${parentNav}`,
      config,
    );
  }

  window.Layout = {
    initLayout,
    renderSidebar,
    renderHeader,
    renderMobileNav,
    renderOverlays,
    detectActiveFromURL,
    ICONS,
    ANIMATED_ICONS,
    getParentNav,
    toggleSidebarCollapse,
    isSidebarCollapsed,
  };

  document.addEventListener("DOMContentLoaded", () => {
    const autoEl = document.querySelector("[data-layout-auto]");
    if (autoEl) {
      const active =
        autoEl.getAttribute("data-layout-auto") || detectActiveFromURL();
      initLayout({ active });
      return;
    }
    const active = detectActiveFromURL();
    const parent = getParentNav(active);
    initLayout({
      active,
      breadcrumb:
        parent === "conferences"
          ? {
              parent: "Teaching",
              current: parent.charAt(0).toUpperCase() + parent.slice(1),
            }
          : {
              parent: "Dashboard",
              current: parent.charAt(0).toUpperCase() + parent.slice(1),
            },
    });
  });

  // Global click handlers for popovers and dropdowns
  document.addEventListener("click", (e) => {
    const notif = document.getElementById("notif");
    const notifDesktop = document.getElementById("notif-desktop");
    const prof = document.getElementById("prof");
    const profDesktop = document.getElementById("prof-desktop");
    // Close notif if click outside
    if (
      notif &&
      !notif.contains(e.target) &&
      !e.target.closest('[onclick="toggleNotif()"]')
    )
      notif.classList.remove("show");
    if (
      notifDesktop &&
      !notifDesktop.contains(e.target) &&
      !e.target.closest('[onclick="toggleNotif()"]')
    )
      notifDesktop.classList.remove("show");
    if (
      prof &&
      !prof.contains(e.target) &&
      !e.target.closest('[onclick="toggleProfile()"]')
    )
      prof.classList.remove("show");
    if (
      profDesktop &&
      !profDesktop.contains(e.target) &&
      !e.target.closest('[onclick="toggleProfile()"]')
    )
      profDesktop.classList.remove("show");
    document.querySelectorAll(".action-dropdown.show").forEach((dd) => {
      if (
        !dd.contains(e.target) &&
        !e.target.closest(".action-menu") &&
        !e.target.closest("[data-dropdown-trigger]")
      )
        dd.classList.remove("show");
    });
  });

  // Email badge live update - listen to datachange and custom email:counts
  window.addEventListener("studypod:datachange", (e) => {
    const col = e.detail?.collection;
    if (col === "emails" || col === "all") {
      try {
        const Store = window.Store;
        if (!Store) return;
        const unread = Store.filter(
          "emails",
          (em) => em.folder === "inbox" && !em.read,
        ).length;
        const badge = document.getElementById("email-badge");
        if (badge) {
          if (unread > 0) {
            badge.textContent = unread;
            badge.style.display = "inline-flex";
          } else badge.style.display = "none";
        }
        const notifBadge = document.getElementById("notif-badge");
        if (notifBadge)
          notifBadge.style.display = unread > 0 ? "block" : "none";
      } catch (err) {}
    }
  });

  window.addEventListener("email:counts", (e) => {
    try {
      const counts = e.detail;
      if (!counts) return;
      const badge = document.getElementById("email-badge");
      if (badge) {
        if (counts.unread > 0) {
          badge.textContent = counts.unread;
          badge.style.display = "inline-flex";
        } else badge.style.display = "none";
      }
      const notifBadge = document.getElementById("notif-badge");
      if (notifBadge)
        notifBadge.style.display = counts.unread > 0 ? "block" : "none";
    } catch (err) {}
  });
})();
