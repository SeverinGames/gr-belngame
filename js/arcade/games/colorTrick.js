// js/arcade/games/colorTrick.js
// MINISPIEL 3 - FARBKLICK / COLOR TRICK. Ein Wort wird gezeigt, oft in einer
// abweichenden Farbe eingefärbt. Der Spieler muss die BEDEUTUNG des Wortes
// antippen, nicht die Farbe, in der es dargestellt ist.
import { mountSkinAvatar, popBanner, ComboTracker, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const WORDS = [
  { id: "rot", label: "ROT", hex: "#ff5470" },
  { id: "blau", label: "BLAU", hex: "#6be0ff" },
  { id: "gruen", label: "GRÜN", hex: "#4ee39a" },
  { id: "gelb", label: "GELB", hex: "#ffd166" },
  { id: "lila", label: "LILA", hex: "#c78bff" },
];
const ROUNDS = 12;

export function start({ container, skinId, rng, onHud, onEnd }) {
  const stage = document.createElement("div");
  stage.className = "ct-playfield";
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "ct-avatar-row";
  const wordEl = document.createElement("div");
  wordEl.className = "ct-word";
  const optionsEl = document.createElement("div");
  optionsEl.className = "ct-options";
  stage.appendChild(avatarWrap);
  stage.appendChild(wordEl);
  stage.appendChild(optionsEl);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 52 });

  let round = 0, score = 0, running = true, roundTimeout = null, deadlineTimeout = null;
  const combo = new ComboTracker(2000);
  let optionCount = 3;
  let timeBudget = 2600;

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    clearTimeout(roundTimeout);
    clearTimeout(deadlineTimeout);
    avatar.destroy();
    stage.innerHTML = "";
    if (!silent) {
      const percent = clamp(Math.round((score / (ROUNDS * 2)) * 100), 0, 100);
      onEnd({ score, percent, maxCombo: combo.maxCombo });
    }
  }

  function nextRound() {
    if (!running) return;
    round++;
    if (round > ROUNDS) { endGame(); return; }
    optionCount = round > 8 ? 4 : 3;
    timeBudget = clamp(2600 - round * 110, 1200, 2600);

    const target = WORDS[Math.floor(rng() * WORDS.length)];
    let displayColor = WORDS[Math.floor(rng() * WORDS.length)];
    // Meist eine ANDERE Farbe als das Wort selbst - das ist der Twist.
    if (rng() < 0.8) {
      let tries = 0;
      while (displayColor.id === target.id && tries < 5) { displayColor = WORDS[Math.floor(rng() * WORDS.length)]; tries++; }
    }
    wordEl.textContent = target.label;
    wordEl.style.color = displayColor.hex;
    wordEl.style.textShadow = `0 0 18px ${displayColor.hex}88`;

    const pool = [target];
    while (pool.length < optionCount) {
      const cand = WORDS[Math.floor(rng() * WORDS.length)];
      if (!pool.some((w) => w.id === cand.id)) pool.push(cand);
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    optionsEl.innerHTML = "";
    pool.forEach((w) => {
      const btn = document.createElement("button");
      btn.className = "ct-option";
      btn.textContent = w.label;
      btn.style.borderColor = w.hex;
      btn.addEventListener("click", () => choose(w.id === target.id, btn));
      optionsEl.appendChild(btn);
    });

    const startTs = performance.now();
    clearTimeout(deadlineTimeout);
    deadlineTimeout = setTimeout(() => choose(false, null), timeBudget);
    onHud({ timeLeft: timeBudget, total: timeBudget, score, combo: combo.combo, round, roundTotal: ROUNDS, restart: startTs });
  }

  function choose(correct, btn) {
    clearTimeout(deadlineTimeout);
    if (btn) btn.classList.add(correct ? "ct-option--right" : "ct-option--wrong");
    if (correct) {
      const n = combo.hit();
      score += 2;
      avatar.bump();
      audio.sfx("pop");
      if (n > 0 && n % 4 === 0) popBanner(stage, `COMBO x${n}!`, "combo");
    } else {
      combo.miss();
      audio.sfx("wrong");
      score = Math.max(0, score - 1);
    }
    setTimeout(nextRound, 260);
  }

  nextRound();
  return { destroy: () => endGame(true) };
}
