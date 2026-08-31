// js/minigames/hideGame.js
export const HIDE_GAME = {
  id: "hideGame",
  name: "Verstecken",
  description: "Etwas durchsucht den Raum - finde rechtzeitig ein Versteck.",
  minPlayers: 1,
  maxPlayers: 6,
};

// difficultyFactor > 1 = weniger Zeit zum Verstecken
export function createHideChallenge(rng, difficultyFactor = 1) {
  const spotCount = 3 + Math.floor(rng() * 2); // 3 oder 4 Verstecke
  const timeLimitMs = Math.max(2500, Math.round(6000 / difficultyFactor));
  return { spotCount, timeLimitMs };
}

// hiddenSpotIndex: Index des Verstecks, in dem der Spieler sitzt, oder null
// (nicht rechtzeitig versteckt -> automatischer Fehlschlag).
export function resolveHideOutcome(hiddenSpotIndex, spotCount, rng) {
  if (hiddenSpotIndex === null || hiddenSpotIndex === undefined) {
    return { success: false, checkedSpot: null, reason: "too-slow" };
  }
  const checkedSpot = Math.floor(rng() * spotCount);
  const success = checkedSpot !== hiddenSpotIndex;
  return { success, checkedSpot, reason: success ? "safe" : "found" };
}

export function hideOutcomeMessage(result, difficultyFactor = 1) {
  if (result.success) {
    const coins = Math.round(25 + Math.random() * 20);
    return { kind: "reward", message: `Gut versteckt! Es zieht vorbei. +${coins} Münzen.`, coins, hp: 0, xp: 10 };
  }
  const dmg = Math.round(18 * difficultyFactor);
  const msg = result.reason === "too-slow"
    ? `Zu langsam versteckt! -${dmg} HP.`
    : `Erwischt! -${dmg} HP.`;
  return { kind: "danger", message: msg, coins: 0, hp: -dmg, xp: 0 };
}
