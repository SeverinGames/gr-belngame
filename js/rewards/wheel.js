// js/rewards/wheel.js
// Glücksrad: kleines, bewusst NICHT übermächtiges Bonus-System für die
// Langzeitmotivation. 1 kostenloser Dreh pro Kalendertag + 1 Bonus-Dreh je
// ROUNDS_PER_BONUS_SPIN gespielter Minispiel-Runden. Die 16 gleich großen
// Felder sind zugleich die echten Wahrscheinlichkeiten (was man sieht, ist
// was man bekommt). Erwartungswert ~45 Münzen + etwas XP pro Dreh und nur
// eine kleine Chance (1/16) auf eine Basic Box - reicht für Spielreiz, aber
// nicht, um die Skin-Sammlung abzukürzen.
import { grantRewards } from "./profile.js";

// Reihenfolge = Reihenfolge auf dem Rad (im Uhrzeigersinn ab oben)
export const WHEEL_SLICES = [
  { coins: 25 }, { coins: 50 }, { xp: 40 }, { coins: 25 },
  { coins: 100 }, { coins: 50 }, { xp: 40 }, { coins: 25 },
  { boxId: "basic" }, { coins: 50 }, { xp: 100 }, { coins: 25 },
  { coins: 100 }, { xp: 40 }, { coins: 200 }, { coins: 50 },
];

export function sliceLabel(sl) {
  if (sl.boxId) return "📦";
  if (sl.coins) return `${sl.coins}🪙`;
  return `${sl.xp}XP`;
}
export function describeSlice(sl) {
  if (sl.boxId) return "eine Gratis Basic Box";
  const parts = [];
  if (sl.coins) parts.push(`+${sl.coins} 🪙`);
  if (sl.xp) parts.push(`+${sl.xp} XP`);
  return parts.join(" ");
}

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

export function canFreeSpin(profile, now = new Date()) {
  return profile.wheel.lastFreeDay !== dayKey(now);
}
export function spinsAvailable(profile, now = new Date()) {
  return (canFreeSpin(profile, now) ? 1 : 0) + (profile.wheel.bonusSpins ?? 0);
}

// Verbraucht einen Dreh (erst den kostenlosen, dann Bonus-Drehs), würfelt das
// Feld aus und bucht Münzen/XP sofort ein. Für Box-Felder öffnet der Aufrufer
// (main.js) anschließend die Box (grantFreeBox + Öffnungsanimation).
export function spinWheel(profile, rng = Math.random, now = new Date()) {
  if (spinsAvailable(profile, now) <= 0) return { success: false, reason: "no-spins" };
  let source;
  if (canFreeSpin(profile, now)) { profile.wheel.lastFreeDay = dayKey(now); source = "free"; }
  else { profile.wheel.bonusSpins--; source = "bonus"; }
  profile.stats.wheelSpins = (profile.stats.wheelSpins ?? 0) + 1;

  const index = Math.floor(rng() * WHEEL_SLICES.length);
  const slice = WHEEL_SLICES[index];
  let levelUps = [];
  if (slice.coins || slice.xp) levelUps = grantRewards(profile, { coins: slice.coins ?? 0, xp: slice.xp ?? 0 });
  return { success: true, index, slice, source, levelUps };
}
