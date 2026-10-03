// js/rewards/profile.js
// Persistentes Profil: Name, Level, XP, Münzen, Skins, Kosmetik, Statistiken,
// Highscores und Party-Punkte. storage ist injizierbar (Default:
// window.localStorage), damit dies auch ohne Browser (Tests) funktioniert.
//
// Fortschritt (siehe js/progress/): XP -> Level -> Level-Belohnungen,
// Meilensteine, Party-Punkte (vergleichbare Gesamtwertung). Skins bleiben
// bewusst ein Langzeitziel und kommen nur aus Boxen (Drop-Raten unverändert).
import { xpNeeded, applyLevelReward } from "../progress/levels.js";
import { addSpin } from "../progress/rewardOps.js";
import { ensureCosmetics } from "../progress/cosmetics.js";

// KOMPLETT-RESET (Oktober 2026): Der Spielstand liegt im Browser jedes Geräts.
// Durch den neuen Schlüssel starten ALLE Geräte beim nächsten Öffnen mit einem
// frischen Konto bei null (neuer Spielerschlüssel, kein Level/keine Münzen/Skins).
// Der alte Spielstand wird dabei gelöscht. Für einen weiteren Reset später
// einfach die Nummer erhöhen (und server/leaderboard.js EPOCH ändern).
const STORAGE_KEY = "nwo_profile_v2";
const LEGACY_KEYS = ["nwo_profile_v1"];
const PROGRESS_VERSION = 2;

// Aus dem Spiel entfernte Inhalte: werden beim Laden alter Spielstände
// bereinigt, damit nirgends (Spind, Highscores, Missionen) Reste auftauchen.
const REMOVED_SKIN_IDS = ["mayo"];
const REMOVED_GAME_IDS = ["meteorDash", "starCatcher"];

// Alle N gespielten Runden gibt es einen Bonus-Dreh am Glücksrad - aber
// höchstens MAX_ROUND_SPINS_PER_DAY pro Tag (langfristiges System).
export const ROUNDS_PER_BONUS_SPIN = 6;
export const MAX_ROUND_SPINS_PER_DAY = 3;

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

