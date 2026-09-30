// js/arcade/games/connectFour.js
// NEUES MINISPIEL - VIER GEWINNT gegen eine KI. Kein Reaktionsspiel: es geht
// um Planen und Blocken. Der Spieler ist sein ausgewählter Skin (die eigenen
// Steine zeigen die Figur, der Skin steht außerdem über dem Brett), die KI
// spielt mit dunklen Steinen.
// KI-Stufen: leicht = schlägt/blockt nur offensichtliches und macht oft
// Zufallszüge, normal = Minimax Tiefe 3, schwer = Minimax mit Alpha-Beta
// Tiefe 6 (kaum Fehler).
import { mountSkinAvatar, renderSkinStill, popBanner, clamp } from "../engine.js";
import { getSkinPalette } from "../../world/characterSprite.js";
import { audio } from "../../audio/audio.js";

const COLS = 7, ROWS = 6;
const HUMAN = 1, AI = 2;

const AI_LEVEL = {
  easy: { depth: 1, randomChance: 0.4 },
  normal: { depth: 3, randomChance: 0.08 },
  hard: { depth: 6, randomChance: 0 },
};

// ---------- reine Spiellogik (ohne DOM) ----------
function newBoard() { return Array.from({ length: COLS }, () => Array(ROWS).fill(0)); } // board[col][row], row 0 = unten
function canPlay(b, c) { return b[c][ROWS - 1] === 0; }
function drop(b, c, who) {
  const r = b[c].indexOf(0);
  b[c][r] = who;
  return r;
}
function undrop(b, c) {
  for (let r = ROWS - 1; r >= 0; r--) if (b[c][r] !== 0) { b[c][r] = 0; return; }
}
function validCols(b) { return [3, 2, 4, 1, 5, 0, 6].filter((c) => canPlay(b, c)); } // Mitte zuerst
function isFull(b) { return validCols(b).length === 0; }

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
function findWin(b, who) {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (b[c][r] !== who) continue;
      for (const [dc, dr] of DIRS) {
        const cells = [[c, r]];
        for (let k = 1; k < 4; k++) {
          const cc = c + dc * k, rr = r + dr * k;
          if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS || b[cc][rr] !== who) break;
          cells.push([cc, rr]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

function scoreWindow(cells, who) {
  const opp = who === AI ? HUMAN : AI;
  const mine = cells.filter((v) => v === who).length;
  const theirs = cells.filter((v) => v === opp).length;
  const empty = 4 - mine - theirs;
  if (mine === 4) return 1000;
  if (mine === 3 && empty === 1) return 6;
  if (mine === 2 && empty === 2) return 2;
  if (theirs === 3 && empty === 1) return -8;
  return 0;
}
function evaluate(b, who) {
  let score = 0;
  for (let r = 0; r < ROWS; r++) score += b[3][r] === who ? 3 : 0; // Mitte ist wertvoll
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of DIRS) {
        const cells = [];
        for (let k = 0; k < 4; k++) {
          const cc = c + dc * k, rr = r + dr * k;
          if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) break;
          cells.push(b[cc][rr]);
        }
        if (cells.length === 4) score += scoreWindow(cells, who);
      }
    }
  }
  return score;
}

