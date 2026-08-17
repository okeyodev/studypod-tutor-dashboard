/**
 * ==========================================================================
 * DASHBOARD.JS - Dashboard Page Only (index.html)
 * ==========================================================================
 * Contains ONLY logic unique to dashboard.
 * Shared logic (theme, popovers, drawer, toast) is in common.js
 *
 * Features:
 * - Chart data & state (datasets, currentRange)
 * - setRange() - Change time range (7D,30D,3M,1Y)
 * - drawChart() - SVG line chart with Bezier curves, gradient fill
 * - Count-up animation for stats (data-count)
 * - Progress bar fill animation
 *
 * DRY: If you add something used on conferences page, move it to common.js
 * ==========================================================================
 */

/**
 * datasets - Mock data for Student Engagement chart
 * Each key = time range, value = array of student counts
 * - 7D: last 7 days
 * - 30D: last 30 days (default)
 * - 3M: last 3 months
 * - 1Y: last year
 * Edit these arrays to change chart data. Max Y is 1000.
 */
const datasets = {
  "7D": [320, 410, 380, 520, 490, 620, 710],
  "30D": [210, 340, 380, 420, 510, 580, 640, 720, 690, 840],
  "3M": [180, 240, 320, 380, 450, 520, 610, 720, 680, 840, 900, 860],
  "1Y": [120, 200, 280, 340, 410, 500, 580, 640, 710, 780, 840, 920],
};

/**
 * currentRange - Tracks which range is active
 * Used by setRange() and drawChart()
 */
let currentRange = "30D";

/**
 * setRange(r)
 * -----------
 * Changes chart time range and redraws chart.
 * @param {string} r - Range key: '7D','30D','3M','1Y'
 *
 * Steps:
 * 1. Update currentRange global state
 * 2. Update active button styling (add .active to selected)
 * 3. Redraw chart with new dataset
 */
function setRange(r) {
  // Step 1: Update global state
  currentRange = r;

  // Step 2: Update button active states
  ["7D", "30D", "3M", "1Y"].forEach((k) => {
    const el = document.getElementById("r-" + k); // e.g. r-7D, r-30D
    if (el) {
      el.className = k === r ? "range-btn active" : "range-btn";
    }
  });

  // Step 3: Re-render chart with new data
  drawChart();
}

/**
 * drawChart()
 * -----------
 * Draws Student Engagement SVG chart.
 *
 * How it works:
 * 1. Gets current dataset based on currentRange
 * 2. Clears SVG
 * 3. Converts values to X,Y coordinates (Y inverted because SVG 0 is top)
 * 4. Draws horizontal grid lines (0,250,500,750,1000)
 * 5. Builds smooth path using Bezier curves (C command)
 * 6. Creates gradient fill under line (blue fading to transparent)
 * 7. Draws line with .draw animation (stroke-dashoffset)
 * 8. Adds dots at each data point
 *
 * Dark mode aware: grid color and gradient opacity change via isDark from common.js
 */
function drawChart() {
  const data = datasets[currentRange]; // Get current data array
  const svg = document.getElementById("chart"); // SVG element
  if (!svg) return; // Safety: exit if no chart on page
  svg.innerHTML = ""; // Clear previous chart

  // Chart dimensions
  const W = 600,
    H = 180,
    padT = 10,
    padB = 20; // Width, Height, Top/Bottom padding
  const max = 1000; // Max Y value for scaling

  // Convert raw values to X,Y points
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W; // Evenly spaced X
    const y = padT + (1 - v / max) * (H - padT - padB); // Inverted Y: higher value = higher on screen
    return { x, y, v }; // Return point object
  });

  // Draw grid lines
  [0, 250, 500, 750, 1000].forEach((yVal) => {
    const y = padT + (1 - yVal / max) * (H - padT - padB); // Y position for this grid value
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line"); // Create SVG line
    line.setAttribute("x1", "0");
    line.setAttribute("x2", W); // Full width
    line.setAttribute("y1", y);
    line.setAttribute("y2", y); // Horizontal at y
    line.setAttribute("stroke", isDark ? "#1E293B" : "#F1F5F9"); // Dark mode aware color
    line.setAttribute("stroke-width", "1");
    if (yVal !== 0) line.setAttribute("stroke-dasharray", "4 6"); // Dashed except baseline
    svg.appendChild(line); // Add to SVG
  });

  // Build smooth path using Bezier curves
  let d = `M ${pts[0].x} ${pts[0].y}`; // Move to first point
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1],
      curr = pts[i];
    const cx = (prev.x + curr.x) / 2; // Control point X = middle between points
    d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`; // Cubic Bezier curve
  }

  // Area fill path: line + down to bottom + back to start
  const areaD =
    d + ` L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z`;

  // Create gradient for area fill
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const grad = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "linearGradient",
  );
  grad.setAttribute("id", "g"); // ID for url(#g) reference
  grad.setAttribute("x1", "0");
  grad.setAttribute("x2", "0");
  grad.setAttribute("y1", "0");
  grad.setAttribute("y2", "1"); // Vertical gradient
  const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s1.setAttribute("offset", "0%");
  s1.setAttribute("stop-color", "#2563EB");
  s1.setAttribute("stop-opacity", isDark ? "0.35" : "0.22"); // More subtle in light
  const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s2.setAttribute("offset", "100%");
  s2.setAttribute("stop-color", "#2563EB");
  s2.setAttribute("stop-opacity", "0");
  grad.appendChild(s1);
  grad.appendChild(s2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  // Draw filled area
  const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
  area.setAttribute("d", areaD);
  area.setAttribute("fill", "url(#g)"); // Use gradient
  svg.appendChild(area);

  // Draw main line with animation
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", d);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#2563EB");
  line.setAttribute("stroke-width", "2.5");
  line.setAttribute("stroke-linecap", "round");
  line.classList.add("draw"); // CSS animation: draws line from left to right
  svg.appendChild(line);

  // Draw dots at each data point
  pts.forEach((p) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", p.x); // X position
    c.setAttribute("cy", p.y); // Y position
    c.setAttribute("r", "4"); // Radius
    c.setAttribute("fill", "#fff"); // White fill
    c.setAttribute("stroke", "#2563EB"); // Blue border
    c.setAttribute("stroke-width", "2.5");
    svg.appendChild(c);
  });
}

/**
 * initDashboard() - Initialize dashboard page
 * Runs on page load after 200ms for smooth entry
 * - Animates count-up numbers (data-count)
 * - Animates progress bars (adds .on class)
 * - Draws initial chart
 * - Sets active nav to dashboard
 */
function initDashboard() {
  // Animate numbers with data-count attribute
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = parseInt(el.dataset.count); // Final number from HTML
    let cur = 0; // Current count starts at 0
    const step = target / 40; // 40 steps to reach target
    const iv = setInterval(() => {
      cur += step; // Increment
      if (cur >= target) {
        cur = target;
        clearInterval(iv);
      } // Stop when reached
      el.textContent = Math.floor(cur).toLocaleString(); // Update text with comma formatting
    }, 20); // 20ms per step = ~800ms total
  });

  // Animate progress bars: triggers CSS transition width 0 -> var(--w)
  document.querySelectorAll(".progress").forEach((b) => {
    setTimeout(() => b.classList.add("on"), 300); // Small delay for staggered effect
  });

  drawChart(); // Draw initial chart (30D by default)
  setActiveNav("dashboard"); // Highlight dashboard nav
}

// Run init after DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initDashboard, 200);
});

// Also run if DOM already loaded (for direct script inclusion)
if (document.readyState !== "loading") {
  setTimeout(initDashboard, 200);
}
