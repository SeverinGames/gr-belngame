// js/arcade/games/treasurePaths.js
// NEUES MINISPIEL - SCHATZPFADE (Entscheidung). Mehrere Kisten werden kurz
// aufgedeckt (manche Schatz, manche Falle), dann wieder verschlossen. Der
// Spieler muss sich merken, welche Kiste der Schatz war, und sie innerhalb
// des Zeitlimits anklicken. Mehr Kisten, kürzere Merkzeit und mehr Fallen
// mit steigender Runde - echtes Game Over nach 3 Fehlversuchen.
import { mountSkinAvatar, popBanner, ComboTracker, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const MAX_ROUNDS = 12;
const DIFFICULTY = {
  easy: { lives: 4, peekMul: 1.35 },
  normal: { lives: 3, peekMul: 1 },
  hard: { lives: 2, peekMul: 0.75 },
};

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const diff = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;

  const stage = document.createElement("div");
  stage.className = "tp-playfield";
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "tp-avatar-row";
  const livesEl = document.createElement("div");
  livesEl.className = "tp-lives";
  const hintEl = document.createElement("div");
  hintEl.className = "tp-hint";
  const chestRow = document.createElement("div");
  chestRow.className = "tp-chests";
  stage.appendChild(avatarWrap);
  stage.appendChild(livesEl);
  stage.appendChild(hintEl);
  stage.appendChild(chestRow);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 52 });

  let round = 0, score = 0, lives = diff.lives, running = true;
  const combo = new ComboTracker(2500);
  let deadlineTimeout = null, peekTimeout = null;

  function renderLives() {
    livesEl.textContent = "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, diff.lives - lives));
  }
  renderLives();

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    clearTimeout(deadlineTimeout);
    clearTimeout(peekTimeout);
    avatar.destroy();
    stage.innerHTML = "";
    if (silent) return;
    const percent = clamp(Math.round((score / (MAX_ROUNDS * 12)) * 100), 0, 100);
    onEnd({ score, percent, maxCombo: combo.maxCombo });
  }

  function nextRound() {
    if (!running) return;
    round++;
    if (round > MAX_ROUNDS || lives <= 0) { endGame(); return; }

    const chestCount = clamp(3 + Math.floor((round - 1) / 3), 3, 5);
    const trapCount = clamp(1 + Math.floor((round - 1) / 4), 1, chestCount - 1);
    const peekMs = clamp((1500 - round * 70) * diff.peekMul, 550, 1800);
    const decideMs = clamp(3200 - round * 90, 1700, 3200);

    const kinds = Array.from({ length: chestCount }, (_, i) => (i < trapCount ? "trap" : "treasure"));
    // Position der Fallen/Schätze mischen
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    // Unter mehreren Schätzen ist einer davon golden (mehr Punkte) - macht
    // Merken bei höheren Runden noch relevanter statt nur "irgendein Schatz".
    const treasureIndexes = kinds.map((k, i) => (k === "treasure" ? i : -1)).filter((i) => i >= 0);
    const goldenIndex = treasureIndexes[Math.floor(rng() * treasureIndexes.length)];

    hintEl.textContent = "MERKEN!";
    chestRow.innerHTML = "";
    const chestEls = kinds.map((kind, i) => {
      const btn = document.createElement("button");
      btn.className = "tp-chest tp-chest--peek";
      btn.textContent = kind === "trap" ? "💀" : (i === goldenIndex ? "👑" : "💰");
      chestRow.appendChild(btn);
      return btn;
    });

    peekTimeout = setTimeout(() => {
      chestEls.forEach((btn, i) => {
        btn.classList.remove("tp-chest--peek");
        btn.textContent = "❓";
        btn.addEventListener("click", () => choose(kinds[i] === "treasure", i === goldenIndex, btn));
      });
      hintEl.textContent = "WELCHE WAR DER SCHATZ?";
      clearTimeout(deadlineTimeout);
      deadlineTimeout = setTimeout(() => choose(false, false, null), decideMs);
      onHud({ round, roundTotal: MAX_ROUNDS, score, combo: combo.combo, timeLeft: decideMs, total: decideMs });
    }, peekMs);

    onHud({ round, roundTotal: MAX_ROUNDS, score, combo: combo.combo, timeLeft: peekMs, total: peekMs });
  }

  function choose(correct, golden, btn) {
    clearTimeout(deadlineTimeout);
    chestRow.querySelectorAll("button").forEach((b) => { b.disabled = true; b.onclick = null; });
    if (btn) btn.classList.add(correct ? "tp-chest--right" : "tp-chest--wrong");

    if (correct) {
      const n = combo.hit();
      const pts = golden ? 8 : 4;
      score += pts;
      avatar.bump();
      audio.sfx("pop");
      if (n > 0 && n % 3 === 0) popBanner(stage, `COMBO x${n}!`, "combo");
      if (golden) popBanner(stage, "GOLDENER SCHATZ!", "gold");
    } else {
      combo.miss();
      lives--;
      renderLives();
      audio.sfx("wrong");
      popBanner(stage, lives <= 0 ? "GAME OVER" : "FALSCH!", "warn");
    }
    setTimeout(nextRound, 550);
  }

  nextRound();
  return { destroy: () => endGame(true) };
}
