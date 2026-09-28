// js/arcade/games/meteorDash.js
// NEUES MINISPIEL - METEOR DASH (Geschicklichkeit/Steuerung).
// Der Skin fliegt/läuft am unteren Spielfeldrand und muss Meteoriten
// ausweichen (Leben-System, klares Game Over) und dabei Sterne einsammeln.
// Fühlt sich bewusst wie ein kleines echtes Arcade-Spiel an, nicht nur wie
// "klicke schnell" - Steuerung per Ziehen/Touch oder Pfeiltasten, wie bei
// Obstkorb, aber mit Ausweichen statt Fangen und einem echten Game-Over.
import { mountSkinAvatar, popFloatingText, popBanner, rollModifier, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const MAX_DURATION_MS = 50000;
const STAR = "⭐";
const GOLD_STAR = "🌟";
const METEOR = "☄️";

const DIFFICULTY = {
  easy: { lives: 4, speedMul: 0.85 },
  normal: { lives: 3, speedMul: 1 },
  hard: { lives: 2, speedMul: 1.25 },
};

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const diff = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;

  const stage = document.createElement("div");
  stage.className = "md-playfield";
  const livesEl = document.createElement("div");
  livesEl.className = "md-lives";
  stage.appendChild(livesEl);
  container.appendChild(stage);

  const ship = mountSkinAvatar(stage, skinId, { size: 60 });
  ship.el.classList.add("md-ship");

  let shipX = 50, score = 0, combo = 0, maxCombo = 0, lives = diff.lives;
  let fastMode = false, doublePoints = false, invulnerableUntil = 0;
  let running = true;
  const objects = [];
  let spawnTimer = 500, modTimer = 5000, elapsed = 0, lastTs = null, raf = null;

  function renderLives() {
    livesEl.textContent = "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, diff.lives - lives));
  }
  renderLives();

  function place() { ship.el.style.left = `calc(${shipX}% - 30px)`; }
  place();

  function onPointer(clientX) {
    const rect = stage.getBoundingClientRect();
    shipX = clamp(((clientX - rect.left) / rect.width) * 100, 6, 94);
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

  function cleanupListeners() {
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("touchmove", onMove);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  }

  function spawnObject() {
    const roll = rng();
    const type = roll < 0.55 ? "meteor" : roll < 0.9 ? "star" : "goldstar";
    const el = document.createElement("div");
    el.className = `md-object md-object--${type}`;
    el.textContent = type === "meteor" ? METEOR : type === "goldstar" ? GOLD_STAR : STAR;
    stage.appendChild(el);
    objects.push({
      el, type, x: 6 + rng() * 88, y: -10,
      speed: (58 + rng() * 30) * diff.speedMul * (fastMode ? 1.5 : 1),
    });
  }

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    cleanupListeners();
    objects.forEach((o) => o.el.remove());
    ship.destroy();
    if (silent) return;
    const survivalBonus = clamp(Math.round((elapsed / MAX_DURATION_MS) * 40), 0, 40);
    const percent = clamp(Math.round((score / 90) * 100) + survivalBonus, 0, 100);
    onEnd({ score, percent, maxCombo });
  }

  function loseLife() {
    if (performance.now() < invulnerableUntil) return;
    lives--;
    combo = 0;
    renderLives();
    ship.bump();
    audio.sfx("wrong");
    invulnerableUntil = performance.now() + 700;
    if (lives <= 0) {
      popBanner(stage, "GAME OVER", "warn");
      setTimeout(() => endGame(), 500);
    } else {
      popBanner(stage, "GETROFFEN!", "warn");
    }
  }

  function collect(o) {
    let pts = o.type === "goldstar" ? 5 : 1;
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    if (doublePoints) pts *= 2;
    if (combo > 0 && combo % 6 === 0) popBanner(stage, `COMBO x${combo}!`, "combo");
    score += pts;
    ship.bump();
    audio.sfx("pop");
    const px = (o.x / 100) * stage.clientWidth;
    popFloatingText(stage, px, stage.clientHeight - 90, `+${pts}`, "good");
  }

  function tick(ts) {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(48, ts - lastTs);
    lastTs = ts;
    elapsed += dt;

    if (keys.ArrowLeft) { shipX = clamp(shipX - dt * 0.07, 6, 94); place(); }
    if (keys.ArrowRight) { shipX = clamp(shipX + dt * 0.07, 6, 94); place(); }

    modTimer -= dt;
    if (modTimer <= 0) {
      modTimer = 6000 + rng() * 3000;
      const mod = rollModifier(rng, 0.35);
      if (mod?.id === "double") { doublePoints = true; popBanner(stage, `${mod.icon} ${mod.label}`, "gold"); setTimeout(() => { doublePoints = false; }, 4000); }
      else if (mod?.id === "turbo") { fastMode = true; popBanner(stage, `${mod.icon} ${mod.label}`, "warn"); setTimeout(() => { fastMode = false; }, 3000); }
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObject();
      spawnTimer = clamp(560 - elapsed * 0.012, 220, 560);
    }

    const shipTopPx = stage.clientHeight - 44;
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      o.y += o.speed * (dt / 1000);
      o.el.style.left = `${o.x}%`;
      o.el.style.top = `${o.y}px`;
      if (o.y >= shipTopPx) {
        if (Math.abs(o.x - shipX) < 11) {
          if (o.type === "meteor") loseLife();
          else collect(o);
        }
        o.el.remove();
        objects.splice(i, 1);
      }
    }

    if (elapsed >= MAX_DURATION_MS) { popBanner(stage, "GESCHAFFT!", "gold"); setTimeout(() => endGame(), 400); return; }
    onHud({ timeLeft: Math.max(0, MAX_DURATION_MS - elapsed), total: MAX_DURATION_MS, score, combo });
    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);
  return { destroy: () => endGame(true) };
}
