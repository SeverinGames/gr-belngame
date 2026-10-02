// js/arcade/games/colorMatch.js
// MINISPIEL - FARBE NACHMACHEN (Puzzle / Genauigkeit, kein Reaktionsspiel).
// Oben die Zielfarbe, darunter deine Mischung mit Rot-/Grün-/Blau-Reglern.
// 3 Zielfarben; je näher du kommst, desto höher der Farbtreffer in %.
//   LEICHT  deutlich unterschiedliche Farben, grobe Regler, große Toleranz
//   MITTEL  gemischte Töne, feinere Regler, geringere Toleranz
//   SCHWER  gedämpfte, ähnliche Töne, feinste Regler, kleinste Toleranz
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";
import { matchPercent, randomTarget } from "./colorMath.js";

const ROUNDS = 3;
const LEVELS = { easy: { step: 5, time: 40000 }, normal: { step: 2, time: 45000 }, hard: { step: 1, time: 50000 } };
const CH = [{ k: "r", label: "ROT", c: "#ff5470" }, { k: "g", label: "GRÜN", c: "#4ee39a" }, { k: "b", label: "BLAU", c: "#4f9bff" }];

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const L = LEVELS[difficulty] ?? LEVELS.normal;
  const stage = document.createElement("div");
  stage.className = "cm-playfield";
  stage.innerHTML = `
    <div class="cm-top"><div class="cm-avatar"></div><div class="cm-info"><b class="cm-round"></b><span class="cm-time"></span></div></div>
    <div class="cm-swatches">
      <div class="cm-sw"><div class="cm-sw__color cm-target"></div><span>ZIEL</span></div>
      <div class="cm-sw"><div class="cm-sw__color cm-mine"></div><span>DEINE FARBE</span></div>
    </div>
    <div class="cm-sliders">${CH.map((c) => `<label class="cm-slider"><span style="color:${c.c}">${c.label}</span><input type="range" min="0" max="255" step="${L.step}" value="128" data-k="${c.k}" class="cm-range cm-range--${c.k}"><output>128</output></label>`).join("")}</div>
    <button class="btn btn--primary cm-done">FERTIG</button>
    <div class="cm-result hidden"></div>`;
  container.appendChild(stage);
  const $ = (s) => stage.querySelector(s);
  const avatar = mountSkinAvatar($(".cm-avatar"), skinId, { size: 40 });
  const inputs = [...stage.querySelectorAll(".cm-range")];

  let running = true, round = 0, target = [0, 0, 0], roundStart = 0, locked = true, tick = null, nextT = null;
  const results = [];
  const mine = () => inputs.map((i) => +i.value);

  function paint() {
    const m = mine();
    $(".cm-mine").style.background = `rgb(${m[0]},${m[1]},${m[2]})`;
    inputs.forEach((i, idx) => { i.nextElementSibling.textContent = m[idx]; i.style.setProperty("--p", `${(m[idx] / 255) * 100}%`); });
  }
  inputs.forEach((i) => i.addEventListener("input", paint));

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    clearInterval(tick); clearTimeout(nextT);
    avatar.destroy(); stage.remove();
    if (silent) return;
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    onEnd({ score: Math.round(avg * 10), percent: Math.round(avg), maxCombo: results.filter((r) => r >= 90).length, hideCombo: true, resultLabel: `Farbtreffer: Ø ${Math.round(avg)} %` });
  }

  function nextRound() {
    if (!running) return;
    round++;
    if (round > ROUNDS) { endGame(); return; }
    target = randomTarget(difficulty, rng);
    $(".cm-target").style.background = `rgb(${target.join(",")})`;
    inputs.forEach((i) => { i.value = 128; }); paint();
    $(".cm-result").classList.add("hidden"); $(".cm-done").disabled = false;
    $(".cm-round").textContent = `Farbe ${round} / ${ROUNDS}`;
    roundStart = performance.now(); locked = false;
    clearInterval(tick);
    tick = setInterval(() => {
      const left = Math.max(0, L.time - (performance.now() - roundStart));
      $(".cm-time").textContent = `⏱ ${Math.ceil(left / 1000)} s`;
      onHud({ timeLeft: left, total: L.time, score: results.length, round, roundTotal: ROUNDS });
      if (left <= 0) submit();
    }, 200);
  }

  function submit() {
    if (!running || locked) return; // nur EIN Abschluss pro Farbe
    locked = true; clearInterval(tick);
    $(".cm-done").disabled = true;
    const pct = matchPercent(target, mine(), difficulty);
    results.push(pct);
    const m = mine();
    const res = $(".cm-result");
    res.innerHTML = `<div class="cm-result__pct">${pct >= 98 ? "🎯 " : ""}Farbtreffer: ${pct} %</div><div class="cm-result__row"><i style="background:rgb(${target})"></i><i style="background:rgb(${m})"></i></div><small>Ziel · Deine Farbe</small>`;
    res.classList.remove("hidden");
    if (pct >= 90) { audio.sfx("pop"); avatar.bump(); popBanner(stage, pct >= 98 ? "FAST PERFEKT!" : "STARK!", "gold"); } else audio.sfx(pct >= 70 ? "treasure" : "wrong");
    nextT = setTimeout(nextRound, 1900);
  }
  $(".cm-done").addEventListener("click", submit);

  nextRound();
  return { destroy: () => endGame(true) };
}
