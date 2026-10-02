// js/progress/roundResult.js
// Verbindet alles, was nach einer Runde passiert - in genau einer Funktion,
// damit SOLO und ONLINE dieselben Regeln nutzen:
//   Runde -> Münzen/XP -> Statistik -> Highscore -> Party-Punkte
//         -> kleine Highscore-Belohnung -> Meilensteine -> Level-Ups
import { applyArcadeRewards, grantRewards, ensureDaily } from "../rewards/profile.js";
import { recordPartyPoints } from "./partyPoints.js";
import { checkMilestones } from "./milestones.js";

const HIGHSCORE_REWARD = { coins: 30, xp: 20 };
const MAX_HIGHSCORE_REWARDS_PER_DAY = 3;

export function applyRound(profile, args) {
  const { gameId, difficulty = "normal", percent = 0 } = args;
  const base = applyArcadeRewards(profile, args);
  const pp = recordPartyPoints(profile, gameId, difficulty, percent);

  // Kleine Belohnung für neue persönliche Highscores (nicht beim allerersten
  // Mal pro Spiel/Schwierigkeit und höchstens 3x pro Tag - kein Farming).
  let highscoreReward = null;
  const daily = ensureDaily(profile);
  if (base.isNewHighscore && base.previousBest > 0 && daily.highscoreRewards < MAX_HIGHSCORE_REWARDS_PER_DAY) {
    daily.highscoreRewards++;
    base.levelUps.push(...grantRewards(profile, HIGHSCORE_REWARD));
    highscoreReward = HIGHSCORE_REWARD;
  }
  if (base.isNewHighscore && args.gameId === "maisMission") { /* Schätze zählt das Spiel selbst über result.won */ }
  if (args.gameId === "maisMission" && args.won) profile.stats.treasuresFound = (profile.stats.treasuresFound ?? 0) + 1;

  const milestones = checkMilestones(profile);
  return { ...base, pp, highscoreReward, milestones };
}
