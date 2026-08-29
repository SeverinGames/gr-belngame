// js/rewards/dailyReward.js

const DAILY_TABLE = [
  { day: 1, type: "coins", amount: 50 },
  { day: 2, type: "keys", amount: 1 },
  { day: 3, type: "coins", amount: 80 },
  { day: 4, type: "keys", amount: 1 },
  { day: 5, type: "coins", amount: 120 },
  { day: 6, type: "keys", amount: 2 },
  { day: 7, type: "coins", amount: 300 },
];

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function canClaimDaily(profile, now = new Date()) {
  return profile.dailyReward.lastClaimDate !== todayKey(now);
}

export function claimDaily(profile, now = new Date()) {
  if (!canClaimDaily(profile, now)) return { success: false, reason: "already-claimed" };

  const yesterday = todayKey(new Date(now.getTime() - 86400000));
  const isConsecutive = profile.dailyReward.lastClaimDate === yesterday;
  const nextStreak = isConsecutive ? (profile.dailyReward.streakDay % 7) + 1 : 1;

  const reward = DAILY_TABLE[nextStreak - 1];
  if (reward.type === "coins") profile.coins += reward.amount;
  if (reward.type === "keys") profile.keys += reward.amount;

  profile.dailyReward.lastClaimDate = todayKey(now);
  profile.dailyReward.streakDay = nextStreak;

  return { success: true, reward, streakDay: nextStreak };
}

export function getDailyTable() {
  return DAILY_TABLE;
}
