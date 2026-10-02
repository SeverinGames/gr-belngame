// js/arcade/games/colorTrick.js
// MINISPIEL - COLOR TRICK (neu). Oben steht ein Farbwort, z.B. "GRÜN", aber in
// einer ANDEREN Tinte geschrieben (z.B. rot). Gesucht ist die TATSÄCHLICHE
// FARBE DER SCHRIFT - nicht das, was das Wort sagt. Darunter gibt es nur
// echte Farbkleckse (ohne Beschriftung, alle optisch gleichwertig): man muss
// die Farbe wirklich erkennen und kann nichts "ablesen".
//
// Schwierigkeit:
//   LEICHT  3 klar verschiedene Farben, viel Zeit
//   MITTEL  4 Klekse, mehr Farben (auch Orange/Pink/Türkis), weniger Zeit
//   SCHWER  4 Klekse mit sehr ähnlichen Farbtönen (z.B. Rot/Orangerot/Pink), kurze Zeit
import { mountSkinAvatar, popBanner, ComboTracker, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const COLORS = [
  { id: "rot", label: "ROT", hex: "#ff3b4e", rgb: [255, 59, 78] },
  { id: "blau", label: "BLAU", hex: "#2f8cff", rgb: [47, 140, 255] },
  { id: "gruen", label: "GRÜN", hex: "#2fd16f", rgb: [47, 209, 111] },
  { id: "gelb", label: "GELB", hex: "#ffd21f", rgb: [255, 210, 31] },
  { id: "lila", label: "LILA", hex: "#a95bff", rgb: [169, 91, 255] },
  { id: "orange", label: "ORANGE", hex: "#ff8a1f", rgb: [255, 138, 31] },
  { id: "pink", label: "PINK", hex: "#ff5fc4", rgb: [255, 95, 196] },
  { id: "tuerkis", label: "TÜRKIS", hex: "#1fd6cc", rgb: [31, 214, 204] },
  // Zusatz-Töne nur für SCHWER (ähnlich zu den Grundfarben)
  { id: "rot2", label: "ROT", hex: "#ff6a3a", rgb: [255, 106, 58], hardOnly: true },
  { id: "rot3", label: "ROT", hex: "#e8386f", rgb: [232, 56, 111], hardOnly: true },
  { id: "gruen2", label: "GRÜN", hex: "#8fdc3a", rgb: [143, 220, 58], hardOnly: true },
  { id: "gruen3", label: "GRÜN", hex: "#22c79a", rgb: [34, 199, 154], hardOnly: true },
  { id: "blau2", label: "BLAU", hex: "#5a79ff", rgb: [90, 121, 255], hardOnly: true },
  { id: "blau3", label: "BLAU", hex: "#22b4ee", rgb: [34, 180, 238], hardOnly: true },
];
const LEVELS = {
  easy: { options: 3, pool: ["rot", "blau", "gruen", "gelb"], time0: 3200, step: 70, min: 1900, trapChance: 0.55 },
  normal: { options: 4, pool: ["rot", "blau", "gruen", "gelb", "lila", "orange", "pink", "tuerkis"], time0: 2800, step: 110, min: 1400, trapChance: 0.8 },
  hard: { options: 4, pool: null, time0: 2500, step: 110, min: 1100, trapChance: 0.9 },
};
const ROUNDS = 12;
const BLOB_SHAPES = [
  "58% 42% 55% 45% / 48% 58% 42% 52%", "46% 54% 40% 60% / 56% 44% 56% 44%",
  "52% 48% 62% 38% / 42% 52% 48% 58%", "60% 40% 48% 52% / 54% 46% 54% 46%",
];
const dist = (a, b) => Math.hypot(a.rgb[0] - b.rgb[0], a.rgb[1] - b.rgb[1], a.rgb[2] - b.rgb[2]);

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const L = LEVELS[difficulty] ?? LEVELS.normal;
  const pool = COLORS.filter((c) => (L.pool ? L.pool.includes(c.id) : true));

  const stage = document.createElement("div");
  stage.className = "ct-playfield";
  stage.innerHTML = `<div class="ct-avatar-row"></div><div class="ct-hint">Tippe die FARBE der Schrift!</div><div class="ct-word"></div><div class="ct-options"></div>`;
  container.appendChild(stage);
  const wordEl = stage.querySelector(".ct-word"), optionsEl = stage.querySelector(".ct-options");
  const avatar = mountSkinAvatar(stage.querySelector(".ct-avatar-row"), skinId, { size: 48 });

  let round = 0, score = 0, running = true, deadline = null, nextT = null, locked = true;
  const combo = new ComboTracker(2000);

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    clearTimeout(deadline); clearTimeout(nextT);
    avatar.destroy();
    stage.remove();
    if (!silent) onEnd({ score, percent: clamp(Math.round((score / (ROUNDS * 2)) * 100), 0, 100), maxCombo: combo.maxCombo });
  }

  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }

  function nextRound() {
    if (!running) return;
    round++;
    if (round > ROUNDS) { endGame(); return; }
    const time = clamp(L.time0 - round * L.step, L.min, L.time0);
    const ink = pick(pool);                       // gesuchte Farbe = Farbe der Schrift
    let word = pick(COLORS.filter((c) => !c.hardOnly));   // geschriebenes Wort
    let guard = 0;
    while (word.label === ink.label && rng() < 0.9 && guard++ < 8) word = pick(COLORS.filter((c) => !c.hardOnly));
    wordEl.textContent = word.label;
    wordEl.style.color = ink.hex;
    wordEl.style.textShadow = `0 0 18px ${ink.hex}66`;

    // Antwortklekse: gesuchte Farbe + (meist) die Farbe, die das WORT nennt (Falle) + Ablenker
    let opts = [ink];
    const trap = pool.find((c) => c.label === word.label && c.id !== ink.id) ?? pool.find((c) => c.id === word.id);
    if (trap && trap.id !== ink.id && rng() < L.trapChance) opts.push(trap);
    const others = pool.filter((c) => !opts.includes(c));
    if (difficulty === "hard") others.sort((a, b) => dist(a, ink) - dist(b, ink)); // sehr ähnliche Töne zuerst
    else for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    while (opts.length < L.options && others.length) opts.push(others.shift());
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }

    optionsEl.innerHTML = "";
    locked = false;
    opts.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "ct-blob";
      b.setAttribute("aria-label", "Farbklecks");
      b.dataset.color = c.id; // (nur für Tests; nicht sichtbar)
      b.style.setProperty("--c", c.hex);
      b.style.borderRadius = BLOB_SHAPES[(i + round) % BLOB_SHAPES.length];
      b.addEventListener("click", () => choose(c.id === ink.id, b));
      optionsEl.appendChild(b);
    });
    clearTimeout(deadline);
    deadline = setTimeout(() => choose(false, null), time);
    onHud({ timeLeft: time, total: time, score, combo: combo.combo, round, roundTotal: ROUNDS });
  }

  function choose(correct, btn) {
    if (!running || locked) return; // genau eine Antwort pro Runde
    locked = true;
    clearTimeout(deadline);
    if (btn) btn.classList.add(correct ? "ct-blob--right" : "ct-blob--wrong");
    if (correct) {
      const n = combo.hit(); score += 2; avatar.bump(); audio.sfx("pop");
      if (n > 0 && n % 4 === 0) popBanner(stage, `COMBO x${n}!`, "combo");
    } else { combo.miss(); audio.sfx("wrong"); score = Math.max(0, score - 1); }
    nextT = setTimeout(nextRound, 320);
  }

  nextRound();
  return { destroy: () => endGame(true) };
}
