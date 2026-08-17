# eStudy - Separated & Documented (DRY Version)

## Structure - Why this is DRY and easy to collaborate

studypod-tutor-dashboard.0.2/
├── index.html (Dashboard - fully commented)
├── conferences.html (Conferences - separate file)
├── css/
│   ├── variables.css (ONE variable file - single source of truth)
│   ├── common.css (Shared: sidebar, header, buttons, cards, drawer, toast)
│   ├── dashboard.css (Dashboard only: stats, chart, attention, activity, table)
│   └── conferences.css (Conferences only: conf-grid, past-list)
├── image/
│   ├── studyPod_logo_pra
│   
├── js/
│   ├── common.js (Shared: theme, popovers, drawer, toast, nav)
│   ├── dashboard.js (Dashboard only: chart data, setRange, drawChart, counters)
│   └── conferences.js (Conferences only: handle actions, filter)
└── README.md

### HTML (2 pages - separated as requested)
- index.html = Dashboard page (main landing)
- conferences.html = Conferences page (separate file)

Both pages share same sidebar/header via common.css and common.js

### CSS (1 variable file + shared + page-specific)
- css/variables.css = SINGLE SOURCE OF TRUTH for all colors, spacing, radius, shadows
  Change anything here and it updates everywhere. No duplication.
- css/common.css = Shared layout: sidebar, header, buttons, cards, mobile nav, drawer, toast, upcoming conference preview
  Used by BOTH pages to avoid repeating same CSS.
- css/dashboard.css = ONLY dashboard-specific: stats-grid, chart, attention, activity timeline, students table
- css/conferences.css = ONLY conferences-specific: conf-stats-grid, conf-grid, past-list

Import order in HTML: variables.css -> common.css -> dashboard.css OR conferences.css

### JS (shared + page-specific)
- js/common.js = Shared logic: toggleTheme(), toggleNotif(), toggleProfile(), openStudent(), closeStudent(), toast(), setActiveNav(), click-outside listeners
  Loaded on BOTH pages.
- js/dashboard.js = Dashboard-only: datasets, currentRange, setRange(), drawChart(), count-up animation, progress bars
- js/conferences.js = Conferences-only: initConferences(), handleConferenceAction(), filterConferences() (placeholders for future)

### How to Collaborate
1. To re-theme: edit :root in css/variables.css only
2. To add shared component: add to css/common.css and js/common.js
3. To add dashboard feature: edit css/dashboard.css and js/dashboard.js
4. To add conference feature: edit css/conferences.css and js/conferences.js
5. Every section in HTML has comments explaining purpose
6. Every CSS file has section headers
7. Every JS function has JSDoc comments explaining params, steps, usage

### DRY Checklist
- No color hex repeated: all use var(--color-*)
- No duplicate sidebar/header CSS: lives in common.css
- No duplicate theme logic: lives in common.js
- No duplicate popover logic: lives in common.js
- Each page only loads what it needs

### Run
Open index.html in browser, no build needed. Click Conferences in sidebar to go to conferences.html
