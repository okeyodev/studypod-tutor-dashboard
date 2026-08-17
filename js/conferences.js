/**
 * ==========================================================================
 * CONFERENCES.JS - Conferences Page Only (conferences.html)
 * ==========================================================================
 * Contains ONLY logic unique to conferences page.
 * Shared logic (theme, popovers, drawer, toast) is in common.js
 *
 * Current features:
 * - Sets active nav to conferences
 * - Handles conference actions (manage, share) - placeholder for future
 * - Could be extended with: conference filtering, search, registration logic
 *
 * DRY: If you add something used on dashboard page, move it to common.js
 * ==========================================================================
 */

/**
 * initConferences() - Initialize conferences page
 * Runs on page load
 * - Sets active nav to conferences
 * - Could initialize conference-specific features
 */
function initConferences() {
  // Highlight conferences nav in sidebar and mobile nav
  setActiveNav("conferences");

  // Future: Add conference-specific init here
  // Example: Load conferences from API, setup search, etc.
  console.log("Conferences page initialized - 3 upcoming, 2 past");
}

/**
 * handleConferenceAction(action, conferenceId)
 * --------------------------------------------
 * Placeholder for conference actions
 * @param {string} action - 'manage', 'share', 'edit', 'analytics'
 * @param {string} conferenceId - ID or title of conference
 *
 * Currently uses toast() from common.js for "coming soon" message
 * In real app, this would navigate or open modals
 */
function handleConferenceAction(action, conferenceId) {
  // For now, show toast notification
  toast(`${action} - ${conferenceId}`);

  // Future implementation ideas:
  // if(action === 'manage') { window.location.href = `/manage/${conferenceId}`; }
  // if(action === 'share') { navigator.clipboard.writeText(link); }
  // if(action === 'analytics') { openAnalyticsModal(conferenceId); }
}

/**
 * filterConferences(filter)
 * --------------------------
 * Placeholder for filtering conferences
 * @param {string} filter - 'upcoming', 'draft', 'past', 'all'
 *
 * Would hide/show conference cards based on status
 */
function filterConferences(filter) {
  console.log(`Filtering conferences by: ${filter}`);
  // Implementation would loop through .conf-item and show/hide based on data-status
  toast(`Filter: ${filter}`);
}

// Run init when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initConferences, 100);
});

// Also run if DOM already loaded
if (document.readyState !== "loading") {
  setTimeout(initConferences, 100);
}
