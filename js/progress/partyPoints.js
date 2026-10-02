// js/progress/partyPoints.js
// Einheitliche, spielübergreifend vergleichbare Wertung.
//
//   Minispiel-Score (bleibt wie er ist)  ->  Leistung 0-100 %  ->  Party-Punkte
//
// Jedes Minispiel meldet neben seinem eigenen Score eine "Leistung" (percent,
// 0-100), in die Genauigkeit, Zeit und Sieg/Niederlage bereits einfließen
// (z.B. Vier gewinnt: Sieg = hoch, Niederlage = niedrig). Daraus entstehen
// Party-Punkte pro Runde:
//
//   Party-Punkte = (5 + 95 x Leistung) x Schwierigkeitsfaktor x 5
//
// LEICHT x1.0 · MITTEL x1.6 · SCHWER x2.4   ->  max. 500 / 800 / 1200 pro Runde
//
// Für die GESAMT-Rangliste zählt je Minispiel und Schwierigkeit nur die
// persönliche BESTLEISTUNG (Summe der Bestwerte). Damit gewinnt nicht, wer
// am meisten spielt, sondern wer in vielen Spielen und auf hohen
// Schwierigkeitsstufen am besten ist. Fortschritt durch häufiges Spielen
// kommt über XP, Level, Münzen und Meilensteine.
export const DIFF_FACTOR = { easy: 1, normal: 1.6, hard: 2.4 };
export const PP_SCALE = 5;

export function partyPointsFor(percent, difficulty = "normal") {
  const perf = Math.max(0, Math.min(100, percent ?? 0)) / 100;
  const f = DIFF_FACTOR[difficulty] ?? 1;
  return Math.round((5 + 95 * perf) * f * PP_SCALE);
}
export const MAX_PP_PER_ENTRY = Math.round(100 * DIFF_FACTOR.hard * PP_SCALE);

export const bestKey = (gameId, difficulty) => `${gameId}|${difficulty}`;

export function totalPartyPoints(profile) {
  return Object.values(profile.partyBest ?? {}).reduce((s, v) => s + (v || 0), 0);
}

// Trägt eine Runde ein. Gibt { gained, previousBest, newBest, isNewBest, total } zurück.
export function recordPartyPoints(profile, gameId, difficulty, percent) {
  if (!profile.partyBest) profile.partyBest = {};
  const k = bestKey(gameId, difficulty);
  const pp = partyPointsFor(percent, difficulty);
  const previousBest = profile.partyBest[k] ?? 0;
  const before = totalPartyPoints(profile);
  const isNewBest = pp > previousBest;
  if (isNewBest) profile.partyBest[k] = pp;
  const total = totalPartyPoints(profile);
  profile.stats.partyPoints = total;
  return { roundPoints: pp, previousBest, newBest: Math.max(pp, previousBest), isNewBest, gained: total - before, total };
}
