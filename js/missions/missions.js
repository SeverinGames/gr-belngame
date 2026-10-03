// js/missions/missions.js
import { ensureDaily } from "../rewards/profile.js";
// Datengetriebene Missionen. Belohnungen können Münzen, XP oder eine
// kostenlose Box sein (reward.coins / reward.xp / reward.boxId) - für lange
// Ziele gibt's bewusst mal eine Box statt nur Münzen, das fühlt sich nach
// mehr an.
// Kategorien: "daily" (täglich neu), "short" (kurzfristig), "long" (langfristig),
// "milestone" (sehr lange Meilensteine). statKey: Wert aus profile.stats, ein
// abgeleiteter Wert (siehe statValue) oder "daily:<feld>" (Tageszähler).
export const MISSION_CATEGORIES = {
  daily: { label: "TÄGLICH", hint: "Setzt sich jeden Tag zurück" },
  short: { label: "KURZ", hint: "Schnelle Ziele für zwischendurch" },
  long: { label: "LANG", hint: "Für regelmäßige Spieler" },
  milestone: { label: "MEILENSTEINE", hint: "Große Langzeitziele" },
};

export const MISSION_DEFS = [
  // --- täglich ---
  { id: "dm_rounds6", category: "daily", label: "Spiele heute 6 Runden.", target: 6, statKey: "daily:rounds", reward: { coins: 20, xp: 40 } },
  { id: "dm_wins2", category: "daily", label: "Gewinne heute 2 Spiele.", target: 2, statKey: "daily:wins", reward: { coins: 20, xp: 30 } },
  { id: "dm_hard2", category: "daily", label: "Spiele heute 2 Runden auf SCHWER.", target: 2, statKey: "daily:hard", reward: { coins: 30, xp: 50 } },
  { id: "dm_games4", category: "daily", label: "Probiere heute 4 verschiedene Spiele.", target: 4, statKey: "daily:games", reward: { coins: 20, spin: 1 } },
  // --- kurzfristig ---
  { id: "arcade3", category: "short", label: "Spiele 3 Minispiele.", target: 3, statKey: "arcadeRoundsPlayed", reward: { coins: 30, xp: 40 } },
  { id: "arcade10", category: "short", label: "Spiele 10 Minispiel-Runden.", target: 10, statKey: "arcadeRoundsPlayed", reward: { coins: 80, xp: 60 } },
  { id: "distinct5", category: "short", label: "Spiele 5 verschiedene Minispiele.", target: 5, statKey: "distinctGamesPlayed", reward: { coins: 120 } },
  { id: "newHighscore", category: "short", label: "Erreiche einen neuen Highscore.", target: 1, statKey: "highscoresAchieved", reward: { coins: 60 } },
  { id: "combo10", category: "short", label: "Erreiche eine 10er-Combo.", target: 10, statKey: "bestCombo", reward: { xp: 150, coins: 40 } },
  { id: "boxes3", category: "short", label: "Öffne 3 Boxen im Shop.", target: 3, statKey: "boxesOpened", reward: { coins: 160 } },
  { id: "wheel3", category: "short", label: "Drehe das Glücksrad 3-mal.", target: 3, statKey: "wheelSpins", reward: { coins: 80, spin: 1 } },
  { id: "streak3", category: "short", label: "Schaffe 3 Runden hintereinander (mind. GESCHAFFT).", target: 3, statKey: "goodRoundStreak", reward: { coins: 120 } },
  { id: "days3", category: "short", label: "Spiele an 3 verschiedenen Tagen.", target: 3, statKey: "distinctDaysPlayed", reward: { coins: 160, miniBox: 1 } },
  { id: "hard3", category: "short", label: "Spiele 3 Runden auf SCHWER.", target: 3, statKey: "hardRoundsPlayed", reward: { coins: 100, xp: 100 } },
  // --- langfristig ---
  { id: "arcade30", category: "long", label: "Spiele 30 Minispiel-Runden.", target: 30, statKey: "arcadeRoundsPlayed", reward: { boxId: "basic" } },
  { id: "arcade100", category: "long", label: "Spiele 100 Minispiel-Runden.", target: 100, statKey: "arcadeRoundsPlayed", reward: { coins: 260, miniBox: 1 } },
  { id: "wins5", category: "long", label: "Gewinne 5 Spiele (Vier gewinnt, Memory, Farbröhren, Maze ...).", target: 5, statKey: "gamesWon", reward: { coins: 130, miniBox: 1 } },
  { id: "wins25", category: "long", label: "Gewinne 25 Spiele.", target: 25, statKey: "gamesWon", reward: { coins: 260, spin: 1 } },
  { id: "distinct10", category: "long", label: "Spiele 10 verschiedene Minispiele.", target: 10, statKey: "distinctGamesPlayed", reward: { coins: 200, cosmetic: "badge:star" } },
  { id: "hardGames5", category: "long", label: "Spiele 5 verschiedene Spiele auf SCHWER.", target: 5, statKey: "hardGamesDistinct", reward: { coins: 200, xp: 200 } },
  { id: "days7", category: "long", label: "Spiele an 7 verschiedenen Tagen.", target: 7, statKey: "distinctDaysPlayed", reward: { coins: 260, cosmetic: "frame:bronze" } },
  { id: "xp1000", category: "long", label: "Sammle insgesamt 1.000 XP.", target: 1000, statKey: "xpEverEarned", reward: { coins: 100, spin: 1 } },
  { id: "xp5000", category: "long", label: "Sammle insgesamt 5.000 XP.", target: 5000, statKey: "xpEverEarned", reward: { coins: 200, miniBox: 1 } },
  { id: "collect1000", category: "long", label: "Verdiene insgesamt 1.000 Münzen.", target: 1000, statKey: "coinsEverEarned", reward: { coins: 100 } },
  { id: "collect10000", category: "long", label: "Verdiene insgesamt 10.000 Münzen.", target: 10000, statKey: "coinsEverEarned", reward: { coins: 200, xp: 200 } },
  { id: "boxes10", category: "long", label: "Öffne 10 Boxen im Shop.", target: 10, statKey: "boxesOpened", reward: { boxId: "super" } },
  { id: "cosm5", category: "long", label: "Sammle 5 kosmetische Gegenstände.", target: 5, statKey: "cosmeticsOwned", reward: { coins: 100, miniBox: 1 } },
  { id: "hs10", category: "long", label: "Erreiche 10 neue Highscores.", target: 10, statKey: "highscoresAchieved", reward: { coins: 160, cosmetic: "badge:trophy" } },
  { id: "perfect5", category: "long", label: "Schaffe 5 PERFEKT-Runden.", target: 5, statKey: "perfectRounds", reward: { coins: 160, xp: 150 } },
  { id: "pp3000", category: "long", label: "Erreiche 6.000 Party-Punkte.", target: 6000, statKey: "partyPoints", reward: { coins: 200, miniBox: 1 } },
  { id: "mais3", category: "long", label: "Finde 3 Schätze in der Mais-Mission.", target: 3, statKey: "treasuresFound", reward: { coins: 160, spin: 1 } },
  { id: "score1000", category: "long", label: "Erziele insgesamt 1.000 Punkte.", target: 1000, statKey: "totalArcadeScore", reward: { coins: 100 } },
  { id: "score5000", category: "long", label: "Erziele insgesamt 5.000 Punkte.", target: 5000, statKey: "totalArcadeScore", reward: { coins: 260, xp: 100 } },
  { id: "collect5000", category: "long", label: "Sammle insgesamt 5.000 Münzen.", target: 5000, statKey: "coinsEverEarned", reward: { coins: 270 } },
  // --- Meilensteine ---
  { id: "arcade500", category: "milestone", label: "Spiele 500 Minispiel-Runden.", target: 500, statKey: "arcadeRoundsPlayed", reward: { coins: 520, cosmetic: "title:legend" } },
  { id: "wins100", category: "milestone", label: "Gewinne 100 Spiele.", target: 100, statKey: "gamesWon", reward: { coins: 520, cosmetic: "frame:neon" } },
  { id: "days30", category: "milestone", label: "Spiele an 30 verschiedenen Tagen.", target: 30, statKey: "distinctDaysPlayed", reward: { coins: 650, cosmetic: "badge:ticket", miniBox: 2 } },
  { id: "xp20000", category: "milestone", label: "Sammle insgesamt 20.000 XP.", target: 20000, statKey: "xpEverEarned", reward: { coins: 390, cosmetic: "effect:aurora" } },
  { id: "coins100k", category: "milestone", label: "Verdiene insgesamt 100.000 Münzen.", target: 100000, statKey: "coinsEverEarned", reward: { coins: 650, cosmetic: "frame:gold" } },
  { id: "boxes50", category: "milestone", label: "Öffne 50 Boxen.", target: 50, statKey: "boxesOpened", reward: { coins: 520, voucher: "super" } },
  { id: "cosm20", category: "milestone", label: "Sammle 20 kosmetische Gegenstände.", target: 20, statKey: "cosmeticsOwned", reward: { coins: 320, miniBox: 2 } },
  { id: "hs50", category: "milestone", label: "Erreiche 50 neue Highscores.", target: 50, statKey: "highscoresAchieved", reward: { coins: 390, cosmetic: "title:hunter" } },
  { id: "hardGames14", category: "milestone", label: "Spiele alle 14 Minispiele auf SCHWER.", target: 14, statKey: "hardGamesDistinct", reward: { coins: 650, cosmetic: "badge:crown" } },
  { id: "perfect50", category: "milestone", label: "Schaffe 50 PERFEKT-Runden.", target: 50, statKey: "perfectRounds", reward: { coins: 460, cosmetic: "title:mind" } },
  { id: "pp10000skin", category: "milestone", label: "Löndis Herausforderung: Erreiche 32.000 Party-Punkte (fast alles perfekt).", target: 32000, statKey: "partyPoints", reward: { skinId: "loendi" } },
];

