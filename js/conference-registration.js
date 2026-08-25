/**
 * CONFERENCE-REGISTRATION.JS
 */

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav("conferences");
  init();
});

function init() {
  if (typeof Store === "undefined") {
    setTimeout(init, 200);
    return;
  }
  const params = new URLSearchParams(location.search);
  const conferenceId = params.get("conferenceId") || params.get("id");

  // Populate conference selector
  const select = document.getElementById("conference-select");
  const conferences = Store.get("conferences");
  if (select) {
    select.innerHTML =
      '<option value="">All Conferences</option>' +
      conferences
        .map(
          (c) =>
            `<option value="${c.id}" ${c.id === conferenceId ? "selected" : ""}>${escapeHtml(c.name)} (${c.token})</option>`,
        )
        .join("");
    select.addEventListener("change", () => {
      const newId = select.value;
      const url = new URL(location.href);
      if (newId) url.searchParams.set("conferenceId", newId);
      else url.searchParams.delete("conferenceId");
      history.replaceState(null, "", url);
      render(newId);
    });
  }

  render(conferenceId);

  // Search
  const search = document.getElementById("reg-search");
  if (search)
    search.addEventListener("input", () =>
      render(conferenceId || select?.value, search.value),
    );
}

function render(conferenceId, searchTerm = "") {
  const searchEl = document.getElementById("reg-search");
  const term = (searchTerm || searchEl?.value || "").toLowerCase();

  let regs = Store.get("registrations");
  if (conferenceId) regs = regs.filter((r) => r.conferenceId === conferenceId);
  if (term)
    regs = regs.filter((r) =>
      (r.firstName + " " + r.lastName + " " + r.email + " " + r.membershipNo)
        .toLowerCase()
        .includes(term),
    );

  // Metrics
  const total = regs.length;
  const paid = regs.filter((r) => r.status === "paid").length;
  const pending = regs.filter((r) => r.status === "pending").length;
  const cancelled = regs.filter((r) => r.status === "cancelled").length;

  setText("total-regs", total);
  setText("paid-regs", paid);
  setText("pending-regs", pending);
  setText("cancelled-regs", cancelled);

  const tbody = document.getElementById("regs-body");
  const empty = document.getElementById("empty-regs");
  if (!tbody) return;

  if (!regs.length) {
    tbody.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  tbody.innerHTML = regs
    .map((r, idx) => {
      const conf = Store.getById("conferences", r.conferenceId);
      return `
      <tr>
        <td>${idx + 1}</td>
        <td><div style="font-weight:500">${escapeHtml(r.firstName + " " + r.lastName)}</div><div style="font-size:11px;color:var(--text-muted)">${escapeHtml(r.email)}</div></td>
        <td>${escapeHtml(r.membershipNo)}</td>
        <td>${escapeHtml(r.workshop)}</td>
        <td>${formatCurrency(r.amount?.amount || 0, r.amount?.currency || "NGN")}</td>
        <td><span class="tag ${r.status === "paid" ? "good" : "warn"}">${r.status}</span></td>
        <td>${formatDate(r.registeredAt)}</td>
        <td><button class="btn-light" onclick="viewReg('${r.id}')">View</button></td>
      </tr>`;
    })
    .join("");
}

window.viewReg = function (id) {
  const r = Store.getById("registrations", id);
  if (!r) return;
  const conf = Store.getById("conferences", r.conferenceId);
  const modal = document.getElementById("reg-detail-modal");
  const body = document.getElementById("reg-detail-body");
  if (!body) return;
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div><h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:8px">Personal</h4>
        <div style="font-size:13px;line-height:1.8"><strong>First Name:</strong> ${escapeHtml(r.firstName)}<br><strong>Last Name:</strong> ${escapeHtml(r.lastName)}<br><strong>Phone:</strong> ${escapeHtml(r.phone)}<br><strong>Email:</strong> ${escapeHtml(r.email)}<br><strong>Membership:</strong> ${escapeHtml(r.membershipNo)}</div>
      </div>
      <div><h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:8px">Conference</h4>
        <div style="font-size:13px;line-height:1.8"><strong>Conference:</strong> ${escapeHtml(conf?.name || "-")}<br><strong>Workshop:</strong> ${escapeHtml(r.workshop)}<br><strong>State:</strong> ${escapeHtml(r.state)}<br><strong>Country:</strong> ${escapeHtml(r.country)}</div>
      </div>
      <div style="grid-column:1/-1"><h4 style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:8px">Payment</h4>
        <div style="font-size:13px;line-height:1.8"><strong>Amount:</strong> ${formatCurrency(r.amount?.amount || 0, r.amount?.currency)}<br><strong>Transaction Ref:</strong> ${escapeHtml(r.transactionReference)}<br><strong>Payment Date:</strong> ${formatDate(r.paymentDate)}<br><strong>Status:</strong> ${escapeHtml(r.status)}</div>
      </div>
    </div>
  `;
  openModal("reg-detail-modal");
};

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
