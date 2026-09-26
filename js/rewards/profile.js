// js/rewards/profile.js
// Persistentes Profil: Level, XP, Münzen (Bank), Schlüssel, freigeschaltete Skins.
// storage ist injizierbar (Default: window.localStorage), damit dies auch
// ohne Browser (z.B. in Tests) funktioniert.

const STORAGE_KEY = "nwo_profile_v1";
const XP_PER_LEVEL = 100;

function defaultProfile() {
  return {
    level: 1,
    xp: 0,
    coins: 0, // Bank-Münzen, dauerhaft (getrennt von riskCoins/securedCoins im Run)
    keys: 0,
    unlockedSkins: ["mario"],
    equippedSkin: "mario",
    stats: { runsPlayed: 0, runsFled: 0, runsDied: 0, roomsCleared: 0, doorsOpened: 0, coinsEverEarned: 0, arcadeRoundsPlayed: 0 },
    claimedMissions: [],
    dailyReward: { lastClaimDate: null, streakDay: 0 },
    settings: { musicVolume: 0.5, sfxVolume: 0.7, vibration: true },
    // Bestwerte pro Minispiel (key = gameId), für Highscore-Anzeige auf den
    // Minispiel-Karten (Punkt 9 des Prompts).
    arcadeHighscores: {},
  };
}

export function loadProfile(storage = safeStorage()) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw);
    const base = defaultProfile();
    // Flache Spreads würden verschachtelte Objekte (stats/settings/...) aus
    // älteren gespeicherten Profilen komplett ersetzen und dabei neu
    // hinzugekommene Felder verlieren (z.B. arcadeRoundsPlayed) - daher hier
    // pro verschachteltem Objekt einzeln mergen statt alles zu überschreiben.
    return {
      ...base,
      ...parsed,
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      dailyReward: { ...base.dailyReward, ...(parsed.dailyReward ?? {}) },
      arcadeHighscores: { ...base.arcadeHighscores, ...(parsed.arcadeHighscores ?? {}) },
    };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile, storage = safeStorage()) {
  storage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

function safeStorage() {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  // Fallback-Mock, falls kein Browser-Storage verfügbar ist (z.B. Tests)
  const mem = {};
  return {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = v; },
  };
}

// Belohnungen aus einer beendeten Runde ins Profil einbuchen
export function applyRunRewards(profile, { coinsEarned, xpEarned, keysEarned, fled, roomsCleared }) {
  profile.coins += coinsEarned;
  profile.keys += keysEarned;
  profile.xp += xpEarned;
  profile.stats.runsPlayed++;
  profile.stats.coinsEverEarned += coinsEarned;
  profile.stats.roomsCleared += roomsCleared ?? 0;
  profile.stats.doorsOpened += roomsCleared ?? 0;
  if (fled) profile.stats.runsFled++;
  else profile.stats.runsDied++;

  // Flache XP-Kurve für Phase 3 (bewusst einfach, in Phase 7 ggf. verfeinern)
  const levelUps = [];
  while (profile.xp >= XP_PER_LEVEL) {
    profile.xp -= XP_PER_LEVEL;
    profile.level++;
    levelUps.push(profile.level);
  }
  return { profile, levelUps };
}

// Belohnung aus einer Minispiel-Runde einbuchen (Arcade-System, Punkt 5 des
// Prompts). Getrennt von applyRunRewards, weil Minispiele nicht "fled/died"
// kennen, dafür aber einen Highscore pro Spiel führen.
export function applyArcadeRewards(profile, { gameId, xpEarned, coinsEarned, score }) {
  profile.coins += coinsEarned;
  profile.xp += xpEarned;
  profile.stats.arcadeRoundsPlayed = (profile.stats.arcadeRoundsPlayed ?? 0) + 1;
  profile.stats.coinsEverEarned += coinsEarned;

  const previousBest = profile.arcadeHighscores[gameId] ?? 0;
  const isNewHighscore = score > previousBest;
  if (isNewHighscore) profile.arcadeHighscores[gameId] = score;

  const levelUps = [];
  while (profile.xp >= XP_PER_LEVEL) {
    profile.xp -= XP_PER_LEVEL;
    profile.level++;
    levelUps.push(profile.level);
  }
  return { profile, levelUps, isNewHighscore, previousBest };
}

export function unlockSkin(profile, skinId) {
  if (!profile.unlockedSkins.includes(skinId)) {
    profile.unlockedSkins.push(skinId);
    return true;
  }
  return false;
}