// Wert einer Statistik: direkte Zahl, abgeleiteter Wert oder Tageszähler
export function statValue(profile, key) {
  if (key.startsWith("daily:")) {
    const d = profile.daily ?? {};
    const f = key.slice(6);
    return Array.isArray(d[f]) ? d[f].length : (d[f] ?? 0);
  }
  if (key === "hardGamesDistinct") return (profile.hardGamesPlayed ?? []).length;
  if (key === "cosmeticsOwned") return (profile.cosmetics?.owned ?? []).length;
  if (key === "skinsOwned") return (profile.unlockedSkins ?? []).length;
  return profile.stats[key] ?? 0;
}

export function getMissionProgress(profile, missionId) {
  ensureDaily(profile); // Tageswerte beim Tageswechsel zurücksetzen
  const def = MISSION_DEFS.find((m) => m.id === missionId);
  if (!def) return null;
  const current = statValue(profile, def.statKey);
  const claimed = def.category === "daily"
    ? (profile.daily?.claimedMissions?.includes(missionId) ?? false)
    : (profile.claimedMissions?.includes(missionId) ?? false);
  return { def, current, done: current >= def.target, claimed };
}

export function listMissionProgress(profile) {
  return MISSION_DEFS.map((def) => getMissionProgress(profile, def.id));
}
// Anzahl abholbereiter Missionen (für die Zähler-Badges), optional je Kategorie
export function claimableMissions(profile, category = null) {
  return listMissionProgress(profile).filter((m) => m.done && !m.claimed && (!category || m.def.category === category)).length;
}

