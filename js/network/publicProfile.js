// js/network/publicProfile.js - baut das ÖFFENTLICHE Profil (nur harmlose Daten).
// NIE enthalten: Münzen, Spielerschlüssel, Gutscheine, Creator Codes, Tagesdaten.
import { publicLoadout } from "../progress/cosmetics.js";
import { ensureCosmetics } from "../progress/cosmetics.js";

export function buildPublicProfile(profile) {
  const badges = ensureCosmetics(profile).owned.filter((k) => k.startsWith("badge:")).map((k) => k.slice(6));
  const hs = {};
  for (const [g, v] of Object.entries(profile.arcadeHighscoresByDiff ?? {})) {
    hs[g] = { easy: v.easy ?? null, normal: v.normal ?? null, hard: v.hard ?? null };
  }
  const st = profile.stats;
  return {
    skin: profile.equippedSkin ?? "mario", level: profile.level, xp: profile.xp,
    loadout: publicLoadout(profile),
    stats: { rounds: st.arcadeRoundsPlayed, wins: st.gamesWon, highscores: st.highscoresAchieved, perfect: st.perfectRounds, treasures: st.treasuresFound, days: st.distinctDaysPlayed },
    skins: profile.unlockedSkins.length, cosmetics: ensureCosmetics(profile).owned.length,
    badges, hs,
  };
}
