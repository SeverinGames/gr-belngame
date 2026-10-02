// js/arcade/games/maisMission.js
// MINISPIEL: MAIS-MISSION - echtes 3D (WebGL2, siehe ../gl3d.js).
//
// Ablauf: 1) Beobachtungsflug: die Drohne fliegt den richtigen Weg durch das
// Maisfeld-Labyrinth, Orientierungspunkte ragen über den Mais. 2) START.
// 3) Der Spieler steuert die Drohne selbst (WASD/Pfeiltasten oder Touch-
// Tasten) und findet den Schatz. Sackgassen kosten Zeit; Zeit + Fehler
// bestimmen die Leistung und damit Münzen/XP/Party-Punkte.
import { MeshBuilder, M4, createRenderer } from "../gl3d.js";
import { generateMaze, MAZE_LEVELS, pathToWorld, cellToWorld, worldToCell, isOpen } from "./maisMaze.js";
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const S = 3.4; // Zellgröße (Weltmaß)
const RING = 2; // Maisrand um das Feld (Zellen)
const FLY_H = 1.5; // Flughöhe der Drohne
const PLAYER_SPEED = 6.2, TURN_RATE = 2.3, BACK_SPEED = 2.6, RADIUS = 0.5;
const FOG = { color: [0.62, 0.84, 0.97], near: 15, far: 60 };
const TINTS = [[0.92, 0.28, 0.24], [0.28, 0.56, 0.95], [0.98, 0.8, 0.22], [0.72, 0.42, 0.92]];
const WOOD = [0.55, 0.33, 0.15], GOLD = [1, 0.8, 0.2];
const key = (x, y) => `${x},${y}`;

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const L = MAZE_LEVELS[difficulty] ?? MAZE_LEVELS.normal;
  const maze = generateMaze(difficulty, rng);
  const mainIdx = new Map(maze.path.map((c, i) => [key(...c), i]));

  // ---------------------------------------------------------------- DOM
  const stage = document.createElement("div");
  stage.className = "m3-playfield";
  stage.innerHTML = `
    <canvas class="m3-canvas"></canvas>
    <div class="m3-avatar"></div>
    <div class="m3-hud"><div class="m3-hud__phase"></div><div class="m3-hud__stats"></div></div>
    <div class="m3-count hidden"></div>
    <div class="m3-start hidden"><div class="m3-start__card"><div class="m3-start__title">Jetzt bist du dran!</div><div class="m3-start__sub">Flieg den Weg selbst zum Schatz.</div><button class="btn btn--primary m3-start__btn">START</button></div></div>
    <div class="m3-pad hidden">
      <div class="m3-pad__side"><button class="m3-btn" data-k="left">◀</button><button class="m3-btn" data-k="right">▶</button></div>
      <div class="m3-pad__side"><button class="m3-btn" data-k="up">▲</button><button class="m3-btn" data-k="down">▼</button></div>
    </div>
    <div class="m3-fade"></div>
    <div class="m3-error hidden"></div>`;
  container.appendChild(stage);
  const $ = (s) => stage.querySelector(s);
  const canvas = $(".m3-canvas"), phaseEl = $(".m3-hud__phase"), statsEl = $(".m3-hud__stats");
  const countEl = $(".m3-count"), startEl = $(".m3-start"), padEl = $(".m3-pad"), fadeEl = $(".m3-fade"), errEl = $(".m3-error");
  const avatar = mountSkinAvatar($(".m3-avatar"), skinId, { size: 38 });

  let alive = true, raf = null, renderer = null;
  const onSelect = (e) => e.preventDefault();
  const cleanups = [];
  function fail(msg) {
    errEl.innerHTML = `<div class="m3-error__card"><div class="m3-error__title">3D nicht verfügbar</div><p>${msg}</p><button class="btn btn--secondary m3-error__btn">ZURÜCK</button></div>`;
    errEl.classList.remove("hidden");
    errEl.querySelector("button").addEventListener("click", () => { if (alive) { teardown(); onEnd({ score: 0, percent: 0, aborted: true }); } });
  }
  try { renderer = createRenderer(canvas); } catch (e) { renderer = null; }
  if (!renderer) {
    fail("Dein Gerät oder Browser unterstützt WebGL2 nicht. Probiere einen aktuellen Browser (Chrome, Safari, Firefox, Edge). Für dieses Spiel gibt es keine Belohnung, wenn 3D nicht läuft.");
    return { destroy: teardown };
  }
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); if (phase !== "done") { phase = "done"; fail("Die 3D-Grafik wurde vom Gerät beendet (z.B. zu wenig Speicher). Bitte starte das Spiel neu."); } });

  // ---------------------------------------------------------------- Meshes
  const mb = (f) => { const b = new MeshBuilder(); f(b); return b.build(); };
  renderer.makeMesh("cube", mb((b) => b.box(0, 0, 0, 1, 1, 1, [1, 1, 1])));
  renderer.makeMesh("cyl", mb((b) => b.cyl(0, 0, 0, 0.5, 0.5, 1, 10, [1, 1, 1])));
  renderer.makeMesh("frustum", mb((b) => b.cyl(0, 0, 0, 0.5, 0.32, 1, 10, [1, 1, 1])));
  renderer.makeMesh("cone", mb((b) => b.cyl(0, 0, 0, 0.5, 0, 1, 10, [1, 1, 1])));
  renderer.makeMesh("sph", mb((b) => b.sphere(0, 0, 0, 0.5, [1, 1, 1])));
  renderer.makeMesh("roof", mb((b) => b.roof(0, 0, 0, 1, 1, 1, [1, 1, 1])));
  renderer.makeMesh("corn", mb((b) => {
    b.box(0, 1.3, 0, 0.08, 2.6, 0.08, [0.36, 0.6, 0.2]);
    b.box(0.28, 1.5, 0, 0.65, 0.03, 0.16, [0.3, 0.7, 0.22], { rz: 0.45 });
    b.box(-0.26, 1.15, 0, 0.6, 0.03, 0.16, [0.26, 0.62, 0.2], { rz: -0.4 });
    b.box(0, 1.9, 0.26, 0.16, 0.03, 0.6, [0.32, 0.72, 0.24], { rx: -0.4 });
    b.box(0.1, 1.55, 0.07, 0.13, 0.42, 0.13, [0.96, 0.8, 0.25]);
    b.box(0, 2.62, 0, 0.12, 0.34, 0.12, [0.85, 0.75, 0.4]);
  }));

  // ---------------------------------------------------------------- Statische Szene
  const dyn = {
    cube: renderer.makeBatch("cube", 700, true), cyl: renderer.makeBatch("cyl", 260, true), frustum: renderer.makeBatch("frustum", 40, true),
    cone: renderer.makeBatch("cone", 80, true), sph: renderer.makeBatch("sph", 120, true), roof: renderer.makeBatch("roof", 30, true),
  };
  const staticBatches = [];
  const I = new Float32Array(16); M4.trs(I, 0, 0, 0);
  const T1 = new Float32Array(16);
  const half = maze.size / 2;
  const cw = (cx, cy) => cellToWorld(maze, cx, cy, S);
  const isLandmarkCell = new Set(maze.landmarks.map((l) => key(l.x, l.y)));

  function buildStatic() {
    const ground = renderer.makeBatch("cube", 1, false);
    M4.trs(T1, 0, -0.1, 0, 0, 0, 0, 600, 0.2, 600); ground.set(0, T1, 0.42, 0.46, 0.22); ground.count = 1; ground.upload(); staticBatches.push(ground);

    const wallCells = [], pathCells = [];
    for (let cy = -RING; cy < maze.size + RING; cy++) for (let cx = -RING; cx < maze.size + RING; cx++) {
      if (isOpen(maze, cx, cy)) pathCells.push([cx, cy]); else wallCells.push([cx, cy]);
    }
    const soil = renderer.makeBatch("cube", 1, false);
    const fw = (maze.size + RING * 2) * S;
    M4.trs(T1, 0, 0.0, 0, 0, 0, 0, fw, 0.04, fw); soil.set(0, T1, 0.4, 0.28, 0.15); soil.count = 1; soil.upload(); staticBatches.push(soil);
    const lane = renderer.makeBatch("cube", pathCells.length + 1, false);
    pathCells.forEach(([cx, cy], i) => { const p = cw(cx, cy); M4.trs(T1, p.x, 0.03, p.z, 0, 0, 0, S, 0.04, S); lane.set(i, T1, 0.66, 0.52, 0.3); });
    lane.count = pathCells.length; lane.upload(); staticBatches.push(lane);

    // Start-Markierung
    const sp = cw(maze.start[0], maze.start[1]);
    const mark = renderer.makeBatch("cube", 1, false);
    M4.trs(T1, sp.x, 0.06, sp.z, 0, 0, 0, S * 0.7, 0.03, S * 0.7); mark.set(0, T1, 0.95, 0.85, 0.3, 0.5); mark.count = 1; mark.upload(); staticBatches.push(mark);

    // Maiswände: dunkle Hecken-Basis + Stauden
    const hedge = renderer.makeBatch("cube", wallCells.length, false);
    wallCells.forEach(([cx, cy], i) => { const p = cw(cx, cy); M4.trs(T1, p.x, 1.0, p.z, 0, 0, 0, S * 0.94, 2.0, S * 0.94); hedge.set(i, T1, 0.24, 0.5, 0.19); });
    hedge.count = wallCells.length; hedge.upload(); staticBatches.push(hedge);

    const CH = 3; // Chunk = 3x3 Zellen (für Sichtbarkeits-Auswahl)
    const chunks = new Map();
    for (const [cx, cy] of wallCells) {
      if (isLandmarkCell.has(key(cx, cy))) continue;
      const ck = `${Math.floor((cx + RING) / CH)},${Math.floor((cy + RING) / CH)}`;
      if (!chunks.has(ck)) chunks.set(ck, []);
      chunks.get(ck).push([cx, cy]);
    }
    const PER = 10;
    for (const cells of chunks.values()) {
      const b = renderer.makeBatch("corn", cells.length * PER, false);
      let n = 0, sx = 0, sz = 0;
      for (const [cx, cy] of cells) {
        const p = cw(cx, cy); sx += p.x; sz += p.z;
        for (let k = 0; k < PER; k++) {
          const gx = (k % 4) + 0.5 * (Math.floor(k / 4) % 2), gz = Math.floor(k / 4);
          const x = p.x + ((gx / 4 - 0.5) * 0.9 + (rng() - 0.5) * 0.18) * S;
          const z = p.z + ((gz / 2.5 - 0.5) * 0.9 + (rng() - 0.5) * 0.18) * S;
          const sc = 0.92 + rng() * 0.28, tint = 0.88 + rng() * 0.2;
          M4.trs(T1, x, 0, z, rng() * 6.28, 0, 0, 1.15, sc, 1.15);
          b.set(n++, T1, tint, tint, tint);
        }
      }
      b.count = n; b.upload();
      b.center = { x: sx / cells.length, z: sz / cells.length }; b.radius = CH * S * 0.75;
      staticBatches.push(b);
    }
  }
  buildStatic();

  // ---------------------------------------------------------------- Zeichenhelfer
  const Pm = new Float32Array(16), Lm = new Float32Array(16), Om = new Float32Array(16);
  const put = (b, parent, lx, ly, lz, ry, rx, rz, sx, sy, sz, col, e = 0) => {
    if (b.count >= b.capacity) return;
    M4.trs(Lm, lx, ly, lz, ry, rx, rz, sx, sy, sz); M4.mul(Om, parent, Lm); b.set(b.count++, Om, col[0], col[1], col[2], e);
  };
  const world = (x, y, z, ry = 0, rx = 0, rz = 0) => M4.trs(new Float32Array(16), x, y, z, ry, rx, rz);

  function drawLandmark(lm, t) {
    const p = cw(lm.x, lm.y), c = TINTS[lm.tint % 4], P = world(p.x, 0, p.z, lm.rot);
    const white = [0.95, 0.93, 0.88], dark = [0.25, 0.2, 0.18], green = [0.3, 0.6, 0.25];
    switch (lm.type) {
      case "windmill": {
        put(dyn.frustum, P, 0, 2.6, 0, 0, 0, 0, 2.2, 5.2, 2.2, white);
        put(dyn.cone, P, 0, 6.0, 0, 0, 0, 0, 2.1, 1.5, 2.1, c);
        put(dyn.sph, P, 0, 5.2, -1.15, 0, 0, 0, 0.6, 0.6, 0.6, dark);
        for (let k = 0; k < 4; k++) {
          const H = new Float32Array(16); M4.mul(H, P, M4.trs(Lm, 0, 5.2, -1.3, 0, 0, t * 0.9 + k * Math.PI / 2));
          put(dyn.cube, H, 0, 1.4, 0, 0, 0, 0, 0.34, 2.8, 0.08, c);
        }
        break;
      }
      case "silo":
        put(dyn.cyl, P, 0, 3.0, 0, 0, 0, 0, 1.9, 6.0, 1.9, c);
        put(dyn.sph, P, 0, 6.0, 0, 0, 0, 0, 1.9, 1.5, 1.9, white);
        put(dyn.cube, P, 0, 3.0, -0.95, 0, 0, 0, 0.25, 6.0, 0.06, dark);
        break;
      case "balloon": {
        put(dyn.cyl, P, 0, 2.2, 0, 0, 0, 0, 0.1, 4.4, 0.1, dark);
        const bob = Math.sin(t * 1.3 + lm.rot) * 0.25;
        put(dyn.sph, P, 0, 5.6 + bob, 0, 0, 0, 0, 2.3, 2.6, 2.3, c);
        put(dyn.cube, P, 0, 4.1 + bob, 0, 0, 0, 0, 0.5, 0.35, 0.5, WOOD);
        break;
      }
      case "flag":
        put(dyn.cyl, P, 0, 3.3, 0, 0, 0, 0, 0.14, 6.6, 0.14, white);
        put(dyn.cube, P, 0.85, 5.9, 0, Math.sin(t * 2.2 + lm.rot) * 0.25, 0, 0, 1.7, 1.0, 0.06, c);
        put(dyn.sph, P, 0, 6.65, 0, 0, 0, 0, 0.3, 0.3, 0.3, GOLD, 0.5);
        break;
      case "sunflower":
        put(dyn.cyl, P, 0, 2.5, 0, 0, 0, 0, 0.18, 5.0, 0.18, green);
        put(dyn.cyl, P, 0, 5.2, -0.15, 0, Math.PI / 2 - 0.2, 0, 2.6, 0.12, 2.6, [1, 0.82, 0.15], 0.2);
        put(dyn.cyl, P, 0, 5.2, -0.28, 0, Math.PI / 2 - 0.2, 0, 1.2, 0.2, 1.2, [0.35, 0.2, 0.1]);
        break;
      case "tower":
        for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) put(dyn.cyl, P, x, 2.0, z, 0, 0, 0, 0.14, 4.0, 0.14, dark);
        put(dyn.cyl, P, 0, 4.9, 0, 0, 0, 0, 2.2, 1.8, 2.2, c);
        put(dyn.cone, P, 0, 6.2, 0, 0, 0, 0, 2.4, 1.0, 2.4, dark);
        break;
      case "scarecrow":
        put(dyn.cyl, P, 0, 2.3, 0, 0, 0, 0, 0.14, 4.6, 0.14, WOOD);
        put(dyn.cube, P, 0, 3.7, 0, 0, 0, 0, 2.3, 0.14, 0.14, WOOD);
        put(dyn.cube, P, 0, 3.3, 0, 0, 0, 0, 0.9, 1.3, 0.4, c);
        put(dyn.sph, P, 0, 4.4, 0, 0, 0, 0, 0.7, 0.7, 0.7, [0.95, 0.8, 0.55]);
        put(dyn.cone, P, 0, 4.95, 0, 0, 0, 0, 0.9, 0.7, 0.9, dark);
        break;
      case "barn":
        put(dyn.cube, P, 0, 1.6, 0, 0, 0, 0, 3.2, 3.2, 4.2, c);
        put(dyn.roof, P, 0, 3.8, 0, 0, 0, 0, 3.6, 1.5, 4.5, dark);
        put(dyn.cube, P, 0, 1.2, -2.12, 0, 0, 0, 1.4, 2.0, 0.06, white);
        break;
    }
  }

  // ---------------------------------------------------------------- Drohne & Schatz
  const droneC = [0.93, 0.93, 0.96], droneD = [0.2, 0.22, 0.28];
  function drawDrone(d, t) {
    const P = M4.trs(new Float32Array(16), d.x, d.y, d.z, d.yaw, d.pitch, d.roll, 0.62, 0.62, 0.62);
    put(dyn.cube, P, 0, 0, 0, 0, 0, 0, 0.62, 0.22, 0.86, droneC);
    put(dyn.cube, P, 0, 0.14, 0.05, 0, 0, 0, 0.36, 0.14, 0.4, [0.98, 0.45, 0.2]);
    put(dyn.cube, P, 0, 0, 0, Math.PI / 4, 0, 0, 1.55, 0.07, 0.1, droneD);
    put(dyn.cube, P, 0, 0, 0, -Math.PI / 4, 0, 0, 1.55, 0.07, 0.1, droneD);
    put(dyn.cube, P, 0, 0.02, -0.46, 0, 0, 0, 0.16, 0.1, 0.1, [0.4, 1, 0.8], 1);
    put(dyn.cube, P, 0, 0.02, 0.46, 0, 0, 0, 0.16, 0.1, 0.1, [1, 0.3, 0.3], 1);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
      const x = sx * 0.55, z = sz * 0.55;
      put(dyn.cyl, P, x, 0.02, z, 0, 0, 0, 0.16, 0.14, 0.16, droneD);
      put(dyn.cube, P, x, 0.12, z, t * 38 * (i % 2 ? 1 : -1), 0, 0, 0.72, 0.02, 0.08, [0.1, 0.1, 0.12]);
    });
    // Schatten auf dem Boden (Tiefenwahrnehmung)
    put(dyn.cyl, I, d.x, 0.07, d.z, 0, 0, 0, 0.7, 0.02, 0.7, [0.22, 0.16, 0.08]);
  }

  const goalW = cw(maze.goal[0], maze.goal[1]);
  const prevCell = maze.path[maze.path.length - 2] ?? maze.start;
  const chestYaw = Math.atan2(-(maze.goal[0] - prevCell[0]), maze.goal[1] - prevCell[1]);
  let chestOpen = 0; // 0 zu .. 1 offen
  function drawChest(t, near) {
    const P = world(goalW.x, 0, goalW.z, chestYaw);
    put(dyn.cube, P, 0, 0.35, 0, 0, 0, 0, 1.3, 0.7, 0.9, WOOD);
    for (const x of [-0.45, 0.45]) put(dyn.cube, P, x, 0.36, 0, 0, 0, 0, 0.12, 0.74, 0.94, GOLD, 0.15);
    put(dyn.cube, P, 0, 0.3, -0.46, 0, 0, 0, 0.2, 0.22, 0.05, GOLD, 0.3);
    const H = new Float32Array(16); M4.mul(H, P, M4.trs(Lm, 0, 0.7, 0.45, 0, chestOpen * 1.9, 0));
    put(dyn.cube, H, 0, 0.125, -0.45, 0, 0, 0, 1.3, 0.25, 0.9, WOOD);
    for (const x of [-0.45, 0.45]) put(dyn.cube, H, x, 0.13, -0.45, 0, 0, 0, 0.12, 0.28, 0.94, GOLD, 0.15);
    if (chestOpen > 0.3) put(dyn.cube, P, 0, 0.68, 0, 0, 0, 0, 1.1, 0.06, 0.7, GOLD, 1);
    if (near || chestOpen > 0) for (let i = 0; i < 6; i++) {
      const a = t * 1.4 + i * 1.05, r = 0.9 + 0.2 * Math.sin(t * 2 + i);
      put(dyn.cube, I, goalW.x + Math.cos(a) * r, 1.0 + 0.5 * Math.sin(t * 2.3 + i * 2), goalW.z + Math.sin(a) * r, a, 0, 0, 0.13, 0.13, 0.13, GOLD, 1);
    }
  }

  // Wolken (nur Deko)
  const clouds = Array.from({ length: 7 }, (_, i) => ({ x: (rng() - 0.5) * 140, y: 26 + rng() * 8, z: (rng() - 0.5) * 140, s: 8 + rng() * 8, sp: 0.4 + rng() * 0.6 }));

  // ---------------------------------------------------------------- Zustand
  const startW = pathToWorld(maze, S);
  const startCellW = cw(maze.start[0], maze.start[1]);
  const drone = { x: startCellW.x, y: FLY_H, z: startCellW.z, yaw: 0, pitch: 0, roll: 0 };
  const cam = { x: 0, y: 2, z: 0, tx: 0, ty: 1.6, tz: 0, yaw: 0 };
  let phase = "intro", phaseT = 0, time = 0, playTime = 0, wrong = 0, maxIdx = 0, onMain = true, found = false;
  const keys = { up: false, down: false, left: false, right: false };
  const particles = [];
  const parts = { frames: 0 };

  // Beobachtungsflug: Weg glätten (Ecken abrunden) und mit konstantem Tempo abfliegen
  const flight = (() => {
    let pts = startW.map((p) => [p.x, p.z]);
    for (let it = 0; it < 3; it++) {
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      out.push(pts[pts.length - 1]); pts = out;
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, total: cum[cum.length - 1] };
  })();
  function flightAt(d) {
    const { pts, cum } = flight;
    if (d < 0) return { x: pts[0][0], z: pts[0][1] - d, yaw: 0 }; // vor dem Start: Verlängerung nach Süden
    d = clamp(d, 0, flight.total);
    let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
    const seg = cum[i] - cum[i - 1] || 1, u = (d - cum[i - 1]) / seg;
    const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, z = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u;
    const yaw = Math.atan2(pts[i][0] - pts[i - 1][0], -(pts[i][1] - pts[i - 1][1]));
    return { x, z, yaw };
  }
  const obsDuration = flight.total / L.obsSpeed;
  const pathLen = (maze.path.length) * S;
  const par = (pathLen / PLAYER_SPEED) * 1.25;
  const timeLimit = par * L.timeFactor + 15;
  let flightDist = 0;

  // ---------------------------------------------------------------- Eingabe
  const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  const onKeyDown = (e) => { const k = KEYMAP[e.code]; if (k) { keys[k] = true; e.preventDefault(); } };
  const onKeyUp = (e) => { const k = KEYMAP[e.code]; if (k) { keys[k] = false; e.preventDefault(); } };
  window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);
  cleanups.push(() => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); });
  const releaseAll = () => { keys.up = keys.down = keys.left = keys.right = false; };
  window.addEventListener("blur", releaseAll); cleanups.push(() => window.removeEventListener("blur", releaseAll));
  padEl.querySelectorAll(".m3-btn").forEach((btn) => {
    const k = btn.dataset.k;
    const on = (e) => { e.preventDefault(); keys[k] = true; btn.classList.add("m3-btn--on"); try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ } };
    const off = (e) => { e.preventDefault(); keys[k] = false; btn.classList.remove("m3-btn--on"); };
    btn.addEventListener("pointerdown", on); btn.addEventListener("pointerup", off);
    btn.addEventListener("pointercancel", off); btn.addEventListener("lostpointercapture", off);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  });
  const touchy = window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window;
  if (touchy) padEl.classList.remove("hidden");
  stage.addEventListener("selectstart", onSelect);

  $(".m3-start__btn").addEventListener("click", () => {
    if (phase !== "ready") return;
    audio.sfx("click");
    startEl.classList.add("hidden"); beginCountdown();
  });

  // ---------------------------------------------------------------- Ablauf
  const setPhase = (p) => { phase = p; phaseT = 0; };
  function say(text) { phaseEl.textContent = text; }
  function resetDroneToStart() {
    drone.x = startCellW.x; drone.z = startCellW.z; drone.yaw = 0; drone.y = FLY_H; drone.pitch = 0; drone.roll = 0;
    cam.yaw = 0;
  }
  function fadeTo(fn) {
    fadeEl.classList.add("m3-fade--on");
    setTimeout(() => { if (!alive) return; fn(); fadeEl.classList.remove("m3-fade--on"); }, 380);
  }
  function beginCountdown() {
    setPhase("countdown"); countEl.classList.remove("hidden"); countEl.textContent = "3"; say("Mach dich bereit …"); audio.sfx("tick");
    countdownN = 3;
  }
  let countdownN = 3;

  function blockedAt(x, z) {
    const [cx, cy] = worldToCell(maze, x, z, S);
    return !isOpen(maze, cx, cy);
  }
  // Kamera: nur das Maisfeld (inkl. Rand) ist massiv, davor/dahinter ist freies Gelände
  function camBlockedAt(x, z) {
    const [cx, cy] = worldToCell(maze, x, z, S);
    if (cx < -RING || cy < -RING || cx >= maze.size + RING || cy >= maze.size + RING) return false;
    return !isOpen(maze, cx, cy);
  }
  function blockedCircle(x, z) {
    return blockedAt(x - RADIUS, z) || blockedAt(x + RADIUS, z) || blockedAt(x, z - RADIUS) || blockedAt(x, z + RADIUS)
      || blockedAt(x - RADIUS * 0.7, z - RADIUS * 0.7) || blockedAt(x + RADIUS * 0.7, z - RADIUS * 0.7)
      || blockedAt(x - RADIUS * 0.7, z + RADIUS * 0.7) || blockedAt(x + RADIUS * 0.7, z + RADIUS * 0.7);
  }

  function updatePlay(dt) {
    playTime += dt;
    const turn = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), fwd = (keys.up ? 1 : 0) - (keys.down ? 1 : 0) * 0.45;
    drone.yaw += turn * TURN_RATE * dt * (fwd < 0 ? -1 : 1) * (fwd === 0 ? 0.85 : 1);
    const sp = fwd * (fwd > 0 ? PLAYER_SPEED : PLAYER_SPEED) * dt;
    const nx = drone.x + Math.sin(drone.yaw) * sp, nz = drone.z - Math.cos(drone.yaw) * sp;
    if (!blockedCircle(nx, drone.z)) drone.x = nx;
    if (!blockedCircle(drone.x, nz)) drone.z = nz;
    drone.pitch += ((fwd > 0 ? -0.2 : fwd < 0 ? 0.12 : 0) - drone.pitch) * Math.min(1, dt * 6);
    drone.roll += ((-turn * 0.32) - drone.roll) * Math.min(1, dt * 6);

    // Fortschritt / Sackgassen
    const [cx, cy] = worldToCell(maze, drone.x, drone.z, S);
    const mi = mainIdx.get(key(cx, cy));
    if (mi !== undefined) { maxIdx = Math.max(maxIdx, mi); onMain = true; }
    else if (isOpen(maze, cx, cy) && onMain) { onMain = false; wrong++; audio.sfx("wrong"); popBanner(stage, "SACKGASSE!", "warn"); avatar.bump(); }
    // Schatz erreicht?
    if (Math.hypot(drone.x - goalW.x, drone.z - goalW.z) < 1.5) { onFound(); return; }
    if (playTime >= timeLimit) { onTimeout(); return; }
    onHud({ timeLeft: Math.max(0, timeLimit - playTime), total: timeLimit, score: 0 });
    statsEl.textContent = `⏱ ${Math.max(0, timeLimit - playTime).toFixed(0)} s   ✖ ${wrong}`;
  }

  function onFound() {
    found = true; setPhase("found"); releaseAll(); padEl.classList.add("hidden");
    audio.sfx("unlockRare"); audio.vibrate?.([30, 20, 60]); say("SCHATZ GEFUNDEN!"); statsEl.textContent = "";
    popBanner(stage, "SCHATZ GEFUNDEN!", "gold"); avatar.bump();
  }
  function onTimeout() {
    setPhase("timeout"); releaseAll(); padEl.classList.add("hidden"); say("ZEIT ABGELAUFEN"); statsEl.textContent = "";
    audio.sfx("wrong"); popBanner(stage, "ZEIT ABGELAUFEN", "warn");
    setTimeout(() => finish(false), 1800);
  }
  function spawnTreasure() {
    for (let i = 0; i < 46; i++) {
      const a = rng() * Math.PI * 2, sp = 2 + rng() * 4;
      particles.push({ x: goalW.x, y: 0.9, z: goalW.z, vx: Math.cos(a) * sp * 0.6, vy: 4 + rng() * 5, vz: Math.sin(a) * sp * 0.6, life: 1.6 + rng() * 1.0, coin: i % 3 === 0, sp: rng() * 8 });
    }
  }

  function finish(won) {
    if (phase === "done") return;
    setPhase("done");
    let percent, score;
    if (won) {
      const timeScore = clamp(1 - (playTime - par) / (par * (L.timeFactor - 1)), 0, 1);
      const accuracy = Math.max(0, 1 - wrong * 0.18);
      percent = Math.round(45 + 35 * timeScore + 20 * accuracy);
      score = percent * 10;
    } else {
      percent = Math.round(35 * (maxIdx / Math.max(1, maze.path.length - 1)));
      score = percent * 10;
    }
    const secs = playTime.toFixed(1);
    const res = { score, percent, won, maxCombo: 0, hideCombo: true,
      resultLabel: won ? `SCHATZ in ${secs} s · ${wrong} Sackgasse${wrong === 1 ? "" : "n"} · ${score} PUNKTE` : `ZEIT ABGELAUFEN · ${score} PUNKTE` };
    teardown(true);
    onEnd(res);
  }

  // ---------------------------------------------------------------- Kamera
  function updateCameraOnPath(dt) {
    const c = flightAt(flightDist - 3.6), look = flightAt(flightDist + 5);
    const k = Math.min(1, dt * 8);
    cam.x += (c.x - cam.x) * k; cam.z += (c.z - cam.z) * k; cam.y = 2.05;
    cam.tx += (look.x - cam.tx) * k; cam.tz += (look.z - cam.tz) * k; cam.ty = 1.7;
    cam.yaw = drone.yaw;
  }
  function updateCamera(dt, tight) {
    const targetYaw = drone.yaw;
    let dy = targetYaw - cam.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    cam.yaw += dy * Math.min(1, dt * (tight ? 14 : 6));
    const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    // so weit hinter die Drohne, wie der Gang frei ist (Kamera bleibt im Mais-Gang)
    let back = 0;
    while (back < 3.6 && !camBlockedAt(drone.x - fx * (back + 0.3), drone.z - fz * (back + 0.3))) back += 0.3;
    cam.x = drone.x - fx * back; cam.z = drone.z - fz * back; cam.y = 1.95 + (back < 1.8 ? 0.3 : 0);
    cam.tx = drone.x + fx * 6; cam.tz = drone.z + fz * 6; cam.ty = 1.75;
  }
  function orbitCamera(t) {
    // Kamera bleibt im Gang vor der Truhe (dort ist Platz), leichtes Schwanken + Anheben
    const fx = Math.sin(chestYaw), fz = -Math.cos(chestYaw), sx = -fz, sz = fx; // sx,sz = seitlich
    const sway = Math.sin(t * 1.1) * 0.5, dist = 3.3 - Math.min(0.5, t * 0.25);
    cam.x = goalW.x + fx * dist + sx * sway; cam.z = goalW.z + fz * dist + sz * sway; cam.y = 1.7 + Math.min(0.9, t * 0.5);
    cam.tx = goalW.x; cam.ty = 0.9; cam.tz = goalW.z;
  }

  // ---------------------------------------------------------------- Hauptschleife
  let last = null;
  function frame(ts) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (last == null) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    time += dt; phaseT += dt;
    renderer.resize(touchy ? 1.6 : 2);

    switch (phase) {
      case "intro": {
        say("👀 Merk dir den Weg!"); statsEl.textContent = "";
        const f = flightAt(0); drone.x = f.x; drone.z = f.z; drone.yaw = f.yaw; flightDist = 0; updateCameraOnPath(1);
        onHud({ timeLeft: obsDuration, total: obsDuration, score: 0 });
        if (phaseT > 1.4) setPhase("observe");
        break;
      }
      case "observe": {
        flightDist += L.obsSpeed * dt;
        const f = flightAt(flightDist), nf = flightAt(flightDist + 0.8);
        drone.x = f.x; drone.z = f.z;
        let dy = nf.yaw - drone.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); drone.yaw += dy * Math.min(1, dt * 8);
        drone.roll += ((-dy * 0.8) - drone.roll) * Math.min(1, dt * 5); drone.pitch += (-0.18 - drone.pitch) * Math.min(1, dt * 4);
        drone.y = FLY_H + Math.sin(time * 3) * 0.05;
        updateCameraOnPath(dt);
        onHud({ timeLeft: Math.max(0, obsDuration - phaseT), total: obsDuration, score: 0 });
        if (flightDist >= flight.total) { setPhase("show"); say("💰 Hier liegt der Schatz!"); }
        break;
      }
      case "show": {
        drone.y = FLY_H + Math.sin(time * 3) * 0.05; drone.pitch *= 0.9; drone.roll *= 0.9; updateCameraOnPath(dt);
        if (phaseT > 1.6) { setPhase("fadeout"); fadeTo(() => { resetDroneToStart(); setPhase("ready"); startEl.classList.remove("hidden"); say("Bereit?"); }); }
        break;
      }
      case "fadeout": break;
      case "ready": {
        drone.y = FLY_H + Math.sin(time * 3) * 0.05; updateCamera(dt, true);
        onHud({ timeLeft: timeLimit, total: timeLimit, score: 0 });
        break;
      }
      case "countdown": {
        updateCamera(dt, true); drone.y = FLY_H + Math.sin(time * 3) * 0.05;
        if (phaseT > 0.8) {
          phaseT = 0; countdownN--;
          if (countdownN > 0) { countEl.textContent = String(countdownN); audio.sfx("tick"); }
          else { countEl.textContent = "LOS!"; audio.sfx("combo"); setPhase("play"); padEl.classList.remove("m3-pad--dim"); say("Finde den Schatz!"); setTimeout(() => countEl.classList.add("hidden"), 500); }
        }
        break;
      }
      case "play": updatePlay(dt); updateCamera(dt, true); drone.y = FLY_H + Math.sin(time * 3) * 0.04; break;
      case "found": {
        chestOpen = Math.min(1, chestOpen + dt * 1.3);
        if (phaseT < 0.05 && !particles.length) spawnTreasure();
        orbitCamera(phaseT);
        if (phaseT > 2.6) finish(true);
        break;
      }
      case "timeout": updateCamera(dt, false); break;
      default: break;
    }

    // Partikel
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= dt; p.vy -= 11 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
      if (p.life <= 0) particles.splice(i, 1);
    }

    // --- Szene zusammenbauen
    for (const b of Object.values(dyn)) b.count = 0;
    for (const lm of maze.landmarks) drawLandmark(lm, time);
    const nearChest = phase === "show" || phase === "observe" ? (flight.total - flightDist) < 9 : Math.hypot(drone.x - goalW.x, drone.z - goalW.z) < 9;
    drawChest(time, nearChest);
    if (phase !== "found") drawDrone(drone, time);
    for (const p of particles) {
      if (p.coin) put(dyn.cyl, I, p.x, p.y, p.z, 0, time * 6 + p.sp, p.sp, 0.28, 0.05, 0.28, GOLD, 1);
      else put(dyn.cube, I, p.x, p.y, p.z, p.sp, 0, 0, 0.14, 0.14, 0.14, [1, 0.9, 0.5], 1);
    }
    for (const c of clouds) { c.x += c.sp * dt; if (c.x > 90) c.x = -90; put(dyn.cube, I, c.x, c.y, c.z, 0, 0, 0, c.s, 1.8, c.s * 0.55, [1, 1, 1], 0.9); }
    for (const b of Object.values(dyn)) b.upload();

    // Sichtbarkeit der Mais-Chunks (Entfernung + vor der Kamera)
    const cfx = cam.tx - cam.x, cfz = cam.tz - cam.z, cl = Math.hypot(cfx, cfz) || 1;
    for (const b of staticBatches) {
      if (!b.center) continue;
      const dx = b.center.x - cam.x, dz = b.center.z - cam.z;
      b.visible = Math.hypot(dx, dz) < FOG.far + b.radius && (dx * cfx + dz * cfz) / cl > -b.radius * 1.2;
    }
    parts.calls = renderer.render({ x: cam.x, y: cam.y, z: cam.z, tx: cam.tx, ty: cam.ty, tz: cam.tz, fov: 1.05 }, FOG, [...staticBatches, ...Object.values(dyn)]);
    parts.frames++;
  }
  raf = requestAnimationFrame(frame);

  // Test-/Debug-Zugriff nur mit ?debug in der URL
  if (typeof location !== "undefined" && /[?&]debug/.test(location.search)) {
    window.__mais = {
      maze, par, timeLimit, obsDuration, S,
      state: () => ({ phase, x: drone.x, z: drone.z, yaw: drone.yaw, wrong, playTime, calls: parts.calls, frames: parts.frames, found }),
      setKeys: (k) => Object.assign(keys, k),
      pressStart: () => $(".m3-start__btn").click(),
      skipObserve: () => { if (phase === "intro" || phase === "observe") { flightDist = flight.total; setPhase("observe"); } },
    };
  }

  function teardown(keepAvatarStage) {
    if (!alive) return;
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    cleanups.forEach((f) => f());
    stage.removeEventListener("selectstart", onSelect);
    try { avatar.destroy(); } catch { /* ignore */ }
    try { renderer?.dispose(); } catch { /* ignore */ }
    if (typeof window !== "undefined" && window.__mais) delete window.__mais;
    stage.remove();
  }
  return { destroy: () => teardown() };
}
