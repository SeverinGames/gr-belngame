// js/missions/missions.js
// Datengetriebene Missionen. Belohnungen können Münzen, XP oder eine
// kostenlose Box sein (reward.coins / reward.xp / reward.boxId) - für lange
// Ziele gibt's bewusst mal eine Box statt nur Münzen, das fühlt sich nach
// mehr an.
export const MISSION_DEFS = [
  { id: "arcade3", label: "Spiele 3 Minispiele.", target: 3, statKey: "arcadeRoundsPlayed", reward: { coins: 50, xp: 40 } },
  { id: "arcade10", label: "Spiele 10 Minispiel-Runden.", target: 10, statKey: "arcadeRoundsPlayed", reward: { coins: 120, xp: 60 } },
  { id: "arcade30", label: "Spiele 30 Minispiel-Runden.", target: 30, statKey: "arcadeRoundsPlayed", reward: { boxId: "basic" } },
  { id: "distinct5", label: "Spiele 5 verschiedene Minispiele.", target: 5, statKey: "distinctGamesPlayed", reward: { coins: 180 } },
  { id: "score1000", label: "Erziele insgesamt 1.000 Punkte.", target: 1000, statKey: "totalArcadeScore", reward: { coins: 150 } },
  { id: "score5000", label: "Erziele insgesamt 5.000 Punkte.", target: 5000, statKey: "totalArcadeScore", reward: { coins: 420, xp: 100 } },
  { id: "combo10", label: "Erreiche eine 10er-Combo.", target: 10, statKey: "bestCombo", reward: { xp: 150, coins: 60 } },
  { id: "newHighscore", label: "Erreiche einen neuen Highscore.", target: 1, statKey: "highscoresAchieved", reward: { coins: 90 } },
  { id: "boxes3", label: "Öffne 3 Boxen im Shop.", target: 3, statKey: "boxesOpened", reward: { coins: 240 } },
  { id: "boxes10", label: "Öffne 10 Boxen im Shop.", target: 10, statKey: "boxesOpened", reward: { boxId: "super" } },
  { id: "collect1000", label: "Sammle insgesamt 1.000 Münzen.", target: 1000, statKey: "coinsEverEarned", reward: { coins: 150 } },
  { id: "collect5000", label: "Sammle insgesamt 5.000 Münzen.", target: 5000, statKey: "coinsEverEarned", reward: { coins: 420 } },
  { id: "streak3", label: "Schaffe 3 Minispiel-Runden hintereinander (mind. GESCHAFFT-Bewertung).", target: 3, statKey: "goodRoundStreak", reward: { coins: 180 } },
  { id: "wheel3", label: "Drehe das Glücksrad 3-mal.", target: 3, statKey: "wheelSpins", reward: { coins: 120, spin: 1 } },
  { id: "days3", label: "Spiele an 3 verschiedenen Tagen.", target: 3, statKey: "distinctDaysPlayed", reward: { coins: 240, miniBox: 1 } },
  // --- neu ---
  { id: "pp3000", label: "Erreiche 6.000 Party-Punkte.", target: 6000, statKey: "partyPoints", reward: { coins: 300, miniBox: 1 } },
  { id: "mais3", label: "Finde 3 Schätze in der Mais-Mission.", target: 3, statKey: "treasuresFound", reward: { coins: 240, spin: 1 } },
  { id: "perfect5", label: "Schaffe 5 PERFEKT-Runden.", target: 5, statKey: "perfectRounds", reward: { coins: 240, xp: 150 } },
  { id: "wins5", label: "Gewinne 5 Spiele (Vier gewinnt, Memory, Farbröhren ...).", target: 5, statKey: "gamesWon", reward: { coins: 210, miniBox: 1 } },
  { id: "pp10000skin", label: "Löndis Herausforderung: Erreiche 20.000 Party-Punkte.", target: 20000, statKey: "partyPoints", reward: { skinId: "loendi" } },
];

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

// rng wird nur für boxId-Belohnungen gebraucht (Drop-Ziehung); Aufrufer
// (main.js) übergibt bei Bedarf Math.random und öffnet danach die
// Box-Animation mit dem zurückgegebenen boxResult.
export function claimMission(profile, missionId, { grantRewards, grantFreeBox, unlockSkin, addSpin, addMiniBoxes } = {}) {
  const progress = getMissionProgress(profile, missionId);
  if (!progress || !progress.done || progress.claimed) return { success: false };

  if (!profile.claimedMissions) profile.claimedMissions = [];
  profile.claimedMissions.push(missionId);

  const reward = progress.def.reward;
  if ((reward.coins || reward.xp) && grantRewards) {
    grantRewards(profile, { coins: reward.coins ?? 0, xp: reward.xp ?? 0 });
  }
  if (reward.spin && addSpin) addSpin(profile, reward.spin);
  if (reward.miniBox && addMiniBoxes) addMiniBoxes(profile, reward.miniBox);
  if (reward.skinId && unlockSkin) unlockSkin(profile, reward.skinId);
  let boxResult = null;
  if (reward.boxId && grantFreeBox) {
    boxResult = grantFreeBox(profile, reward.boxId, Math.random);
  }

  return { success: true, reward, boxResult };
}
