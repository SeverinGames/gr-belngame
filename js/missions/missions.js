// js/missions/missions.js
// Datengetriebene Missionen. check(stats) prüft anhand der kumulierten
// Profil-Statistiken, ob die Mission erfüllt ist.

export const MISSION_DEFS = [
  { id: "open5doors", label: "Öffne 5 Türen.", target: 5, statKey: "doorsOpened", reward: { coins: 30 } },
  { id: "survive10", label: "Überlebe 10 Räume.", target: 10, statKey: "roomsCleared", reward: { coins: 40 } },
  { id: "collect500", label: "Sammle insgesamt 500 Münzen.", target: 500, statKey: "coinsEverEarned", reward: { keys: 1 } },
  { id: "flee2", label: "Entkomme 2-mal.", target: 2, statKey: "runsFled", reward: { keys: 1 } },
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

  if (progress.def.reward.coins) profile.coins += progress.def.reward.coins;
  if (progress.def.reward.keys) profile.keys += progress.def.reward.keys;

  return { success: true, reward: progress.def.reward };
}
