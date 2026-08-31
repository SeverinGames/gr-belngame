// js/minigames/reactionGame.js
// Datengetriebenes Minispiel-Format (Punkt 35 des Prompts): id, name, duration,
// difficulty-abhängige Parameter, successCondition. Reine Logik ohne DOM, damit
// Server (Multiplayer, autoritativ) und Client (Solo) exakt denselben Code nutzen.

export const REACTION_GAME = {
  id: "reactionGame",
  name: "Reaktionstest",
  description: "Ein Symbol erscheint plötzlich - reagiere so schnell wie möglich.",
  minPlayers: 1,
  maxPlayers: 6,
};

const SYMBOLS = ["⚡", "★", "◆", "●"];

// Erzeugt eine neue Challenge. difficultyFactor > 1 = schwerer (kürzeres Fenster).
export function createReactionChallenge(rng, difficultyFactor = 1) {
  const symbol = SYMBOLS[Math.floor(rng() * SYMBOLS.length)];
  const revealDelayMs = 600 + Math.floor(rng() * 1800); // 0.6s - 2.4s Warten
  const windowMs = Math.max(320, Math.round(900 / difficultyFactor)); // schwerer = kürzeres Zeitfenster
  return { symbol, revealDelayMs, windowMs };
}

// reactionMs: Zeit zwischen "Symbol erscheint" und Tastendruck.
// reactionMs < 0 bedeutet "zu früh gedrückt" (vor dem Symbol).
export function scoreReaction(reactionMs, windowMs) {
  if (reactionMs < 0) return { success: false, reason: "too-early", speedRatio: 0 };
  if (reactionMs > windowMs) return { success: false, reason: "too-slow", speedRatio: 0 };
  const speedRatio = 1 - reactionMs / windowMs; // 1 = perfekt sofort, 0 = gerade noch rechtzeitig
  return { success: true, reason: "ok", speedRatio: Math.max(0, Math.min(1, speedRatio)) };
}

// Belohnung/Schaden aus dem Ergebnis ableiten (gemeinsam für Solo + Multiplayer)
export function reactionOutcome(result, difficultyFactor = 1) {
  if (result.success) {
    const coins = Math.round(15 + result.speedRatio * 35 * difficultyFactor);
    const msg = result.speedRatio > 0.75
      ? `Blitzschnell! +${coins} Münzen.`
      : `Geschafft, gerade noch rechtzeitig. +${coins} Münzen.`;
    return { kind: "reward", message: msg, coins, hp: 0, xp: 8 };
  }
  const dmg = Math.round(10 * difficultyFactor);
  const msg = result.reason === "too-early"
    ? `Zu früh reagiert! -${dmg} HP.`
    : `Zu langsam! -${dmg} HP.`;
  return { kind: "danger", message: msg, coins: 0, hp: -dmg, xp: 0 };
}
