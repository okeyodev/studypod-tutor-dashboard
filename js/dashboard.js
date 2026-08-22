/**
 * DASHBOARD.JS - Optimized DRY, Light & Fast
 * - No duplicate code, cached DOM, rAF for counters
 */

const datasets = {
  "7D": [320, 410, 380, 520, 490, 620, 710],
  "30D": [210, 340, 380, 420, 510, 580, 640, 720, 690, 840],
  "3M": [180, 240, 320, 380, 450, 520, 610, 720, 680, 840, 900, 860],
  "1Y": [120, 200, 280, 340, 410, 500, 580, 640, 710, 780, 840, 920],
};
let currentRange = "30D";

function setRange(r) {
  currentRange = r;
  ["7D","30D","3M","1Y"].forEach(k => {
    const el = document.getElementById("r-" + k);
    if (el) el.className = k === r ? "range-btn active" : "range-btn";
  });
  drawChart();
}

function drawChart() {
  const data = datasets[currentRange];
  const svg = document.getElementById("chart");
  if (!svg) return;
  svg.innerHTML = "";
  const W = 600, H = 180, padT = 10, padB = 20, max = 1000;
  const pts = data.map((v,i) => ({
    x: (i / (data.length - 1)) * W,
    y: padT + (1 - v / max) * (H - padT - padB),
    v
  }));
  // Grid
  [0,250,500,750,1000].forEach(yVal => {
    const y = padT + (1 - yVal / max) * (H - padT - padB);
    const line = document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1","0"); line.setAttribute("x2",W);
    line.setAttribute("y1",y); line.setAttribute("y2",y);
    line.setAttribute("stroke", isDark ? "#1E293B" : "#F1F5F9");
    line.setAttribute("stroke-width","1");
    if (yVal !== 0) line.setAttribute("stroke-dasharray","4 6");
    svg.appendChild(line);
  });
  // Path
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i=1;i<pts.length;i++) {
    const prev = pts[i-1], curr = pts[i];
    const cx = (prev.x + curr.x)/2;
    d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  const areaD = d + ` L ${pts[pts.length-1].x} ${H-padB} L ${pts[0].x} ${H-padB} Z`;

  const defs = document.createElementNS("http://www.w3.org/2000/svg","defs");
  const grad = document.createElementNS("http://www.w3.org/2000/svg","linearGradient");
  grad.setAttribute("id","g"); grad.setAttribute("x1","0"); grad.setAttribute("x2","0"); grad.setAttribute("y1","0"); grad.setAttribute("y2","1");
  const s1 = document.createElementNS("http://www.w3.org/2000/svg","stop");
  s1.setAttribute("offset","0%"); s1.setAttribute("stop-color","#2563EB"); s1.setAttribute("stop-opacity", isDark ? "0.35" : "0.22");
  const s2 = document.createElementNS("http://www.w3.org/2000/svg","stop");
  s2.setAttribute("offset","100%"); s2.setAttribute("stop-color","#2563EB"); s2.setAttribute("stop-opacity","0");
  grad.append(s1,s2); defs.appendChild(grad); svg.appendChild(defs);

  const area = document.createElementNS("http://www.w3.org/2000/svg","path");
  area.setAttribute("d",areaD); area.setAttribute("fill","url(#g)");
  svg.appendChild(area);

  const line = document.createElementNS("http://www.w3.org/2000/svg","path");
  line.setAttribute("d",d); line.setAttribute("fill","none"); line.setAttribute("stroke","#2563EB");
  line.setAttribute("stroke-width","2.5"); line.setAttribute("stroke-linecap","round");
  line.classList.add("draw"); svg.appendChild(line);

  pts.forEach(p => {
    const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",p.x); c.setAttribute("cy",p.y); c.setAttribute("r","4");
    c.setAttribute("fill","#fff"); c.setAttribute("stroke","#2563EB"); c.setAttribute("stroke-width","2.5");
    svg.appendChild(c);
  });
}

function initDashboard() {
  // Count-up with rAF - lighter than setInterval
  document.querySelectorAll("[data-count]").forEach(el => {
    const target = parseInt(el.dataset.count,10);
    let cur = 0; const step = target/40;
    const tick = () => {
      cur += step;
      if (cur >= target) { el.textContent = target.toLocaleString(); return; }
      el.textContent = Math.floor(cur).toLocaleString();
      requestAnimationFrame(() => setTimeout(tick, 20));
    };
    tick();
  });
  document.querySelectorAll(".progress").forEach(b => setTimeout(() => b.classList.add("on"), 300));
  drawChart();
  setActiveNav("dashboard");
}

document.addEventListener("DOMContentLoaded", () => setTimeout(initDashboard, 200));
if (document.readyState !== "loading") setTimeout(initDashboard, 200);
