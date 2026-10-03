// js/arcade/games/mazeGrid.js - Labyrinth-Erzeugung (rein, testbar) für "Maze".
// Das Spielfeld ist ein Raster aus Blöcken (1 = Wand, 0 = Gang) der Größe
// (2n+1) x (2n+1); jedes Labyrinth ist "perfekt" (genau ein Weg zum Ziel).
export const MAZE_LEVELS = {
  easy: { n: 6, straight: 0.85, speed: 6.2, timeFactor: 4.5 },   // wenige Abzweigungen, kurze Gänge
  normal: { n: 9, straight: 0.45, speed: 6.4, timeFactor: 3.6 },
  hard: { n: 15, straight: 0, speed: 6.8, timeFactor: 2.5 },     // groß, viele Sackgassen, knapperes Zeitlimit
};

export function generateMaze(difficulty, rng = Math.random) {
  const L = MAZE_LEVELS[difficulty] ?? MAZE_LEVELS.normal, n = L.n, T = 2 * n + 1;
  const grid = Array.from({ length: T }, () => Array(T).fill(1));
  const D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const seen = Array.from({ length: n }, () => Array(n).fill(false));
  const stack = [[0, 0, -1]]; seen[0][0] = true; grid[1][1] = 0;
  while (stack.length) {
    const [cx, cy, lastDir] = stack[stack.length - 1];
    const opts = [];
    for (let d = 0; d < 4; d++) { const nx = cx + D[d][0], ny = cy + D[d][1]; if (nx >= 0 && ny >= 0 && nx < n && ny < n && !seen[ny][nx]) opts.push(d); }
    if (!opts.length) { stack.pop(); continue; }
    // "straight" bevorzugt Geradeausgehen -> lange Gänge, weniger Abzweigungen (LEICHT)
    let d = opts[Math.floor(rng() * opts.length)];
    if (lastDir >= 0 && opts.includes(lastDir) && rng() < L.straight) d = lastDir;
    const nx = cx + D[d][0], ny = cy + D[d][1];
    grid[cy * 2 + 1 + D[d][1]][cx * 2 + 1 + D[d][0]] = 0; grid[ny * 2 + 1][nx * 2 + 1] = 0;
    seen[ny][nx] = true; stack.push([nx, ny, d]);
  }
  // Start/Ziel zufällig an gegenüberliegenden Ecken
  const flipX = rng() < 0.5, flipY = rng() < 0.5;
  const start = [flipX ? T - 2 : 1, flipY ? T - 2 : 1], goal = [flipX ? 1 : T - 2, flipY ? 1 : T - 2];
  const dist = distancesFrom(grid, goal);
  return { grid, T, start, goal, dist, shortest: dist[start[1]][start[0]], level: L };
}

// Wegstrecke (in Blöcken) von jedem Gang-Block bis zum Ziel (BFS); Wände = -1
export function distancesFrom(grid, [gx, gy]) {
  const T = grid.length, dist = Array.from({ length: T }, () => Array(T).fill(-1));
  const q = [[gx, gy]]; dist[gy][gx] = 0;
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < T && ny < T && grid[ny][nx] === 0 && dist[ny][nx] < 0) { dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]); }
    }
  }
  return dist;
}

// Kreis (cx,cy,r in Block-Einheiten) gegen Wandblöcke: schiebt den Kreis heraus.
export function collide(grid, x, y, r) {
  const T = grid.length;
  let hit = false;
  for (let by = Math.floor(y - r); by <= Math.floor(y + r); by++) for (let bx = Math.floor(x - r); bx <= Math.floor(x + r); bx++) {
    if (bx < 0 || by < 0 || bx >= T || by >= T || grid[by][bx] === 1) {
      const nx = Math.max(bx, Math.min(x, bx + 1)), ny = Math.max(by, Math.min(y, by + 1));
      const dx = x - nx, dy = y - ny, d = Math.hypot(dx, dy);
      if (d < r) {
        hit = true;
        if (d > 1e-6) { x = nx + (dx / d) * r; y = ny + (dy / d) * r; }
        else { y -= r; }
      }
    }
  }
  return { x, y, hit };
}
