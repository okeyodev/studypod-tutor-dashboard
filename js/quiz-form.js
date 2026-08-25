/**
 * QUIZ-FORM.JS - Quiz builder with questions
 */

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav("quizzes");
  init();
});

let questionsBuffer = [];
let editingQuizId = null;

function getId() {
  return new URLSearchParams(location.search).get("id");
}

function init() {
  if (typeof Store === "undefined") {
    setTimeout(init, 200);
    return;
  }
  const id = getId();
  editingQuizId = id;
  const isEdit = !!id;

  // Courses dropdown
  const courseSelect = document.getElementById("quiz-course");
  const courses = Store.get("courses");
  if (courseSelect) {
    courseSelect.innerHTML =
      '<option value="">Select Course</option>' +
      courses
        .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
        .join("");
  }

  // Token
  const tokenEl = document.getElementById("quiz-token");
  if (tokenEl) {
    if (isEdit) {
      const quiz = Store.getById("quizzes", id);
      if (quiz) tokenEl.value = quiz.token;
    } else {
      const count = Store.get("quizzes").length + 1;
      const year = new Date().getFullYear();
      tokenEl.value = `QUIZ-${year}-${String(count).padStart(3, "0")}`;
    }
  }

  if (isEdit) {
    const quiz = Store.getById("quizzes", id);
    if (!quiz) {
      toast("Quiz not found");
      location.href = "quizzes.html";
      return;
    }
    document.getElementById("form-title").textContent = "Edit Quiz";
    setVal("quiz-title", quiz.title);
    setVal("quiz-course", quiz.courseId);
    setVal("quiz-description", quiz.description);
    setVal("quiz-time-limit", quiz.timeLimit);
    setVal("quiz-max-attempts", quiz.maximumAttempts);
    setVal("quiz-passing-score", quiz.passingScore);
    const rand = document.getElementById("quiz-randomize");
    if (rand) rand.checked = !!quiz.randomizeQuestions;
    const show = document.getElementById("quiz-show-results");
    if (show) show.checked = !!quiz.showResults;
    setRadio("quiz-status", quiz.status);
    questionsBuffer = Store.filter("questions", (q) => q.quizId === id).sort(
      (a, b) => a.order - b.order,
    );
  } else {
    questionsBuffer = [];
  }

  renderQuestions();

  document
    .getElementById("add-question-btn")
    ?.addEventListener("click", () => addQuestion());

  const form = document.getElementById("quiz-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const status =
        e.submitter?.dataset.status || getRadio("quiz-status") || "draft";
      handleSubmit(status);
    });
  }
}

function addQuestion(type = "multiple-choice") {
  const id = `temp_${Date.now()}`;
  questionsBuffer.push({
    id,
    temp: true,
    type,
    question: "",
    options:
      type === "true-false"
        ? ["True", "False"]
        : ["Option 1", "Option 2", "Option 3", "Option 4"],
    correctAnswer: "",
    points: 10,
    order: questionsBuffer.length + 1,
  });
  renderQuestions();
}

function renderQuestions() {
  const container = document.getElementById("questions-container");
  if (!container) return;
  if (!questionsBuffer.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-title">No questions yet</div><div class="empty-sub">Add questions to build your quiz</div><button type="button" class="btn-primary" onclick="document.getElementById('add-question-btn').click()" style="margin-top:12px">+ Add Question</button></div>`;
    return;
  }
  container.innerHTML = questionsBuffer
    .map(
      (q, idx) => `
    <div class="question-card" data-qid="${q.id}">
      <div class="question-head">
        <div style="display:flex;align-items:center;gap:8px"><span class="question-number">Q${idx + 1}</span><span class="question-type">${q.type}</span></div>
        <div class="question-actions">
          <button type="button" class="btn-light" onclick="moveQuestion('${q.id}', -1)" ${idx === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="btn-light" onclick="moveQuestion('${q.id}', 1)" ${idx === questionsBuffer.length - 1 ? "disabled" : ""}>↓</button>
          <button type="button" class="btn-light" onclick="duplicateQuestion('${q.id}')">Dup</button>
          <button type="button" class="btn-light" style="color:var(--color-danger)" onclick="deleteQuestion('${q.id}')">×</button>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Question</label><textarea class="form-textarea" style="min-height:60px" oninput="updateQuestion('${q.id}', 'question', this.value)">${escapeHtml(q.question)}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
        <div class="form-group"><label class="form-label">Type</label><select class="form-select" onchange="changeType('${q.id}', this.value)"><option value="multiple-choice" ${q.type === "multiple-choice" ? "selected" : ""}>Multiple Choice</option><option value="true-false" ${q.type === "true-false" ? "selected" : ""}>True/False</option></select></div>
        <div class="form-group"><label class="form-label">Points</label><input type="number" class="form-input" value="${q.points}" min="1" oninput="updateQuestion('${q.id}', 'points', parseInt(this.value)||0)"></div>
      </div>
      <div class="options-list">
        ${q.options
          .map(
            (opt, oIdx) => `
          <div class="option-row">
            <div class="option-correct ${q.correctAnswer === opt ? "active" : ""}" onclick="setCorrect('${q.id}', '${escapeHtml(opt).replace(/'/g, "\\'")}')">${q.correctAnswer === opt ? "" : ""}</div>
            <input type="text" class="form-input" value="${escapeHtml(opt)}" oninput="updateOption('${q.id}', ${oIdx}, this.value)">
            ${q.type === "multiple-choice" ? `<button type="button" class="btn-light" onclick="removeOption('${q.id}', ${oIdx})">×</button>` : ""}
          </div>
        `,
          )
          .join("")}
        ${q.type === "multiple-choice" ? `<button type="button" class="btn-light" style="margin-top:8px" onclick="addOption('${q.id}')">+ Add Option</button>` : ""}
      </div>
    </div>
  `,
    )
    .join("");
}

