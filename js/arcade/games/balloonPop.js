// js/arcade/games/balloonPop.js
// MINISPIEL 2 - BALLOON POP. Der Skin steht als Charakter am unteren
// Spielfeldrand und reagiert (bump) auf jeden erfolgreichen Pop.
import { mountSkinAvatar, popFloatingText, popBanner, ComboTracker, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const DURATION_MS = 32000;
const COLORS = ["#ff6b8a", "#6be0ff", "#ffd166", "#7bff9e", "#c78bff", "#ff9f6b"];

export function start({ container, skinId, rng, onHud, onEnd }) {
  const stage = document.createElement("div");
  stage.className = "bp-playfield";
  container.appendChild(stage);

  const avatar = mountSkinAvatar(stage, skinId, { size: 56 });
  avatar.el.classList.add("bp-avatar");

  let score = 0, running = true, elapsed = 0, lastTs = null, spawnTimer = 300, raf = null;
  let doublePoints = false;
  const combo = new ComboTracker(1300);
  const balloons = [];

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    stage.removeEventListener("pointerdown", onStagePointer);
    balloons.forEach((b) => clearTimeout(b.timeout));
    stage.innerHTML = "";
    avatar.destroy();
    if (!silent) {
      const percent = clamp(Math.round((score / 90) * 100), 0, 100);
      onEnd({ score, percent, maxCombo: combo.maxCombo });
    }
  }

  function onStagePointer() { combo.miss(); } // Klick auf leere Fläche = Combo weg

  function spawnBalloon() {
    const roll = rng();
    const kind = roll < 0.1 ? "gold" : roll < 0.3 ? "small" : "normal";
    const el = document.createElement("div");
    const size = kind === "small" ? 34 : kind === "gold" ? 52 : 46;
    el.className = `bp-balloon bp-balloon--${kind}`;
    el.style.width = `${size}px`;
    el.style.height = `${size * 1.2}px`;
    el.style.background = kind === "gold" ? "radial-gradient(circle at 35% 30%, #fff2b0, #ffb020)" : COLORS[Math.floor(rng() * COLORS.length)];
    const x = 8 + rng() * 82;
    el.style.left = `${x}%`;
    const lifeMs = 3600 + rng() * 1400;
    el.style.animationDuration = `${lifeMs}ms`;
    stage.appendChild(el);
    const b = { el, popped: false, timeout: null };
    b.timeout = setTimeout(() => { if (!b.popped) removeBalloon(b, true); }, lifeMs);
    el.addEventListener("pointerdown", (e) => { e.stopPropagation(); pop(b, kind, x); });
    balloons.push(b);
  }

  function removeBalloon(b, escaped) {
    b.el.classList.add(escaped ? "bp-balloon--escape" : "bp-balloon--pop");
    setTimeout(() => b.el.remove(), 220);
    const idx = balloons.indexOf(b);
    if (idx >= 0) balloons.splice(idx, 1);
  }

  function pop(b, kind, xPercent) {
    if (b.popped || !running) return;
    b.popped = true;
    clearTimeout(b.timeout);
    const n = combo.hit();
    let pts = kind === "gold" ? 5 : kind === "small" ? 3 : 1;
    if (doublePoints) pts *= 2;
    if (n === 5) { doublePoints = true; popBanner(stage, "2x PUNKTE!", "gold"); setTimeout(() => { doublePoints = false; }, 3500); }
    else if (n % 8 === 0) popBanner(stage, `COMBO x${n}!`, "combo");
    score += pts;
    avatar.bump();
    audio.sfx("pop");
    const px = (xPercent / 100) * stage.clientWidth;
    popFloatingText(stage, px, stage.clientHeight * 0.5, `+${pts}`, "good");
    removeBalloon(b, false);
  }

  stage.addEventListener("pointerdown", onStagePointer);

  function tick(ts) {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(48, ts - lastTs);
    lastTs = ts;
    elapsed += dt;

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnBalloon();
      spawnTimer = clamp(560 - elapsed * 0.01, 220, 560);
    }

    if (elapsed >= DURATION_MS) { endGame(); return; }
    onHud({ timeLeft: Math.max(0, DURATION_MS - elapsed), total: DURATION_MS, score, combo: combo.combo });
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return { destroy: () => endGame(true) };
}
