// js/missions/missions.js
// Datengetriebene Missionen. check(stats) prüft anhand der kumulierten
// Profil-Statistiken, ob die Mission erfüllt ist. Belohnungen sind jetzt
// ausschließlich Münzen (kein Schlüssel-System mehr) - Münzen fließen direkt
// in den Shop (Boxen kaufen).
export const MISSION_DEFS = [
  { id: "arcade3", label: "Spiele 3 Minispiele.", target: 3, statKey: "arcadeRoundsPlayed", reward: { coins: 20 } },
  { id: "arcade10", label: "Spiele 10 Minispiel-Runden.", target: 10, statKey: "arcadeRoundsPlayed", reward: { coins: 60 } },
  { id: "arcade30", label: "Spiele 30 Minispiel-Runden.", target: 30, statKey: "arcadeRoundsPlayed", reward: { coins: 150 } },
  { id: "distinct5", label: "Spiele 5 verschiedene Minispiele.", target: 5, statKey: "distinctGamesPlayed", reward: { coins: 100 } },
  { id: "score1000", label: "Erziele insgesamt 1.000 Punkte.", target: 1000, statKey: "totalArcadeScore", reward: { coins: 80 } },
  { id: "combo10", label: "Erreiche eine 10er-Combo.", target: 10, statKey: "bestCombo", reward: { coins: 100 } },
  { id: "newHighscore", label: "Erreiche einen neuen Highscore.", target: 1, statKey: "highscoresAchieved", reward: { coins: 50 } },
  { id: "boxes3", label: "Öffne 3 Boxen im Shop.", target: 3, statKey: "boxesOpened", reward: { coins: 150 } },
  { id: "collect1000", label: "Sammle insgesamt 1.000 Münzen.", target: 1000, statKey: "coinsEverEarned", reward: { coins: 100 } },
];

// progress: { [missionId]: currentValue, claimed: { [missionId]: bool } }
export function getMissionProgress(profile, missionId) {
  const def = MISSION_DEFS.find((m) => m.id === missionId);
  if (!def) return null;
  const current = profile.stats[def.statKey] ?? 0;
  const claimed = profile.claimedMissions?.includes(missionId) ?? false;
  return { def, current, done: current >= def.target, claimed };
}

export function listMissionProgress(profile) {
  return MISSION_DEFS.map((def) => getMissionProgress(profile, def.id));
}

export function claimMission(profile, missionId) {
  const progress = getMissionProgress(profile, missionId);
  if (!progress || !progress.done || progress.claimed) return { success: false };

  if (!profile.claimedMissions) profile.claimedMissions = [];
  profile.claimedMissions.push(missionId);

  if (progress.def.reward.coins) {
    profile.coins += progress.def.reward.coins;
    profile.stats.coinsEverEarned += progress.def.reward.coins;
  }

  return { success: true, reward: progress.def.reward };
}
