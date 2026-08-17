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