window.updateQuestion = function (qid, field, val) {
  const q = questionsBuffer.find((x) => x.id === qid);
  if (q) q[field] = val;
};
window.updateOption = function (qid, oIdx, val) {
  const q = questionsBuffer.find((x) => x.id === qid);
  if (q) {
    q.options[oIdx] = val;
    renderQuestions();
  }
};
window.addOption = function (qid) {
  const q = questionsBuffer.find((x) => x.id === qid);
  if (q) {
    q.options.push(`Option ${q.options.length + 1}`);
    renderQuestions();
  }
};
window.removeOption = function (qid, oIdx) {
  const q = questionsBuffer.find((x) => x.id === qid);
  if (q && q.options.length > 2) {
    q.options.splice(oIdx, 1);
    renderQuestions();
  }
};
window.setCorrect = function (qid, val) {
  const q = questionsBuffer.find((x) => x.id === qid);
  if (q) {
    q.correctAnswer = val;
    renderQuestions();
  }
};
window.changeType = function (qid, type) {
  const q = questionsBuffer.find((x) => x.id === qid);
  if (q) {
    q.type = type;
    q.options =
      type === "true-false"
        ? ["True", "False"]
        : ["Option 1", "Option 2", "Option 3", "Option 4"];
    q.correctAnswer = "";
    renderQuestions();
  }
};
window.moveQuestion = function (qid, dir) {
  const idx = questionsBuffer.findIndex((x) => x.id === qid);
  if (idx === -1) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= questionsBuffer.length) return;
  const tmp = questionsBuffer[idx];
  questionsBuffer[idx] = questionsBuffer[newIdx];
  questionsBuffer[newIdx] = tmp;
  questionsBuffer.forEach((q, i) => (q.order = i + 1));
  renderQuestions();
};
window.duplicateQuestion = function (qid) {
  const q = questionsBuffer.find((x) => x.id === qid);
  if (!q) return;
  const copy = {
    ...q,
    id: `temp_${Date.now()}`,
    question: q.question + " (Copy)",
    order: questionsBuffer.length + 1,
    temp: true,
  };
  questionsBuffer.push(copy);
  renderQuestions();
};
window.deleteQuestion = function (qid) {
  if (!confirm("Delete this question?")) return;
  questionsBuffer = questionsBuffer.filter((x) => x.id !== qid);
  questionsBuffer.forEach((q, i) => (q.order = i + 1));
  renderQuestions();
};

function handleSubmit(status) {
  const data = {
    title: getVal("quiz-title"),
    courseId: getVal("quiz-course"),
    description: getVal("quiz-description"),
    timeLimit: parseInt(getVal("quiz-time-limit")) || 30,
    maximumAttempts: parseInt(getVal("quiz-max-attempts")) || 1,
    passingScore: parseInt(getVal("quiz-passing-score")) || 70,
    randomizeQuestions:
      document.getElementById("quiz-randomize")?.checked || false,
    showResults: document.getElementById("quiz-show-results")?.checked || true,
    status,
  };

  if (!data.title) {
    toast("Title required");
    return;
  }
  if (!data.courseId) {
    toast("Course required");
    return;
  }
  if (!questionsBuffer.length) {
    toast("Add at least one question");
    return;
  }
  const invalid = questionsBuffer.find(
    (q) => !q.question.trim() || !q.correctAnswer,
  );
  if (invalid) {
    toast("All questions must have text and correct answer");
    return;
  }

  try {
    let quizId = editingQuizId;
    if (editingQuizId) {
      Store.update("quizzes", editingQuizId, data);
    } else {
      const created = Store.create("quizzes", data);
      quizId = created.id;
    }

    // Save questions
    const existingQs = Store.filter("questions", (q) => q.quizId === quizId);
    existingQs.forEach((q) => Store.delete("questions", q.id));
    questionsBuffer.forEach((q) => {
      Store.create("questions", {
        quizId,
        type: q.type,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        points: q.points,
        order: q.order,
      });
    });

    toast(editingQuizId ? "Quiz updated" : "Quiz created");
    setTimeout(() => (location.href = "quizzes.html"), 600);
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