// rng wird nur für boxId-Belohnungen gebraucht (Drop-Ziehung); Aufrufer
// (main.js) übergibt bei Bedarf Math.random und öffnet danach die
// Box-Animation mit dem zurückgegebenen boxResult.
export function claimMission(profile, missionId, { grantRewards, grantFreeBox, unlockSkin, addSpin, addMiniBoxes, addVoucher, unlockCosmetic } = {}) {
  const progress = getMissionProgress(profile, missionId);
  if (!progress || !progress.done || progress.claimed) return { success: false };

  if (progress.def.category === "daily") profile.daily.claimedMissions.push(missionId);
  else { if (!profile.claimedMissions) profile.claimedMissions = []; profile.claimedMissions.push(missionId); }

  const reward = progress.def.reward;
  if ((reward.coins || reward.xp) && grantRewards) {
    grantRewards(profile, { coins: reward.coins ?? 0, xp: reward.xp ?? 0 });
  }
  if (reward.spin && addSpin) addSpin(profile, reward.spin);
  if (reward.miniBox && addMiniBoxes) addMiniBoxes(profile, reward.miniBox);
  if (reward.skinId && unlockSkin) unlockSkin(profile, reward.skinId);
  if (reward.voucher && addVoucher) addVoucher(profile, reward.voucher, 1);
  if (reward.cosmetic && unlockCosmetic) { const [c, id] = reward.cosmetic.split(":"); unlockCosmetic(profile, c, id); }
  let boxResult = null;
  if (reward.boxId && grantFreeBox) {
    boxResult = grantFreeBox(profile, reward.boxId, Math.random);
  }

  return { success: true, reward, boxResult };
}
