/**
 * ==========================================================================
 * COMMON.JS - Shared Logic for Both Dashboard & Conferences Pages
 * ==========================================================================
 * Purpose: DRY - All functions used on BOTH pages live here.
 * This prevents duplication and makes collaboration easier.
 *
 * Contains:
 * - Theme Management (toggleTheme)
 * - Popovers (Notifications & Profile)
 * - Student Drawer (openStudent, closeStudent)
 * - Toast System (toast)
 * - Navigation helper (setActiveNav)
 * - Global event listeners (click outside to close popovers)
 *
 * Import: This file is loaded BEFORE page-specific JS files.
 * Dashboard page: common.js -> dashboard.js
 * Conferences page: common.js -> conferences.js
 * ==========================================================================
 */

/**
 * isDark - Global state for dark mode
 * false = light mode, true = dark mode
 * Shared across all pages, persisted only in memory (resets on page reload)
 */
let isDark = false;

/**
 * toggleTheme()
 * ----------------
 * Switches between light and dark mode.
 *
 * Steps:
 * 1. Flips isDark boolean
 * 2. Toggles 'dark' class on <html> and <body> (CSS uses body.dark selectors)
 * 3. Updates icons: moon (🌙) for light, sun (☀️) for dark in both header and sidebar
 * 4. If dashboard chart exists, redraws it with dark-mode colors
 *
 * Usage in HTML: onclick="toggleTheme()"
 */
function toggleTheme() {
  // Step 1: Flip the boolean state
  isDark = !isDark;

  // Step 2: Toggle 'dark' class on html and body for CSS theming
  document.documentElement.classList.toggle("dark", isDark);
  document.body.classList.toggle("dark", isDark);

  // Step 3: Update icons in header and sidebar
  const topIcon = document.getElementById("ico-top");
  const sideIcon = document.getElementById("ico-side");
  if (topIcon) topIcon.textContent = isDark ? "☀️" : "🌙";
  if (sideIcon) sideIcon.textContent = isDark ? "☀️" : "🌙";

  // Step 4: If drawChart exists (dashboard page), redraw with new colors
  if (typeof drawChart === "function") {
    drawChart();
  }
}

/**
 * toggleNotif()
 * ---------------
 * Shows/hides notification popover.
 * Hides profile popover to avoid overlap.
 * Triggered by bell icon in header.
 */
function toggleNotif() {
  const notifEl = document.getElementById("notif"); // Notification dropdown
  if (!notifEl) return;
  notifEl.classList.toggle("show"); // Toggle visibility via .show class
  // Hide other popover
  const profEl = document.getElementById("prof");
  if (profEl) profEl.classList.remove("show");
}

/**
 * toggleProfile()
 * ----------------
 * Shows/hides profile menu dropdown.
 * Hides notification popover.
 * Triggered by avatar in header.
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
 * -------------------------
 * Opens right-side drawer with student details.
 * @param {string} name - Full name, e.g. "Michael Johnson"
 * @param {string} init - Initials for avatar circle, e.g. "MJ"
 *
 * Usage: onclick="openStudent('Michael Johnson','MJ')" on table rows
 */
function openStudent(name, init) {
  // Set name in drawer header
  const nameEl = document.getElementById("d-name");
  if (nameEl) nameEl.textContent = name;

  // Set initials in avatar circle
  const avEl = document.getElementById("d-av");
  if (avEl) avEl.textContent = init;

  // Show drawer (CSS: display:block)
  const drawerEl = document.getElementById("drawer");
  if (drawerEl) drawerEl.classList.add("show");
}

/**
 * closeStudent()
 * ----------------
 * Closes student drawer.
 * Called by X button and backdrop click.
 */
function closeStudent() {
  const drawerEl = document.getElementById("drawer");
  if (drawerEl) drawerEl.classList.remove("show");
}

/**
 * toast(msg)
 * ----------
 * Shows small toast notification at bottom center.
 * @param {string} msg - Message to show, e.g. "Create Course"
 *
 * Adds " — coming soon" suffix, auto-hides after 2.5s
 * Used for features not yet implemented.
 */