function makeKey() {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch { /* ignore */ }
  return "k" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function defaultProfile() {
  return {
    progressVersion: PROGRESS_VERSION,
    playerKey: makeKey(), // geheimer Schlüssel für die Rangliste (verlässt das Gerät nur Richtung Server)
    nickname: null,
    welcomed: false, // Willkommens-/Namensabfrage schon gezeigt?
    level: 1,
    xp: 0,
    rewardedLevel: 1, // bis zu diesem Level wurden Level-Belohnungen schon vergeben
    coins: 0,
    unlockedSkins: ["mario"],
    equippedSkin: "mario",
    cosmetics: { owned: [], equipped: {} },
    bonusBoxes: 0, // Mini-Boxen (kosmetische Bonusboxen, keine Skins)
    vouchers: {}, // Gratis-Boxen, z.B. { basic: 1 }
    stats: {
      coinsEverEarned: 0,
      arcadeRoundsPlayed: 0,
      totalArcadeScore: 0,
      bestCombo: 0,
      distinctGamesPlayed: 0,
      highscoresAchieved: 0,
      boxesOpened: 0,
      wheelSpins: 0,
      goodRoundStreak: 0,
      distinctDaysPlayed: 0,
      partyPoints: 0,
      gamesWon: 0,
      perfectRounds: 0,
      treasuresFound: 0,
      wins_connectFour: 0,
      onlineRoundsPlayed: 0,
      xpEverEarned: 0,
      hardRoundsPlayed: 0,
    },
    lastPlayedDay: null,
    wheel: { lastFreeDay: null, bonusSpins: 0 },
    redeemedCodes: [],
    arcadeGamesPlayed: [],
    hardGamesPlayed: [], // verschiedene Spiele, die schon auf SCHWER gespielt wurden
    claimedMissions: [],
    milestonesDone: [],
    daily: { day: null, rounds: 0, games: [], done: [], highscoreRewards: 0, roundSpins: 0, wins: 0, hard: 0, xp: 0, claimedMissions: [] },
    dailyReward: { lastClaimDate: null, streakDay: 0 },
    settings: { musicVolume: 0.5, sfxVolume: 0.7, vibration: true },
    arcadeHighscores: {}, // bester Score pro Minispiel (über alle Schwierigkeiten)
    arcadeHighscoresByDiff: {}, // { gameId: { easy, normal, hard } }
    partyBest: {}, // { "gameId|difficulty": beste Party-Punkte } -> Summe = Gesamtwertung
  };
}

export let wasReset = false; // true, wenn auf diesem Gerät gerade ein alter Spielstand zurückgesetzt wurde
export function loadProfile(storage = safeStorage()) {
  try {
    for (const k of LEGACY_KEYS) {
      if (storage.getItem(k) != null) { wasReset = true; try { storage.removeItem?.(k); } catch { /* ignore */ } }
    }
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw);
    const base = defaultProfile();
    // Pro verschachteltem Objekt einzeln mergen, damit neu hinzugekommene
    // Felder aus älteren Spielständen nicht verloren gehen.
    const merged = {
      ...base,
      ...parsed,
      playerKey: parsed.playerKey || base.playerKey,
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      dailyReward: { ...base.dailyReward, ...(parsed.dailyReward ?? {}) },
      wheel: { ...base.wheel, ...(parsed.wheel ?? {}) },
      daily: { ...base.daily, ...(parsed.daily ?? {}) },
      arcadeHighscores: { ...base.arcadeHighscores, ...(parsed.arcadeHighscores ?? {}) },
      arcadeHighscoresByDiff: { ...(parsed.arcadeHighscoresByDiff ?? {}) },
      partyBest: { ...(parsed.partyBest ?? {}) },
      vouchers: { ...(parsed.vouchers ?? {}) },
      arcadeGamesPlayed: parsed.arcadeGamesPlayed ?? base.arcadeGamesPlayed,
      hardGamesPlayed: parsed.hardGamesPlayed ?? base.hardGamesPlayed,
      redeemedCodes: parsed.redeemedCodes ?? base.redeemedCodes,
      milestonesDone: parsed.milestonesDone ?? base.milestonesDone,
    };
    ensureCosmetics(merged);
    migrate(merged, parsed);
    return sanitizeRemovedContent(merged);
  } catch {
    return defaultProfile();
  }
}

// Alte Spielstände (vor dem Fortschrittssystem) übernehmen: Level/XP/Münzen/
// Skins bleiben exakt erhalten. Kosmetische Level-Belohnungen bis zum
// aktuellen Level werden still nachgereicht, Münzen/Drehs/Boxen NICHT
// (kein Belohnungs-Flood, kein Eingriff in die Skin-Balance).
function migrate(p, parsed) {
  if ((parsed.progressVersion ?? 1) < 2) {
    for (let l = 2; l <= p.level; l++) applyLevelReward(p, l, { silent: true });
    p.rewardedLevel = p.level;
    // Bisheriger Highscore pro Spiel zählt als bisheriger Bestwert auf MITTEL
    // (vorher gab es keine Schwierigkeit im Score).
    for (const [gid, best] of Object.entries(p.arcadeHighscores)) {
      p.arcadeHighscoresByDiff[gid] = { normal: best, ...(p.arcadeHighscoresByDiff[gid] ?? {}) };
    }
    p.progressVersion = PROGRESS_VERSION;
  }
  p.wheel.bonusSpins = Math.min(p.wheel.bonusSpins ?? 0, 6);
}

