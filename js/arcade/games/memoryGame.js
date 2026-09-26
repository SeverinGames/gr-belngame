// js/arcade/games/memoryGame.js
// MINISPIEL 4 - MINI MEMORY. 4 Paare, im Spiel-Look statt als Standard-HTML-
// Tabelle. Der Skin sitzt oberhalb des Feldes und feiert gefundene Paare.
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const SYMBOLS = ["🍎", "⭐", "🎈", "🧠", "⚡", "🚦", "🍀", "💎"];
const PAIR_COUNT = 4;
const TIME_LIMIT_MS = 45000;

export function start({ container, skinId, rng, onHud, onEnd }) {
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

  const chosenSymbols = SYMBOLS.slice(0, PAIR_COUNT);
  const deck = shuffle([...chosenSymbols, ...chosenSymbols], rng);

  let firstCard = null, lock = false, matches = 0, mistakes = 0, running = true;
  let elapsed = 0, lastTs = null, raf = null;

  const cards = deck.map((symbol, i) => {
    const el = document.createElement("button");
    el.className = "mm-card";
    el.dataset.index = String(i);
    el.innerHTML = `<span class="mm-card__back">?</span><span class="mm-card__front">${symbol}</span>`;
    el.addEventListener("click", () => onFlip(card));
    grid.appendChild(el);
    const card = { el, symbol, matched: false };
    return card;
  });
  // dataset.index nur zur Klarheit - eigentliche Referenz läuft über das card-Objekt

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
      if (matches === PAIR_COUNT) { finishSuccess(); return; }
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
    const timeLeftFrac = clamp(1 - elapsed / TIME_LIMIT_MS, 0, 1);
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
    if (elapsed >= TIME_LIMIT_MS) { endGame(false); return; }
    onHud({ timeLeft: Math.max(0, TIME_LIMIT_MS - elapsed), total: TIME_LIMIT_MS, score: matches, combo: 0 });
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
