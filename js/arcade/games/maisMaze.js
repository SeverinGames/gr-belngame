// js/arcade/games/maisMaze.js
// Reiner Logik-Teil der MAIS-MISSION (ohne DOM/WebGL, daher testbar):
// erzeugt zufällige Maisfeld-Labyrinthe mit EINEM Lösungsweg, Sackgassen-
// Abzweigungen und Orientierungspunkten.
//
// Regeln: Alle begehbaren Zellen bilden einen Baum (keine Schleifen, kein
// Zusammenstoßen von Gängen - jede Zelle hat nur ihre Nachbarn im Gang als
// begehbare Nachbarn). Damit ist der Weg zum Schatz eindeutig.
export const MAZE_LEVELS = {
  easy: { size: 7, len: [12, 14], turns: [2, 4], branches: 2, branchLen: [1, 2], landmarks: 6, repeatLandmarks: false, obsSpeed: 3.8, timeFactor: 4.0 },
  normal: { size: 9, len: [20, 24], turns: [6, 9], branches: 5, branchLen: [1, 3], landmarks: 8, repeatLandmarks: false, obsSpeed: 5.4, timeFactor: 3.4 },
  hard: { size: 15, len: [46, 56], turns: [16, 24], branches: 14, branchLen: [2, 5], landmarks: 14, repeatLandmarks: true, obsSpeed: 7.8, timeFactor: 2.9 },
};
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, O, S, W
export const LANDMARK_TYPES = ["windmill", "silo", "balloon", "flag", "sunflower", "tower", "scarecrow", "barn"];

const key = (x, y) => `${x},${y}`;

export function generateMaze(difficulty, rng = Math.random) {
  const L = MAZE_LEVELS[difficulty] ?? MAZE_LEVELS.normal;
  for (let attempt = 0; attempt < 600; attempt++) {
    const m = tryGenerate(L, rng);
    if (m) return m;
  }
  return serpentine(L); // sicherer Notfall-Weg (sollte praktisch nie nötig sein)
}

function tryGenerate(L, rng) {
  const N = L.size;
  const carved = new Set();
  const inGrid = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  // Zelle darf nur begehbar werden, wenn außer dem Elternteil kein weiterer Nachbar begehbar ist
  const canCarve = (x, y, px, py) => {
    if (!inGrid(x, y) || carved.has(key(x, y))) return false;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if ((nx !== px || ny !== py) && carved.has(key(nx, ny))) return false;
    }
    return true;
  };
  const nodeBudget = L.size >= 15 ? 60000 : 6000;
  const targetLen = L.len[0] + Math.floor(rng() * (L.len[1] - L.len[0] + 1));
  const sx = 1 + Math.floor(rng() * (N - 2));
  const start = [sx, N - 1]; // Südkante, Blick nach Norden
  const path = [start];
  carved.add(key(...start));
  let nodes = 0;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function dfs(dirIdx) {
    if (path.length === targetLen) return countTurns(path) >= L.turns[0] && countTurns(path) <= L.turns[1];
    if (++nodes > nodeBudget) return false;
    const [cx, cy] = path[path.length - 1];
    const order = path.length === 1 ? [0] : shuffle([0, 1, 2, 3]); // erster Schritt nach Norden
    for (const d of order) {
      const nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
      if (!canCarve(nx, ny, cx, cy)) continue;
      path.push([nx, ny]); carved.add(key(nx, ny));
      if (countTurns(path) <= L.turns[1] && dfs(d)) return true;
      path.pop(); carved.delete(key(nx, ny));
    }
    return false;
  }
  if (!dfs(0)) return null;

  const mainSet = new Set(path.map((c) => key(...c)));
  const cells = path.map((c, i) => ({ x: c[0], y: c[1], main: true, idx: i }));

  // Sackgassen-Abzweigungen
  let made = 0, tries = 0;
  while (made < L.branches && tries++ < 200) {
    const base = path[1 + Math.floor(rng() * (path.length - 2))]; // nicht Start, nicht Ziel
    const d = Math.floor(rng() * 4);
    let [px, py] = base;
    const want = L.branchLen[0] + Math.floor(rng() * (L.branchLen[1] - L.branchLen[0] + 1));
    let len = 0, dir = d;
    const added = [];
    while (len < want) {
      const nx = px + DIRS[dir][0], ny = py + DIRS[dir][1];
      if (canCarve(nx, ny, px, py)) {
        carved.add(key(nx, ny)); added.push([nx, ny]); cells.push({ x: nx, y: ny, main: false, idx: -1 });
        px = nx; py = ny; len++;
      } else if (len > 0 && rng() < 0.7) {
        dir = (dir + (rng() < 0.5 ? 1 : 3)) % 4; // abbiegen
        const tx = px + DIRS[dir][0], ty = py + DIRS[dir][1];
        if (!canCarve(tx, ty, px, py)) break;
      } else break;
    }
    if (len >= 1) made++;
  }

  const goal = path[path.length - 1];
  const maze = {
    size: N, start, goal, path, cells, carved: new Set(carved), mainSet, difficulty: null,
    turns: countTurns(path), branchesMade: made, entrance: [start[0], N], entrance2: [start[0], N + 1], // Zufahrt südlich vom Feld (2 Zellen)
  };
  maze.landmarks = placeLandmarks(maze, L, rng);
  return maze;
}