// Entfernte Skins/Minispiele aus alten Spielständen tilgen.
function sanitizeRemovedContent(profile) {
  profile.unlockedSkins = (profile.unlockedSkins ?? []).filter((id) => !REMOVED_SKIN_IDS.includes(id));
  if (!profile.unlockedSkins.includes("mario")) profile.unlockedSkins.unshift("mario");
  if (!profile.equippedSkin || REMOVED_SKIN_IDS.includes(profile.equippedSkin) || !profile.unlockedSkins.includes(profile.equippedSkin)) {
    profile.equippedSkin = "mario";
  }
  for (const gid of REMOVED_GAME_IDS) {
    delete profile.arcadeHighscores[gid];
    delete profile.arcadeHighscoresByDiff[gid];
    for (const k of Object.keys(profile.partyBest)) if (k.startsWith(gid + "|")) delete profile.partyBest[k];
  }
  profile.arcadeGamesPlayed = profile.arcadeGamesPlayed.filter((id) => !REMOVED_GAME_IDS.includes(id));
  profile.stats.distinctGamesPlayed = profile.arcadeGamesPlayed.length;
  profile.stats.partyPoints = Object.values(profile.partyBest).reduce((s, v) => s + (v || 0), 0);
  return profile;
}

export function saveProfile(profile, storage = safeStorage()) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* Speicher voll/gesperrt - Spiel läuft weiter */ }
  return profile;
}

function safeStorage() {
  try { if (typeof window !== "undefined" && window.localStorage) return window.localStorage; } catch { /* ignore */ }
  const mem = {};
  return {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = v; },
    removeItem: (k) => { delete mem[k]; },
  };
}

// Tageswerte (Tagesziele) beim Tageswechsel zurücksetzen.
export function ensureDaily(profile, now = new Date()) {
  const k = dayKey(now);
  if (profile.daily.day !== k) {
    profile.daily = { day: k, rounds: 0, games: [], done: [], highscoreRewards: 0, roundSpins: 0, wins: 0, hard: 0, xp: 0, claimedMissions: [] };
  }
  for (const f of ["wins", "hard", "xp"]) if (typeof profile.daily[f] !== "number") profile.daily[f] = 0;
  if (!Array.isArray(profile.daily.claimedMissions)) profile.daily.claimedMissions = [];
  return profile.daily;
}

// Level-Ups verarbeiten; jedes neue Level löst seine Belohnung aus.
function applyLevelUps(profile) {
  const levelUps = [];
  while (profile.xp >= xpNeeded(profile.level)) {
    profile.xp -= xpNeeded(profile.level);
    profile.level++;
    levelUps.push(profile.level);
    if (profile.level > (profile.rewardedLevel ?? 1)) {
      applyLevelReward(profile, profile.level);
      profile.rewardedLevel = profile.level;
    }
  }
  return levelUps;
}

// Generischer Weg, Münzen/XP direkt gutzuschreiben (Missionen, Daily-Reward,
// Creator-Codes, Rad, Meilensteine ...).
export function grantRewards(profile, { coins = 0, xp = 0 } = {}) {
  profile.coins += coins;
  profile.xp += xp;
  if (coins > 0) profile.stats.coinsEverEarned += coins;
  if (xp > 0) { profile.stats.xpEverEarned = (profile.stats.xpEverEarned ?? 0) + xp; ensureDaily(profile).xp += xp; }
  return applyLevelUps(profile);
}

export function grantCoins(profile, amount) {
  return grantRewards(profile, { coins: amount });
}

