/**
 * COURSE-FORM.JS - StudyPod Tutor Dashboard v2.0
 * Handles create & edit course via ?id= param
 * Uses window.Store (collections: courses) + helpers from common.js
 * No framework, no React/Tailwind. Robust to multiple HTML markup variations.
 */

(function () {
  "use strict";

  const COLLECTION = "courses";
  const YEAR = new Date().getFullYear();
  const FIELDS = [
    "Programming",
    "Design",
    "Marketing",
    "Business",
    "Data Science",
    "Product Management",
    "Engineering",
    "Finance",
    "Operations",
    "HR & Leadership",
    "Sales",
    "Personal Development",
    "Photography",
    "Music",
    "Language",
  ];
  const CURRENCIES = ["NGN", "USD", "GBP", "EUR"];

  // State
  let editingId = null;
  let currentCourse = null;
  let pendingStatus = null; // forced by button click: 'draft' | 'published' | null
  let deliveryMethodValue = "Virtual";
  let uploadedImageData = null; // NEW: stores base64 image data for course cover
  let uploadedImageName = null;
  let uploadedImageSize = null;

  // ---------- Helpers ----------
  function $(sel, root = document) {
    try {
      return root.querySelector(sel);
    } catch (e) {
      return null;
    }
  }
  function $$(sel, root = document) {
    try {
      return Array.from(root.querySelectorAll(sel));
    } catch (e) {
      return [];
    }
  }
  function byId(id) {
    return document.getElementById(id);
  }
  function safeToast(msg, type) {
    try {
      if (typeof window.toast === "function") return window.toast(msg, type);
      if (typeof toast === "function") return toast(msg, type);
    } catch (e) {}
    console.log("[toast]", msg);
  }
  function safeEscape(str) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(str);
    if (typeof escapeHtml === "function") return escapeHtml(str);
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function getNextTokenPreview() {
    try {
      if (!window.Store) return `CRS-${YEAR}-XXX`;
      const all = Store.get(COLLECTION) || [];
      const count = all.length + 1;
      const padded = String(count).padStart(3, "0");
      return `CRS-${YEAR}-${padded}`;
    } catch (e) {
      return `CRS-${YEAR}-XXX`;
    }
  }

  // Find element by trying multiple selectors
  function findFirst(selectors) {
    for (const s of selectors) {
      if (!s) continue;
      const el = $(s);
      if (el) return el;
    }
    return null;
  }

  function getElements() {
    // form itself
    const form = findFirst([
      "#course-form",
      "#courseForm",
      'form[data-form="course"]',
      "form#form",
      "form",
    ]);

    // token
    const token = findFirst([
      "#course-token",
      "#token",
      "#courseToken",
      '[name="token"]',
      '[data-field="token"]',
      ".field-token input",
    ]);

    // name
    const name = findFirst([
      "#course-name",
      "#name",
      "#courseName",
      '[name="name"]',
      '[name="courseName"]',
      '[data-field="name"]',
    ]);

    // field (category)
    const field = findFirst([
      "#course-field",
      "#field",
      "#category",
      "#course-field-select",
      '[name="field"]',
      '[name="category"]',
      '[data-field="field"]',
    ]);

    // location
    const location = findFirst([
      "#course-location",
      "#location",
      "#courseLocation",
      '[name="location"]',
      '[data-field="location"]',
    ]);

    // venue
    const venue = findFirst([
      "#course-venue",
      "#venue",
      "#courseVenue",
      '[name="venue"]',
      '[data-field="venue"]',
    ]);

    // venue group wrapper (to hide)
    let venueGroup = null;
    if (venue) {
      venueGroup =
        venue.closest(".form-group") ||
        venue.closest(".field") ||
        venue.closest('[data-group="venue"]') ||
        findFirst([
          "#venue-group",
          "#venue-field",
          "#field-venue",
          ".field-venue",
          '[data-field-group="venue"]',
        ]);
      if (!venueGroup) venueGroup = venue.parentElement;
    } else {
      venueGroup = findFirst(["#venue-group", "#field-venue", ".field-venue"]);
    }

    // credit hours
    const creditHours = findFirst([
      "#course-creditHours",
      "#creditHours",
      "#credit-hours",
      "#credit",
      '[name="creditHours"]',
      '[name="credit_hours"]',
    ]);

    // fee amount + currency
    const feeAmount = findFirst([
      "#course-fee-amount",
      "#fee-amount",
      "#feeAmount",
      "#amount",
      "#course-fee",
      '[name="feeAmount"]',
      '[name="amount"]',
      '[data-field="feeAmount"]',
      '[data-field="amount"]',
    ]);
    const feeCurrency = findFirst([
      "#course-fee-currency",
      "#fee-currency",
      "#currency",
      "#feeCurrency",
      '[name="feeCurrency"]',
      '[name="currency"]',
      '[data-field="currency"]',
    ]);

    // dates
    const startDate = findFirst([
      "#course-startDate",
      "#startDate",
      "#start-date",
      '[name="startDate"]',
      '[data-field="startDate"]',
    ]);
    const endDate = findFirst([
      "#course-endDate",
      "#endDate",
      "#end-date",
      '[name="endDate"]',
      '[data-field="endDate"]',
    ]);

    // times
    const startTime = findFirst([
      "#course-startTime",
      "#startTime",
      "#start-time",
      '[name="startTime"]',
    ]);
    const endTime = findFirst([
      "#course-endTime",
      "#endTime",
      "#end-time",
      '[name="endTime"]',
    ]);

    // image upload - NEW
    const imageUploadArea = findFirst([
      "#course-image-upload-area",
      "#image-upload-area",
      ".image-upload-area",
    ]);
    const imageInput = findFirst([
      "#course-image-input",
      "#image-input",
      'input[type="file"][accept*="image"]',
    ]);
    const imagePreview = findFirst(["#course-image-preview", ".image-preview"]);
    const imagePreviewImg = findFirst([
      "#course-image-preview-img",
      ".image-preview img",
    ]);
    const imageRemoveBtn = findFirst([
      "#course-image-remove",
      ".image-preview-remove",
    ]);
    const imageNameEl = findFirst(["#course-image-name"]);
    const imageSizeEl = findFirst(["#course-image-size"]);

    // deliveryMethod segmented / radios
    const deliveryContainer = findFirst([
      "#deliveryMethod",
      "#delivery-method",
      "#course-deliveryMethod",
      "#course-delivery",
      '[data-field="deliveryMethod"]',
      '.segmented-control[data-name="deliveryMethod"]',
      ".delivery-method",
    ]);
    const deliveryRadios = $$(
      'input[name="deliveryMethod"], input[name="delivery"], input[type="radio"][data-group="delivery"]',
    );
    const deliveryButtons = $$(
      '[data-delivery], #deliveryMethod button, #delivery-method button, .segmented button, .seg-control button, [data-value="Virtual"], [data-value="On-Premise"]',
    );

    // description
    const description = findFirst([
      "#course-description",
      "#description",
      "#desc",
      '[name="description"]',
      'textarea[name="description"]',
    ]);

    // status radios
    const statusRadios = $$(
      'input[name="status"], input[name="course-status"], input[type="radio"][value="draft"], input[type="radio"][value="published"]',
    );
    const statusDraft = findFirst([
      "#status-draft",
      "#statusDraft",
      'input[value="draft"]',
    ]);
    const statusPublished = findFirst([
      "#status-published",
      "#statusPublished",
      'input[value="published"]',
    ]);

    // buttons
    const btnCancel = findFirst([
      "#btn-cancel",
      "#cancelBtn",
      "#btnCancel",
      'button[data-action="cancel"]',
      'a[data-action="cancel"]',
      'a[href*="courses.html"].btn',
      "button.btn-cancel",
    ]);
    const btnDraft = findFirst([
      "#btn-draft",
      "#btn-save-draft",
      "#saveDraft",
      'button[data-action="draft"]',
      'button[data-status="draft"]',
      "#btnDraft",
    ]);
    const btnPublish = findFirst([
      "#btn-publish",
      "#btn-create-publish",
      "#createPublish",
      "#btn-save",
      "#saveChanges",
      "#btn-submit",
      'button[data-action="publish"]',
      'button[data-status="published"]',
      'button.btn-primary[type="submit"]',
    ]);
    // secondary publish/save changes may be separate
    const btnSaveChanges = findFirst([
      "#btn-save-changes",
      "#saveChanges",
      "#btnSaveChanges",
    ]);

    const formTitle = findFirst([
      "#form-title",
      "#page-title",
      ".page-head h1",
      "h1[data-title]",
      "h1",
    ]);
    const errorContainer = findFirst([
      "#form-errors",
      "#error-container",
      ".form-errors",
      "#errors",
    ]);

    return {
      form,
      token,
      name,
      field,
      location,
      venue,
      venueGroup,
      creditHours,
      feeAmount,
      feeCurrency,
      startDate,
      endDate,
      startTime,
      endTime,
      imageUploadArea,
      imageInput,
      imagePreview,
      imagePreviewImg,
      imageRemoveBtn,
      imageNameEl,
      imageSizeEl,
      deliveryContainer,
      deliveryRadios,
      deliveryButtons,
      description,
      statusRadios,
      statusDraft,
      statusPublished,
      btnCancel,
      btnDraft,
      btnPublish,
      btnSaveChanges,
      formTitle,
      errorContainer,
    };
  }

  function ensureFieldOptions(fieldEl) {
    if (!fieldEl || fieldEl.tagName !== "SELECT") return;
    if (fieldEl.options.length > 1) return; // already populated
    // clear
    fieldEl.innerHTML = '<option value="">Select field</option>';
    FIELDS.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      fieldEl.appendChild(opt);
    });
  }

  function ensureCurrencyOptions(currencyEl) {
    if (!currencyEl || currencyEl.tagName !== "SELECT") return;
    if (currencyEl.options.length >= 4) return;
    currencyEl.innerHTML = "";
    CURRENCIES.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      currencyEl.appendChild(opt);
    });
    // default NGN
    if (!currencyEl.value) currencyEl.value = "NGN";
  }

  function setDeliveryMethod(val, els) {
    deliveryMethodValue = val;
    // Update radios
    if (els.deliveryRadios && els.deliveryRadios.length) {
      els.deliveryRadios.forEach((r) => {
        if (r.value === val) r.checked = true;
        // handle data attributes
        if (r.dataset.value === val) r.checked = true;
      });
    }
    // Update segmented buttons
    if (els.deliveryButtons && els.deliveryButtons.length) {
      els.deliveryButtons.forEach((b) => {
        const bv =
          b.dataset.delivery || b.dataset.value || b.textContent.trim();
        const isActive =
          bv === val ||
          b.textContent.trim().toLowerCase().includes(val.toLowerCase());
        b.classList.toggle("active", isActive);
        b.classList.toggle("selected", isActive);
        b.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }
    // Update container buttons if it contains them
    if (els.deliveryContainer) {
      const btns = els.deliveryContainer.querySelectorAll(
        'button, [role="button"]',
      );
      btns.forEach((b) => {
        const bv =
          b.dataset.delivery ||
          b.dataset.value ||
          b.getAttribute("data-value") ||
          b.textContent.trim();
        const isActive =
          bv === val ||
          (bv && bv.toLowerCase().includes(val.toLowerCase().split("-")[0]));
        // more precise
        const norm = (str) => (str || "").toLowerCase().replace(/[^a-z]/g, "");
        if (
          norm(bv) === norm(val) ||
          (val === "On-Premise" && norm(bv).includes("onpremise")) ||
          (val === "On-Premise" && norm(bv).includes("premise"))
        ) {
          b.classList.add("active", "selected");
        } else {
          // if not matching, but if button text exactly Virtual or On-Premise, toggle
          if (
            b.textContent.trim().toLowerCase() === val.toLowerCase() ||
            (val === "On-Premise" && /on.*premise/i.test(b.textContent))
          ) {
            b.classList.add("active", "selected");
          } else if (
            b.textContent.trim().toLowerCase() === "virtual" ||
            /on.*premise/i.test(b.textContent.trim())
          ) {
            b.classList.remove("active", "selected");
          }
        }
      });
    }

    // Venue visibility
    if (els.venueGroup) {
      if (val === "Virtual") {
        els.venueGroup.style.display = "none";
        if (els.venue) els.venue.required = false;
      } else {
        els.venueGroup.style.display = "";
        // keep required logic for validation only when visible, not html5 required to avoid blocking
      }
    }
    // also hide venue input directly if no group
    if (!els.venueGroup && els.venue) {
      els.venue.closest("div") &&
        (els.venue.closest("div").style.display =
          val === "Virtual" ? "none" : "");
    }
  }

  function populateForm(course, els) {
    if (!course) return;
    if (els.token) {
      els.token.value = course.token || "";
      els.token.readOnly = true;
      els.token.setAttribute("readonly", "readonly");
    }
    if (els.name) els.name.value = course.name || "";
    if (els.field) {
      // if select, ensure option exists
      if (els.field.tagName === "SELECT") {
        const exists = Array.from(els.field.options).some(
          (o) => o.value === course.field,
        );
        if (!exists && course.field) {
          const opt = document.createElement("option");
          opt.value = course.field;
          opt.textContent = course.field;
          els.field.appendChild(opt);
        }
      }
      els.field.value = course.field || "";
    }
    if (els.location) els.location.value = course.location || "";
    if (els.venue)
      els.venue.value =
        course.venue ||
        (course.location && course.deliveryMethod === "On-Premise"
          ? course.location
          : "") ||
        "";
    if (els.creditHours)
      els.creditHours.value =
        course.creditHours != null ? String(course.creditHours) : "";
    if (els.feeAmount) {
      const amt = course.fee?.amount ?? course.amount ?? course.feeAmount ?? "";
      els.feeAmount.value = amt !== "" ? String(amt) : "";
    }
    if (els.feeCurrency) {
      const cur = course.fee?.currency || course.currency || "NGN";
      // ensure option
      if (els.feeCurrency.tagName === "SELECT") {
        const exists = Array.from(els.feeCurrency.options).some(
          (o) => o.value === cur,
        );
        if (!exists) {
          const opt = document.createElement("option");
          opt.value = cur;
          opt.textContent = cur;
          els.feeCurrency.appendChild(opt);
        }
      }
      els.feeCurrency.value = cur;
    }
    if (els.startDate) els.startDate.value = course.startDate || "";
    if (els.endDate) els.endDate.value = course.endDate || "";
    if (els.startTime) els.startTime.value = course.startTime || "";
    if (els.endTime) els.endTime.value = course.endTime || "";
    if (els.description) els.description.value = course.description || "";

    // delivery
    const dm = course.deliveryMethod || "Virtual";
    setDeliveryMethod(dm, els);

    // status
    const status = (course.status || "draft").toLowerCase();
    if (els.statusRadios && els.statusRadios.length) {
      els.statusRadios.forEach((r) => {
        if (r.value && r.value.toLowerCase() === status) r.checked = true;
      });
    }
    if (status === "draft" && els.statusDraft) els.statusDraft.checked = true;
    if (status === "published" && els.statusPublished)
      els.statusPublished.checked = true;

    // update titles
    if (els.formTitle) {
      // if it's h1 containing create, replace
      if (
        /create/i.test(els.formTitle.textContent) ||
        /new/i.test(els.formTitle.textContent)
      ) {
        els.formTitle.textContent = "Edit Course";
      } else if (!/edit/i.test(els.formTitle.textContent)) {
        // only if small title area
        if (els.formTitle.id === "form-title")
          els.formTitle.textContent = `Edit Course: ${course.name || course.token || ""}`;
      }
    }
  }

  function setupNewForm(els) {
    if (els.token) {
      els.token.value = `CRS-${YEAR}-XXX`;
      els.token.placeholder = getNextTokenPreview();
      els.token.readOnly = true;
      els.token.setAttribute("readonly", "readonly");
      els.token.title = "Token auto-generated on save";
      // store preview as data attribute
      els.token.dataset.placeholder = getNextTokenPreview();
    }
    // default NGN
    if (els.feeCurrency && !els.feeCurrency.value)
      els.feeCurrency.value = "NGN";
    setDeliveryMethod("Virtual", els);

    if (els.formTitle && /edit/i.test(els.formTitle.textContent)) {
      els.formTitle.textContent = "Create Course";
    }
  }

  // ---------- Validation ----------
  function clearErrors(els) {
    if (els.errorContainer) els.errorContainer.innerHTML = "";
    $$(".field-error, .error-msg, .input-error").forEach((e) => e.remove());
    $$(".has-error, .is-invalid, .error").forEach((e) =>
      e.classList.remove("has-error", "is-invalid", "error"),
    );
  }

  function showError(els, fieldKey, message) {
    const map = {
      name: els.name,
      field: els.field,
      location: els.location,
      venue: els.venue,
      creditHours: els.creditHours,
      feeAmount: els.feeAmount,
      feeCurrency: els.feeCurrency,
      startDate: els.startDate,
      endDate: els.endDate,
      startTime: els.startTime,
      endTime: els.endTime,
      description: els.description,
      deliveryMethod: els.deliveryContainer || els.deliveryRadios[0],
      status: els.statusRadios[0],
    };
    const target = map[fieldKey];
    if (target) {
      target.classList.add("has-error");
      // try to find existing error element
      let errEl = document.createElement("div");
      errEl.className = "field-error";
      errEl.style.cssText =
        "color: var(--color-danger, #ef4444); font-size:12px; margin-top:6px;";
      errEl.textContent = message;
      // insert after
      const parent = target.closest(".form-group") || target.parentElement;
      if (parent) {
        // check if already has error
        const existing = parent.querySelector(".field-error");
        if (existing) existing.remove();
        parent.appendChild(errEl);
      }
    }
    // summary
    if (els.errorContainer) {
      const div = document.createElement("div");
      div.textContent = message;
      div.style.cssText =
        "padding:8px 12px; background: var(--color-danger-bg, #fee2e2); color: var(--color-danger, #b91c1c); border-radius:6px; font-size:13px; margin-bottom:6px;";
      els.errorContainer.appendChild(div);
      els.errorContainer.style.display = "block";
    }
  }

  function validate(els) {
    clearErrors(els);
    const errors = [];

    const getVal = (el) => (el ? (el.value || "").trim() : "");

    const name = getVal(els.name);
    const field = getVal(els.field);
    const location = getVal(els.location);
    const venue = getVal(els.venue);
    const creditHours = getVal(els.creditHours);
    const feeAmount = getVal(els.feeAmount);
    const feeCurrency = getVal(els.feeCurrency) || "NGN";
    const startDate = getVal(els.startDate);
    const endDate = getVal(els.endDate);
    const startTime = getVal(els.startTime);
    const endTime = getVal(els.endTime);
    const description = getVal(els.description);

    // required
    if (!name) {
      errors.push({ field: "name", msg: "Course name is required" });
    }
    if (!field) {
      errors.push({ field: "field", msg: "Field / category is required" });
    }
    if (!location) {
      errors.push({ field: "location", msg: "Location is required" });
    }
    if (deliveryMethodValue === "On-Premise" && !venue) {
      errors.push({
        field: "venue",
        msg: "Venue is required for On-Premise courses",
      });
    }
    if (!creditHours) {
      errors.push({ field: "creditHours", msg: "Credit hours is required" });
    } else {
      const ch = Number(creditHours);
      if (isNaN(ch) || ch <= 0)
        errors.push({
          field: "creditHours",
          msg: "Credit hours must be a positive number",
        });
    }
    if (feeAmount === "") {
      errors.push({ field: "feeAmount", msg: "Fee amount is required" });
    } else {
      const amt = Number(feeAmount);
      if (isNaN(amt) || amt < 0)
        errors.push({
          field: "feeAmount",
          msg: "Fee amount must be 0 or greater",
        });
    }
    if (!CURRENCIES.includes(feeCurrency) && feeCurrency) {
      // allow but warn? just accept any but prefer known
    }
    if (!startDate)
      errors.push({ field: "startDate", msg: "Start date is required" });
    if (!endDate)
      errors.push({ field: "endDate", msg: "End date is required" });
    if (startDate && endDate) {
      const sd = new Date(startDate);
      const ed = new Date(endDate);
      if (isNaN(sd.getTime()))
        errors.push({ field: "startDate", msg: "Invalid start date" });
      if (isNaN(ed.getTime()))
        errors.push({ field: "endDate", msg: "Invalid end date" });
      if (!isNaN(sd.getTime()) && !isNaN(ed.getTime()) && ed < sd) {
        errors.push({
          field: "endDate",
          msg: "End date must be on or after start date",
        });
      }
    }
    if (!startTime)
      errors.push({ field: "startTime", msg: "Start time is required" });
    if (!endTime)
      errors.push({ field: "endTime", msg: "End time is required" });
    if (startDate && endDate && startTime && endTime && startDate === endDate) {
      // compare times
      const toMins = (t) => {
        const parts = t.split(":");
        if (parts.length < 2) return NaN;
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      };
      const sm = toMins(startTime);
      const em = toMins(endTime);
      if (!isNaN(sm) && !isNaN(em) && em <= sm) {
        errors.push({
          field: "endTime",
          msg: "End time must be after start time on the same date",
        });
      }
    }

    // delivery method required (internal)
    if (!deliveryMethodValue)
      errors.push({
        field: "deliveryMethod",
        msg: "Delivery method is required",
      });

    // optional description length check
    if (description && description.length < 10) {
      // soft warning - not error, but we can allow
    }

    if (errors.length) {
      errors.forEach((e) => showError(els, e.field, e.msg));
      safeToast(errors[0].msg, "error");
      return { valid: false, errors };
    }
    return { valid: true };
  }

  function collectData(els, statusOverride) {
    const getVal = (el) => (el ? el.value.trim() : "");
    const name = getVal(els.name);
    const field = getVal(els.field);
    const location = getVal(els.location);
    const venueRaw = getVal(els.venue);
    const creditHours = els.creditHours ? Number(els.creditHours.value) : 0;
    const feeAmount = els.feeAmount ? Number(els.feeAmount.value) : 0;
    const feeCurrency = els.feeCurrency
      ? els.feeCurrency.value.trim() || "NGN"
      : "NGN";
    const startDate = getVal(els.startDate);
    const endDate = getVal(els.endDate);
    const startTime = getVal(els.startTime);
    const endTime = getVal(els.endTime);
    const description = getVal(els.description);

    // status resolution
    let status = statusOverride;
    if (!status) {
      // check radios
      const checked = document.querySelector(
        'input[name="status"]:checked, input[name="course-status"]:checked',
      );
      if (checked) status = checked.value;
      else if (els.statusDraft && els.statusDraft.checked) status = "draft";
      else if (els.statusPublished && els.statusPublished.checked)
        status = "published";
      else status = "draft";
    }
    status = (status || "draft").toLowerCase();
    if (!["draft", "published"].includes(status)) status = "draft";

    const deliveryMethod = deliveryMethodValue || "Virtual";
    const venue =
      deliveryMethod === "Virtual" ? "Virtual" : venueRaw || location || "";

    // Include uploaded image if exists - NEW
    const image =
      uploadedImageData ||
      (currentCourse && (currentCourse.image || currentCourse.coverImage)) ||
      null;

    return {
      name,
      field,
      location,
      venue,
      creditHours,
      image,
      fee: { amount: feeAmount, currency: feeCurrency },
      startDate,
      endDate,
      startTime,
      endTime,
      deliveryMethod,
      description,
      status,
    };
  }

  function updateButtonLabels(isEdit, els) {
    if (!isEdit) {
      // create mode: ensure labels
      if (els.btnDraft) {
        els.btnDraft.textContent = els.btnDraft.textContent.includes("Draft")
          ? els.btnDraft.textContent
          : "Save Draft";
        els.btnDraft.dataset.status = "draft";
      }
      if (els.btnPublish) {
        // Might be create & publish
        if (!/publish/i.test(els.btnPublish.textContent)) {
          // keep original but ensure
        }
        els.btnPublish.dataset.status = "published";
      }
      if (els.btnSaveChanges) {
        els.btnSaveChanges.style.display = "none";
      }
    } else {
      // edit mode
      if (els.btnPublish) {
        // Change to Save Changes if exists
        if (els.btnSaveChanges) {
          els.btnPublish.textContent = "Create & Publish";
          // Actually Save Changes is primary in edit
          els.btnSaveChanges.style.display = "";
          els.btnSaveChanges.textContent = "Save Changes";
        } else {
          // repurpose publish button as Save Changes
          els.btnPublish.textContent = "Save Changes";
          els.btnPublish.dataset.status = ""; // use radio
        }
      }
      if (els.formTitle) {
        // already handled
      }
    }
  }

  // Image upload handling - NEW
  function handleImageFile(file, els) {
    if (!file) return;
    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      safeToast("Image too large. Max 2MB allowed.", "error");
      return;
    }
    // Validate type
    if (!file.type.startsWith("image/")) {
      safeToast("Please upload an image file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImageData = e.target.result;
      uploadedImageName = file.name;
      uploadedImageSize = (file.size / 1024).toFixed(1) + " KB";

      // Show preview
      if (els.imagePreviewImg) els.imagePreviewImg.src = uploadedImageData;
      const previewImg = document.getElementById("course-image-preview-img");
      if (previewImg) previewImg.src = uploadedImageData;

      const nameEl =
        els.imageNameEl || document.getElementById("course-image-name");
      const sizeEl =
        els.imageSizeEl || document.getElementById("course-image-size");
      if (nameEl) nameEl.textContent = uploadedImageName;
      if (sizeEl) sizeEl.textContent = uploadedImageSize;

      const preview =
        els.imagePreview || document.getElementById("course-image-preview");
      const area =
        els.imageUploadArea ||
        document.getElementById("course-image-upload-area");
      if (preview) preview.style.display = "block";
      if (area) area.style.display = "none";

      safeToast("Image uploaded successfully", "success");
    };
    reader.readAsDataURL(file);
  }

  function clearImage(els) {
    uploadedImageData = null;
    uploadedImageName = null;
    uploadedImageSize = null;
    if (els.imageInput) els.imageInput.value = "";
    const input = document.getElementById("course-image-input");
    if (input) input.value = "";
    const preview =
      els.imagePreview || document.getElementById("course-image-preview");
    const area =
      els.imageUploadArea ||
      document.getElementById("course-image-upload-area");
    const previewImg =
      els.imagePreviewImg ||
      document.getElementById("course-image-preview-img");
    if (preview) preview.style.display = "none";
    if (area) area.style.display = "block";
    if (previewImg) previewImg.src = "";
  }

  function initEvents(els) {
    // Image upload events - NEW
    if (els.imageUploadArea) {
      els.imageUploadArea.addEventListener("click", () => {
        if (els.imageInput) els.imageInput.click();
        else {
          const input = document.getElementById("course-image-input");
          if (input) input.click();
        }
      });

      els.imageUploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        els.imageUploadArea.classList.add("dragover");
      });

      els.imageUploadArea.addEventListener("dragleave", () => {
        els.imageUploadArea.classList.remove("dragover");
      });

      els.imageUploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        els.imageUploadArea.classList.remove("dragover");
        const file = e.dataTransfer.files[0];
        if (file) handleImageFile(file, els);
      });
    }

    if (els.imageInput) {
      els.imageInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) handleImageFile(file, els);
      });
    }

    // Also bind via direct IDs for robustness
    const directInput = document.getElementById("course-image-input");
    const directArea = document.getElementById("course-image-upload-area");
    const directRemove = document.getElementById("course-image-remove");

    if (directInput && !els.imageInput) {
      directInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) handleImageFile(file, els);
      });
    }

    if (directArea && !els.imageUploadArea) {
      directArea.addEventListener("click", () => {
        if (directInput) directInput.click();
      });
    }

    if (directRemove) {
      directRemove.addEventListener("click", (e) => {
        e.stopPropagation();
        clearImage(els);
      });
    }

    if (els.imageRemoveBtn) {
      els.imageRemoveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearImage(els);
      });
    }

    // Delivery method toggle: segmented buttons
    const handleDeliveryClick = (e) => {
      const btn = e.currentTarget;
      const val =
        btn.dataset.delivery ||
        btn.dataset.value ||
        btn.getAttribute("data-value") ||
        btn.textContent.trim();
      // normalize to Virtual / On-Premise
      let normalized = "Virtual";
      if (/on/i.test(val) && /prem/i.test(val)) normalized = "On-Premise";
      else if (/virtual/i.test(val)) normalized = "Virtual";
      else if (val === "On-Premise" || val === "OnPremise")
        normalized = "On-Premise";
      else if (val === "Virtual") normalized = "Virtual";
      else {
        // if button text exactly matches
        if (val.toLowerCase().includes("virtual")) normalized = "Virtual";
        else normalized = "On-Premise";
      }
      setDeliveryMethod(normalized, els);
    };

    els.deliveryButtons.forEach((btn) => {
      btn.addEventListener("click", handleDeliveryClick);
    });

    if (els.deliveryContainer) {
      // delegation for dynamic buttons
      els.deliveryContainer.addEventListener("click", (e) => {
        const btn = e.target.closest("button, [data-delivery], [data-value]");
        if (!btn) return;
        handleDeliveryClick({ currentTarget: btn });
      });
    }

    els.deliveryRadios.forEach((r) => {
      r.addEventListener("change", (e) => {
        if (e.target.checked) setDeliveryMethod(e.target.value, els);
      });
    });

    // Cancel
    const goToCourses = () => {
      window.location.href = "courses.html";
    };
    if (els.btnCancel) {
      els.btnCancel.addEventListener("click", (e) => {
        e.preventDefault();
        goToCourses();
      });
    }

    // Draft button
    if (els.btnDraft) {
      els.btnDraft.addEventListener("click", (e) => {
        e.preventDefault();
        pendingStatus = "draft";
        if (els.form) {
          if (typeof els.form.requestSubmit === "function")
            els.form.requestSubmit();
          else
            els.form.dispatchEvent(new Event("submit", { cancelable: true }));
        }
      });
    }

    // Publish / Save buttons
    const handlePublishClick = (e) => {
      e.preventDefault();
      // If this is the Save Changes button in edit mode and it has no forced status, respect radio
      const forced = e.currentTarget.dataset.status;
      if (forced === "draft") pendingStatus = "draft";
      else if (forced === "published") pendingStatus = "published";
      else {
        // if edit and button is Save Changes without dataset, use radio or keep current
        if (editingId && !forced) {
          // check if still has draft/published radio? Use its value
          const checked = document.querySelector(
            'input[name="status"]:checked',
          );
          pendingStatus = checked
            ? checked.value
            : currentCourse?.status || "published";
        } else {
          pendingStatus = "published";
        }
      }
      if (els.form) {
        if (typeof els.form.requestSubmit === "function")
          els.form.requestSubmit();
        else els.form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    };

    if (els.btnPublish)
      els.btnPublish.addEventListener("click", handlePublishClick);
    if (els.btnSaveChanges)
      els.btnSaveChanges.addEventListener("click", handlePublishClick);

    // Form submit
    if (els.form) {
      els.form.addEventListener("submit", async (e) => {
        e.preventDefault();
        // prevent double
        const submitBtns = [
          els.btnDraft,
          els.btnPublish,
          els.btnSaveChanges,
        ].filter(Boolean);
        submitBtns.forEach((b) => (b.disabled = true));

        const validation = validate(els);
        if (!validation.valid) {
          submitBtns.forEach((b) => (b.disabled = false));
          pendingStatus = null;
          return;
        }

        const data = collectData(els, pendingStatus);

        try {
          if (!window.Store) {
            safeToast("Store not ready. Please refresh.", "error");
            submitBtns.forEach((b) => (b.disabled = false));
            return;
          }
          let saved;
          if (editingId) {
            saved = Store.update(COLLECTION, editingId, data);
            if (!saved) {
              safeToast("Failed to update course. Not found.", "error");
              submitBtns.forEach((b) => (b.disabled = false));
              return;
            }
            // Flash toast for next page
            try {
              sessionStorage.setItem(
                "studypod_flash_toast",
                `Course "${saved.name}" updated`,
              );
            } catch (e) {}
            safeToast(`Course "${safeEscape(saved.name)}" updated`, "success");
          } else {
            saved = Store.create(COLLECTION, data);
            try {
              sessionStorage.setItem(
                "studypod_flash_toast",
                `Course "${saved.name}" ${saved.status === "published" ? "published" : "saved as draft"}`,
              );
            } catch (e) {}
            safeToast(
              `Course "${safeEscape(saved.name)}" ${saved.status === "published" ? "published" : "saved"}`,
              "success",
            );
          }

          // slight delay to show toast then redirect
          setTimeout(() => {
            window.location.href = "courses.html";
          }, 500);
        } catch (err) {
          console.error("[course-form] save failed", err);
          safeToast("Failed to save course: " + (err.message || err), "error");
          submitBtns.forEach((b) => (b.disabled = false));
          pendingStatus = null;
        }
      });
    }

    // Live validation clearing on input
    const inputs = [
      els.name,
      els.field,
      els.location,
      els.venue,
      els.creditHours,
      els.feeAmount,
      els.startDate,
      els.endDate,
      els.startTime,
      els.endTime,
      els.description,
    ].filter(Boolean);
    inputs.forEach((inp) => {
      inp.addEventListener("input", () => {
        inp.classList.remove("has-error");
        const parent = inp.closest(".form-group");
        if (parent) {
          const err = parent.querySelector(".field-error");
          if (err) err.remove();
        }
      });
    });
  }

  function init() {
    // Layout & nav
    try {
      if (window.Layout && typeof Layout.initLayout === "function") {
        Layout.initLayout({
          active: "courses",
          breadcrumb: {
            parent: "Dashboard",
            current: editingId ? "Edit Course" : "Create Course",
          },
        });
      } else if (typeof setActiveNav === "function") {
        setActiveNav("courses");
      }
    } catch (e) {}

    editingId = getQueryParam("id");
    const els = getElements();

    // Ensure selects populated
    ensureFieldOptions(els.field);
    ensureCurrencyOptions(els.feeCurrency);

    // Token placeholder handling
    if (!editingId) {
      setupNewForm(els);
    }

    // If editing, load
    if (editingId) {
      if (!window.Store) {
        // retry after short delay
        setTimeout(init, 100);
        return;
      }
      const course = Store.getById(COLLECTION, editingId);
      if (!course) {
        safeToast("Course not found", "error");
        setTimeout(() => {
          window.location.href = "courses.html";
        }, 800);
        return;
      }
      currentCourse = course;
      populateForm(course, els);
      updateButtonLabels(true, els);
    } else {
      updateButtonLabels(false, els);
      // default delivery toggle already set
    }

    // Delivery initial toggle already handled but ensure
    if (
      !els.deliveryContainer &&
      !els.deliveryRadios.length &&
      !els.deliveryButtons.length
    ) {
      // No UI for delivery, default Virtual
      deliveryMethodValue = "Virtual";
    }

    initEvents(els);

    // Handle flash toast for edit page? Not needed

    // Focus first field
    if (els.name)
      setTimeout(() => {
        try {
          els.name.focus();
        } catch (e) {}
      }, 200);

    // If token input is clickable placeholder, generate preview on hover? Not needed

    console.log("[course-form] initialized", {
      editingId,
      isEdit: !!editingId,
    });
  }

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose for debugging
  window.CourseForm = {
    init,
    getElements,
    setDeliveryMethod,
    collectData: () => {
      const els = getElements();
      return collectData(els, pendingStatus);
    },
  };
})();
