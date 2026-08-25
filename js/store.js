/**
 * StudyPod Central Store - Version 2.0
 * Centralized data layer for all collections
 * Architecture: UI -> Page JS -> Store -> localStorage
 */

const STORAGE_VERSION = 2;
const VERSION_KEY = "studypod_version";

const COLLECTION_KEYS = {
  courses: "studypod_courses",
  students: "studypod_students",
  enrollments: "studypod_enrollments",
  conferences: "studypod_conferences",
  registrations: "studypod_registrations",
  assignments: "studypod_assignments",
  submissions: "studypod_assignment_submissions",
  quizzes: "studypod_quizzes",
  questions: "studypod_quiz_questions",
  attempts: "studypod_quiz_attempts",
  emails: "studypod_emails",
  analytics: "studypod_analytics",
  settings: "studypod_settings",
};

const TOKEN_PREFIXES = {
  courses: "CRS",
  conferences: "CONF",
  assignments: "ASG",
  quizzes: "QUIZ",
  registrations: "REG",
  students: "STU",
};

const ID_PREFIXES = {
  courses: "course",
  students: "student",
  enrollments: "enroll",
  conferences: "conference",
  registrations: "reg",
  assignments: "assignment",
  submissions: "submission",
  quizzes: "quiz",
  questions: "question",
  attempts: "attempt",
  emails: "email",
};

function _now() {
  return new Date().toISOString();
}

function _escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
}