// Basis-Buchung einer Minispiel-Runde (SOLO und ONLINE): Münzen, XP,
// Statistiken, Highscore (je Spiel UND Schwierigkeit), Bonus-Dreh-Zähler.
// Party-Punkte und Meilensteine setzt progress/roundResult.js obendrauf.
export function applyArcadeRewards(profile, {
  gameId, xpEarned, coinsEarned, score, maxCombo = 0, tier = "normal",
  difficulty = "normal", won = false, lowerIsBetter = false, online = false,
}) {
  const daily = ensureDaily(profile);
  profile.coins += coinsEarned;
  profile.xp += xpEarned;
  profile.stats.xpEverEarned = (profile.stats.xpEverEarned ?? 0) + xpEarned;
  daily.xp += xpEarned;
  profile.stats.arcadeRoundsPlayed = (profile.stats.arcadeRoundsPlayed ?? 0) + 1;
  if (online) profile.stats.onlineRoundsPlayed = (profile.stats.onlineRoundsPlayed ?? 0) + 1;
  profile.stats.coinsEverEarned += coinsEarned;
  if (!lowerIsBetter) profile.stats.totalArcadeScore = (profile.stats.totalArcadeScore ?? 0) + Math.max(0, score);
  profile.stats.bestCombo = Math.max(profile.stats.bestCombo ?? 0, maxCombo);
  profile.stats.goodRoundStreak = tier === "schwach" ? 0 : (profile.stats.goodRoundStreak ?? 0) + 1;
  if (tier === "perfekt") profile.stats.perfectRounds = (profile.stats.perfectRounds ?? 0) + 1;
  if (difficulty === "hard") {
    profile.stats.hardRoundsPlayed = (profile.stats.hardRoundsPlayed ?? 0) + 1; daily.hard++;
    if (!profile.hardGamesPlayed.includes(gameId)) profile.hardGamesPlayed.push(gameId);
  }
  if (won) {
    daily.wins++;
    profile.stats.gamesWon = (profile.stats.gamesWon ?? 0) + 1;
    const wk = `wins_${gameId}`;
    profile.stats[wk] = (profile.stats[wk] ?? 0) + 1;
  }

  const todayKey = dayKey();
  if (profile.lastPlayedDay !== todayKey) {
    profile.lastPlayedDay = todayKey;
    profile.stats.distinctDaysPlayed = (profile.stats.distinctDaysPlayed ?? 0) + 1;
  }
  daily.rounds++;
  if (!daily.games.includes(gameId)) daily.games.push(gameId);

  if (!profile.arcadeGamesPlayed.includes(gameId)) {
    profile.arcadeGamesPlayed.push(gameId);
    profile.stats.distinctGamesPlayed = profile.arcadeGamesPlayed.length;
  }

  // Highscore je Spiel + Schwierigkeit (bei "weniger ist besser" z.B. Reaktionszeit: Minimum)
  const byDiff = (profile.arcadeHighscoresByDiff[gameId] ??= {});
  const prevDiffBest = byDiff[difficulty] ?? null;
  const better = (a, b) => (lowerIsBetter ? a > 0 && (b == null || a < b) : (b == null ? a > 0 : a > b));
  const isNewHighscore = better(score, prevDiffBest);
  const previousBest = prevDiffBest ?? 0;
  if (isNewHighscore) {
    byDiff[difficulty] = score;
    profile.stats.highscoresAchieved = (profile.stats.highscoresAchieved ?? 0) + 1;
  }
  // Gesamtbestwert pro Spiel (für die Spielkarten) bleibt erhalten
  const overall = profile.arcadeHighscores[gameId];
  if (overall == null || better(score, overall)) profile.arcadeHighscores[gameId] = score;

  // Bonus-Dreh alle N Runden, höchstens MAX_ROUND_SPINS_PER_DAY pro Tag
  let bonusSpinEarned = false;
  if (profile.stats.arcadeRoundsPlayed % ROUNDS_PER_BONUS_SPIN === 0 && (daily.roundSpins ?? 0) < MAX_ROUND_SPINS_PER_DAY) {
    const r = addSpin(profile, 1);
    daily.roundSpins = (daily.roundSpins ?? 0) + 1;
    bonusSpinEarned = r.gained > 0;
  }

  const levelUps = applyLevelUps(profile);
  return { profile, levelUps, isNewHighscore, previousBest, bonusSpinEarned };
}

export function unlockSkin(profile, skinId) {
  if (!profile.unlockedSkins.includes(skinId)) {
    profile.unlockedSkins.push(skinId);
    return true;
  }
  return false;
}

// --- Spielername --------------------------------------------------------
export const NICK_MIN = 3, NICK_MAX = 14;
export function validateNickname(raw) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < NICK_MIN) return { ok: false, reason: `Mindestens ${NICK_MIN} Zeichen.` };
  if (name.length > NICK_MAX) return { ok: false, reason: `Höchstens ${NICK_MAX} Zeichen.` };
  if (!/^[A-Za-z0-9ÄÖÜäöüß _\-.]+$/.test(name)) return { ok: false, reason: "Nur Buchstaben, Zahlen, Leerzeichen, _ - . erlaubt." };
  return { ok: true, name };
}
