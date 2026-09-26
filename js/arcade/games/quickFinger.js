// js/arcade/games/quickFinger.js
// MINISPIEL 10 - SCHNELLSTER FINGER. Mehrere Buttons, nur einer ist richtig;
// nach jedem Treffer wechseln Position/Farbe. Falscher Klick killt nur die
// Combo, nicht die Runde (Punkt 10 des Prompts für dieses Spiel).
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const DURATION_MS = 26000;
const BUTTON_COUNT = 6;
const COLORS = ["#6be0ff", "#ffb020", "#4ee39a", "#c78bff", "#ff6b8a", "#ffd166"];

export function start({ container, skinId, rng, onHud, onEnd }) {
  const stage = document.createElement("div");
  stage.className = "qf-playfield";
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "qf-avatar-row";
  const grid = document.createElement("div");
  grid.className = "qf-grid";
  stage.appendChild(avatarWrap);
  stage.appendChild(grid);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 52 });

  let running = true, score = 0, combo = 0, maxCombo = 0, elapsed = 0, lastTs = null, raf = null;
  let roundDeadline = 0, roundTimeout = null;

  const buttons = Array.from({ length: BUTTON_COUNT }, () => {
    const btn = document.createElement("button");
    btn.className = "qf-btn";
    grid.appendChild(btn);
    return btn;
  });

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(roundTimeout);
    avatar.destroy();
    stage.innerHTML = "";
    if (!silent) {
      const percent = clamp(Math.round((score / 60) * 100), 0, 100);
      onEnd({ score, percent, maxCombo });
    }
  }

  function layoutRound() {
    const correctIdx = Math.floor(rng() * BUTTON_COUNT);
    buttons.forEach((btn, i) => {
      btn.style.background = COLORS[Math.floor(rng() * COLORS.length)];
      btn.textContent = i === correctIdx ? "★" : "";
      btn.classList.toggle("qf-btn--target", i === correctIdx);
      btn.onclick = () => onPick(i === correctIdx);
    });
    roundDeadline = clamp(1150 - combo * 25, 450, 1150);
    clearTimeout(roundTimeout);
    roundTimeout = setTimeout(() => onPick(false), roundDeadline);
  }

  function onPick(correct) {
    clearTimeout(roundTimeout);
    if (!running) return;
    if (correct) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      const mult = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
      score += mult;
      avatar.bump();
      audio.sfx("pop");
      if (combo === 5) popBanner(stage, "2x PUNKTE!", "gold");
      else if (combo === 10) popBanner(stage, "3x PUNKTE!", "gold");
      else if (combo % 6 === 0) popBanner(stage, `COMBO x${combo}!`, "combo");
    } else {
      combo = 0;
      audio.sfx("wrong");
    }
    layoutRound();
  }

  function tick(ts) {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    elapsed += ts - lastTs;
    lastTs = ts;
    if (elapsed >= DURATION_MS) { endGame(); return; }
    onHud({ timeLeft: Math.max(0, DURATION_MS - elapsed), total: DURATION_MS, score, combo });
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  layoutRound();
  return { destroy: () => endGame(true) };
}