export function countTurns(path) {
  let t = 0;
  for (let i = 2; i < path.length; i++) {
    const a = [path[i - 1][0] - path[i - 2][0], path[i - 1][1] - path[i - 2][1]];
    const b = [path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]];
    if (a[0] !== b[0] || a[1] !== b[1]) t++;
  }
  return t;
}

// Orientierungspunkte stehen in Maiszellen NEBEN den Gängen (und am Feldrand).
// Sie sind verteilt, nicht direkt an die richtige Abzweigung gekoppelt.
function placeLandmarks(maze, L, rng) {
  const N = maze.size;
  const spots = [];
  const seen = new Set();
  const addSpot = (x, y, near) => { const k = key(x, y); if (!seen.has(k) && !maze.carved.has(k)) { seen.add(k); spots.push({ x, y, near }); } };
  // Nachbarzellen von Hauptweg-Zellen (Wand) und ein paar Randpunkte
  for (const c of maze.path) for (const [dx, dy] of DIRS) {
    const x = c[0] + dx, y = c[1] + dy;
    if (x >= -1 && y >= -1 && x <= N && y <= N) addSpot(x, y, "main");
  }
  for (const c of maze.cells.filter((c) => !c.main)) for (const [dx, dy] of DIRS) addSpot(c.x + dx, c.y + dy, "branch");
  for (let i = -1; i <= N; i++) { addSpot(i, -1, "edge"); addSpot(-1, i, "edge"); addSpot(N, i, "edge"); }
  // mischen und so wählen, dass die Punkte gestreut sind (Mindestabstand)
  for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
  const chosen = [];
  let minDist = 3;
  while (chosen.length < L.landmarks && minDist >= 1) {
    for (const s of spots) {
      if (chosen.length >= L.landmarks) break;
      if (chosen.includes(s)) continue;
      if (chosen.every((c) => Math.hypot(c.x - s.x, c.y - s.y) >= minDist)) chosen.push(s);
    }
    minDist--;
  }
  const types = [...LANDMARK_TYPES];
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  const palette = [0, 1, 2, 3];
  return chosen.map((s, i) => {
    // SCHWER: nur wenige Typen/Farben -> ähnliche Abschnitte, man muss genauer hinsehen
    const type = L.repeatLandmarks ? types[i % 6] : types[i % types.length];
    const tint = L.repeatLandmarks ? palette[(i + (i >> 2)) % 3] : palette[i % 4];
    return { x: s.x, y: s.y, type, tint, rot: rng() * Math.PI * 2 };
  });
}

function serpentine(L) {
  const N = L.size, path = [], carved = new Set();
  for (let r = 0, y = N - 1; y >= 0; y -= 2, r++) {
    const row = [];
    for (let x = 1; x < N - 1; x++) row.push([x, y]);
    if (r % 2) row.reverse();
    path.push(...row);
    if (y - 1 >= 0 && y - 2 >= 0) path.push([r % 2 ? 1 : N - 2, y - 1]);
  }
  path.forEach((c) => carved.add(key(...c)));
  const m = { size: N, start: path[0], goal: path[path.length - 1], path, cells: path.map((c, i) => ({ x: c[0], y: c[1], main: true, idx: i })), carved, mainSet: new Set(carved), turns: countTurns(path), branchesMade: 0, entrance: [path[0][0], N], entrance2: [path[0][0], N + 1] };
  m.landmarks = placeLandmarks(m, L, Math.random);
  return m;
}

// Wegpunkte als Weltkoordinaten (Zellgröße S), inklusive Eingang davor
export function pathToWorld(maze, S) {
  const half = maze.size / 2;
  const toW = (x, y) => ({ x: (x - half + 0.5) * S, z: (y - half + 0.5) * S });
  return [toW(...maze.entrance2), toW(...maze.entrance), ...maze.path.map((c) => toW(...c))];
}
export function cellToWorld(maze, x, y, S) {
  const half = maze.size / 2;
  return { x: (x - half + 0.5) * S, z: (y - half + 0.5) * S };
}
export function worldToCell(maze, wx, wz, S) {
  const half = maze.size / 2;
  return [Math.floor(wx / S + half), Math.floor(wz / S + half)];
}
// Ist diese Zelle begehbar? (Eingangsplatz südlich vom Feld zählt dazu)
export function isOpen(maze, x, y) {
  return maze.carved.has(key(x, y)) || (x === maze.entrance[0] && (y === maze.entrance[1] || y === maze.entrance2[1]));
}
