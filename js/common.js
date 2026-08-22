/**
 * ==========================================================================
 * COMMON.JS - Shared Logic for Both Dashboard & Conferences Pages
 * ==========================================================================
 * REFACTORED: Now with persistent theme across pages + reusable layout support
 *
 * Purpose: DRY - All functions used on ALL pages live here.
 * This prevents duplication and makes collaboration easier.
 *
 * Contains:
 * - Theme Management (persistent via localStorage)
 * - Popovers (Notifications & Profile)
 * - Student Drawer (openStudent, closeStudent)
 * - Toast System (toast)
 * - Navigation helper (setActiveNav) - now generic for future pages
 * - Global event listeners (click outside to close popovers)
 *
 * Theme Persistence:
 * - Uses localStorage key 'studypod_theme' = 'dark' | 'light'
 * - Early inline script in <head> prevents FOUC
 * - toggleTheme() updates localStorage, so all pages share same theme
 * - Storage event listener syncs theme across tabs/pages
 *
 * Import: This file is loaded BEFORE page-specific JS files AND layout.js
 * ==========================================================================
 */

const THEME_KEY = "studypod_theme";
const SIDEBAR_COLLAPSED_KEY = "studypod_sidebar_collapsed";

/**
 * isDark - Global state for dark mode
 * Now initialized from localStorage, not just memory
 */
let isDark = (() => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark") return true;
    if (saved === "light") return false;
    // No saved preference -> use system preference
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
})();

/**
 * getSavedTheme() - returns 'dark' or 'light' from storage or system
 */
function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch (e) {}
  return isDark ? "dark" : "light";
}

/**
 * applyTheme(theme, options)
 * Central function to apply theme to DOM
 * @param {string} theme - 'dark' or 'light'
 * @param {object} options - {save: boolean, redrawChart: boolean}
 */
function applyTheme(theme, options = {}) {
  const { save = true, redrawChart = true } = options;
  const dark = theme === "dark";
  isDark = dark;

  // Apply to html and body
  document.documentElement.classList.toggle("dark", dark);
  document.body.classList.toggle("dark", dark);

  // Update icons
  const topIcon = document.getElementById("ico-top");
  const sideIcon = document.getElementById("ico-side");
  if (topIcon) topIcon.textContent = dark ? "☀️" : "🌙";
  if (sideIcon) sideIcon.textContent = dark ? "☀️" : "🌙";

  // Persist
  if (save) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
  }

  // Update meta theme-color for mobile browsers
  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = dark ? "#0F172A" : "#F8FAFC";

  // Redraw chart if exists and allowed
  if (redrawChart && typeof drawChart === "function") {
    try {
      drawChart();
    } catch (e) {
      console.warn("drawChart failed on theme change", e);
    }
  }

  // Dispatch custom event so other components can react
  window.dispatchEvent(
    new CustomEvent("themechange", { detail: { theme, isDark: dark } }),
  );
}

/**
 * initTheme()
 * Call on page load to ensure theme is applied (also handled by inline head script for FOUC prevention)
 */
function initTheme() {
  const theme = getSavedTheme();
  applyTheme(theme, { save: false, redrawChart: false });
}

/**
 * toggleTheme()
 * Switches between light and dark mode and persists across all pages
 */
function toggleTheme() {
  const newTheme = isDark ? "light" : "dark";
  applyTheme(newTheme, { save: true, redrawChart: true });
}

/**
 * toggleNotif()
 * Shows/hides notification popover.
 */
function toggleNotif() {
  const notifEl = document.getElementById("notif");
  if (!notifEl) return;
  notifEl.classList.toggle("show");
  const profEl = document.getElementById("prof");
  if (profEl) profEl.classList.remove("show");
}

/**
 * toggleProfile()
 * Shows/hides profile menu dropdown.
 */
function toggleProfile() {
  const profEl = document.getElementById("prof");
  if (!profEl) return;
  profEl.classList.toggle("show");
  const notifEl = document.getElementById("notif");
  if (notifEl) notifEl.classList.remove("show");
}

/**
 * openStudent(name, init)
 */