function toast(msg) {
  const toastEl = document.getElementById("toast"); // Toast container
  const msgEl = document.getElementById("toast-msg"); // Text inside toast
  if (!toastEl || !msgEl) return;

  // Set message with suffix
  msgEl.textContent = msg + " — coming soon";

  // Show toast (opacity 1, translate 0)
  toastEl.classList.add("show");

  // Auto-hide after 2500ms
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2500);
}

/**
 * setActiveNav(page)
 * -------------------
 * Sets active state for sidebar and mobile nav based on current page.
 * @param {string} page - 'dashboard' or 'conferences'
 *
 * Adds 'active' class to current page buttons, removes from others.
 * Called on page load to highlight correct nav item.
 */
function setActiveNav(page) {
  const dashBtn = document.getElementById("nav-dash");
  const confBtn = document.getElementById("nav-conf");
  const mdash = document.getElementById("m-dash");
  const mconf = document.getElementById("m-conf");

  if (page === "dashboard") {
    if (dashBtn) dashBtn.className = "nav-btn active";
    if (confBtn) confBtn.className = "nav-btn";
    if (mdash) mdash.className = "mob-btn active";
    if (mconf) mconf.className = "mob-btn";
  } else if (page === "conferences") {
    if (confBtn) confBtn.className = "nav-btn active";
    if (dashBtn) dashBtn.className = "nav-btn";
    if (mconf) mconf.className = "mob-btn active";
    if (mdash) mdash.className = "mob-btn";
  }
}

/* ==========================================================================
   GLOBAL EVENT LISTENERS - Click outside to close popovers (Shared)
   ========================================================================== */

/**
 * Click outside handler:
 * - If click is outside #notif and not on bell button, hide notifications
 * - If click is outside #prof and not on avatar, hide profile
 * Gives natural dropdown behavior.
 */
document.addEventListener("click", (e) => {
  // Close notifications if clicked outside
  const notifEl = document.getElementById("notif");
  const notifTrigger = e.target.closest('[onclick="toggleNotif()"]');
  if (notifEl && !e.target.closest("#notif") && !notifTrigger) {
    notifEl.classList.remove("show");
  }

  // Close profile if clicked outside
  const profEl = document.getElementById("prof");
  const profTrigger =
    e.target.closest('[onclick="toggleProfile()"]') ||
    e.target.closest(".avatar-btn");
  if (profEl && !e.target.closest("#prof") && !profTrigger) {
    profEl.classList.remove("show");
  }
});

/**
 * Auto-enable dark mode if system prefers dark
 * Runs after short delay to avoid flash
 */
setTimeout(() => {
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    toggleTheme();
  }
}, 100);




/**
 * ==========================================================================
 *  - Modern Collapsible Aside Logic
 * ==========================================================================
 * Purpose: Adds modern icon-only collapse without touching existing code.
 * - Adds toggle button to sidebar
 * - Toggles .is-collapsed class
 * - Shows tooltips on hover when collapsed
 * - Persists state in localStorage
 * - Works on both dashboard (index.html) and conferences.html
 *
 * Integration: Include AFTER common.js, no edits to common.js needed
 *   <link rel="stylesheet" href="css/sidebar-collapsible.css">
 *   <script src="js/sidebar-collapsible.js"></script>
 *
 * Original code untouched - this is additive only
 * ==========================================================================
 */

