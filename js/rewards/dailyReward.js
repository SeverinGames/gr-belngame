// js/rewards/dailyReward.js
// Tägliche Belohnung / Streak. Gibt jetzt ausschließlich Münzen (kein
// Schlüssel-System mehr) - passend zum neuen Shop-/Box-Kreislauf. Tag 7 ist
// bewusst ein großer Münzsprung ("Jackpot-Tag"), damit sich das Durchhalten
// der Serie lohnt.
const DAILY_TABLE = [
  { day: 1, type: "coins", amount: 50 },
  { day: 2, type: "coins", amount: 90 },
  { day: 3, type: "coins", amount: 140 },
  { day: 4, type: "coins", amount: 200 },
  { day: 5, type: "coins", amount: 280 },
  { day: 6, type: "coins", amount: 380 },
  { day: 7, type: "coins", amount: 600 },
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
  profile.coins += reward.amount;
  profile.stats.coinsEverEarned += reward.amount;

  profile.dailyReward.lastClaimDate = todayKey(now);
  profile.dailyReward.streakDay = nextStreak;

  return { success: true, reward, streakDay: nextStreak };
}

export function getDailyTable() {
  return DAILY_TABLE;
}