function openStudent(name, init) {
  const nameEl = document.getElementById("d-name");
  if (nameEl) nameEl.textContent = name;
  const avEl = document.getElementById("d-av");
  if (avEl) avEl.textContent = init;
  const drawerEl = document.getElementById("drawer");
  if (drawerEl) drawerEl.classList.add("show");
}

/**
 * closeStudent()
 */
function closeStudent() {
  const drawerEl = document.getElementById("drawer");
  if (drawerEl) drawerEl.classList.remove("show");
}

/**
 * toast(msg)
 */
function toast(msg) {
  const toastEl = document.getElementById("toast");
  const msgEl = document.getElementById("toast-msg");
  if (!toastEl || !msgEl) return;
  msgEl.textContent = msg + " — coming soon";
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2500);
}

/**
 * setActiveNav(page)
 * Now generic: supports any page id, not just dashboard/conferences
 * @param {string} page - page id e.g. 'dashboard', 'conferences', 'courses', etc.
 *
 * Looks for:
 * - Sidebar: #nav-{id} or [data-nav-id="{id}"]
 * - Mobile: #m-{id} or [data-mob-id="{id}"]
 * Falls back to matching href if id not found
 */
function setActiveNav(page) {
  if (!page) return;
  const normalized = page.toLowerCase().trim();

  // Helper to set active class on a collection
  function updateActiveState(containerSelector, activeSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const allBtns = container.querySelectorAll(".nav-btn, .mob-btn");
    allBtns.forEach((btn) => {
      btn.classList.remove("active");
    });
  }

  // Sidebar nav
  const sidebar =
    document.querySelector(".sidebar-nav") ||
    document.getElementById("layout-sidebar");
  if (sidebar) {
    const allSidebarBtns = sidebar.querySelectorAll(".nav-btn");
    allSidebarBtns.forEach((btn) => {
      btn.classList.remove("active");
      // Check data attribute or id
      const btnId = btn.dataset.navId || btn.id.replace("nav-", "");
      if (btnId === normalized) {
        btn.classList.add("active");
      } else if (
        btn.getAttribute("href") &&
        btn.getAttribute("href").includes(normalized)
      ) {
        // Fallback: match href like conferences.html contains conferences
        if (
          normalized === "dashboard" &&
          btn.getAttribute("href").includes("index.html")
        ) {
          btn.classList.add("active");
        } else if (btn.getAttribute("href").includes(`${normalized}.html`)) {
          btn.classList.add("active");
        }
      }
    });
  }

  // Mobile nav
  const mobileNav =
    document.querySelector(".mobile-nav") ||
    document.getElementById("layout-mobile-nav");
  if (mobileNav) {
    const allMobBtns = mobileNav.querySelectorAll(".mob-btn");
    allMobBtns.forEach((btn) => {
      btn.classList.remove("active");
      const btnId = btn.dataset.mobId || btn.id.replace("m-", "");
      if (btnId === normalized) {
        btn.classList.add("active");
      } else if (
        btn.getAttribute("href") &&
        btn.getAttribute("href").includes(normalized)
      ) {
        if (
          normalized === "dashboard" &&
          btn.getAttribute("href").includes("index.html")
        ) {
          btn.classList.add("active");
        } else if (btn.getAttribute("href").includes(`${normalized}.html`)) {
          btn.classList.add("active");
        }
      }
    });
  }

  // Update breadcrumb if element exists and not manually set
  const crumb = document.getElementById("crumb");
  if (crumb && !crumb.dataset.manual) {
    crumb.textContent =
      normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  // Legacy support for old hardcoded ids
  const dashBtn = document.getElementById("nav-dash");
  const confBtn = document.getElementById("nav-conf");
  const mdash = document.getElementById("m-dash");
  const mconf = document.getElementById("m-conf");

  if (normalized === "dashboard") {
    if (dashBtn) dashBtn.classList.add("active");
    if (mdash) mdash.classList.add("active");
  } else if (normalized === "conferences") {
    if (confBtn) confBtn.classList.add("active");
    if (mconf) mconf.classList.add("active");
  }
}

/* ==========================================================================
   GLOBAL EVENT LISTENERS
   ========================================================================== */

document.addEventListener("click", (e) => {
  const notifEl = document.getElementById("notif");
  const notifTrigger =
    e.target.closest('[onclick="toggleNotif()"]') ||
    e.target.closest('[data-action="notif"]');
  if (notifEl && !e.target.closest("#notif") && !notifTrigger) {
    notifEl.classList.remove("show");
  }

  const profEl = document.getElementById("prof");
  const profTrigger =
    e.target.closest('[onclick="toggleProfile()"]') ||
    e.target.closest(".avatar-btn") ||
    e.target.closest('[data-action="profile"]');
  if (profEl && !e.target.closest("#prof") && !profTrigger) {
    profEl.classList.remove("show");
  }
});

// Sync theme across tabs/pages when localStorage changes
window.addEventListener("storage", (e) => {
  if (e.key === THEME_KEY && e.newValue) {
    if (e.newValue !== getSavedTheme() || (e.newValue === "dark") !== isDark) {
      applyTheme(e.newValue, { save: false, redrawChart: true });
    }
  }
});

// Initialize theme as soon as possible
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // Small delay to let layout.js inject first if needed
    setTimeout(() => initTheme(), 10);
  });
} else {
  setTimeout(() => initTheme(), 10);
}