(function () {
  const STORAGE_KEY = 'studypod_sidebar_collapsed';
  const COLLAPSED_CLASS = 'is-collapsed';
  const TOOLTIP_ID = 'sidebar-tooltip';

  let tooltipEl = null;
  let isCollapsed = false;

  /**
   * Create modern tooltip element (singleton)
   */
  function getTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.id = TOOLTIP_ID;
    tooltipEl.className = 'sidebar-tooltip';
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  /**
   * Get label text from nav button
   */
  function getNavLabel(btn) {
    // Try to find span that is not badge
    const spans = btn.querySelectorAll('span');
    for (const s of spans) {
      if (s.classList.contains('nav-badge')) continue;
      const txt = s.textContent.trim();
      if (txt) return txt;
    }
    // Fallback: textContent without badge
    const clone = btn.cloneNode(true);
    const badge = clone.querySelector('.nav-badge');
    if (badge) badge.remove();
    return clone.textContent.trim();
  }

  /**
   * Show tooltip
   */
  function showTooltip(btn) {
    if (!isCollapsed) return;
    const label = getNavLabel(btn);
    if (!label) return;
    const tip = getTooltip();
    tip.textContent = label;
    const rect = btn.getBoundingClientRect();
    tip.style.top = `${rect.top + rect.height / 2 - tip.offsetHeight / 2}px`;
    // left is handled by CSS, but ensure visible
    tip.classList.add('show');
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('show');
  }

  /**
   * Toggle sidebar collapsed state
   */
  function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    isCollapsed = !isCollapsed;
    sidebar.classList.toggle(COLLAPSED_CLASS, isCollapsed);
    // Persist
    try {
      localStorage.setItem(STORAGE_KEY, isCollapsed ? '1' : '0');
    } catch (e) {}
    // Accessibility
    const btn = document.getElementById('sidebar-collapse-btn');
    if (btn) {
      btn.setAttribute('aria-expanded', (!isCollapsed).toString());
      btn.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    }
    hideTooltip();
  }

  /**
   * Initialize collapse button and listeners
   */
  function initCollapsibleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const brand = document.querySelector('.sidebar-brand');
    if (!sidebar || !brand) return;

    // Restore state
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      isCollapsed = saved === '1';
    } catch (e) {
      isCollapsed = false;
    }

    // Avoid duplicate button
    if (document.getElementById('sidebar-collapse-btn')) return;

    // Create toggle button - modern chevron in circle
    const btn = document.createElement('button');
    btn.id = 'sidebar-collapse-btn';
    btn.className = 'sidebar-collapse-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', isCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
    btn.setAttribute('aria-expanded', (!isCollapsed).toString());
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
    `;

    // Make brand relatively positioned if not already (CSS already does)
    brand.style.position = 'relative';
    brand.appendChild(btn);

    // Apply initial collapsed state
    if (isCollapsed) {
      sidebar.classList.add(COLLAPSED_CLASS);
    }

    // Click handler
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    // Keyboard shortcut: [ to toggle (common in modern apps like Slack/Linear)
    document.addEventListener('keydown', (e) => {
      // Only if not typing in input
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      if (e.key === '[' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    });

    // Tooltip listeners for nav buttons - only when collapsed
    const navBtns = sidebar.querySelectorAll('.nav-btn');
    navBtns.forEach((navBtn) => {
      navBtn.addEventListener('mouseenter', () => {
        if (window.innerWidth <= 1024) return;
        if (isCollapsed) showTooltip(navBtn);
      });
      navBtn.addEventListener('mouseleave', hideTooltip);
      navBtn.addEventListener('focus', () => {
        if (window.innerWidth <= 1024) return;
        if (isCollapsed) showTooltip(navBtn);
      });
      navBtn.addEventListener('blur', hideTooltip);
    });

    // Hide tooltip on scroll or resize
    window.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('resize', hideTooltip);

    // Optional: Double-click sidebar to toggle (modern UX)
    sidebar.addEventListener('dblclick', (e) => {
      // Only toggle if double-clicking brand area or empty space, not buttons
      if (e.target.closest('.sidebar-brand') || e.target === sidebar || e.target.classList.contains('sidebar-nav')) {
        toggleSidebar();
      }
    });
  }

  // Init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCollapsibleSidebar);
  } else {
    initCollapsibleSidebar();
  }

  // Expose global for debugging (does not interfere)
  window.toggleSidebarCollapse = toggleSidebar;
})();
