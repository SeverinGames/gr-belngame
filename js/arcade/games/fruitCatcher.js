// js/arcade/games/fruitCatcher.js
// MINISPIEL 1 - OBSTKORB. Der ausgewählte Skin ist der Fänger selbst (nicht
// nur ein Icon irgendwo), gesteuert per Ziehen/Touch oder Pfeiltasten.
import { mountSkinAvatar, popFloatingText, popBanner, rollModifier, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const DURATION_MS = 30000;
const GOOD = ["🍎", "🍌", "🍇", "🍒", "🍉"];
const BAD = "🥴";   // faules Obst
const TRASH = "🥫"; // harmloser Müll statt Bombe/Gefahr (Punkt 1 des Prompts)
const GOLD = "🍊";  // goldenes Obst

export function start({ container, skinId, rng, onHud, onEnd }) {
  const stage = document.createElement("div");
  stage.className = "fc-playfield";
  container.appendChild(stage);

  const basket = mountSkinAvatar(stage, skinId, { size: 64 });
  basket.el.classList.add("fc-basket");

  let basketX = 50, score = 0, combo = 0, maxCombo = 0;
  let fastMode = false, doublePoints = false;
  let running = true;
  const fruits = [];
  let spawnTimer = 500, modTimer = 4500, elapsed = 0, lastTs = null;
  let raf = null;

  function place() { basket.el.style.left = `calc(${basketX}% - 32px)`; }
  place();

  function onPointer(clientX) {
    const rect = stage.getBoundingClientRect();
    basketX = clamp(((clientX - rect.left) / rect.width) * 100, 6, 94);
    place();
  }
  const onMove = (e) => onPointer(e.touches ? e.touches[0].clientX : e.clientX);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("touchmove", onMove, { passive: true });

  const keys = {};
  const onKeyDown = (e) => { keys[e.key] = true; };
  const onKeyUp = (e) => { keys[e.key] = false; };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function spawnFruit() {
    const roll = rng();
    const type = roll < 0.08 ? "gold" : roll < 0.18 ? "bad" : roll < 0.26 ? "trash" : "good";
    const el = document.createElement("div");
    el.className = `fc-fruit fc-fruit--${type}`;
    el.textContent = type === "good" ? GOOD[Math.floor(rng() * GOOD.length)]
      : type === "gold" ? GOLD : type === "bad" ? BAD : TRASH;
    stage.appendChild(el);
    fruits.push({ el, x: 6 + rng() * 88, y: -10, speed: (58 + rng() * 26) * (fastMode ? 1.55 : 1), type });
  }

  function catchFruit(f) {
    let pts = 0;
    if (f.type === "good") { pts = 1; combo++; }
    else if (f.type === "gold") { pts = 5; combo++; popBanner(stage, "GOLDENES OBST! +5", "gold"); }
    else if (f.type === "bad") { pts = -3; combo = 0; audio.sfx("wrong"); }
    else { pts = -1; combo = 0; }
    maxCombo = Math.max(maxCombo, combo);
    if (doublePoints) pts *= 2;
    if (combo > 0 && combo % 5 === 0) popBanner(stage, `COMBO x${combo}!`, "combo");
    score = Math.max(0, score + pts);
    basket.bump();
    audio.sfx(pts >= 0 ? "pop" : "wrong");
    const px = (basketX / 100) * stage.clientWidth;
    popFloatingText(stage, px, stage.clientHeight - 90, pts >= 0 ? `+${pts}` : `${pts}`, pts >= 0 ? "good" : "bad");
  }

  function cleanupListeners() {
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("touchmove", onMove);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  }

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    cleanupListeners();
    fruits.forEach((f) => f.el.remove());
    basket.destroy();
    if (!silent) {
      const percent = clamp(Math.round((score / 140) * 100), 0, 100);
      onEnd({ score, percent, maxCombo });
    }
  }

  function tick(ts) {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(48, ts - lastTs);
    lastTs = ts;
    elapsed += dt;

    if (keys.ArrowLeft) { basketX = clamp(basketX - dt * 0.06, 6, 94); place(); }
    if (keys.ArrowRight) { basketX = clamp(basketX + dt * 0.06, 6, 94); place(); }

    modTimer -= dt;
    if (modTimer <= 0) {
      modTimer = 5000 + rng() * 3000;
      const mod = rollModifier(rng, 0.4);
      if (mod?.id === "double") { doublePoints = true; popBanner(stage, `${mod.icon} ${mod.label}`, "gold"); setTimeout(() => { doublePoints = false; }, 4000); }
      else if (mod?.id === "turbo") { fastMode = true; popBanner(stage, `${mod.icon} ${mod.label}`, "warn"); setTimeout(() => { fastMode = false; }, 3000); }
      else if (mod?.id === "time") { elapsed = Math.max(0, elapsed - 4000); popBanner(stage, `${mod.icon} ${mod.label}`, "combo"); }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnFruit();
      spawnTimer = clamp(640 - elapsed * 0.012, 250, 640);
    }

    const basketTopPx = stage.clientHeight - 46;
    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      f.y += f.speed * (dt / 1000);
      f.el.style.left = `${f.x}%`;
      f.el.style.top = `${f.y}px`;
      if (f.y >= basketTopPx) {
        if (Math.abs(f.x - basketX) < 11) catchFruit(f);
        else if (f.type === "good" || f.type === "gold") combo = 0;
        f.el.remove();
        fruits.splice(i, 1);
      }
    }

    if (elapsed >= DURATION_MS) { endGame(); return; }
    onHud({ timeLeft: Math.max(0, DURATION_MS - elapsed), total: DURATION_MS, score, combo });
    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);
  return { destroy: () => endGame(true) };
}