// Also apply immediately if DOM already has body (for FOUC prevention fallback)
try {
  initTheme();
} catch (e) {}

/* ==========================================================================
   Modern Collapsible Sidebar Logic - Persists across pages
   ========================================================================== */
(function () {
  const STORAGE_KEY = SIDEBAR_COLLAPSED_KEY;
  const COLLAPSED_CLASS = "is-collapsed";
  const TOOLTIP_ID = "sidebar-tooltip";

  let tooltipEl = null;
  let isCollapsed = false;

  function getTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.id = TOOLTIP_ID;
    tooltipEl.className = "sidebar-tooltip";
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function getNavLabel(btn) {
    const spans = btn.querySelectorAll("span");
    for (const s of spans) {
      if (s.classList.contains("nav-badge")) continue;
      const txt = s.textContent.trim();
      if (txt) return txt;
    }
    const clone = btn.cloneNode(true);
    const badge = clone.querySelector(".nav-badge");
    if (badge) badge.remove();
    return clone.textContent.trim();
  }

  function showTooltip(btn) {
    if (!isCollapsed) return;
    const label = getNavLabel(btn);
    if (!label) return;
    const tip = getTooltip();
    tip.textContent = label;
    const rect = btn.getBoundingClientRect();
    tip.style.top = `${rect.top + rect.height / 2 - tip.offsetHeight / 2}px`;
    tip.classList.add("show");
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove("show");
  }

  function toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    isCollapsed = !isCollapsed;
    sidebar.classList.toggle(COLLAPSED_CLASS, isCollapsed);
    try {
      localStorage.setItem(STORAGE_KEY, isCollapsed ? "1" : "0");
    } catch (e) {}
    const btn = document.getElementById("sidebar-collapse-btn");
    if (btn) {
      btn.setAttribute("aria-expanded", (!isCollapsed).toString());
      btn.setAttribute(
        "aria-label",
        isCollapsed ? "Expand sidebar" : "Collapse sidebar",
      );
    }
    hideTooltip();
  }

  function initCollapsibleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const brand = document.querySelector(".sidebar-brand");
    if (!sidebar || !brand) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      isCollapsed = saved === "1";
    } catch (e) {
      isCollapsed = false;
    }

    if (document.getElementById("sidebar-collapse-btn")) return;

    const btn = document.createElement("button");
    btn.id = "sidebar-collapse-btn";
    btn.className = "sidebar-collapse-btn";
    btn.type = "button";
    btn.setAttribute(
      "aria-label",
      isCollapsed ? "Expand sidebar" : "Collapse sidebar",
    );
    btn.setAttribute("aria-expanded", (!isCollapsed).toString());
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
    `;

    brand.style.position = "relative";
    brand.appendChild(btn);

    if (isCollapsed) {
      sidebar.classList.add(COLLAPSED_CLASS);
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    document.addEventListener("keydown", (e) => {
      const tag = document.activeElement?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        document.activeElement?.isContentEditable
      )
        return;
      if (e.key === "[" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    });

    const navBtns = sidebar.querySelectorAll(".nav-btn");
    navBtns.forEach((navBtn) => {
      navBtn.addEventListener("mouseenter", () => {
        if (window.innerWidth <= 1024) return;
        if (isCollapsed) showTooltip(navBtn);
      });
      navBtn.addEventListener("mouseleave", hideTooltip);
      navBtn.addEventListener("focus", () => {
        if (window.innerWidth <= 1024) return;
        if (isCollapsed) showTooltip(navBtn);
      });
      navBtn.addEventListener("blur", hideTooltip);
    });

    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);

    sidebar.addEventListener("dblclick", (e) => {
      if (
        e.target.closest(".sidebar-brand") ||
        e.target === sidebar ||
        e.target.classList.contains("sidebar-nav")
      ) {
        toggleSidebar();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCollapsibleSidebar);
  } else {
    initCollapsibleSidebar();
  }

  // Also re-init when layout is injected (for new reusable system)
  window.addEventListener("layout:ready", initCollapsibleSidebar);
  window.addEventListener("layout:sidebarRendered", initCollapsibleSidebar);

  window.toggleSidebarCollapse = toggleSidebar;
})();

/* ==========================================================================
   LAYOUT.JS MERGED INTO COMMON.JS - Reusable Header/Sidebar/Bottom Nav
   (Previously separate file, now consolidated per user request)
   ========================================================================== */

/**
 * ==========================================================================
 * LAYOUT.JS - Reusable Layout System for studyPod
 * ==========================================================================
 * Purpose: Eliminate duplication of header, sidebar, and bottom navigation.
 * Any future page just needs to include this file + call initLayout().
 *
 * Features:
 * - Single source of truth for sidebar, header, mobile nav, overlays
 * - Active state auto-detected from URL or passed explicitly
 * - Theme toggle consistent (uses common.js persistent theme)
 * - Shared navigation markup follows the student dashboard structure
 *
 * Usage for any page (including future pages):
 *
 * 1. In HTML, add placeholders:
 *    <div id="layout-sidebar"></div>
 *    <div id="layout-header"></div>
 *    <div id="layout-mobile-nav"></div>
 *    <div id="layout-overlays"></div>
 *
 * 2. At bottom, after common.js:
 *    <script src="js/layout.js"></script>
 *    <script>
 *      Layout.initLayout({
 *        active: 'dashboard', // or 'conferences', 'courses', etc.
 *        breadcrumb: { parent: 'Dashboard', current: 'Overview' },
 *        pageTitle: 'Dashboard'
 *      });
 *    </script>
 *
 * 3. That's it - header, sidebar, bottom nav auto-injected
 *
 * To add a new page:
 * - Add new navigation links directly in renderSidebar/renderMobileNav
 *
 * ==========================================================================
 */

(function () {
  "use strict";

  const appRoot = () =>
    window.location.pathname.toLowerCase().includes("/pages/") ? "../" : "./";
  const sitePath = (file) => `${appRoot()}${file}`;
  const pagePath = (file) =>
    appRoot() === "../" ? file : `pages/${file}`;

  // ==================== ICONS - Single source ====================
  const ICONS = {
    dashboard: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
        <rect x="3" y="3" width="7" height="7" rx="2.2" class="anim-dash-1"></rect>
        <rect x="14" y="3" width="7" height="7" rx="2.2" class="anim-dash-2"></rect>
        <rect x="14" y="14" width="7" height="7" rx="2.2" class="anim-dash-3"></rect>
        <rect x="3" y="14" width="7" height="7" rx="2.2" class="anim-dash-4"></rect>
      </svg>`,
    home: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
        <path d="M3.5 9.5L12 3l8.5 6.5V20a1.5 1.5 0 0 1-1.5 1.5H10V14a1.5 1.5 0 0 0-1.5-1.5h-1A1.5 1.5 0 0 0 6 14v7.5H4.5A1.5 1.5 0 0 1 3 20V9.5Z" class="anim-home"></path>
        <path d="M9 21.5V14" opacity=".6"></path>
      </svg>`,
    courses: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" class="anim-course"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"></path>
        <path d="M8 7h8" opacity=".5"></path>
        <path d="M8 11h5" opacity=".3"></path>
      </svg>`,
    students: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
        <path d="M12 3L2.5 8 12 13l9.5-5L12 3Z" class="anim-cap"></path>
        <path d="M6 12.2v2.6c2.4 1.9 9.6 1.9 12 0v-2.6"></path>
        <path d="M12 13v4" class="anim-tassel"></path>
        <circle cx="12" cy="18.8" r="0.9" fill="currentColor" class="anim-dot"></circle>
      </svg>`,
    assignments: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path>
        <rect x="9" y="2" width="6" height="4" rx="1.3"></rect>
        <path d="m9 14 1.8 1.8L15 11.5" class="anim-check"></path>
      </svg>`,
    conferences: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
        <rect x="1.5" y="5.5" width="13.5" height="13" rx="2.5"></rect>
        <path d="M15.5 9.5 22 7v10l-6.5-2.5v-5Z" class="anim-video"></path>
        <circle cx="5.5" cy="9" r="1" fill="currentColor" class="anim-live-dot"></circle>
      </svg>`,
    messages: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
        <path d="M7.5 20.5A9 9 0 0 1 3.2 16L2 22l6-2.1A9 9 0 0 0 17.2 9.2 9 9 0 0 0 7.5 20.5Z"></path>
        <circle cx="8" cy="12.5" r="1" fill="currentColor" class="anim-msg-1"></circle>
        <circle cx="12" cy="12.5" r="1" fill="currentColor" class="anim-msg-2"></circle>
        <circle cx="16" cy="12.5" r="1" fill="currentColor" class="anim-msg-3"></circle>
      </svg>`,
    analytics: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
        <rect x="3" y="12" width="4" height="9" rx="1.2" class="anim-bar-1"></rect>
        <rect x="10" y="7" width="4" height="14" rx="1.2" class="anim-bar-2"></rect>
        <rect x="17" y="3" width="4" height="18" rx="1.2" class="anim-bar-3"></rect>
      </svg>`,
    settings: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
        <circle cx="12" cy="12" r="3.2" class="anim-gear-center"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H1.5a2 2 0 0 1 0-4H3A1.65 1.65 0 0 0 4.68 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V1.5a2 2 0 0 1 4 0V3a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-1.5a1.65 1.65 0 0 0-1.1.32Z" class="anim-gear"></path>
      </svg>`,
    help: `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="nav-icon">
        <circle cx="12" cy="12" r="9" class="anim-help-ring"></circle>
        <path d="M9.2 9.2a3.8 3.8 0 0 1 5.4 5.4c-.6.6-1 1-1.5 1.7-.3.6-.5 1.1-.5 1.9" class="anim-help-q"></path>
        <circle cx="12" cy="17.8" r="1" fill="currentColor" class="anim-help-dot"></circle>
      </svg>`,
  };

  // ==================== RENDER FUNCTIONS ====================

  function renderSidebar(activeId) {
    const brandHTML = `
      <div class="sidebar-brand">
        <div class="logo-box"><img src="${sitePath("image/studyPod_logo_pra.png")}" alt="studyPod_logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
        </div>
        <span class="brand-name">studyPod</span>
        <span class="dot"></span>
      </div>`;

    const navHTML = `
      <nav class="sidebar-nav">
        <a href="${sitePath("index.html")}" id="nav-dash" class="nav-btn">${ICONS.dashboard}<span>Dashboard</span></a>
        <div class="nav-group-title">Teaching</div>
        <button class="nav-btn" onclick="toast('Courses')">${ICONS.courses}<span>Courses</span></button>
        <button class="nav-btn" onclick="toast('Students')">${ICONS.students}<span>Students</span></button>
        <button class="nav-btn" onclick="toast('Assignments')">${ICONS.assignments}<span>Assignments</span></button>
        <a href="${pagePath("conferences.html")}" id="nav-conf" class="nav-btn">${ICONS.conferences}<span>Conferences</span><span class="nav-badge">NEW</span></a>
        <div class="nav-group-title">Communication</div>
        <a class="nav-btn" onclick="toast('Messages')">${ICONS.messages}<span>Messages</span><span class="nav-badge red">5</span></a>
        <div class="nav-group-title">Insights</div>
        <a class="nav-btn" onclick="toast('Analytics')">${ICONS.analytics}<span>Analytics</span></a>
        <a class="nav-btn" onclick="toast('Settings')">${ICONS.settings}<span>Settings</span></a>
        <a class="nav-btn" onclick="toast('Help &amp; Support')">${ICONS.help}<span>Help &amp; Support</span></a>
      </nav>`;

    const userCardHTML = `
      <div>
        <div class="user-card">
          <div class="user-avatar">SD</div>
          <div class="user-info">
            <div class="user-name">Sarah Davis</div>
            <div class="user-role">Tutor</div>
          </div>
        </div>
      </div>`;

    return `
      <aside class="sidebar">
        ${brandHTML}
        ${navHTML}
        ${userCardHTML}
      </aside>
    `;
  }

  function renderHeader(
    breadcrumb = { parent: "Dashboard", current: "Overview" },
  ) {
    return `
      <header class="header">
        <div class="header-left-mobile">
          <div class="logo-box"><img src="${sitePath("image/studyPod_logo_pra.png")}" alt="StudyPod Logo" onerror="this.style.display='none'">
          </div>
          <span style="font-weight:700">studyPod</span>
        </div>

        <div class="breadcrumb"><span>${breadcrumb.parent}</span><span>›</span><span id="crumb" class="active" data-manual="${breadcrumb.manual ? "true" : "false"}">${breadcrumb.current}</span></div>

        <div class="header-actions">
          <button onclick="toggleTheme()" class="header-btn" aria-label="Toggle theme"><span id="ico-top">🌙</span></button>
          <button onclick="toggleNotif()" class="header-btn" aria-label="Notifications" data-action="notif">🔔<span class="notif-dot"></span></button>
          <div onclick="toggleProfile()" class="avatar-btn" data-action="profile">SD</div>
        </div>

        <div id="notif" class="popover">
          <div class="popover-title">Notifications</div>
          <div class="popover-item">
            <div class="popover-dot blue"></div>
            <div>
              <div style="font-weight:500">New assignment submission</div>
              <div class="popover-meta">Ava Kim — UX Design #4</div>
            </div>
          </div>
          <div class="popover-item">
            <div class="popover-dot green"></div>
            <div>
              <div style="font-weight:500">Conference reminder</div>
              <div class="popover-meta">React Masterclass tomorrow 4PM</div>
            </div>
          </div>
        </div>

        <div id="prof" class="popover small">
          <div style="padding:12px">
            <div style="font-weight:600;font-size:14px">Sarah Davis</div>
            <div style="font-size:12px;color:#64748B">sarah@estudy.com • Tutor</div>
          </div>
          <div class="popover-divider">
            <button class="popover-link">View Profile</button>
            <button class="popover-link">Account Settings</button>
            <button class="popover-link danger">Log out</button>
          </div>
        </div>
      </header>
    `;
  }

  function renderMobileNav(activeId) {
    return `
      <nav class="mobile-nav">
        <a href="${sitePath("index.html")}" id="m-dash" class="mob-btn">${ICONS.home}<span>Home</span></a>
        <button class="mob-btn" onclick="toast('Courses')">${ICONS.courses}<span>Courses</span></button>
        <button class="mob-btn" onclick="toast('Students')">${ICONS.students}<span>Students</span></button>
        <a href="${pagePath("conferences.html")}" id="m-conf" class="mob-btn">${ICONS.conferences}<span>Conf</span></a>
        <button class="mob-btn" onclick="toast('Messages')">${ICONS.messages}<span>Messages</span><span class="mob-dot"></span></button>
      </nav><div style="height:72px" class="mobile-spacer"></div>`;
  }

  function renderOverlays() {
    return `
      <div id="drawer" class="drawer">
        <div class="drawer-backdrop" onclick="closeStudent()"></div>
        <div class="drawer-panel">
          <div class="drawer-head">
            <div class="drawer-user">
              <div id="d-av" class="drawer-av">MJ</div>
              <div>
                <div id="d-name" class="drawer-name">Michael Johnson</div>
                <div class="drawer-meta">Student • Joined Sep 2024</div>
              </div>
            </div>
            <button onclick="closeStudent()" class="drawer-close">✕</button>
          </div>
          <div class="drawer-section">
            <div class="drawer-label">Overall Progress</div>
            <div class="drawer-progress-title">92% completed</div>
            <div class="track" style="margin-top:8px;height:8px">
              <div class="fill fill-blue" style="width:92%;height:8px"></div>
            </div>
          </div>
          <div class="drawer-section">
            <div class="drawer-box">
              <div class="drawer-course-icon">📚</div>
              <div>
                <div style="font-size:13px;font-weight:500">Python for Data Science</div>
                <div style="font-size:11px;color:#94A3B8">8 modules • 24 lessons</div>
              </div>
            </div>
          </div>
          <button class="drawer-btn">Send Message</button>
        </div>
      </div>

      <div id="toast" class="toast"><span class="toast-dot"></span><span id="toast-msg">Action</span></div>
    `;
  }

  // Auto-detect active page from URL
  function detectActiveFromURL() {
    const path = window.location.pathname.toLowerCase();
    const file = path.split("/").pop() || "index.html";

    if (file.includes("conference")) return "conferences";
    if (file.includes("index") || file === "" || file === "dashboard")
      return "dashboard";
    if (file.includes("course")) return "courses";
    if (file.includes("student")) return "students";
    if (file.includes("assignment")) return "assignments";
    if (file.includes("message")) return "messages";
    if (file.includes("analytic")) return "analytics";
    if (file.includes("setting")) return "settings";

    // Try to extract name without extension
    const name = file.replace(".html", "");
    if (name) return name;
    return "dashboard";
  }

  function initLayout(config = {}) {
    const activeId = config.active || detectActiveFromURL();
    const breadcrumb = config.breadcrumb || {
      parent: activeId === "conferences" ? "Teaching" : "Dashboard",
      current: activeId.charAt(0).toUpperCase() + activeId.slice(1),
      manual: false,
    };

    // Support legacy breadcrumb object with parent/current
    if (typeof config.breadcrumb === "string") {
      breadcrumb.current = config.breadcrumb;
    }

    const sidebarEl = document.getElementById("layout-sidebar");
    const headerEl = document.getElementById("layout-header");
    const mobileEl = document.getElementById("layout-mobile-nav");
    const overlaysEl = document.getElementById("layout-overlays");

    // New reusable system (placeholders exist)
    if (sidebarEl) {
      sidebarEl.innerHTML = renderSidebar(activeId);
      window.dispatchEvent(new CustomEvent("layout:sidebarRendered"));
    }
    if (headerEl) {
      headerEl.innerHTML = renderHeader(breadcrumb);
    }
    if (mobileEl) {
      mobileEl.innerHTML = renderMobileNav(activeId);
    }
    if (overlaysEl) {
      overlaysEl.innerHTML = renderOverlays();
    }

    // If no placeholders, we're on legacy page - do nothing, let existing HTML stay
    // But still ensure active states are correct
    if (!sidebarEl && !headerEl) {
      setActiveNav(activeId);
    }

    // If placeholders exist, ensure body has .app structure
    // (already in template)

    window.dispatchEvent(
      new CustomEvent("layout:ready", { detail: { activeId, breadcrumb } }),
    );

    // Also init theme icons after layout rendered
    setTimeout(() => {
      if (typeof initTheme === "function") {
        initTheme();
      } else if (typeof applyTheme === "function") {
        const saved =
          localStorage.getItem("studypod_theme") ||
          (window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light");
        applyTheme(saved, { save: false, redrawChart: false });
      }
    }, 0);

    console.log(`[Layout] Initialized - active: ${activeId}`, config);
  }

  // Expose globally
  window.Layout = {
    initLayout,
    renderSidebar,
    renderHeader,
    renderMobileNav,
    renderOverlays,
    detectActiveFromURL,
    ICONS,
  };

  // Auto-init if data-auto attribute is present
  document.addEventListener("DOMContentLoaded", () => {
    const autoEl = document.querySelector("[data-layout-auto]");
    if (autoEl) {
      const active =
        autoEl.getAttribute("data-layout-auto") || detectActiveFromURL();
      initLayout({ active });
      return;
    }

    const active = detectActiveFromURL();
    initLayout({
      active,
      breadcrumb:
        active === "conferences"
          ? { parent: "Teaching", current: "Conferences" }
          : { parent: "Dashboard", current: "Overview" },
    });
  });
})();
