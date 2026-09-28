// js/rewards/profile.js
// Persistentes Profil: Level, XP, Münzen (Bank), freigeschaltete Skins.
// storage ist injizierbar (Default: window.localStorage), damit dies auch
// ohne Browser (z.B. in Tests) funktioniert.
//
// Hinweis zur Umstellung "Big Sevis Minispiel Party": Das frühere
// Schlüssel-System (profile.keys) wurde entfernt und durch Münzen + Shop/
// Box-Käufe ersetzt (siehe js/shop/shop.js). Es gibt keine Tür-Runden mehr,
// daher auch keine runsPlayed/roomsCleared/doorsOpened-Statistiken mehr -
// die Minispiel-Statistiken (arcade*) sind jetzt die einzige Quelle.

const STORAGE_KEY = "nwo_profile_v1";
const XP_PER_LEVEL = 100;

function defaultProfile() {
  return {
    level: 1,
    xp: 0,
    coins: 0, // einzige Währung - wird im Shop gegen Boxen eingetauscht
    unlockedSkins: ["mario"],
    equippedSkin: "mario",
    stats: {
      coinsEverEarned: 0,
      arcadeRoundsPlayed: 0,
      totalArcadeScore: 0,
      bestCombo: 0,
      distinctGamesPlayed: 0,
      highscoresAchieved: 0,
      boxesOpened: 0,
      goodRoundStreak: 0,
      distinctDaysPlayed: 0,
    },
    // Zuletzt gespielter Kalendertag (YYYY-MM-DD) - Grundlage für die
    // "an mehreren Tagen spielen"-Mission, ohne ein Datumsarray zu speichern.
    lastPlayedDay: null,
    // Bereits eingelöste Creator-Codes (rein lokal pro Profil/Browser - siehe
    // js/shop/creatorCodes.js für die globale, serverseitige Nutzungsstatistik).
    redeemedCodes: [],
    // Welche Minispiel-IDs schon mindestens einmal gespielt wurden (für die
    // "Spiele 5 verschiedene Minispiele"-Mission; stats.distinctGamesPlayed
    // ist nur die daraus abgeleitete Zahl, damit Missionen generisch bleiben).
    arcadeGamesPlayed: [],
    claimedMissions: [],
    dailyReward: { lastClaimDate: null, streakDay: 0 },
    settings: { musicVolume: 0.5, sfxVolume: 0.7, vibration: true },
    // Bestwerte pro Minispiel (key = gameId), für Highscore-Anzeige auf den
    // Minispiel-Karten.
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
    // hinzugekommene Felder verlieren - daher hier pro verschachteltem
    // Objekt einzeln mergen statt alles zu überschreiben.
    return {
      ...base,
      ...parsed,
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      dailyReward: { ...base.dailyReward, ...(parsed.dailyReward ?? {}) },
      arcadeHighscores: { ...base.arcadeHighscores, ...(parsed.arcadeHighscores ?? {}) },
      arcadeGamesPlayed: parsed.arcadeGamesPlayed ?? base.arcadeGamesPlayed,
      redeemedCodes: parsed.redeemedCodes ?? base.redeemedCodes,
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

function applyLevelUps(profile) {
  const levelUps = [];
  while (profile.xp >= XP_PER_LEVEL) {
    profile.xp -= XP_PER_LEVEL;
    profile.level++;
    levelUps.push(profile.level);
  }
  return levelUps;
}

// Generischer Weg, Münzen/XP direkt gutzuschreiben (Missionen, Daily-Reward,
// Creator-Codes, Online-Platzierungsbonus, ...) - ohne Highscore-/Minispiel-
// spezifische Logik.
export function grantRewards(profile, { coins = 0, xp = 0 } = {}) {
  profile.coins += coins;
  profile.xp += xp;
  if (coins > 0) profile.stats.coinsEverEarned += coins;
  return applyLevelUps(profile);
}

export function grantCoins(profile, amount) {
  return grantRewards(profile, { coins: amount });
}

// Belohnung aus einer Minispiel-Runde einbuchen (SOLO und ONLINE gemeinsam
// genutzt). gameId/score/maxCombo fließen zusätzlich in die Missionen und
// den Highscore pro Spiel ein.
export function applyArcadeRewards(profile, { gameId, xpEarned, coinsEarned, score, maxCombo = 0, tier = "normal" }) {
  profile.coins += coinsEarned;
  profile.xp += xpEarned;
  profile.stats.arcadeRoundsPlayed = (profile.stats.arcadeRoundsPlayed ?? 0) + 1;
  profile.stats.coinsEverEarned += coinsEarned;
  profile.stats.totalArcadeScore = (profile.stats.totalArcadeScore ?? 0) + Math.max(0, score);
  profile.stats.bestCombo = Math.max(profile.stats.bestCombo ?? 0, maxCombo);

  // "mehrere Runden hintereinander schaffen" - zählt hoch, solange die Runde
  // mindestens "normal" bewertet wurde, sonst zurück auf 0.
  profile.stats.goodRoundStreak = tier === "schwach" ? 0 : (profile.stats.goodRoundStreak ?? 0) + 1;

  // "an mehreren Tagen spielen" - Kalendertag-Wechsel erkennen, ohne eine
  // komplette Historie speichern zu müssen.
  const todayKey = new Date().toISOString().slice(0, 10);
  if (profile.lastPlayedDay !== todayKey) {
    profile.lastPlayedDay = todayKey;
    profile.stats.distinctDaysPlayed = (profile.stats.distinctDaysPlayed ?? 0) + 1;
  }

  if (!profile.arcadeGamesPlayed.includes(gameId)) {
    profile.arcadeGamesPlayed.push(gameId);
    profile.stats.distinctGamesPlayed = profile.arcadeGamesPlayed.length;
  }

  const previousBest = profile.arcadeHighscores[gameId] ?? 0;
  const isNewHighscore = score > previousBest;
  if (isNewHighscore) {
    profile.arcadeHighscores[gameId] = score;
    profile.stats.highscoresAchieved = (profile.stats.highscoresAchieved ?? 0) + 1;
  }

  const levelUps = applyLevelUps(profile);
  return { profile, levelUps, isNewHighscore, previousBest };
}

export function unlockSkin(profile, skinId) {
  if (!profile.unlockedSkins.includes(skinId)) {
    profile.unlockedSkins.push(skinId);
    return true;
  }
  return false;
}
