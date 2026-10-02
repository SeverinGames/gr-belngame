// js/rewards/dailyReward.js
// Tägliche Belohnung / 7-Tage-Serie: Münzen/XP, am Tag 6 ein Bonus-Dreh und
// am Jackpot-Tag 7 eine kostenlose Basic Box + Mini-Box. claimDaily() bucht
// alles sofort ins Profil und liefert eine klare Beschreibung zurück.
import { grantRewards, dayKey } from "./profile.js";
import { addSpin, addMiniBoxes, describeRewardObj } from "../progress/rewardOps.js";

const DAILY_TABLE = [
  { day: 1, type: "coins", coins: 150 },
  { day: 2, type: "coins", coins: 250 },
  { day: 3, type: "mixed", coins: 200, xp: 60 },
  { day: 4, type: "coins", coins: 350 },
  { day: 5, type: "mixed", coins: 300, xp: 100 },
  { day: 6, type: "coins", coins: 500, spin: 1 },
  { day: 7, type: "box", boxId: "basic", miniBox: 1, label: "Gratis Basic Box + Mini-Box" },
];

export function canClaimDaily(profile, now = new Date()) {
  return profile.dailyReward.lastClaimDate !== dayKey(now);
}

// Gibt { success, reward, streakDay, levelUps } zurück. Für type "box" öffnet
// der Aufrufer (main.js) die Box über shop.grantFreeBox().
export function claimDaily(profile, now = new Date()) {
  if (!canClaimDaily(profile, now)) return { success: false, reason: "already-claimed" };

  const yesterday = dayKey(new Date(now.getTime() - 86400000));
  const isConsecutive = profile.dailyReward.lastClaimDate === yesterday;
  const nextStreak = isConsecutive ? (profile.dailyReward.streakDay % 7) + 1 : 1;
  const reward = DAILY_TABLE[nextStreak - 1];

  const levelUps = grantRewards(profile, { coins: reward.coins ?? 0, xp: reward.xp ?? 0 });
  if (reward.spin) addSpin(profile, reward.spin);
  if (reward.miniBox) addMiniBoxes(profile, reward.miniBox);

  profile.dailyReward.lastClaimDate = dayKey(now);
  profile.dailyReward.streakDay = nextStreak;
  return { success: true, reward, streakDay: nextStreak, levelUps };
}

export function getDailyTable() { return DAILY_TABLE; }

export function describeReward(reward) {
  if (reward.type === "box") return reward.label ?? "eine Gratis-Box";
  return describeRewardObj(reward);
}

export function previewReward(profile, now = new Date()) {
  const yesterday = dayKey(new Date(now.getTime() - 86400000));
  const isConsecutive = profile.dailyReward.lastClaimDate === yesterday;
  const nextStreak = isConsecutive ? (profile.dailyReward.streakDay % 7) + 1 : 1;
  return { text: describeReward(DAILY_TABLE[nextStreak - 1]), streakDay: nextStreak };
}