function minimax(b, depth, alpha, beta, maximizing) {
  if (findWin(b, AI)) return 100000 + depth;
  if (findWin(b, HUMAN)) return -100000 - depth;
  if (depth === 0 || isFull(b)) return evaluate(b, AI) - evaluate(b, HUMAN) * 0.9;
  const cols = validCols(b);
  if (maximizing) {
    let best = -Infinity;
    for (const c of cols) {
      drop(b, c, AI);
      best = Math.max(best, minimax(b, depth - 1, alpha, beta, false));
      undrop(b, c);
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const c of cols) {
    drop(b, c, HUMAN);
    best = Math.min(best, minimax(b, depth - 1, alpha, beta, true));
    undrop(b, c);
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

function chooseAiMove(b, level, rng) {
  const cols = validCols(b);
  // 1) sofort gewinnen, 2) sofort blocken - das machen ALLE Stufen, sonst
  // wirkt die KI auf "leicht" kaputt statt nur nachlässig (außer Zufallszug)
  const tryWin = (who) => {
    for (const c of cols) {
      drop(b, c, who);
      const w = !!findWin(b, who);
      undrop(b, c);
      if (w) return c;
    }
    return null;
  };
  if (rng() < level.randomChance) return cols[Math.floor(rng() * cols.length)];
  const win = tryWin(AI);
  if (win !== null) return win;
  const block = tryWin(HUMAN);
  if (block !== null) return block;
  if (level.depth <= 1) {
    // leicht: bevorzugt Mitte, ansonsten zufällig
    const weighted = cols.filter((c) => c >= 2 && c <= 4);
    const pool = rng() < 0.5 && weighted.length ? weighted : cols;
    return pool[Math.floor(rng() * pool.length)];
  }
  let bestScore = -Infinity, bestCols = [];
  for (const c of cols) {
    drop(b, c, AI);
    const sc = minimax(b, level.depth - 1, -Infinity, Infinity, false);
    undrop(b, c);
    if (sc > bestScore) { bestScore = sc; bestCols = [c]; }
    else if (sc === bestScore) bestCols.push(c);
  }
  return bestCols[Math.floor(rng() * bestCols.length)];
}

// ---------- Spiel / UI ----------
export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const level = AI_LEVEL[difficulty] ?? AI_LEVEL.normal;
  const MAX_MOVES = 21;

  const stage = document.createElement("div");
  stage.className = "c4-playfield";
  const top = document.createElement("div");
  top.className = "c4-top";
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "c4-avatar";
  const status = document.createElement("div");
  status.className = "c4-status";
  top.appendChild(avatarWrap);
  top.appendChild(status);
  const boardEl = document.createElement("div");
  boardEl.className = "c4-board";
  stage.appendChild(top);
  stage.appendChild(boardEl);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 56 });
  const playerColor = getSkinPalette(skinId).body ?? "#4fa3ff";
  stage.style.setProperty("--c4-player", playerColor);

  const board = newBoard();
  let running = true, humanTurn = true, humanMoves = 0, busy = false;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (running) fn(); }, ms); timers.add(t); };

  // Brett-DOM: Spalten als Buttons, Zellen von oben nach unten
  const colEls = [];
  const cellEls = Array.from({ length: COLS }, () => []);
  for (let c = 0; c < COLS; c++) {
    const colEl = document.createElement("button");
    colEl.className = "c4-col";
    colEl.setAttribute("aria-label", `Spalte ${c + 1}`);
    for (let r = ROWS - 1; r >= 0; r--) {
      const cell = document.createElement("div");
      cell.className = "c4-cell";
      colEl.appendChild(cell);
      cellEls[c][r] = cell;
    }
    colEl.addEventListener("click", () => humanPlay(c));
    boardEl.appendChild(colEl);
    colEls.push(colEl);
  }

  function setStatus(text) { status.textContent = text; }
  setStatus("Du bist dran!");
  onHud({ score: 0, round: 0, roundTotal: MAX_MOVES, total: 1 });

  function placeDisc(c, who) {
    const r = drop(board, c, who);
    const disc = document.createElement("div");
    disc.className = `c4-disc ${who === HUMAN ? "c4-disc--human" : "c4-disc--ai"}`;
    if (who === HUMAN) renderSkinStill(disc, skinId, 34);
    cellEls[c][r].appendChild(disc);
    // Fallanimation: von oberhalb des Bretts (in Zellhöhen) nach unten
    const fall = (ROWS - r) * 100 + 20;
    disc.animate([{ transform: `translateY(-${fall}%)` }, { transform: "translateY(0)" }], { duration: 260 + (ROWS - r) * 40, easing: "cubic-bezier(.35,0,.7,1.1)" });
    audio.sfx(who === HUMAN ? "pop" : "cardFlip");
    return r;
  }

  function finish(result) {
    if (!running) return;
    running = false;
    colEls.forEach((b) => { b.disabled = true; });
    const win = result === "win", draw = result === "draw";
    if (win) popBanner(stage, "GEWONNEN!", "gold");
    else if (draw) popBanner(stage, "UNENTSCHIEDEN", "combo");
    else popBanner(stage, "VERLOREN", "warn");
    setStatus(win ? "Vier in einer Reihe - stark!" : draw ? "Brett voll - Remis." : "Die KI war schneller.");
    if (win) avatar.bump();
    // Punkte: Sieg = 100 + Tempo-Bonus (weniger eigene Züge = mehr), Remis = 40,
    // Niederlage = 2 pro gesetztem Stein. percent steuert die Belohnungsstufe.
    let score, percent;
    if (win) { score = 100 + Math.max(0, MAX_MOVES - humanMoves) * 3; percent = clamp(75 + (MAX_MOVES - humanMoves) * 2, 75, 100); }
    else if (draw) { score = 40; percent = 45; }
    else { score = humanMoves * 2; percent = 15; }
    const t = setTimeout(() => {
      cleanup();
      onEnd({ score, percent, maxCombo: win ? 4 : 0, resultLabel: `${win ? "SIEG" : draw ? "REMIS" : "NIEDERLAGE"} · ${score} PUNKTE` });
    }, 1400);
    timers.add(t);
  }

  function highlightWin(cells) {
    cells.forEach(([c, r]) => cellEls[c][r].classList.add("c4-cell--win"));
  }

  function humanPlay(c) {
    if (!running || !humanTurn || busy || !canPlay(board, c)) return;
    busy = true;
    humanMoves++;
    placeDisc(c, HUMAN);
    avatar.bump();
    onHud({ score: humanMoves * 0, round: humanMoves, roundTotal: MAX_MOVES, total: 1 });
    const w = findWin(board, HUMAN);
    if (w) { highlightWin(w); finish("win"); return; }
    if (isFull(board)) { finish("draw"); return; }
    humanTurn = false;
    setStatus("KI denkt ...");
    later(() => {
      const c2 = chooseAiMove(board, level, rng);
      placeDisc(c2, AI);
      const w2 = findWin(board, AI);
      if (w2) { highlightWin(w2); finish("loss"); return; }
      if (isFull(board)) { finish("draw"); return; }
      humanTurn = true;
      busy = false;
      setStatus("Du bist dran!");
    }, 550);
  }

  function cleanup() {
    running = false;
    timers.forEach(clearTimeout);
    timers.clear();
    avatar.destroy();
    stage.remove();
  }

  return { destroy: () => { if (stage.isConnected || running) cleanup(); } };
}
