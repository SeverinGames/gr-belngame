// js/arcade/games/starCatcher.js
// MINISPIEL 6 - FANG DEN STERN. Sterne erscheinen einzeln an zufälligen
// Stellen und schrumpfen, bis sie verglühen. Der Skin steht am unteren Rand
// und feiert jeden Treffer.
import { mountSkinAvatar, popFloatingText, popBanner, ComboTracker, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const TOTAL_STARS = 24;

export function start({ container, skinId, rng, onHud, onEnd }) {
  const stage = document.createElement("div");
  stage.className = "sc-playfield";
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "sc-avatar-row";
  stage.appendChild(avatarWrap);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 52 });

  let running = true, spawned = 0, hits = 0, score = 0;
  const combo = new ComboTracker(1400);
  let currentStar = null, raf = null;

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (currentStar) currentStar.el.remove();
    avatar.destroy();
    stage.innerHTML = "";
    if (!silent) {
      const percent = clamp(Math.round((hits / TOTAL_STARS) * 100), 0, 100);
      onEnd({ score, percent, maxCombo: combo.maxCombo });
    }
  }

  function spawnStar() {
    if (!running) return;
    spawned++;
    if (spawned > TOTAL_STARS) { endGame(); return; }
    const isGold = rng() < 0.12;
    const el = document.createElement("div");
    el.className = `sc-star ${isGold ? "sc-star--gold" : ""}`;
    el.textContent = "⭐";
    const areaW = stage.clientWidth, areaH = stage.clientHeight - 70;
    const x = 24 + rng() * (areaW - 48);
    const y = 20 + rng() * Math.max(40, areaH - 40);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    stage.appendChild(el);
    const lifeMs = clamp(1300 - spawned * 22, 620, 1300);
    el.style.animationDuration = `${lifeMs}ms`;
    const star = { el, x, y, isGold, alive: true };
    currentStar = star;
    const timeout = setTimeout(() => { if (star.alive) missStar(star); }, lifeMs);
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (!star.alive) return;
      star.alive = false;
      clearTimeout(timeout);
      hitStar(star);
    });
  }

  function hitStar(star) {
    hits++;
    const n = combo.hit();
    let pts = star.isGold ? 5 : 1;
    if (n % 6 === 0) popBanner(stage, `COMBO x${n}!`, "combo");
    score += pts;
    avatar.bump();
    audio.sfx("pop");
    popFloatingText(stage, star.x, star.y, `+${pts}`, "good");
    star.el.remove();
    currentStar = null;
    onHud({ score, combo: combo.combo, timeLeft: TOTAL_STARS - spawned, total: TOTAL_STARS, round: spawned, roundTotal: TOTAL_STARS });
    setTimeout(spawnStar, 160);
  }

  function missStar(star) {
    star.alive = false;
    combo.miss();
    star.el.remove();
    currentStar = null;
    onHud({ score, combo: combo.combo, timeLeft: TOTAL_STARS - spawned, total: TOTAL_STARS, round: spawned, roundTotal: TOTAL_STARS });
    setTimeout(spawnStar, 160);
  }

  spawnStar();
  return { destroy: () => endGame(true) };
}
