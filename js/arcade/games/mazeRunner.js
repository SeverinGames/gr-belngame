// js/arcade/games/mazeRunner.js
// MINISPIEL - MAZE (Steuerung / Navigation). Führe deine Spielfigur (Kugel in
// Skin-Farben) durch das Labyrinth zum Ziel. Wände sind massiv (nicht
// durchquerbar); jeder neue Wandkontakt kostet ein paar Prozent Leistung.
// Steuerung: WASD/Pfeiltasten oder Ziehen/Wischen auf dem Feld (virtueller Joystick).
//   LEICHT 13x13 Blöcke, wenige Abzweigungen · MITTEL 19x19 · SCHWER 25x25, viele Sackgassen
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { getSkinPalette } from "../../world/characterSprite.js";
import { audio } from "../../audio/audio.js";
import { generateMaze, collide } from "./mazeGrid.js";

const BALL_R = 0.34; // in Blöcken

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const maze = generateMaze(difficulty, rng);
  const { grid, T, start: st, goal, dist, shortest, level } = maze;
  const pal = getSkinPalette(skinId);

  const stage = document.createElement("div");
  stage.className = "mz-playfield";
  stage.innerHTML = `<div class="mz-top"><div class="mz-avatar"></div><div class="mz-info"><span class="mz-time">⏱ 0 s</span><span class="mz-bumps">Wandkontakte: 0</span></div></div><div class="mz-wrap"><canvas class="mz-canvas"></canvas></div><div class="mz-help">Pfeiltasten/WASD oder auf dem Feld ziehen</div>`;
  container.appendChild(stage);
  const avatar = mountSkinAvatar(stage.querySelector(".mz-avatar"), skinId, { size: 36 });
  const wrap = stage.querySelector(".mz-wrap"), canvas = stage.querySelector(".mz-canvas"), ctx = canvas.getContext("2d");
  const timeEl = stage.querySelector(".mz-time"), bumpEl = stage.querySelector(".mz-bumps");

  let running = true, raf = null, last = null, time = 0, bumps = 0, wasHit = false, finished = false;
  const ball = { x: st[0] + 0.5, y: st[1] + 0.5 };
  let bestDist = shortest;
  const par = (shortest / level.speed) * 1.35, limit = par * level.timeFactor + 12;
  let px = 20, size = 300;

  function resize() {
    const w = wrap.clientWidth || 300, h = wrap.clientHeight || 300;
    size = Math.max(120, Math.floor(Math.min(w, h)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.width = canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    px = size / T;
  }
  resize();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; ro?.observe(wrap);

  // --- Eingabe: Tasten + virtueller Joystick (Ziehen/Wischen)
  const keys = { up: false, down: false, left: false, right: false };
  const KM = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  const kd = (e) => { const k = KM[e.code]; if (k) { keys[k] = true; e.preventDefault(); } };
  const ku = (e) => { const k = KM[e.code]; if (k) { keys[k] = false; e.preventDefault(); } };
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
  let joy = null; // {id, ox, oy, dx, dy}
  const pd = (e) => { if (e.pointerType === "mouse" && e.button !== 0) return; joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 }; try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ } e.preventDefault(); };
  const pm = (e) => { if (!joy || e.pointerId !== joy.id) return; joy.dx = e.clientX - joy.ox; joy.dy = e.clientY - joy.oy; const m = Math.hypot(joy.dx, joy.dy); if (m > 70) { joy.ox += joy.dx * (m - 70) / m; joy.oy += joy.dy * (m - 70) / m; joy.dx = e.clientX - joy.ox; joy.dy = e.clientY - joy.oy; } };
  const pu = (e) => { if (joy && e.pointerId === joy.id) joy = null; };
  canvas.addEventListener("pointerdown", pd); canvas.addEventListener("pointermove", pm);
  canvas.addEventListener("pointerup", pu); canvas.addEventListener("pointercancel", pu);

  function inputVec() {
    let vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (vx || vy) { const m = Math.hypot(vx, vy); return [vx / m, vy / m]; }
    if (joy) { const m = Math.hypot(joy.dx, joy.dy); if (m > 8) { const f = clamp((m - 8) / 28, 0.25, 1); return [(joy.dx / m) * f, (joy.dy / m) * f]; } }
    return [0, 0];
  }

  function finish(won) {
    if (finished) return; finished = true;
    running = false;
    cleanup();
    let percent;
    if (won) {
      const timeScore = clamp(1 - (time - par) / (par * (level.timeFactor - 1)), 0, 1);
      percent = Math.round(45 + 40 * timeScore + 15 * Math.max(0, 1 - bumps / 15));
    } else percent = Math.round(30 * (1 - bestDist / Math.max(1, shortest)));
    percent = clamp(percent, 0, 100);
    onEnd({ score: percent * 10, percent, won, maxCombo: 0, hideCombo: true,
      resultLabel: won ? `ZIEL in ${time.toFixed(1)} s · ${bumps} Wandkontakte` : `ZEIT ABGELAUFEN · ${percent * 10} PUNKTE` });
  }
  function cleanup() {
    cancelAnimationFrame(raf); ro?.disconnect();
    window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
    canvas.removeEventListener("pointerdown", pd); canvas.removeEventListener("pointermove", pm);
    canvas.removeEventListener("pointerup", pu); canvas.removeEventListener("pointercancel", pu);
    try { avatar.destroy(); } catch { /* ignore */ }
    stage.remove();
  }

  function draw() {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#10131d"; ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      if (grid[y][x] === 1) { ctx.fillStyle = "#3b4470"; ctx.fillRect(x * px, y * px, px + 0.5, px + 0.5); ctx.fillStyle = "#4b558a"; ctx.fillRect(x * px, y * px, px + 0.5, Math.max(1, px * 0.18)); }
      else { ctx.fillStyle = (x + y) % 2 ? "#171b2b" : "#1a1f31"; ctx.fillRect(x * px, y * px, px + 0.5, px + 0.5); }
    }
    // Ziel
    const gx = (goal[0] + 0.5) * px, gy = (goal[1] + 0.5) * px, pulse = 1 + Math.sin(time * 6) * 0.12;
    ctx.fillStyle = "rgba(255,176,32,0.25)"; ctx.beginPath(); ctx.arc(gx, gy, px * 0.62 * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = "#ffb020"; ctx.font = `${px * 0.9}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("★", gx, gy + px * 0.04);
    // Kugel (Skin-Farben)
    const bx = ball.x * px, by = ball.y * px, br = BALL_R * px;
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(bx, by + br * 0.7, br * 0.9, br * 0.4, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br * 1.1);
    g.addColorStop(0, pal.bodyLight); g.addColorStop(1, pal.body);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, br, 0, 7); ctx.fill();
    ctx.fillStyle = pal.skin; ctx.beginPath(); ctx.arc(bx, by - br * 0.1, br * 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = pal.hair; ctx.beginPath(); ctx.arc(bx, by - br * 0.3, br * 0.5, Math.PI, 0); ctx.fill();
    // Joystick-Anzeige
    if (joy) { ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; const jx = clamp(joy.dx, -40, 40), jy = clamp(joy.dy, -40, 40); ctx.beginPath(); ctx.arc(size / 2, size - 46, 28, 0, 7); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.beginPath(); ctx.arc(size / 2 + jx * 0.6, size - 46 + jy * 0.6, 11, 0, 7); ctx.fill(); }
  }

  function frame(ts) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (last == null) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts; time += dt;
    const [vx, vy] = inputVec();
    if (vx || vy) {
      // in kleinen Schritten bewegen, damit schnelle Kugeln nie durch Wände tunneln
      const total = level.speed * dt, steps = Math.max(1, Math.ceil(total / 0.12)), sp = total / steps;
      let hitNow = false;
      for (let i = 0; i < steps; i++) {
        let r = collide(grid, ball.x + vx * sp, ball.y, BALL_R); ball.x = r.x; hitNow ||= r.hit;
        r = collide(grid, ball.x, ball.y + vy * sp, BALL_R); ball.y = r.y; hitNow ||= r.hit;
      }
      if (hitNow && !wasHit) { bumps++; bumpEl.textContent = `Wandkontakte: ${bumps}`; audio.sfx("cardFlip"); }
      wasHit = hitNow;
    } else wasHit = false;
    const d = dist[Math.floor(ball.y)]?.[Math.floor(ball.x)];
    if (d != null && d >= 0) bestDist = Math.min(bestDist, d);
    if (Math.hypot(ball.x - (goal[0] + 0.5), ball.y - (goal[1] + 0.5)) < 0.6) {
      audio.sfx("unlockRare"); avatar.bump(); popBanner(stage, "ZIEL ERREICHT!", "gold"); running = false;
      draw(); setTimeout(() => finish(true), 650); return;
    }
    if (time >= limit) { finish(false); return; }
    timeEl.textContent = `⏱ ${Math.max(0, limit - time).toFixed(0)} s`;
    onHud({ timeLeft: Math.max(0, limit - time), total: limit, score: 0 });
    draw();
  }
  raf = requestAnimationFrame(frame);

  if (typeof location !== "undefined" && /[?&]debug/.test(location.search)) {
    window.__maze = { maze, ball, setKeys: (k) => Object.assign(keys, k), state: () => ({ time, bumps, running }), limit, par };
  }
  return { destroy: () => { if (finished) return; finished = true; running = false; cleanup(); if (window.__maze) delete window.__maze; } };
}
