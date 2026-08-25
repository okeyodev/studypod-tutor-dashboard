/**
 * ==========================================================================
 * CONFERENCE-FORM.JS - StudyPod v2.1 - Create/Edit Conference with Image Upload
 * ==========================================================================
 * Purpose:
 * - Handles create & edit conference via ?id= param
 * - Supports image upload for visual recognition (base64 storage)
 * - Validates fields, generates token, saves to Store
 * - Replaces emoji with animated SVG icons
 *
 * Collections used: conferences
 * Dependencies: Store (store.js), common.js helpers (toast, setActiveNav)
 *
 * Features:
 * - Token generation: CONF-YYYY-001
 * - Image upload: drag & drop, preview, 2MB limit, base64 storage
 * - Delivery method toggle: Virtual / On-Premise
 * - Status: draft / published
 * - Validation: required fields, date logic, amount
 * - Dark mode compatible
 *
 * Changelog v2.1:
 * - Added image upload section with preview
 * - Added animated SVG icons instead of emojis
 * - Improved dark mode styling
 * - Preserved all existing validation and CRUD logic
 * ==========================================================================
 */

// State for image upload - NEW
let uploadedImageData = null;
let uploadedImageName = null;
let uploadedImageSize = null;
let currentConference = null;

document.addEventListener("DOMContentLoaded", () => {
  if (typeof setActiveNav === "function") setActiveNav("conferences");
  initForm();
  initImageUpload(); // NEW: Initialize image upload handling
});

function getQueryId() {
  try {
    return new URLSearchParams(location.search).get("id");
  } catch {
    return null;
  }
}

/**
 * Initialize form - handles both create and edit modes
 */
function initForm() {
  if (typeof Store === "undefined") {
    setTimeout(initForm, 200);
    return;
  }

  const id = getQueryId();
  const isEdit = !!id;
  let existing = null;

  if (isEdit) {
    existing = Store.getById("conferences", id);
    if (!existing) {
      toast("Conference not found");
      setTimeout(() => (location.href = "conferences.html"), 1000);
      return;
    }
    currentConference = existing;
    document.getElementById("form-title").textContent = "Edit Conference";
    document.getElementById("form-sub").textContent =
      `Editing ${existing.token}`;

    // Load existing image if present - NEW
    if (existing.image) {
      uploadedImageData = existing.image;
      uploadedImageName = existing.imageName || "conference-image.jpg";
      setTimeout(
        () => showImagePreview(existing.image, uploadedImageName),
        100,
      );
    }
  }

  // Token preview
  const tokenEl = document.getElementById("conf-token");
  if (tokenEl) {
    if (isEdit) tokenEl.value = existing.token;
    else {
      const count = Store.get("conferences").length + 1;
      const year = new Date().getFullYear();
      tokenEl.value = `CONF-${year}-${String(count).padStart(3, "0")}`;
    }
  }

  // Populate if edit
  if (existing) {
    setVal("conf-name", existing.name);
    setVal("conf-title", existing.title);
    setVal("conf-workshop", existing.workshopId || existing.workshop);
    setVal("conf-state", existing.location?.state || existing.state);
    setVal("conf-country", existing.location?.country || existing.country);
    setVal("conf-venue", existing.location?.venue || existing.venue);
    setVal("conf-amount", existing.fee?.amount);
    setVal("conf-currency", existing.fee?.currency || "NGN");
    setVal("conf-start-date", existing.startDate);
    setVal("conf-end-date", existing.endDate);
    setVal("conf-start-time", existing.startTime);
    setVal("conf-end-time", existing.endTime);
    setVal("conf-delivery", existing.deliveryMethod);
    if (existing.deliveryMethod) setDelivery(existing.deliveryMethod);
    setRadio("conf-status", existing.status);
  } else {
    setDelivery("Virtual");
  }

  // Delivery toggle
  document
    .querySelectorAll('[name="conf-delivery"], [data-delivery]')
    .forEach((el) => {
      el.addEventListener("click", (e) => {
        const val = e.currentTarget.value || e.currentTarget.dataset.delivery;
        setDelivery(val);
      });
      el.addEventListener("change", (e) => setDelivery(e.target.value));
    });

  // Form submit
  const form = document.getElementById("conference-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const btn = e.submitter;
      const status = btn?.dataset.status || getRadio("conf-status") || "draft";
      handleSubmit(status, isEdit, existing);
    });
  }
}

/**
 * Initialize image upload handling - NEW
 * Supports click to upload, drag & drop, preview, remove
 */
function initImageUpload() {
  const uploadArea = document.getElementById("conf-image-upload-area");
  const input = document.getElementById("conf-image-input");
  const preview = document.getElementById("conf-image-preview");
  const previewImg = document.getElementById("conf-image-preview-img");
  const removeBtn = document.getElementById("conf-image-remove");
  const nameEl = document.getElementById("conf-image-name");
  const sizeEl = document.getElementById("conf-image-size");

  if (!uploadArea || !input) return;

  // Click to upload
  uploadArea.addEventListener("click", () => input.click());

  // Drag and drop
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });

  // File input change
  input.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file);
  });

  // Remove image
  if (removeBtn) {
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearImage();
    });
  }
}

