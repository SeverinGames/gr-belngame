// js/arcade/games/memoryGame.js
// MINISPIEL 4 - MINI MEMORY. Im Spiel-Look statt als Standard-HTML-Tabelle.
// Der Skin sitzt oberhalb des Feldes und feiert gefundene Paare.
// Erweiterung: größerer Symbol-Pool + mehr Paare bei höherer Schwierigkeit,
// damit auch nach vielen Runden noch Abwechslung da ist (Mechanik bleibt
// unverändert - nur Kartenanzahl/Auswahl variieren).
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const SYMBOLS = ["🍎", "⭐", "🎈", "🧠", "⚡", "🚦", "🍀", "💎", "🎯", "🎲", "🔥", "🌙", "🍉", "🎸"];
// leicht -> weniger Paare (schneller/entspannter), schwer -> mehr Paare + mehr Zeit
const PAIR_COUNT_BY_DIFFICULTY = { easy: 4, normal: 5, hard: 6 };

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const pairCount = PAIR_COUNT_BY_DIFFICULTY[difficulty] ?? 5;
  const timeLimitMs = 38000 + pairCount * 4500;

  const stage = document.createElement("div");
  stage.className = "mm-playfield";
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "mm-avatar-row";
  const grid = document.createElement("div");
  grid.className = "mm-grid";
  stage.appendChild(avatarWrap);
  stage.appendChild(grid);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 52 });

  // Symbole zufällig aus dem größeren Pool ziehen statt immer dieselben ersten N
  const chosenSymbols = shuffle(SYMBOLS, rng).slice(0, pairCount);
  const deck = shuffle([...chosenSymbols, ...chosenSymbols], rng);

  let firstCard = null, lock = false, matches = 0, mistakes = 0, running = true;
  let elapsed = 0, lastTs = null, raf = null;

  const cards = deck.map((symbol) => {
    const el = document.createElement("button");
    el.className = "mm-card";
    el.innerHTML = `<span class="mm-card__back">?</span><span class="mm-card__front">${symbol}</span>`;
    const card = { el, symbol, matched: false };
    el.addEventListener("click", () => onFlip(card));
    grid.appendChild(el);
    return card;
  });
  grid.classList.toggle("mm-grid--wide", pairCount >= 6);

  function onFlip(card) {
    if (lock || card.matched || card === firstCard || !running) return;
    card.el.classList.add("mm-card--flipped");
    audio.sfx("cardFlip");
    if (!firstCard) { firstCard = card; return; }
    lock = true;
    if (firstCard.symbol === card.symbol) {
      firstCard.matched = true; card.matched = true;
      firstCard.el.classList.add("mm-card--matched");
      card.el.classList.add("mm-card--matched");
      matches++;
      avatar.bump();
      audio.sfx("pop");
      if (matches === pairCount) { finishSuccess(); return; }
      firstCard = null; lock = false;
    } else {
      mistakes++;
      audio.sfx("wrong");
      setTimeout(() => {
        firstCard.el.classList.remove("mm-card--flipped");
        card.el.classList.remove("mm-card--flipped");
        firstCard = null; lock = false;
      }, 650);
    }
  }

  function finishSuccess() {
    const perfect = mistakes === 0;
    if (perfect) popBanner(stage, "PERFEKTE RUNDE!", "gold");
    endGame(true, perfect);
  }

  function endGame(won, perfect = false, silent = false) {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    setTimeout(() => {
      avatar.destroy();
      stage.innerHTML = "";
    }, won && !silent ? 500 : 0);
    if (silent) return;
    const timeLeftFrac = clamp(1 - elapsed / timeLimitMs, 0, 1);
    let score = won ? Math.round(40 + timeLeftFrac * 60 - mistakes * 4) : Math.round(matches * 10 - mistakes * 3);
    score = Math.max(0, score);
    if (perfect) score += 20;
    const percent = clamp(score, 0, 100);
    onEnd({ score, percent, maxCombo: matches });
  }

  function tick(ts) {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    elapsed += ts - lastTs;
    lastTs = ts;
    if (elapsed >= timeLimitMs) { endGame(false); return; }
    onHud({ timeLeft: Math.max(0, timeLimitMs - elapsed), total: timeLimitMs, score: matches, combo: 0 });
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return { destroy: () => endGame(false, false, true) };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
