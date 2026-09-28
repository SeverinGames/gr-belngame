// js/rewards/dailyReward.js
// Tägliche Belohnung / Streak. Gibt Münzen, an einem Tag auch XP, und am
// Jackpot-Tag 7 eine kostenlose Box-Öffnung (kein Schlüssel-System mehr).
// claimDaily() bucht Münzen/XP sofort ins Profil ein und liefert eine klare
// Beschreibung zurück, damit die UI "Du hast +50 Münzen erhalten!" zeigen
// kann statt nur den Streak-Text zu ändern.
import { grantRewards } from "./profile.js";

const DAILY_TABLE = [
  { day: 1, type: "coins", coins: 50 },
  { day: 2, type: "coins", coins: 90 },
  { day: 3, type: "mixed", coins: 60, xp: 40 },
  { day: 4, type: "coins", coins: 220 },
  { day: 5, type: "mixed", coins: 120, xp: 80 },
  { day: 6, type: "coins", coins: 380 },
  { day: 7, type: "box", boxId: "basic", label: "Kostenlose Basic Box" },
];

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function canClaimDaily(profile, now = new Date()) {
  return profile.dailyReward.lastClaimDate !== todayKey(now);
}

// Gibt { success, reward, streakDay, levelUps } zurück. `reward` beschreibt,
// was der Spieler bekommen hat - für type "box" wird die eigentliche Box vom
// Aufrufer (main.js) über shop.grantFreeBox() geöffnet, damit hier keine
// Shop-Logik dupliziert wird.
export function claimDaily(profile, now = new Date()) {
  if (!canClaimDaily(profile, now)) return { success: false, reason: "already-claimed" };

  const yesterday = todayKey(new Date(now.getTime() - 86400000));
  const isConsecutive = profile.dailyReward.lastClaimDate === yesterday;
  const nextStreak = isConsecutive ? (profile.dailyReward.streakDay % 7) + 1 : 1;
  const reward = DAILY_TABLE[nextStreak - 1];

  let levelUps = [];
  if (reward.type === "coins") levelUps = grantRewards(profile, { coins: reward.coins });
  else if (reward.type === "mixed") levelUps = grantRewards(profile, { coins: reward.coins, xp: reward.xp });
  // type "box": bewusst keine Münzen/XP hier - main.js öffnet die Box separat.

  profile.dailyReward.lastClaimDate = todayKey(now);
  profile.dailyReward.streakDay = nextStreak;

  return { success: true, reward, streakDay: nextStreak, levelUps };
}

export function getDailyTable() {
  return DAILY_TABLE;
}

// Menschlich lesbare Kurzbeschreibung einer Belohnung, für die "Tag X von 7"-
// Vorschau und die "Du hast ... erhalten!"-Bestätigung nach dem Abholen.
export function describeReward(reward) {
  if (reward.type === "coins") return `+${reward.coins} 🪙`;
  if (reward.type === "mixed") return `+${reward.coins} 🪙 + ${reward.xp} XP`;
  if (reward.type === "box") return reward.label ?? "eine Gratis-Box";
  return "";
}

export function previewReward(profile, now = new Date()) {
  const yesterday = todayKey(new Date(now.getTime() - 86400000));
  const isConsecutive = profile.dailyReward.lastClaimDate === yesterday;
  const nextStreak = isConsecutive ? (profile.dailyReward.streakDay % 7) + 1 : 1;
  return { text: describeReward(DAILY_TABLE[nextStreak - 1]), streakDay: nextStreak };
}