/**
 * Handle image file - validates and creates preview
 * @param {File} file - uploaded file
 */
function handleImageFile(file) {
  if (!file) return;

  // Validate size (2MB max)
  if (file.size > 2 * 1024 * 1024) {
    toast("Image too large. Max 2MB allowed.", "error");
    return;
  }

  // Validate type
  if (!file.type.startsWith("image/")) {
    toast("Please upload an image file (PNG, JPG, WEBP).", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImageData = e.target.result;
    uploadedImageName = file.name;
    uploadedImageSize = (file.size / 1024).toFixed(1) + " KB";
    showImagePreview(uploadedImageData, uploadedImageName, uploadedImageSize);
    toast("Image uploaded successfully", "success");
  };
  reader.onerror = () => {
    toast("Failed to read image file", "error");
  };
  reader.readAsDataURL(file);
}

/**
 * Show image preview
 */
function showImagePreview(data, name, size) {
  const preview = document.getElementById("conf-image-preview");
  const previewImg = document.getElementById("conf-image-preview-img");
  const area = document.getElementById("conf-image-upload-area");
  const nameEl = document.getElementById("conf-image-name");
  const sizeEl = document.getElementById("conf-image-size");

  if (previewImg) previewImg.src = data;
  if (nameEl) nameEl.textContent = name || "conference-image.jpg";
  if (sizeEl && size) sizeEl.textContent = size;
  if (preview) preview.style.display = "block";
  if (area) area.style.display = "none";
}

/**
 * Clear uploaded image
 */
function clearImage() {
  uploadedImageData = null;
  uploadedImageName = null;
  uploadedImageSize = null;

  const input = document.getElementById("conf-image-input");
  const preview = document.getElementById("conf-image-preview");
  const area = document.getElementById("conf-image-upload-area");
  const previewImg = document.getElementById("conf-image-preview-img");

  if (input) input.value = "";
  if (preview) preview.style.display = "none";
  if (area) area.style.display = "block";
  if (previewImg) previewImg.src = "";

  toast("Image removed", "info");
}

function setDelivery(method) {
  document
    .querySelectorAll("[data-delivery]")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.delivery === method),
    );
  document.querySelectorAll('[name="conf-delivery"]').forEach((r) => {
    if (r.value === method) r.checked = true;
  });
  const venueGroup = document.getElementById("venue-group");
  const stateGroup = document.getElementById("state-group");
  const countryGroup = document.getElementById("country-group");
  const show = method === "On-Premise";
  if (venueGroup) venueGroup.style.display = show ? "flex" : "none";
  if (stateGroup) stateGroup.style.display = show ? "flex" : "flex";
  if (method === "Virtual" && venueGroup) venueGroup.style.display = "none";
}

function handleSubmit(status, isEdit, existing) {
  const data = {
    name: getVal("conf-name"),
    title: getVal("conf-title"),
    workshopId: getVal("conf-workshop"),
    location: {
      state: getVal("conf-state"),
      country: getVal("conf-country"),
      venue: getVal("conf-venue"),
    },
    fee: {
      amount: parseFloat(getVal("conf-amount")) || 0,
      currency: getVal("conf-currency") || "NGN",
    },
    startDate: getVal("conf-start-date"),
    endDate: getVal("conf-end-date"),
    startTime: getVal("conf-start-time"),
    endTime: getVal("conf-end-time"),
    deliveryMethod:
      getRadio("conf-delivery") ||
      document.querySelector("[data-delivery].active")?.dataset.delivery ||
      "Virtual",
    status: status,
    // NEW: Include image data
    image: uploadedImageData,
    imageName: uploadedImageName,
    imageSize: uploadedImageSize,
  };

  // Validation
  const errors = [];
  if (!data.name) errors.push("Conference Name required");
  if (!data.title) errors.push("Title required");
  if (!data.startDate) errors.push("Start Date required");
  if (!data.endDate) errors.push("End Date required");
  if (
    data.startDate &&
    data.endDate &&
    new Date(data.endDate) < new Date(data.startDate)
  )
    errors.push("End date cannot be before start date");
  if (
    data.startDate === data.endDate &&
    data.startTime &&
    data.endTime &&
    data.endTime <= data.startTime
  )
    errors.push("End time must be after start time when same date");
  if (isNaN(data.fee.amount) || data.fee.amount < 0)
    errors.push("Amount must be numeric and not negative");

  if (errors.length) {
    const errEl = document.getElementById("form-errors");
    if (errEl) {
      errEl.innerHTML = errors
        .map((e) => `<div>• ${escapeHtml(e)}</div>`)
        .join("");
      errEl.style.display = "block";
    }
    toast(errors[0]);
    return;
  }

  try {
    if (isEdit) {
      Store.update("conferences", existing.id, data);
      toast("Conference updated");
    } else {
      Store.create("conferences", data);
      toast("Conference created");
    }
    setTimeout(() => (location.href = "conferences.html"), 600);
  } catch (e) {
    toast("Failed to save: " + e.message);
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
