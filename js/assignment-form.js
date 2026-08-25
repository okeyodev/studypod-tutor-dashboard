/**
 * ASSIGNMENT-FORM.JS
 */

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav("assignments");
  init();
});

function getId() {
  return new URLSearchParams(location.search).get("id");
}
function getCourseId() {
  return new URLSearchParams(location.search).get("courseId");
}

function init() {
  if (typeof Store === "undefined") {
    setTimeout(init, 200);
    return;
  }
  const id = getId();
  const isEdit = !!id;
  let existing = null;
  if (isEdit) {
    existing = Store.getById("assignments", id);
    if (!existing) {
      toast("Assignment not found");
      setTimeout(() => (location.href = "assignments.html"), 800);
      return;
    }
    document.getElementById("form-title").textContent = "Edit Assignment";
  }

  // Courses dropdown
  const courseSelect = document.getElementById("asg-course");
  const courses = Store.get("courses");
  if (courseSelect) {
    courseSelect.innerHTML =
      '<option value="">Select Course</option>' +
      courses
        .map(
          (c) =>
            `<option value="${c.id}" ${existing?.courseId === c.id || getCourseId() === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`,
        )
        .join("");
  }

  // Token
  const tokenEl = document.getElementById("asg-token");
  if (tokenEl) {
    if (isEdit) tokenEl.value = existing.token;
    else {
      const count = Store.get("assignments").length + 1;
      const year = new Date().getFullYear();
      tokenEl.value = `ASG-${year}-${String(count).padStart(3, "0")}`;
    }
  }

  if (existing) {
    setVal("asg-title", existing.title);
    setVal("asg-course", existing.courseId);
    setVal("asg-description", existing.description);
    setVal("asg-instructions", existing.instructions);
    setVal("asg-start-date", existing.startDate);
    setVal("asg-due-date", existing.dueDate);
    setVal("asg-max-score", existing.maximumScore);
    setRadio("asg-status", existing.status);
  }

  const form = document.getElementById("assignment-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const status =
        e.submitter?.dataset.status || getRadio("asg-status") || "draft";
      handleSubmit(status, isEdit, existing);
    });
  }
}

function handleSubmit(status, isEdit, existing) {
  const data = {
    title: getVal("asg-title"),
    courseId: getVal("asg-course"),
    description: getVal("asg-description"),
    instructions: getVal("asg-instructions"),
    startDate: getVal("asg-start-date"),
    dueDate: getVal("asg-due-date"),
    maximumScore: parseInt(getVal("asg-max-score")) || 100,
    status: status,
  };

  const errors = [];
  if (!data.title) errors.push("Title required");
  if (!data.courseId) errors.push("Course required");
  if (!data.startDate) errors.push("Start date required");
  if (!data.dueDate) errors.push("Due date required");
  if (
    data.startDate &&
    data.dueDate &&
    new Date(data.dueDate) < new Date(data.startDate)
  )
    errors.push("Due date cannot be before start date");
  if (errors.length) {
    toast(errors[0]);
    const el = document.getElementById("form-errors");
    if (el) {
      el.innerHTML = errors.map((e) => `<div>• ${e}</div>`).join("");
      el.style.display = "block";
    }
    return;
  }

  try {
    if (isEdit) {
      Store.update("assignments", existing.id, data);
      toast("Assignment updated");
    } else {
      Store.create("assignments", data);
      toast("Assignment created");
    }
    setTimeout(() => (location.href = "assignments.html"), 600);
  } catch (e) {
    toast("Failed: " + e.message);
  }
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.value = val;
}
function getRadio(name) {
  const el = document.querySelector(`[name="${name}"]:checked`);
  return el ? el.value : null;
}
function setRadio(name, val) {
  const el = document.querySelector(`[name="${name}"][value="${val}"]`);
  if (el) el.checked = true;
}
