/**
 * CONFERENCES.JS - Optimized DRY, no console.log, light
 */

function initConferences() {
  setActiveNav("conferences");
}

function handleConferenceAction(action, conferenceId) {
  toast(`${action} - ${conferenceId}`);
}

function filterConferences(filter) {
  toast(`Filter: ${filter}`);
}

document.addEventListener("DOMContentLoaded", () =>
  setTimeout(initConferences, 100),
);
if (document.readyState !== "loading") setTimeout(initConferences, 100);
