// js/arcade/games/memoryGame.js
// MINISPIEL 4 - MINI MEMORY. Im Spiel-Look statt als Standard-HTML-Tabelle.
// Der Skin sitzt oberhalb des Feldes und feiert gefundene Paare.
//
// Schwierigkeit (echte Spiel-Unterschiede, nicht nur Belohnung):
//   LEICHT  12 Karten (4x3), entspannte Zeit, Fehlversuche decken lange auf
//   MITTEL  16 Karten (4x4), knappere Zeit
//   SCHWER  20 Karten (5x4), knappe Zeit, ähnlich aussehende Symbole,
//           Karten drehen sich schneller wieder um
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const SYMBOLS = ["🍎", "⭐", "🎈", "🧠", "⚡", "🚦", "🍀", "💎", "🎯", "🎲", "🔥", "🌙", "🍉", "🎸"];
// Ähnlich aussehende Symbole - machen SCHWER anspruchsvoller als nur "mehr Karten"
const LOOKALIKES = ["🍎", "🍅", "🍓", "🍒", "🌶️", "🍑", "🍊", "🥕", "🍋", "🍌"];
const LEVELS = {
  easy: { pairs: 6, cols: 4, time: 70000, flipBack: 800, lookalike: 0 },
  normal: { pairs: 8, cols: 4, time: 72000, flipBack: 650, lookalike: 0 },
  hard: { pairs: 10, cols: 5, time: 78000, flipBack: 480, lookalike: 6 },
};
export const MEMORY_CARDS = { easy: 12, normal: 16, hard: 20 };

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const lvl = LEVELS[difficulty] ?? LEVELS.normal;
  const pairCount = lvl.pairs;
  const timeLimitMs = lvl.time;

  const stage = document.createElement("div");
  stage.className = "mm-playfield";
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "mm-avatar-row";
  const grid = document.createElement("div");
  grid.className = `mm-grid mm-grid--c${lvl.cols} mm-grid--n${pairCount * 2}`;
  stage.appendChild(avatarWrap);
  stage.appendChild(grid);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 44 });

  // Symbole aus dem Pool ziehen; auf SCHWER ein Teil aus ähnlichen Symbolen.
  const look = shuffle(LOOKALIKES, rng).slice(0, lvl.lookalike);
  const rest = shuffle(SYMBOLS.filter((s) => !look.includes(s)), rng).slice(0, pairCount - look.length);
  const chosenSymbols = [...look, ...rest];
  const deck = shuffle([...chosenSymbols, ...chosenSymbols], rng);

  let firstCard = null, lock = false, matches = 0, mistakes = 0, running = true;
  let elapsed = 0, lastTs = null, raf = null;
  const timers = new Set();

  const cards = deck.map((symbol) => {
    const el = document.createElement("button");
    el.className = "mm-card";
    el.innerHTML = `<span class="mm-card__back">?</span><span class="mm-card__front">${symbol}</span>`;
    const card = { el, symbol, matched: false };
    el.addEventListener("click", () => onFlip(card));
    grid.appendChild(el);
    return card;
  });

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
      const a = firstCard;
      const t = setTimeout(() => {
        timers.delete(t);
        a.el.classList.remove("mm-card--flipped");
        card.el.classList.remove("mm-card--flipped");
        firstCard = null; lock = false;
      }, lvl.flipBack);
      timers.add(t);
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
    timers.forEach(clearTimeout); timers.clear();
    const cleanup = () => { avatar.destroy(); stage.innerHTML = ""; };
    if (silent) { cleanup(); return; }
    setTimeout(cleanup, won ? 500 : 0);
    const timeLeftFrac = clamp(1 - elapsed / timeLimitMs, 0, 1);
    // Score: 10 je Paar, bei Sieg + Zeitbonus (bis 100) - 3 je Fehlversuch, Perfekt +50
    let score = matches * 10 + (won ? Math.round(40 + timeLeftFrac * 60) : 0) - mistakes * 3;
    score = Math.max(0, score);
    if (perfect) score += 50;
    // Leistung 0-100 % (Basis der Belohnung und der Party-Punkte): Fortschritt, Zeit, Genauigkeit
    const accuracy = matches + mistakes > 0 ? matches / (matches + mistakes) : 0;
    const percent = won
      ? clamp(Math.round(45 + timeLeftFrac * 35 + accuracy * 20), 0, 100)
      : clamp(Math.round((matches / pairCount) * 40), 0, 40);
    onEnd({ score, percent, won, maxCombo: matches });
  }

  function tick(ts) {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    elapsed += Math.min(100, ts - lastTs);
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