function _generateId(collection) {
  const prefix = ID_PREFIXES[collection] || collection;
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 9000) + 1000}`;
}

function _generateToken(collection) {
  const prefix = TOKEN_PREFIXES[collection] || "GEN";
  const year = new Date().getFullYear();
  const all = Store.get(collection);
  const count = all.length + 1;
  const padded = String(count).padStart(3, "0");
  return `${prefix}-${year}-${padded}`;
}

function _getRaw(key) {
  try {
    const v = localStorage.getItem(key);
    if (!v) return null;
    return JSON.parse(v);
  } catch (e) {
    return null;
  }
}

function _setRaw(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("localStorage write failed", e);
  }
}

function _dispatch(collection, action, data) {
  window.dispatchEvent(
    new CustomEvent("studypod:datachange", {
      detail: { collection, action, data, timestamp: Date.now() },
    }),
  );
}

const Store = {
  get(collection) {
    const key = COLLECTION_KEYS[collection];
    if (!key) {
      console.warn("Unknown collection", collection);
      return [];
    }
    const val = _getRaw(key);
    return Array.isArray(val) ? val : [];
  },

  getById(collection, id) {
    return this.get(collection).find((item) => item.id === id) || null;
  },

  create(collection, data) {
    const all = this.get(collection);
    const id = data.id || _generateId(collection);
    const token =
      data.token ||
      (TOKEN_PREFIXES[collection] ? _generateToken(collection) : undefined);
    const now = _now();
    const item = {
      id,
      ...(token ? { token } : {}),
      ...data,
      id,
      ...(token ? { token } : {}),
      createdAt: data.createdAt || now,
      updatedAt: now,
    };
    // Ensure token not overwritten if provided
    if (data.token) item.token = data.token;
    if (TOKEN_PREFIXES[collection] && !item.token) item.token = token;

    all.unshift(item);
    _setRaw(COLLECTION_KEYS[collection], all);
    _dispatch(collection, "create", item);
    return item;
  },

  update(collection, id, data) {
    const all = this.get(collection);
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const updated = {
      ...all[idx],
      ...data,
      id: all[idx].id, // don't allow id change
      token: all[idx].token || data.token, // preserve token
      updatedAt: _now(),
    };
    all[idx] = updated;
    _setRaw(COLLECTION_KEYS[collection], all);
    _dispatch(collection, "update", updated);
    return updated;
  },

  delete(collection, id) {
    let all = this.get(collection);
    const item = all.find((i) => i.id === id);
    if (!item) return false;
    all = all.filter((i) => i.id !== id);
    _setRaw(COLLECTION_KEYS[collection], all);
    _dispatch(collection, "delete", item);
    return true;
  },

  find(collection, predicate) {
    return this.get(collection).find(predicate) || null;
  },

  filter(collection, predicate) {
    return this.get(collection).filter(predicate);
  },

  count(collection) {
    return this.get(collection).length;
  },

  clear(collection) {
    const key = COLLECTION_KEYS[collection];
    if (!key) return;
    _setRaw(key, []);
    _dispatch(collection, "clear", null);
  },

  clearAll() {
    Object.values(COLLECTION_KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(VERSION_KEY);
  },

  reset() {
    this.clearAll();
    this.seed();
    localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
  },

  // Migration from old structures
  migrate() {
    const currentVersion = parseInt(
      localStorage.getItem(VERSION_KEY) || "0",
      10,
    );
    if (currentVersion >= STORAGE_VERSION) return;

    // Migrate old email key studypod_tutor_emails -> studypod_emails
    const oldEmails = _getRaw("studypod_tutor_emails");
    if (
      oldEmails &&
      Array.isArray(oldEmails) &&
      this.get("emails").length === 0
    ) {
      const migrated = oldEmails.map((e) => ({
        id: e.id || _generateId("emails"),
        from: e.from || "Unknown",
        fromEmail: e.email || e.fromEmail || "unknown@studypod.com",
        to: e.to || "Sarah Davis",
        toEmail: e.toEmail || "",
        subject: e.subject || "",
        preview: e.preview || (e.body ? e.body.slice(0, 90) : ""),
        body: e.body || "",
        folder: e.folder || "inbox",
        read: !!e.read,
        starred: !!e.starred,
        createdAt: e.date || e.createdAt || _now(),
        updatedAt: _now(),
      }));
      _setRaw(COLLECTION_KEYS.emails, migrated);
    }

    // Migrate old tutorData if exists in localStorage? No action needed as seed will create new

    localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
    console.log("[Store] Migrated to version", STORAGE_VERSION);
  },

  seed() {
    // Don't seed if already has data (unless forced)
    if (this.get("courses").length > 0) return;

    console.log("[Store] Seeding demo data...");

    // STUDENTS - preserve demo users
    const students = [
      {
        id: "student_001",
        firstName: "Michael",
        lastName: "Johnson",
        email: "michael.johnson@studypod.com",
        phone: "+234 801 234 5678",
        membershipNo: "STU-2024-001",
        avatar: "MJ",
        createdAt: "2024-09-10T09:00:00Z",
      },
      {
        id: "student_002",
        firstName: "Ava",
        lastName: "Kim",
        email: "ava.kim@studypod.com",
        phone: "+234 802 345 6789",
        membershipNo: "STU-2024-002",
        avatar: "AK",
        createdAt: "2024-09-12T10:00:00Z",
      },
      {
        id: "student_003",
        firstName: "Ryan",
        lastName: "Lee",
        email: "ryan.lee@studypod.com",
        phone: "+234 803 456 7890",
        membershipNo: "STU-2024-003",
        avatar: "RL",
        createdAt: "2024-09-15T11:00:00Z",
      },
      {
        id: "student_004",
        firstName: "Emma",
        lastName: "Patel",
        email: "emma.patel@studypod.com",
        phone: "+234 804 567 8901",
        membershipNo: "STU-2024-004",
        avatar: "EP",
        createdAt: "2024-09-18T09:30:00Z",
      },
      {
        id: "student_005",
        firstName: "David",
        lastName: "Okafor",
        email: "david.okafor@studypod.com",
        phone: "+234 805 678 9012",
        membershipNo: "STU-2024-005",
        avatar: "DO",
        createdAt: "2024-10-01T08:00:00Z",
      },
      {
        id: "student_006",
        firstName: "Sophia",
        lastName: "Chen",
        email: "sophia.chen@studypod.com",
        phone: "+234 806 789 0123",
        membershipNo: "STU-2024-006",
        avatar: "SC",
        createdAt: "2024-10-05T10:00:00Z",
      },
    ];

    // COURSES
    const courses = [
      {
        id: "course_001",
        token: "CRS-2024-001",
        name: "Python for Data Science",
        field: "Programming",
        location: "Lagos, Nigeria",
        venue: "Virtual",
        creditHours: 12,
        fee: { amount: 120000, currency: "NGN" },
        startDate: "2026-09-01",
        endDate: "2026-11-30",
        startTime: "09:00",
        endTime: "12:00",
        deliveryMethod: "Virtual",
        description:
          "Master Python for data analysis, visualization and machine learning. Includes hands-on projects.",
        status: "published",
        createdAt: "2024-08-01T10:00:00Z",
        updatedAt: _now(),
      },
      {
        id: "course_002",
        token: "CRS-2024-002",
        name: "UX Design Fundamentals",
        field: "Design",
        location: "Abuja, Nigeria",
        venue: "StudyPod Hub, Abuja",
        creditHours: 8,
        fee: { amount: 85000, currency: "NGN" },
        startDate: "2026-09-15",
        endDate: "2026-11-15",
        startTime: "10:00",
        endTime: "13:00",
        deliveryMethod: "On-Premise",
        description:
          "Learn user research, wireframing, prototyping and usability testing.",
        status: "published",
        createdAt: "2024-08-10T10:00:00Z",
        updatedAt: _now(),
      },
      {
        id: "course_003",
        token: "CRS-2024-003",
        name: "Digital Marketing Strategy",
        field: "Marketing",
        location: "Lagos, Nigeria",
        venue: "Virtual",
        creditHours: 10,
        fee: { amount: 95000, currency: "NGN" },
        startDate: "2026-10-01",
        endDate: "2026-12-01",
        startTime: "14:00",
        endTime: "16:00",
        deliveryMethod: "Virtual",
        description:
          "Complete digital marketing from SEO to paid ads and analytics.",
        status: "published",
        createdAt: "2024-08-15T10:00:00Z",
        updatedAt: _now(),
      },
      {
        id: "course_004",
        token: "CRS-2024-004",
        name: "React Advanced Patterns",
        field: "Programming",
        location: "Lagos, Nigeria",
        venue: "StudyPod HQ",
        creditHours: 15,
        fee: { amount: 150000, currency: "NGN" },
        startDate: "2026-11-01",
        endDate: "2027-01-15",
        startTime: "09:00",
        endTime: "12:00",
        deliveryMethod: "On-Premise",
        description:
          "Advanced React patterns, state management and performance.",
        status: "draft",
        createdAt: "2024-09-01T10:00:00Z",
        updatedAt: _now(),
      },
      {
        id: "course_005",
        token: "CRS-2024-005",
        name: "Business Analytics",
        field: "Business",
        location: "Port Harcourt, Nigeria",
        venue: "Virtual",
        creditHours: 9,
        fee: { amount: 110000, currency: "NGN" },
        startDate: "2026-09-20",
        endDate: "2026-11-20",
        startTime: "11:00",
        endTime: "14:00",
        deliveryMethod: "Virtual",
        description: "Data-driven business decision making.",
        status: "published",
        createdAt: "2024-09-10T10:00:00Z",
        updatedAt: _now(),
      },
    ];

    // ENROLLMENTS
    const enrollments = [
      {
        id: "enroll_001",
        studentId: "student_001",
        courseId: "course_001",
        location: "Lagos",
        creditHours: 12,
        startDate: "2026-09-01",
        amountPaid: { amount: 120000, currency: "NGN" },
        deliveryMethod: "Virtual",
        paymentStatus: "paid",
        transactionReference: "TXN-001-2024",
        paymentDate: "2026-08-20",
        enrolledAt: "2026-08-20T10:00:00Z",
      },
      {
        id: "enroll_002",
        studentId: "student_002",
        courseId: "course_002",
        location: "Abuja",
        creditHours: 8,
        startDate: "2026-09-15",
        amountPaid: { amount: 85000, currency: "NGN" },
        deliveryMethod: "On-Premise",
        paymentStatus: "paid",
        transactionReference: "TXN-002-2024",
        paymentDate: "2026-08-22",
        enrolledAt: "2026-08-22T11:00:00Z",
      },
      {
        id: "enroll_003",
        studentId: "student_003",
        courseId: "course_003",
        location: "Lagos",
        creditHours: 10,
        startDate: "2026-10-01",
        amountPaid: { amount: 95000, currency: "NGN" },
        deliveryMethod: "Virtual",
        paymentStatus: "paid",
        transactionReference: "TXN-003-2024",
        paymentDate: "2026-08-25",
        enrolledAt: "2026-08-25T09:00:00Z",
      },
      {
        id: "enroll_004",
        studentId: "student_004",
        courseId: "course_001",
        location: "Lagos",
        creditHours: 12,
        startDate: "2026-09-01",
        amountPaid: { amount: 120000, currency: "NGN" },
        deliveryMethod: "Virtual",
        paymentStatus: "paid",
        transactionReference: "TXN-004-2024",
        paymentDate: "2026-08-18",
        enrolledAt: "2026-08-18T14:00:00Z",
      },
      {
        id: "enroll_005",
        studentId: "student_002",
        courseId: "course_001",
        location: "Lagos",
        creditHours: 12,
        startDate: "2026-09-01",
        amountPaid: { amount: 60000, currency: "NGN" },
        deliveryMethod: "Virtual",
        paymentStatus: "partial",
        transactionReference: "TXN-005-2024",
        paymentDate: "2026-08-28",
        enrolledAt: "2026-08-28T10:00:00Z",
      },
    ];

    // CONFERENCES
    const conferences = [
      {
        id: "conference_001",
        token: "CONF-2026-001",
        name: "React State Management Masterclass",
        title: "Advanced React State Patterns",
        workshopId: "React Development Workshop",
        location: {
          state: "Lagos",
          country: "Nigeria",
          venue: "StudyPod HQ, Lagos",
        },
        fee: { amount: 25000, currency: "NGN" },
        startDate: "2026-08-24",
        endDate: "2026-08-24",
        startTime: "16:00",
        endTime: "18:00",
        deliveryMethod: "On-Premise",
        status: "published",
        createdAt: "2026-07-01T10:00:00Z",
        updatedAt: _now(),
      },
      {
        id: "conference_002",
        token: "CONF-2026-002",
        name: "UX Research Deep Dive Workshop",
        title: "UX Research Methods",
        workshopId: "UX Design Workshop",
        location: {
          state: "Abuja",
          country: "Nigeria",
          venue: "Virtual - Zoom",
        },
        fee: { amount: 30000, currency: "NGN" },
        startDate: "2026-08-28",
        endDate: "2026-08-28",
        startTime: "14:00",
        endTime: "16:00",
        deliveryMethod: "Virtual",
        status: "published",
        createdAt: "2026-07-10T10:00:00Z",
        updatedAt: _now(),
      },
      {
        id: "conference_003",
        token: "CONF-2026-003",
        name: "Digital Marketing Live Q&A",
        title: "Marketing AMA",
        workshopId: "Marketing Workshop",
        location: { state: "Lagos", country: "Nigeria", venue: "Virtual" },
        fee: { amount: 0, currency: "NGN" },
        startDate: "2026-09-02",
        endDate: "2026-09-02",
        startTime: "10:00",
        endTime: "12:00",
        deliveryMethod: "Virtual",
        status: "draft",
        createdAt: "2026-08-01T10:00:00Z",
        updatedAt: _now(),
      },
    ];

    // REGISTRATIONS
    const registrations = [
      {
        id: "reg_001",
        conferenceId: "conference_001",
        studentId: "student_001",
        firstName: "Michael",
        lastName: "Johnson",
        phone: "+234 801 234 5678",
        email: "michael.johnson@studypod.com",
        membershipNo: "STU-2024-001",
        state: "Lagos",
        country: "Nigeria",
        workshop: "React Development Workshop",
        amount: { amount: 25000, currency: "NGN" },
        transactionReference: "CONF-TXN-001",
        paymentDate: "2026-08-20",
        status: "paid",
        registeredAt: "2026-08-20T10:00:00Z",
      },
      {
        id: "reg_002",
        conferenceId: "conference_001",
        studentId: "student_002",
        firstName: "Ava",
        lastName: "Kim",
        phone: "+234 802 345 6789",
        email: "ava.kim@studypod.com",
        membershipNo: "STU-2024-002",
        state: "Abuja",
        country: "Nigeria",
        workshop: "React Development Workshop",
        amount: { amount: 25000, currency: "NGN" },
        transactionReference: "CONF-TXN-002",
        paymentDate: "2026-08-21",
        status: "paid",
        registeredAt: "2026-08-21T09:00:00Z",
      },
      {
        id: "reg_003",
        conferenceId: "conference_002",
        studentId: "student_003",
        firstName: "Ryan",
        lastName: "Lee",
        phone: "+234 803 456 7890",
        email: "ryan.lee@studypod.com",
        membershipNo: "STU-2024-003",
        state: "Lagos",
        country: "Nigeria",
        workshop: "UX Design Workshop",
        amount: { amount: 30000, currency: "NGN" },
        transactionReference: "CONF-TXN-003",
        paymentDate: "2026-08-22",
        status: "pending",
        registeredAt: "2026-08-22T11:00:00Z",
      },
    ];

    // ASSIGNMENTS
    const assignments = [
      {
        id: "assignment_001",
        token: "ASG-2026-001",
        title: "Python Data Analysis Project",
        courseId: "course_001",
        description: "Analyze real-world dataset and produce insights",
        instructions: "Use pandas, matplotlib. Submit Jupyter notebook.",
        startDate: "2026-08-15",
        dueDate: "2026-09-15",
        maximumScore: 100,
        attachment: "",
        status: "published",
        createdAt: "2026-08-01T10:00:00Z",
        updatedAt: _now(),
      },
      {
        id: "assignment_002",
        token: "ASG-2026-002",
        title: "UX Design Assignment #4",
        courseId: "course_002",
        description: "Mobile navigation redesign",
        instructions: "Create Figma prototype and usability report.",
        startDate: "2026-08-20",
        dueDate: "2026-09-01",
        maximumScore: 100,
        attachment: "",
        status: "published",
        createdAt: "2026-08-05T10:00:00Z",
        updatedAt: _now(),
      },
      {
        id: "assignment_003",
        token: "ASG-2026-003",
        title: "Campaign Analysis",
        courseId: "course_003",
        description: "Analyze marketing campaign metrics",
        instructions: "Use provided data, submit report.",
        startDate: "2026-08-25",
        dueDate: "2026-09-10",
        maximumScore: 100,
        attachment: "",
        status: "draft",
        createdAt: "2026-08-10T10:00:00Z",
        updatedAt: _now(),
      },
    ];

    // SUBMISSIONS
    const submissions = [
      {
        id: "submission_001",
        assignmentId: "assignment_002",
        studentId: "student_002",
        submittedAt: "2026-08-23T14:00:00Z",
        score: null,
        feedback: "",
        status: "needs-review",
      },
      {
        id: "submission_002",
        assignmentId: "assignment_001",
        studentId: "student_001",
        submittedAt: "2026-08-22T10:00:00Z",
        score: 95,
        feedback: "Excellent work! Great analysis.",
        status: "graded",
      },
      {
        id: "submission_003",
        assignmentId: "assignment_001",
        studentId: "student_004",
        submittedAt: "2026-08-23T09:00:00Z",
        score: 72,
        feedback: "Good effort, needs more visualization.",
        status: "graded",
      },
      {
        id: "submission_004",
        assignmentId: "assignment_002",
        studentId: "student_003",
        submittedAt: "2026-08-24T08:00:00Z",
        score: null,
        feedback: "",
        status: "submitted",
      },
    ];

    // QUIZZES
    const quizzes = [
      {
        id: "quiz_001",
        token: "QUIZ-2026-001",
        title: "Python Basics Quiz",
        courseId: "course_001",
        description: "Test your Python fundamentals",
        timeLimit: 30,
        maximumAttempts: 2,
        passingScore: 70,
        randomizeQuestions: true,
        showResults: true,
        status: "published",
        createdAt: "2026-08-10T10:00:00Z",
        updatedAt: _now(),
      },
      {
        id: "quiz_002",
        token: "QUIZ-2026-002",
        title: "UX Principles Assessment",
        courseId: "course_002",
        description: "UX design principles and methods",
        timeLimit: 45,
        maximumAttempts: 1,
        passingScore: 60,
        randomizeQuestions: false,
        showResults: true,
        status: "published",
        createdAt: "2026-08-12T10:00:00Z",
        updatedAt: _now(),
      },
      {
        id: "quiz_003",
        token: "QUIZ-2026-003",
        title: "Marketing Strategy Quiz",
        courseId: "course_003",
        description: "Digital marketing concepts",
        timeLimit: 20,
        maximumAttempts: 3,
        passingScore: 70,
        randomizeQuestions: true,
        showResults: false,
        status: "draft",
        createdAt: "2026-08-15T10:00:00Z",
        updatedAt: _now(),
      },
    ];

    // QUESTIONS
    const questions = [
      {
        id: "question_001",
        quizId: "quiz_001",
        type: "multiple-choice",
        question: "What is the output of len([1,2,3])?",
        options: ["2", "3", "4", "Error"],
        correctAnswer: "3",
        points: 10,
        order: 1,
      },
      {
        id: "question_002",
        quizId: "quiz_001",
        type: "multiple-choice",
        question: "Which library is used for data manipulation?",
        options: ["NumPy", "Pandas", "Matplotlib", "Seaborn"],
        correctAnswer: "Pandas",
        points: 10,
        order: 2,
      },
      {
        id: "question_003",
        quizId: "quiz_001",
        type: "true-false",
        question: "Python is statically typed.",
        options: ["True", "False"],
        correctAnswer: "False",
        points: 5,
        order: 3,
      },
      {
        id: "question_004",
        quizId: "quiz_002",
        type: "multiple-choice",
        question: "What does UX stand for?",
        options: [
          "User Experience",
          "User Example",
          "Universal Experience",
          "User Extension",
        ],
        correctAnswer: "User Experience",
        points: 10,
        order: 1,
      },
      {
        id: "question_005",
        quizId: "quiz_002",
        type: "multiple-choice",
        question: "Which is a UX research method?",
        options: ["Interviews", "Compilation", "Encryption", "Mining"],
        correctAnswer: "Interviews",
        points: 10,
        order: 2,
      },
    ];

    // ATTEMPTS
    const attempts = [
      {
        id: "attempt_001",
        quizId: "quiz_001",
        studentId: "student_001",
        score: 85,
        correctAnswers: 3,
        totalQuestions: 3,
        duration: 12,
        completedAt: "2026-08-20T10:00:00Z",
        status: "completed",
      },
      {
        id: "attempt_002",
        quizId: "quiz_001",
        studentId: "student_004",
        score: 70,
        correctAnswers: 2,
        totalQuestions: 3,
        duration: 18,
        completedAt: "2026-08-21T11:00:00Z",
        status: "completed",
      },
      {
        id: "attempt_003",
        quizId: "quiz_002",
        studentId: "student_002",
        score: 90,
        correctAnswers: 2,
        totalQuestions: 2,
        duration: 15,
        completedAt: "2026-08-22T09:00:00Z",
        status: "completed",
      },
      {
        id: "attempt_004",
        quizId: "quiz_001",
        studentId: "student_002",
        score: 95,
        correctAnswers: 3,
        totalQuestions: 3,
        duration: 10,
        completedAt: "2026-08-23T14:00:00Z",
        status: "completed",
      },
    ];

    // EMAILS - migrate or seed
    let emails = this.get("emails");
    if (emails.length === 0) {
      emails = [
        {
          id: "email_001",
          from: "Ava Kim",
          fromEmail: "ava.kim@studypod.com",
          to: "Sarah Davis",
          toEmail: "sarah@studypod.com",
          subject: "Question about the design critique",
          preview: "Could you clarify the feedback on my mobile navigation?",
          body: "Hi Sarah,\n\nCould you clarify the feedback on my mobile navigation? I would love to revise it before the next review.\n\nThanks,\nAva",
          folder: "inbox",
          read: false,
          starred: false,
          createdAt: "2026-08-23T09:20:00Z",
          updatedAt: _now(),
        },
        {
          id: "email_002",
          from: "Michael Johnson",
          fromEmail: "michael.johnson@studypod.com",
          to: "Sarah Davis",
          toEmail: "sarah@studypod.com",
          subject: "Module 8 completed",
          preview:
            "I have completed the final module and submitted the project.",
          body: "Hi Sarah,\n\nI have completed the final module and submitted the project. Thank you for the guidance throughout the course.\n\nMichael",
          folder: "inbox",
          read: false,
          starred: true,
          createdAt: "2026-08-22T16:10:00Z",
          updatedAt: _now(),
        },
        {
          id: "email_003",
          from: "Emma Patel",
          fromEmail: "emma.patel@studypod.com",
          to: "Sarah Davis",
          toEmail: "sarah@studypod.com",
          subject: "Feedback on my project",
          preview: "Can I get feedback before I submit the final version?",
          body: "Hello Sarah,\n\nCan I get feedback before I submit the final version of my project?\n\nEmma",
          folder: "inbox",
          read: true,
          starred: false,
          createdAt: "2026-08-21T11:00:00Z",
          updatedAt: _now(),
        },
        {
          id: "email_004",
          from: "Sarah Davis",
          fromEmail: "sarah@studypod.com",
          to: "Ava Kim",
          toEmail: "ava.kim@studypod.com",
          subject: "Re: Question about the design critique",
          preview: "Great question, Ava. The navigation needs...",
          body: "Hi Ava,\n\nGreat question. The navigation needs clearer hierarchy. Let me know if you need more details.\n\nSarah",
          folder: "sent",
          read: true,
          starred: false,
          createdAt: "2026-08-23T10:00:00Z",
          updatedAt: _now(),
        },
        {
          id: "email_005",
          from: "Sarah Davis",
          fromEmail: "sarah@studypod.com",
          to: "Ryan Lee",
          toEmail: "ryan.lee@studypod.com",
          subject: "Draft: Marketing feedback",
          preview: "Ryan, your campaign analysis...",
          body: "Ryan,\n\nYour campaign analysis draft...",
          folder: "drafts",
          read: true,
          starred: false,
          createdAt: "2026-08-24T08:00:00Z",
          updatedAt: _now(),
        },
      ];
    }

    _setRaw(COLLECTION_KEYS.students, students);
    _setRaw(COLLECTION_KEYS.courses, courses);
    _setRaw(COLLECTION_KEYS.enrollments, enrollments);
    _setRaw(COLLECTION_KEYS.conferences, conferences);
    _setRaw(COLLECTION_KEYS.registrations, registrations);
    _setRaw(COLLECTION_KEYS.assignments, assignments);
    _setRaw(COLLECTION_KEYS.submissions, submissions);
    _setRaw(COLLECTION_KEYS.quizzes, quizzes);
    _setRaw(COLLECTION_KEYS.questions, questions);
    _setRaw(COLLECTION_KEYS.attempts, attempts);
    _setRaw(COLLECTION_KEYS.emails, emails);

    localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
    _dispatch("all", "seed", null);
    console.log("[Store] Seeded with demo data");
  },
};

// Auto-migrate and seed on load
try {
  Store.migrate();
  if (Store.get("courses").length === 0) {
    Store.seed();
  }
} catch (e) {
  console.warn("Store init failed", e);
}

window.Store = Store;
window.StudyPodStore = Store;
