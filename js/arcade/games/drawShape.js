// js/arcade/games/drawShape.js
// MINISPIEL - FORM ZEICHNEN (Kreativität / Genauigkeit). Ein kleines Glücksrad
// entscheidet, welche Form du nachzeichnen musst. Danach zeichnest du sie frei
// (Maus, Touch oder Stift) - sie wird automatisch bewertet (Form, Abweichung,
// Vollständigkeit, Zeit). 3 Formen pro Spiel.
//   LEICHT Quadrat/Dreieck/Rechteck · MITTEL Kreis/Stern/Sechseck/Herz/... · SCHWER Haus des Nikolaus/Drudenfuß/Blitz ...
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";
import { SHAPES, POOLS, scoreDrawing } from "./drawShapes.js";

const ROUNDS = 3;
const TIME = { easy: 25000, normal: 28000, hard: 35000 };
const SEG_COLORS = ["#ff5470", "#6be0ff", "#ffd166", "#4ee39a", "#b06bff", "#ff9a3d"];

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const pool = POOLS[difficulty] ?? POOLS.normal;
  const stage = document.createElement("div");
  stage.className = "ds-playfield";
  stage.innerHTML = `
    <div class="ds-top"><div class="ds-avatar"></div><div class="ds-info"><b class="ds-round"></b><span class="ds-time"></span></div></div>
    <div class="ds-task"><div class="ds-task__label">Zeichne:</div><div class="ds-task__name">–</div><canvas class="ds-preview" width="72" height="72"></canvas></div>
    <div class="ds-board"><canvas class="ds-canvas"></canvas>
      <div class="ds-wheel-layer"><div class="ds-wheel-title">GLÜCKSRAD</div><div class="ds-wheel-box"><div class="ds-pointer">▼</div><canvas class="ds-wheel" width="220" height="220"></canvas></div><div class="ds-wheel-result">&nbsp;</div></div>
      <div class="ds-result hidden"></div></div>
    <div class="ds-actions"><button class="btn btn--secondary ds-clear" disabled>LÖSCHEN</button><button class="btn btn--primary ds-done" disabled>FERTIG</button></div>`;
  container.appendChild(stage);
  const $ = (s) => stage.querySelector(s);
  const avatar = mountSkinAvatar($(".ds-avatar"), skinId, { size: 38 });
  const board = $(".ds-board"), cv = $(".ds-canvas"), ctx = cv.getContext("2d");
  const wheelCv = $(".ds-wheel"), wctx = wheelCv.getContext("2d"), layer = $(".ds-wheel-layer");
  const previewCv = $(".ds-preview"), pctx = previewCv.getContext("2d");
  const doneBtn = $(".ds-done"), clearBtn = $(".ds-clear");

  let running = true, round = 0, phase = "idle", shapeId = null, strokes = [], cur = null, roundStart = 0, raf = null, timer = null, wheelAngle = 0;
  const results = [];
  const cleanups = [];

  function sizeCanvas() {
    const w = board.clientWidth || 300, h = board.clientHeight || 300, dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr; cv.height = h * dpr; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); redraw();
  }
  function redraw() {
    const w = cv.clientWidth, h = cv.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 5; ctx.strokeStyle = "#6be0ff";
    for (const s of [...strokes, ...(cur ? [cur] : [])]) {
      if (s.length < 2) { if (s.length === 1) { ctx.fillStyle = "#6be0ff"; ctx.beginPath(); ctx.arc(s[0].x, s[0].y, 2.5, 0, 7); ctx.fill(); } continue; }
      ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y); for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y); ctx.stroke();
    }
  }
  sizeCanvas();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sizeCanvas) : null; ro?.observe(board);

  // --- Zeichnen: Pointer-Events (Maus, Touch, Stift), ein Strich je gedrückter Taste/Finger
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const pd = (e) => { if (phase !== "draw" || cur) return; if (e.pointerType === "mouse" && e.button !== 0) return; cur = [pos(e)]; try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ } e.preventDefault(); redraw(); };
  const pm = (e) => { if (!cur) return; const p = pos(e), l = cur[cur.length - 1]; if (Math.hypot(p.x - l.x, p.y - l.y) >= 2) { cur.push(p); redraw(); } e.preventDefault(); };
  const pu = () => { if (!cur) return; strokes.push(cur); cur = null; redraw(); refreshButtons(); };
  cv.addEventListener("pointerdown", pd); cv.addEventListener("pointermove", pm); cv.addEventListener("pointerup", pu); cv.addEventListener("pointercancel", pu);
  const refreshButtons = () => { const n = strokes.flat().length; doneBtn.disabled = phase !== "draw" || n < 8; clearBtn.disabled = phase !== "draw" || n === 0; };
  clearBtn.addEventListener("click", () => { if (phase !== "draw") return; strokes = []; cur = null; redraw(); refreshButtons(); audio.sfx("click"); });
  doneBtn.addEventListener("click", () => submit(false));

  function endGame(silent = false) {
    if (!running) return;
    running = false; clearTimeout(timer); cancelAnimationFrame(raf); ro?.disconnect();
    cv.removeEventListener("pointerdown", pd); cv.removeEventListener("pointermove", pm); cv.removeEventListener("pointerup", pu); cv.removeEventListener("pointercancel", pu);
    avatar.destroy(); stage.remove();
    if (silent) return;
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    onEnd({ score: Math.round(avg * 10), percent: Math.round(avg), maxCombo: results.filter((r) => r >= 85).length, hideCombo: true, resultLabel: `Ø ${Math.round(avg)} % Genauigkeit` });
  }

  // --- Glücksrad: das Ergebnis wird VORHER ausgewürfelt (rng), die Animation landet exakt dort.
  function drawWheel(angle) {
    const R = 104, c = 110, n = pool.length;
    wctx.clearRect(0, 0, 220, 220);
    for (let i = 0; i < n; i++) {
      const a0 = angle + (i / n) * Math.PI * 2 - Math.PI / 2, a1 = angle + ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      wctx.fillStyle = SEG_COLORS[i % SEG_COLORS.length]; wctx.beginPath(); wctx.moveTo(c, c); wctx.arc(c, c, R, a0, a1); wctx.closePath(); wctx.fill();
      wctx.strokeStyle = "#10131d"; wctx.lineWidth = 3; wctx.stroke();
      wctx.save(); wctx.translate(c, c); wctx.rotate((a0 + a1) / 2); wctx.fillStyle = "#10131d"; wctx.font = "bold 24px sans-serif"; wctx.textAlign = "right"; wctx.textBaseline = "middle"; wctx.fillText(SHAPES[pool[i]].icon, R - 14, 0); wctx.restore();
    }
    wctx.fillStyle = "#10131d"; wctx.beginPath(); wctx.arc(c, c, 14, 0, 7); wctx.fill();
  }
  function spinWheel(done) {
    phase = "wheel"; layer.classList.remove("hidden"); $(".ds-wheel-result").innerHTML = "&nbsp;";
    const n = pool.length, pick = Math.floor(rng() * n);
    // Segment i liegt bei Winkel (i+0.5)/n*2π ab oben; Zeiger oben -> Rad so drehen, dass es dort landet.
    const within = (rng() - 0.5) * 0.7; // nicht immer exakt Mitte
    const target = -((pick + 0.5 + within) / n) * Math.PI * 2;
    const turns = 4 + Math.floor(rng() * 3), start = wheelAngle % (Math.PI * 2);
    const end = target - turns * Math.PI * 2, dur = 3600, t0 = performance.now();
    let lastSeg = -1;
    const step = (ts) => {
      if (!running) return;
      const t = clamp((ts - t0) / dur, 0, 1), e = 1 - Math.pow(1 - t, 4); // stark abbremsend = Spannung am Ende
      wheelAngle = start + (end - start) * e; drawWheel(wheelAngle);
      const seg = Math.floor((((-wheelAngle / (Math.PI * 2)) % 1) + 1) % 1 * n);
      if (seg !== lastSeg) { lastSeg = seg; audio.sfx("cardFlip"); if (navigator.vibrate) try { navigator.vibrate(8); } catch { /* ignore */ } }
      if (t < 1) raf = requestAnimationFrame(step);
      else { audio.sfx("unlockRare"); $(".ds-wheel-result").textContent = `${SHAPES[pool[pick]].icon} ${SHAPES[pool[pick]].name}!`; timer = setTimeout(() => done(pool[pick]), 1100); }
    };
    raf = requestAnimationFrame(step);
  }

  function drawPreview(id) {
    pctx.clearRect(0, 0, 72, 72);
    const pts = SHAPES[id].pts, xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0, s = 56 / Math.max(w, h);
    pctx.strokeStyle = "#ffb020"; pctx.lineWidth = 3; pctx.lineJoin = "round"; pctx.lineCap = "round"; pctx.beginPath();
    pts.forEach((p, i) => { const x = 36 + (p.x - x0 - w / 2) * s, y = 36 + (p.y - y0 - h / 2) * s; i ? pctx.lineTo(x, y) : pctx.moveTo(x, y); }); pctx.stroke();
  }

  function nextRound() {
    if (!running) return;
    round++;
    if (round > ROUNDS) { endGame(); return; }
    strokes = []; cur = null; redraw(); refreshButtons();
    $(".ds-result").classList.add("hidden");
    $(".ds-round").textContent = `Form ${round} / ${ROUNDS}`; $(".ds-time").textContent = "";
    $(".ds-task__name").textContent = "Glücksrad dreht …"; pctx.clearRect(0, 0, 72, 72);
    onHud({ round, roundTotal: ROUNDS, score: results.length, timeLeft: 1, total: 1 });
    spinWheel((id) => {
      shapeId = id; layer.classList.add("hidden");
      $(".ds-task__name").textContent = SHAPES[id].name; drawPreview(id);
      phase = "draw"; roundStart = performance.now(); refreshButtons();
      const total = TIME[difficulty] ?? TIME.normal;
      const tick = () => {
        if (!running || phase !== "draw") return;
        const left = Math.max(0, total - (performance.now() - roundStart));
        $(".ds-time").textContent = `⏱ ${Math.ceil(left / 1000)} s`;
        onHud({ round, roundTotal: ROUNDS, score: results.length, timeLeft: left, total });
        if (left <= 0) submit(true); else timer = setTimeout(tick, 200);
      };
      tick();
    });
  }

  function submit(timeout) {
    if (!running || phase !== "draw") return; // nur EIN Abschluss pro Form
    if (cur) { strokes.push(cur); cur = null; }
    phase = "result"; clearTimeout(timer); refreshButtons();
    const total = TIME[difficulty] ?? TIME.normal, used = performance.now() - roundStart;
    const sc = scoreDrawing(shapeId, strokes, difficulty);
    // Zeit zählt leicht: schnell +bis 8 %, nur wenn die Form wirklich passt
    const timeBonus = sc.percent >= 50 ? Math.round(8 * clamp(1 - used / total, 0, 1)) : 0;
    const pct = clamp(sc.percent + timeBonus, 0, 100);
    results.push(pct);
    const res = $(".ds-result");
    res.innerHTML = `<div class="ds-result__pct">${pct} % Genauigkeit</div><small>${sc.reason ?? (pct >= 85 ? "Sauber gezeichnet!" : pct >= 60 ? "Ganz gut – noch etwas genauer." : "Die Form passt noch nicht richtig.")}</small>`;
    res.classList.remove("hidden");
    if (pct >= 85) { audio.sfx("pop"); avatar.bump(); popBanner(stage, "STARK GEZEICHNET!", "gold"); } else audio.sfx(pct >= 55 ? "treasure" : "wrong");
    timer = setTimeout(nextRound, 2000);
  }

  nextRound();
  if (typeof location !== "undefined" && /[?&]debug/.test(location.search)) {
    window.__draw = { state: () => ({ phase, shapeId, round }), canvas: cv };
  }
  return { destroy: () => { endGame(true); if (window.__draw) delete window.__draw; } };
}
