// js/arcade/games/colorTubes.js
// NEUES MINISPIEL - FARBRÖHREN (Sortier-/Logikpuzzle). Kein Zeitdruck, kein
// Reagieren: Man tippt eine Röhre an (oberste Farbe wird "in die Hand"
// genommen) und dann eine Zielröhre. Gegossen wird nur auf gleiche Farbe
// oder in eine leere Röhre, und nur wenn Platz ist (4 pro Röhre). Ziel: jede
// Röhre enthält nur noch eine Farbe. Der Skin steht als Figur über dem
// Feld und feiert fertige Röhren. Zug-Limit auf normal/schwer = klares Game
// Over, "Zug zurück" ist unbegrenzt erlaubt (zählt aber als Zug).
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const CAPACITY = 4;
const COLORS = ["#ff5470", "#4fa3ff", "#4ee39a", "#ffd166", "#b06bff"];
const LEVEL = {
  easy: { colors: 3, limitFactor: Infinity },
  normal: { colors: 4, limitFactor: 4 },
  hard: { colors: 5, limitFactor: 3 },
};

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const lvl = LEVEL[difficulty] ?? LEVEL.normal;
  const n = lvl.colors;
  const par = n * 4; // grobe "gute" Zugzahl
  const moveLimit = lvl.limitFactor === Infinity ? Infinity : Math.round(par * lvl.limitFactor);

  const stage = document.createElement("div");
  stage.className = "ft-playfield";
  const top = document.createElement("div");
  top.className = "ft-top";
  const avatarWrap = document.createElement("div");
  const info = document.createElement("div");
  info.className = "ft-info";
  top.appendChild(avatarWrap);
  top.appendChild(info);
  const tubesEl = document.createElement("div");
  tubesEl.className = "ft-tubes";
  const actions = document.createElement("div");
  actions.className = "ft-actions";
  const undoBtn = document.createElement("button");
  undoBtn.className = "btn btn--secondary ft-btn";
  undoBtn.textContent = "↩ Zug zurück";
  actions.appendChild(undoBtn);
  stage.append(top, tubesEl, actions);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 52 });

  // Zustand: tubes[i] = Array von Farbindizes (unten -> oben)
  const tubes = generate(n, rng);
  const history = [];
  let selected = null, moves = 0, running = true, doneTubes = 0;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (running) fn(); }, ms); timers.add(t); };

  function generate(colorCount, r) {
    // Alle Segmente mischen und auf colorCount Röhren verteilen, dazu 2 leere.
    let arr;
    do {
      arr = [];
      for (let c = 0; c < colorCount; c++) for (let k = 0; k < CAPACITY; k++) arr.push(c);
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    } while (chunk(arr, colorCount).some((t) => t.every((v) => v === t[0]))); // nie schon fertig starten
    const t = chunk(arr, colorCount);
    t.push([], []);
    return t;
  }
  function chunk(arr, count) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(arr.slice(i * CAPACITY, (i + 1) * CAPACITY));
    return out;
  }
  const isDone = (t) => t.length === CAPACITY && t.every((v) => v === t[0]);

  function render() {
    tubesEl.innerHTML = "";
    tubes.forEach((t, i) => {
      const el = document.createElement("button");
      el.className = "ft-tube" + (selected === i ? " ft-tube--selected" : "") + (isDone(t) ? " ft-tube--done" : "");
      el.setAttribute("aria-label", `Röhre ${i + 1}`);
      // von oben nach unten rendern (column-reverse im CSS) -> Segmente in Array-Reihenfolge
      t.forEach((v) => {
        const seg = document.createElement("div");
        seg.className = "ft-seg";
        seg.style.background = COLORS[v];
        seg.dataset.c = String(v);
        el.appendChild(seg);
      });
      el.addEventListener("click", () => tap(i));
      tubesEl.appendChild(el);
    });
    doneTubes = tubes.filter(isDone).length;
    info.textContent = `Züge: ${moves}${moveLimit === Infinity ? "" : ` / ${moveLimit}`} · Fertig: ${doneTubes}/${n}`;
    undoBtn.disabled = history.length === 0 || !running;
    onHud({ score: doneTubes * 10, round: doneTubes, roundTotal: n, total: 1 });
  }

  function canPour(from, to) {
    if (from === to) return false;
    const a = tubes[from], b = tubes[to];
    if (!a.length || b.length >= CAPACITY) return false;
    if (isDone(a)) return false; // fertige Röhren bleiben ruhig
    return b.length === 0 || b[b.length - 1] === a[a.length - 1];
  }

  function pour(from, to) {
    // gießt alle gleichfarbigen obersten Segmente, soweit Platz ist
    const a = tubes[from], b = tubes[to];
    const color = a[a.length - 1];
    let count = 0;
    while (a.length && a[a.length - 1] === color && b.length < CAPACITY) { b.push(a.pop()); count++; }
    return count;
  }

  function tap(i) {
    if (!running) return;
    if (selected === null) {
      if (!tubes[i].length || isDone(tubes[i])) return;
      selected = i;
      audio.sfx("cardFlip");
      render();
      return;
    }
    if (selected === i) { selected = null; render(); return; }
    if (!canPour(selected, i)) {
      audio.sfx("wrong");
      // ungültig: Auswahl auf die neu getippte Röhre wechseln, wenn sie was enthält
      selected = tubes[i].length && !isDone(tubes[i]) ? i : null;
      render();
      return;
    }
    const before = doneTubes;
    const snapshot = tubes.map((t) => t.slice());
    const count = pour(selected, i);
    history.push(snapshot);
    moves++;
    selected = null;
    audio.sfx("pop");
    render();
    const after = tubes.filter(isDone).length;
    if (after > before) { avatar.bump(); popBanner(stage, "RÖHRE FERTIG!", "combo"); audio.sfx("combo"); }
    if (count >= 2) avatar.bump();
    if (after === n) { win(); return; }
    if (moves >= moveLimit) lose();
  }

  undoBtn.addEventListener("click", () => {
    if (!running || !history.length) return;
    const prev = history.pop();
    for (let i = 0; i < tubes.length; i++) tubes[i] = prev[i];
    moves++; // zurücknehmen kostet einen Zug - sonst gäbe es kein Limit-Risiko
    selected = null;
    audio.sfx("cardFlip");
    render();
    if (moves >= moveLimit) lose();
  });

  function win() {
    running = false;
    popBanner(stage, "GELÖST!", "gold");
    avatar.bump();
    const efficiency = clamp(1 - (moves - par) / (par * 1.5), 0, 1);
    const score = n * 20 + Math.round(efficiency * 60);
    const percent = Math.round(55 + efficiency * 45);
    finishLater({ score, percent, won: true, maxCombo: n, resultLabel: `GELÖST in ${moves} Zügen · ${score} PUNKTE` });
  }
  function lose() {
    running = false;
    popBanner(stage, "ZUG-LIMIT!", "warn");
    audio.sfx("wrong");
    const score = doneTubes * 15;
    finishLater({ score, percent: clamp(Math.round((doneTubes / n) * 45), 0, 45), maxCombo: doneTubes, resultLabel: `ZUG-LIMIT · ${score} PUNKTE` });
  }
  function finishLater(result) {
    undoBtn.disabled = true;
    const t = setTimeout(() => { cleanup(); onEnd(result); }, 1300);
    timers.add(t);
  }

  function cleanup() {
    running = false;
    timers.forEach(clearTimeout);
    timers.clear();
    avatar.destroy();
    stage.remove();
  }

  render();
  return { destroy: () => { if (stage.isConnected || running) cleanup(); } };
}
