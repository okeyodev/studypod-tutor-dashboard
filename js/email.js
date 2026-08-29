/**
 * EMAIL.JS - StudyPod Tutor Dashboard v2.0
 * Full CRUD for emails collection via centralized Store (window.Store)
 * Fields: id, from, fromEmail, to, toEmail, subject, preview, body, folder, read, starred, createdAt
 * Folders: inbox, unread (inbox && !read), sent, drafts, trash, starred
 * Features: search, star, read/unread toggle, delete -> trash / permanent, counts, compose, reply, draft persist
 */

(function () {
  "use strict";

  const COLLECTION = "emails";
  const DEFAULT_FOLDER = "inbox";
  const COMPOSE_LOCAL_KEY = "studypod_compose_draft";
  const DRAFT_EDIT_KEY = "studypod_last_draft_id";

  let currentFolder = DEFAULT_FOLDER;
  let searchQuery = "";

  // ---------- helpers ----------
  const safeEscape = (str) => {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(str);
    if (typeof str !== "string") return str;
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  };

  const safeToast = (msg, type = "info") => {
    if (typeof window.toast === "function") window.toast(msg, type);
    else console.log("[toast]", msg);
  };

  const safeFormatDateTime = (iso) => {
    if (typeof window.formatDateTime === "function")
      return window.formatDateTime(iso);
    if (typeof window.formatDate === "function") return window.formatDate(iso);
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return iso || "";
    }
  };

  const formatListDate = (iso) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24 && d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch (e) {
      return safeFormatDateTime(iso);
    }
  };

  const getInitials = (name) => {
    if (!name) return "??";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const PALETTE = [
    "#2563EB",
    "#7C3AED",
    "#059669",
    "#DB2777",
    "#EA580C",
    "#0891B2",
    "#4338CA",
    "#BE185D",
  ];
  const getAvatarColor = (str) => {
    const s = String(str || "U");
    let hash = 0;
    for (let i = 0; i < s.length; i++)
      hash = (hash * 31 + s.charCodeAt(i)) % 100000;
    return PALETTE[hash % PALETTE.length];
  };

  const getStore = () => window.Store || null;

  const parseParam = (key) => {
    try {
      return new URLSearchParams(window.location.search).get(key);
    } catch (e) {
      return null;
    }
  };

  // ---------- counts ----------
  function updateCounts() {
    const Store = getStore();
    if (!Store) return;
    const all = Store.get(COLLECTION) || [];

    const counts = {
      inbox: all.filter((e) => e.folder === "inbox").length,
      unread: all.filter((e) => e.folder === "inbox" && !e.read).length,
      sent: all.filter((e) => e.folder === "sent").length,
      drafts: all.filter((e) => e.folder === "drafts").length,
      trash: all.filter((e) => e.folder === "trash").length,
      starred: all.filter((e) => !!e.starred && e.folder !== "trash").length,
    };

    const idMap = {
      "count-inbox": counts.inbox,
      "count-unread": counts.unread,
      "count-sent": counts.sent,
      "count-drafts": counts.drafts,
      "count-draft": counts.drafts,
      "count-trash": counts.trash,
      "count-starred": counts.starred,
      "count-star": counts.starred,
    };

    Object.entries(idMap).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = String(val);
      // Always show, but hide if you want badge logic - we show always for clarity
      el.style.display = "inline-flex";
      // For unread badge, hide when 0 in header contexts
      if (id === "count-unread" && val === 0) {
        // Keep visible in sidebar? The spec has 0 initially. Show as 0.
        el.style.display = "inline-flex";
      }
    });

    // Header/email-badge - sidebar and header
    const badge = document.getElementById("email-badge");
    if (badge) {
      if (counts.unread > 0) {
        badge.textContent = String(counts.unread);
        badge.style.display = "inline-flex";
      } else {
        badge.style.display = "none";
      }
    }
    const notifBadge = document.getElementById("notif-badge");
    if (notifBadge) {
      notifBadge.style.display = counts.unread > 0 ? "block" : "none";
    }
    // Also update any other unread badges
    const altBadges = document.querySelectorAll("[data-unread-badge]");
    altBadges.forEach((b) => {
      if (counts.unread > 0) {
        b.textContent = String(counts.unread);
        b.style.display = "inline-flex";
      } else {
        b.style.display = "none";
      }
    });

    // Dispatch events for other components (header, sidebar) to sync
    window.dispatchEvent(new CustomEvent("email:counts", { detail: counts }));
    // Also trigger datachange for common.js listener
    try {
      window.dispatchEvent(
        new CustomEvent("studypod:datachange", {
          detail: { collection: "emails" },
        }),
      );
    } catch (e) {}
  }

  // ---------- folder detection ----------
  function detectFolder() {
    const Store = getStore();
    if (!Store) return DEFAULT_FOLDER;

    const paramFolder = parseParam("folder");
    const validFolders = [
      "inbox",
      "unread",
      "sent",
      "drafts",
      "trash",
      "starred",
    ];
    if (paramFolder && validFolders.includes(paramFolder)) return paramFolder;

    const path = window.location.pathname.toLowerCase();
    if (path.includes("email-sent")) return "sent";
    if (path.includes("email-drafts") || path.includes("draft")) {
      // If it's compose page, folder irrelevant, but for list pages:
      if (path.includes("compose")) return null;
      if (path.includes("draft")) return "drafts";
    }
    if (path.includes("trash")) return "trash";
    if (path.includes("starred")) return "starred";
    if (path.includes("unread")) return "unread";
    if (path.includes("inbox")) return "inbox";

    const activeNav = document.querySelector(".email-nav.active[data-folder]");
    if (activeNav) {
      const f = activeNav.getAttribute("data-folder");
      if (validFolders.includes(f)) return f;
    }

    return DEFAULT_FOLDER;
  }

  function initFolderNav() {
    const navs = document.querySelectorAll(".email-nav[data-folder]");
    const detected = detectFolder();
    if (detected) currentFolder = detected;

    if (!navs.length) return;

    navs.forEach((btn) => {
      const folder = btn.getAttribute("data-folder");
      if (folder === currentFolder) btn.classList.add("active");
      else btn.classList.remove("active");

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        navs.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFolder = btn.getAttribute("data-folder");

        // Update toolbar title if present
        const toolbarTitle = document.querySelector(".email-main .email-title");
        if (toolbarTitle) {
          const labels = {
            inbox: "Inbox",
            unread: "Unread",
            sent: "Sent",
            drafts: "Drafts",
            trash: "Trash",
            starred: "Starred",
          };
          // Preserve #email-count span if inside
          if (toolbarTitle.querySelector("#email-count")) {
            // title is separate - set first text node
            toolbarTitle.childNodes.forEach((n) => {
              if (n.nodeType === 3)
                n.textContent = (labels[currentFolder] || currentFolder) + " ";
            });
            // Fallback
            if (!toolbarTitle.textContent.trim())
              toolbarTitle.textContent = labels[currentFolder] || currentFolder;
          } else {
            toolbarTitle.textContent = labels[currentFolder] || currentFolder;
          }
        }

        const url = new URL(window.location.href);
        url.searchParams.set("folder", currentFolder);
        history.replaceState(null, "", url.toString());

        renderList();
        window.dispatchEvent(
          new CustomEvent("email:folderchange", {
            detail: { folder: currentFolder },
          }),
        );
      });
    });
  }

  // ---------- search ----------
  function initSearch() {
    const input = document.getElementById("email-search");
    if (!input) return;

    const qParam = parseParam("q") || parseParam("search");
    if (qParam) {
      input.value = qParam;
      searchQuery = qParam.trim();
    }

    let debounceTimer;
    input.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = e.target.value.trim();
        renderList();
      }, 250);
    });
  }

  // ---------- list rendering ----------
  function getFilteredEmails() {
    const Store = getStore();
    if (!Store) return [];
    let emails = Store.get(COLLECTION) || [];

    // Folder logic
    emails = emails.filter((email) => {
      if (currentFolder === "unread")
        return email.folder === "inbox" && !email.read;
      if (currentFolder === "starred")
        return !!email.starred && email.folder !== "trash";
      return email.folder === currentFolder;
    });

    // Search logic (sender/subject/body)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      emails = emails.filter((email) => {
        return (
          (email.from && email.from.toLowerCase().includes(q)) ||
          (email.fromEmail && email.fromEmail.toLowerCase().includes(q)) ||
          (email.to && email.to.toLowerCase().includes(q)) ||
          (email.toEmail && email.toEmail.toLowerCase().includes(q)) ||
          (email.subject && email.subject.toLowerCase().includes(q)) ||
          (email.preview && email.preview.toLowerCase().includes(q)) ||
          (email.body && email.body.toLowerCase().includes(q))
        );
      });
    }

    // Sort newest first
    emails.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );
    return emails;
  }

  
  // ---------- Render List - REFACTORED for PHP deployment ----------
  // HTML moved to email.html <template id="email-item-template">
  // Logic preserved: avatar color, initials, sender, date, subject, preview, unread, starred, actions, reusable
  function renderList() {
    const container = document.getElementById("email-list");
    if (!container) return;

    const filtered = getFilteredEmails();

    const countEl = document.getElementById("email-count");
    if (countEl) {
      countEl.textContent = `${filtered.length} ${filtered.length === 1 ? "email" : "emails"}`;
    }

    if (!filtered.length) {
      const emptyMap = {
        inbox: "Inbox is empty",
        unread: "No unread emails — you're all caught up! ",
        sent: "No sent emails yet",
        drafts: "No drafts saved",
        trash: "Trash is empty",
        starred: "No starred emails",
      };
      const emptyTitle = emptyMap[currentFolder] || "No emails found";
      container.innerHTML = `
        <div class="empty-email">
          <div>
            <div style="font-size:36px;margin-bottom:12px">Inbox</div>
            <div style="font-weight:700;font-size:14px;margin-bottom:6px">${safeEscape(emptyTitle)}</div>
            <div style="font-size:13px;color:var(--text-secondary);max-width:320px;margin:0 auto">
              ${searchQuery ? `No results for "<strong>${safeEscape(searchQuery)}</strong>"` : "Your emails will appear here."}
            </div>
            <div style="margin-top:18px;display:flex;gap:8px;justify-content:center">
              ${searchQuery ? `<button class="email-button" onclick="document.getElementById('email-search').value=''; window.EmailApp && window.EmailApp.clearSearch()">Clear search</button>` : ""}
              <a href="email-compose.html" class="btn-primary" style="display:inline-flex;justify-content:center">+ Compose email</a>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const template = document.getElementById("email-item-template");
    container.innerHTML = "";

    if (template && template.content) {
      // PHP-ready path: clone from HTML template
      filtered.forEach((email) => {
        const isIncomingContext = currentFolder === "inbox" || currentFolder === "unread" || currentFolder === "starred" || email.folder === "inbox";
        const primaryNameRaw = isIncomingContext ? email.from || "Unknown" : email.to || email.toEmail || "Unknown";
        const displayNameRaw = primaryNameRaw;
        const displayName = displayNameRaw;
        const initials = getInitials(displayNameRaw);
        const color = getAvatarColor(displayNameRaw);
        const dateLabel = formatListDate(email.createdAt);
        const subject = email.subject || "(No subject)";
        const preview = email.preview || (email.body ? email.body.slice(0, 90) : "");
        const unreadClass = !email.read && email.folder === "inbox" ? "unread" : "";
        const starredChar = email.starred ? "Starred" : "Star";
        const starredTitle = email.starred ? "Unstar" : "Star";
        const readIcon = email.read ? "Inbox" : "";
        const readTitle = email.read ? "Mark unread" : "Mark read";
        const isTrash = email.folder === "trash";
        const clickAction = email.folder === "drafts" ? `window.EmailApp.openDraft('${email.id}')` : `window.EmailApp.openEmail('${email.id}')`;

        const clone = template.content.cloneNode(true);
        const itemEl = clone.querySelector(".email-item");
        if (!itemEl) return;

        itemEl.setAttribute("data-id", email.id);
        if (unreadClass) itemEl.classList.add(unreadClass);
        itemEl.setAttribute("onclick", clickAction);

        // Avatar
        const avatarEl = clone.querySelector(".email-avatar");
        if (avatarEl) {
          avatarEl.textContent = initials;
          avatarEl.style.background = color;
        }

        // Sender
        const senderEl = clone.querySelector(".email-sender");
        if (senderEl) {
          senderEl.textContent = displayName;
          senderEl.title = displayName;
        }

        // Date
        const dateEl = clone.querySelector(".email-date");
        if (dateEl) dateEl.textContent = dateLabel;

        // Star
        const starEl = clone.querySelector(".email-star");
        if (starEl) {
          starEl.textContent = starredChar;
          starEl.title = starredTitle;
          if (email.starred) starEl.classList.add("starred");
          starEl.setAttribute("onclick", `event.stopPropagation(); window.EmailApp.toggleStar('${email.id}', event)`);
        }

        // Subject - preserve bold logic for unread inbox
        const subjectEl = clone.querySelector(".email-subject");
        if (subjectEl) {
          subjectEl.textContent = subject;
          subjectEl.style.fontWeight = !email.read && email.folder === "inbox" ? "700" : "500";
        }

        // Preview
        const previewEl = clone.querySelector(".email-preview");
        if (previewEl) previewEl.textContent = preview;

        // Read button
        const readBtn = clone.querySelector(".email-read-btn");
        if (readBtn) {
          readBtn.textContent = readIcon;
          readBtn.title = readTitle;
          readBtn.setAttribute("onclick", `window.EmailApp.toggleRead('${email.id}', event)`);
        }

        // Delete button
        const deleteBtn = clone.querySelector(".email-delete-btn");
        if (deleteBtn) {
          if (isTrash) deleteBtn.classList.add("danger");
          deleteBtn.title = isTrash ? "Delete permanently" : "Move to trash";
          deleteBtn.setAttribute("onclick", `window.EmailApp.deleteEmail('${email.id}', event)`);
        }

        container.appendChild(clone);
      });
    } else {
      // Fallback: original string template
      container.innerHTML = filtered
        .map((email) => {
          const isIncomingContext = currentFolder === "inbox" || currentFolder === "unread" || currentFolder === "starred" || email.folder === "inbox";
          const primaryNameRaw = isIncomingContext ? email.from || "Unknown" : email.to || email.toEmail || "Unknown";
          const displayNameRaw = primaryNameRaw;
          const displayName = safeEscape(displayNameRaw);
          const initials = safeEscape(getInitials(displayNameRaw));
          const color = getAvatarColor(displayNameRaw);
          const dateLabel = safeEscape(formatListDate(email.createdAt));
          const subject = safeEscape(email.subject || "(No subject)");
          const preview = safeEscape(email.preview || (email.body ? email.body.slice(0, 90) : ""));
          const unreadClass = !email.read && email.folder === "inbox" ? "unread" : "";
          const starredChar = email.starred ? "Starred" : "Star";
          const starredTitle = email.starred ? "Unstar" : "Star";
          const readIcon = email.read ? "Inbox" : "";
          const readTitle = email.read ? "Mark unread" : "Mark read";
          const isTrash = email.folder === "trash";
          const clickAction = email.folder === "drafts" ? `window.EmailApp.openDraft('${safeEscape(email.id)}')` : `window.EmailApp.openEmail('${safeEscape(email.id)}')`;

          return `
        <div class="email-item ${unreadClass}" data-id="${safeEscape(email.id)}" onclick="${clickAction}">
          <div class="email-avatar" style="background:${color}">${initials}</div>
          <div class="email-item-body">
            <div class="email-item-top">
              <div class="email-sender" title="${displayName}">${displayName}</div>
              <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
                <span class="email-date">${dateLabel}</span>
                <span class="email-star ${email.starred ? "starred" : ""}" title="${safeEscape(starredTitle)}" style="font-size:16px;cursor:pointer;user-select:none" onclick="event.stopPropagation(); window.EmailApp.toggleStar('${safeEscape(email.id)}', event)">${starredChar}</span>
              </div>
            </div>
            <div class="email-subject" style="font-weight:${!email.read && email.folder === "inbox" ? "700" : "500"}">${subject}</div>
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:4px">
              <div class="email-preview" style="flex:1;min-width:0">${preview}</div>
              <div style="display:flex;gap:6px;flex-shrink:0" onclick="event.stopPropagation()">
                <button class="email-button" style="padding:5px 8px;font-size:11px;line-height:1" title="${safeEscape(readTitle)}" onclick="window.EmailApp.toggleRead('${safeEscape(email.id)}', event)">${readIcon}</button>
                <button class="email-button ${isTrash ? "danger" : ""}" style="padding:5px 8px;font-size:11px;line-height:1" title="${isTrash ? "Delete permanently" : "Move to trash"}" onclick="window.EmailApp.deleteEmail('${safeEscape(email.id)}', event)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
              </div>
            </div>
          </div>
        </div>
      `;
        })
        .join("");
    }
  }

  // ---------- actions ----------

  // ---------- actions ----------
  function openEmail(id) {
    const Store = getStore();
    if (!Store) return;
    const email = Store.getById(COLLECTION, id);
    if (!email) {
      safeToast("Email not found");
      return;
    }
    if (email.folder === "inbox" && !email.read) {
      Store.update(COLLECTION, id, { read: true });
      updateCounts();
    }
    window.location.href = `email-message.html?id=${encodeURIComponent(id)}`;
  }

  function openDraft(id) {
    window.location.href = `email-compose.html?draftId=${encodeURIComponent(id)}`;
  }

  function toggleStar(id, event, isDetail = false) {
    if (event) event.stopPropagation();
    const Store = getStore();
    const email = Store.getById(COLLECTION, id);
    if (!email) return;
    const updated = Store.update(COLLECTION, id, { starred: !email.starred });
    safeToast(
      updated.starred ? "Added to starred Starred" : "Removed from starred",
    );
    updateCounts();
    if (!isDetail) renderList();
    else initMessagePage(); // re-render message detail to reflect star state
  }

  function toggleRead(id, event, isDetail = false) {
    if (event) event.stopPropagation();
    const Store = getStore();
    const email = Store.getById(COLLECTION, id);
    if (!email) return;
    const updated = Store.update(COLLECTION, id, { read: !email.read });
    safeToast(updated.read ? "Marked as read" : "Marked as unread");
    updateCounts();
    if (!isDetail) renderList();
    else initMessagePage();
  }

  function deleteEmail(id, event, isDetail = false) {
    if (event) event.stopPropagation();
    const Store = getStore();
    const email = Store.getById(COLLECTION, id);
    if (!email) return;

    if (email.folder === "trash") {
      // Permanent delete
      const doDelete = () => {
        Store.delete(COLLECTION, id);
        safeToast("Email deleted permanently");
        updateCounts();
        if (isDetail) {
          window.location.href = "email.html?folder=trash";
        } else {
          renderList();
        }
      };
      if (typeof window.confirmDelete === "function") {
        window
          .confirmDelete(
            "Permanently delete this email? This cannot be undone.",
            "Delete permanently?",
          )
          .then((confirmed) => {
            if (confirmed) doDelete();
          });
      } else {
        if (window.confirm("Permanently delete this email?")) doDelete();
      }
    } else {
      Store.update(COLLECTION, id, {
        folder: "trash",
        updatedAt: new Date().toISOString(),
      });
      safeToast("Moved to Trash");
      updateCounts();
      if (isDetail) {
        setTimeout(() => {
          window.location.href = "email.html?folder=inbox";
        }, 400);
      } else {
        renderList();
      }
    }
  }

  function forwardEmail(id) {
    window.location.href = `email-compose.html?forward=${encodeURIComponent(id)}`;
  }

  function clearSearch() {
    const input = document.getElementById("email-search");
    if (input) input.value = "";
    searchQuery = "";
    renderList();
  }

  // ---------- message detail page ----------
  function initMessagePage() {
    const container = document.getElementById("email-message");
    if (!container) return;

    const Store = getStore();
    const id = parseParam("id");
    if (!id) {
      container.innerHTML = `
        <div class="empty-email"><div>
          <div style="font-size:36px">Inbox</div>
          <div style="margin-top:14px;font-weight:600">No email selected</div>
          <a href="email.html" class="btn-primary" style="margin-top:16px;display:inline-flex">Back to Inbox</a>
        </div></div>`;
      return;
    }

    const email = Store.getById(COLLECTION, id);
    if (!email) {
      container.innerHTML = `
        <div class="empty-email"><div>
          <div style="font-size:36px"></div>
          <div style="margin-top:14px;font-weight:600">Email not found</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-top:6px">It may have been deleted or moved.</div>
          <a href="email.html" class="btn-primary" style="margin-top:16px;display:inline-flex">Back to Inbox</a>
        </div></div>`;
      return;
    }

    // Mark read if inbox unread
    if (email.folder === "inbox" && !email.read) {
      Store.update(COLLECTION, id, { read: true });
      email.read = true;
      updateCounts();
    }

    const initials = safeEscape(getInitials(email.from || email.to || "U"));
    const color = getAvatarColor(email.from || email.to || "U");
    const fromName = safeEscape(email.from || "Unknown");
    const fromEmail = safeEscape(email.fromEmail || "");
    const toName = safeEscape(email.to || "");
    const toEmail = safeEscape(email.toEmail || "");
    const subject = safeEscape(email.subject || "(No subject)");
    const bodyHtml = safeEscape(email.body || email.preview || "").replace(
      /\n/g,
      "<br>",
    );
    const date = safeEscape(safeFormatDateTime(email.createdAt));
    const isTrash = email.folder === "trash";
    const starredLabel = email.starred ? "Starred Starred" : "Star Not starred";

    container.innerHTML = `
      <div class="email-message-content">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
          <a href="email.html${email.folder ? `?folder=${email.folder}` : ""}" class="email-button">← Back</a>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="email-button ${email.starred ? "primary" : ""}" onclick="window.EmailApp.toggleStar('${safeEscape(email.id)}', null, true)">${email.starred ? "Starred Unstar" : "Star Star"}</button>
            <button class="email-button" onclick="window.EmailApp.toggleRead('${safeEscape(email.id)}', null, true)">${email.read ? "Mark unread" : "Mark read"}</button>
            <a href="email-compose.html?reply=${encodeURIComponent(email.id)}" class="email-button primary">↩ Reply</a>
            <button class="email-button" onclick="window.EmailApp.forwardEmail('${safeEscape(email.id)}')">Forward</button>
            <button class="email-button ${isTrash ? "danger" : ""}" onclick="window.EmailApp.deleteEmail('${safeEscape(email.id)}', null, true)">${isTrash ? "Delete permanently" : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete'}</button>
          </div>
        </div>

        <h2 style="line-height:1.3">${subject}</h2>

        <div class="email-meta">
          <div class="email-avatar" style="background:${color}">${initials}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;color:var(--text-primary);font-size:14px">${fromName} <span style="font-weight:400;color:var(--text-secondary)">&lt;${fromEmail}&gt;</span></div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;word-break:break-all">
              To: ${toName} ${toEmail ? `&lt;${toEmail}&gt;` : ""} • ${date} • <span style="text-transform:capitalize">${safeEscape(email.folder)}</span> • ${safeEscape(starredLabel)}
            </div>
          </div>
        </div>

        <div class="email-body">${bodyHtml}</div>

        ${email.folder === "drafts" ? `<div style="margin-top:24px;padding:12px;border:1px dashed var(--border-light);border-radius:8px;font-size:13px;color:var(--text-secondary)">This is a draft. <a href="email-compose.html?draftId=${encodeURIComponent(email.id)}" style="color:var(--color-primary);font-weight:600">Edit draft</a></div>` : ""}
      </div>

      <div class="email-message-actions">
        <a href="email.html?folder=${safeEscape(email.folder || "inbox")}" class="email-button">Back</a>
        <a href="email-compose.html?reply=${encodeURIComponent(email.id)}" class="email-button primary">Reply</a>
        ${email.folder !== "trash" ? `<button class="email-button" onclick="window.EmailApp.forwardEmail('${safeEscape(email.id)}')">Forward</button>` : ""}
        <button class="email-button ${isTrash ? "danger" : ""}" onclick="window.EmailApp.deleteEmail('${safeEscape(email.id)}', null, true)">${isTrash ? "Delete permanently" : "Move to Trash"}</button>
      </div>
    `;
  }

  // ---------- compose page ----------
  function parseEmailInput(raw) {
    raw = String(raw || "").trim();
    if (!raw) return { name: "Draft", email: "" };
    const angle = raw.match(/^(.*)<(.+)>$/);
    if (angle) {
      const name = angle[1].trim().replace(/^["']|["']$/g, "");
      const email = angle[2].trim();
      return { name: name || email.split("@")[0], email };
    }
    if (raw.includes("@")) {
      const name = raw
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (s) => s.toUpperCase());
      return { name, email: raw };
    }
    // plain name
    const name = raw;
    const email =
      raw
        .toLowerCase()
        .replace(/\s+/g, ".")
        .replace(/[^a-z0-9.@_-]/g, "") + "@studypod.com";
    return { name, email };
  }

  function initComposePage() {
    const form = document.getElementById("email-compose-form");
    if (!form) return;

    const toInput = document.getElementById("compose-to");
    const subjectInput = document.getElementById("compose-subject");
    const bodyInput = document.getElementById("compose-body");

    const replyId =
      parseParam("reply") || parseParam("replyTo") || parseParam("id");
    const draftId = parseParam("draftId") || parseParam("draft");
    const forwardId = parseParam("forward");
    const Store = getStore();

    // Load existing draft for editing
    if (draftId) {
      const draft = Store.getById(COLLECTION, draftId);
      if (draft && draft.folder === "drafts") {
        if (toInput) toInput.value = draft.toEmail || draft.to || "";
        if (subjectInput) subjectInput.value = draft.subject || "";
        if (bodyInput) bodyInput.value = draft.body || "";
        form.dataset.editingDraftId = draft.id;
      }
    } else if (replyId) {
      const original = Store.getById(COLLECTION, replyId);
      if (original) {
        if (toInput) {
          const replyTo =
            original.folder === "sent"
              ? original.toEmail || original.to
              : original.fromEmail || original.from || "";
          toInput.value = replyTo;
        }
        if (subjectInput) {
          let sub = original.subject || "";
          if (!/^re:/i.test(sub)) sub = `Re: ${sub}`;
          subjectInput.value = sub;
        }
        if (bodyInput) {
          const quoted = `\n\n\n--- Original message ---\nFrom: ${original.from} <${original.fromEmail}>\nDate: ${safeFormatDateTime(original.createdAt)}\nSubject: ${original.subject}\n\n${original.body || ""}`;
          bodyInput.value = quoted;
          // Put caret at top
          setTimeout(() => {
            bodyInput.focus();
            try {
              bodyInput.setSelectionRange(0, 0);
            } catch (e) {}
          }, 80);
        }
      }
    } else if (forwardId) {
      const original = Store.getById(COLLECTION, forwardId);
      if (original) {
        if (subjectInput) {
          let sub = original.subject || "";
          if (!/^fwd:/i.test(sub)) sub = `Fwd: ${sub}`;
          subjectInput.value = sub;
        }
        if (bodyInput) {
          const fwd = `\n\n\n--- Forwarded message ---\nFrom: ${original.from} <${original.fromEmail}>\nDate: ${safeFormatDateTime(original.createdAt)}\nSubject: ${original.subject}\nTo: ${original.to} <${original.toEmail}>\n\n${original.body || ""}`;
          bodyInput.value = fwd;
        }
      }
    } else {
      // Restore local persist (compose draft autosave)
      try {
        const saved = localStorage.getItem(COMPOSE_LOCAL_KEY);
        if (saved) {
          const data = JSON.parse(saved);
          if (data) {
            if (toInput && data.to && !toInput.value) toInput.value = data.to;
            if (subjectInput && data.subject && !subjectInput.value)
              subjectInput.value = data.subject;
            if (bodyInput && data.body && !bodyInput.value)
              bodyInput.value = data.body;
          }
        }
      } catch (e) {}
    }

    // Local autosave to localStorage
    let localSaveTimer;
    const persistLocal = () => {
      clearTimeout(localSaveTimer);
      localSaveTimer = setTimeout(() => {
        try {
          const payload = {
            to: toInput ? toInput.value : "",
            subject: subjectInput ? subjectInput.value : "",
            body: bodyInput ? bodyInput.value : "",
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem(COMPOSE_LOCAL_KEY, JSON.stringify(payload));
        } catch (e) {}
      }, 400);
    };

    [toInput, subjectInput, bodyInput].forEach((el) => {
      if (el) el.addEventListener("input", persistLocal);
    });

    // Save draft to Store (explicit)
    const saveDraftToStore = () => {
      const toVal = toInput ? toInput.value.trim() : "";
      const subjectVal = subjectInput ? subjectInput.value.trim() : "";
      const bodyVal = bodyInput ? bodyInput.value.trim() : "";

      if (!toVal && !subjectVal && !bodyVal) {
        safeToast("Nothing to save as draft");
        return;
      }

      const parsed = parseEmailInput(toVal);
      const editingId = form.dataset.editingDraftId;

      if (editingId) {
        const existing = Store.getById(COLLECTION, editingId);
        if (existing && existing.folder === "drafts") {
          Store.update(COLLECTION, editingId, {
            to: parsed.name || "Draft",
            toEmail: parsed.email || "",
            subject: subjectVal || "(No subject)",
            preview: bodyVal.slice(0, 90) || "No content",
            body: bodyVal,
            updatedAt: new Date().toISOString(),
          });
          safeToast("Draft updated");
        }
      } else {
        const draft = Store.create(COLLECTION, {
          from: "Sarah Davis",
          fromEmail: "sarah@studypod.com",
          to: parsed.name || toVal || "Draft",
          toEmail: parsed.email || "",
          subject: subjectVal || "(No subject)",
          preview: bodyVal.slice(0, 90) || "No content",
          body: bodyVal,
          folder: "drafts",
          read: true,
          starred: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        form.dataset.editingDraftId = draft.id;
        try {
          localStorage.setItem(DRAFT_EDIT_KEY, draft.id);
        } catch (e) {}
        safeToast("Draft saved to Drafts");
      }

      try {
        localStorage.removeItem(COMPOSE_LOCAL_KEY);
      } catch (e) {}
      updateCounts();
    };

    // Attach save draft button if present
    const saveDraftBtn =
      document.getElementById("save-draft") ||
      document.querySelector('[data-action="save-draft"]') ||
      document.getElementById("btn-save-draft");
    if (saveDraftBtn) {
      saveDraftBtn.addEventListener("click", (e) => {
        e.preventDefault();
        saveDraftToStore();
      });
    }

    // Auto draft to Store every 8s if typing (optional persistence beyond localStorage)
    let storeDraftTimer;
    const autoStoreDraft = () => {
      clearTimeout(storeDraftTimer);
      storeDraftTimer = setTimeout(() => {
        const hasContent =
          (toInput && toInput.value.trim()) ||
          (subjectInput && subjectInput.value.trim()) ||
          (bodyInput && bodyInput.value.trim());
        if (!hasContent) return;
        // Only auto-save if already editing a draft, avoid spamming new drafts
        if (form.dataset.editingDraftId) saveDraftToStore();
      }, 8000);
    };
    [toInput, subjectInput, bodyInput].forEach((el) => {
      if (el) el.addEventListener("input", autoStoreDraft);
    });

    // Expose for inline onclick handlers that may exist in HTML
    window.EmailCompose = {
      saveDraft: saveDraftToStore,
      saveDraftToStore,
    };

    // Submit handler - send email
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const toVal = toInput ? toInput.value.trim() : "";
      const subjectVal = subjectInput ? subjectInput.value.trim() : "";
      const bodyVal = bodyInput ? bodyInput.value.trim() : "";

      if (!toVal || !subjectVal || !bodyVal) {
        safeToast("Please fill To, Subject, and Message");
        return;
      }

      const parsed = parseEmailInput(toVal);
      const editingId = form.dataset.editingDraftId;

      if (editingId) {
        // If editing a draft, remove the draft (convert to sent)
        const existing = Store.getById(COLLECTION, editingId);
        if (existing && existing.folder === "drafts") {
          Store.delete(COLLECTION, editingId);
        }
      }

      const newEmail = {
        from: "Sarah Davis",
        fromEmail: "sarah@studypod.com",
        to: parsed.name,
        toEmail: parsed.email,
        subject: subjectVal,
        preview: bodyVal.slice(0, 90),
        body: bodyVal,
        folder: "sent",
        read: true,
        starred: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      Store.create(COLLECTION, newEmail);

      try {
        localStorage.removeItem(COMPOSE_LOCAL_KEY);
        localStorage.removeItem(DRAFT_EDIT_KEY);
      } catch (err) {}

      safeToast("Email sent successfully ");
      window.dispatchEvent(new CustomEvent("email:sent", { detail: newEmail }));

      setTimeout(() => {
        window.location.href = "email-sent.html?folder=sent";
      }, 500);
    });

    // Keyboard shortcut: Cmd/Ctrl + S to save draft
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (
          document.activeElement &&
          (document.activeElement === toInput ||
            document.activeElement === subjectInput ||
            document.activeElement === bodyInput)
        ) {
          e.preventDefault();
          saveDraftToStore();
        }
      }
    });
  }

  // ---------- boot ----------
  function init() {
    const Store = getStore();
    if (!Store) {
      console.warn(
        "[Email] Store not found. Make sure store.js is loaded before email.js",
      );
      return;
    }

    if (typeof window.setActiveNav === "function") {
      window.setActiveNav("email");
    }

    const hasList = !!document.getElementById("email-list");
    const hasCompose = !!document.getElementById("email-compose-form");
    const hasMessage = !!document.getElementById("email-message");

    if (hasList) {
      initFolderNav();
      initSearch();
      updateCounts();
      renderList();
      window.addEventListener("studypod:datachange", (e) => {
        if (
          !e.detail ||
          e.detail.collection === COLLECTION ||
          e.detail.collection === "all"
        ) {
          updateCounts();
          // Only re-render if not currently searching? Always render
          if (document.getElementById("email-list")) renderList();
        }
      });
    }

    if (hasMessage) {
      initMessagePage();
      updateCounts();
      window.addEventListener("studypod:datachange", updateCounts);
    }

    if (hasCompose) {
      initComposePage();
      updateCounts();
      window.addEventListener("studypod:datachange", updateCounts);
    }

    // Fallback for generic email-page without explicit containers (e.g., future layout)
    if (!hasList && !hasCompose && !hasMessage) {
      if (document.querySelector(".email-page")) {
        initFolderNav();
        initSearch();
        updateCounts();
        // If list exists later? Retry once
        setTimeout(() => {
          if (document.getElementById("email-list")) renderList();
        }, 100);
      }
    }
  }

  // Expose public API
  window.EmailApp = {
    openEmail,
    openDraft,
    toggleStar,
    toggleRead,
    deleteEmail,
    forwardEmail,
    renderList,
    updateCounts,
    clearSearch,
    get currentFolder() {
      return currentFolder;
    },
    set currentFolder(v) {
      currentFolder = v;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
