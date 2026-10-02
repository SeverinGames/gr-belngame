// js/rewards/wheel.js
// Glücksrad: Langzeit-Bonus-System, bewusst NICHT übermächtig.
// Drehs: 1 kostenloser pro Kalendertag + erspielbare Bonus-Drehs (alle 6
// Runden, max. 3x pro Tag; außerdem Level-Ups, Meilensteine, Daily-Serie und
// ein seltenes Rad-Feld). Der Vorrat ist auf MAX_BONUS_SPINS gedeckelt.
// Die 16 gleich großen Felder sind zugleich die echten Wahrscheinlichkeiten
// (was man sieht, ist was man bekommt). Skins gibt es nur über eine seltene
// Gratis Basic Box (1/16) - dieselben Drop-Raten wie im Shop.
import { grantRewards, dayKey } from "./profile.js";
import { addSpin, addMiniBoxes, describeRewardObj } from "../progress/rewardOps.js";
import { randomUnownedCosmetic, unlockCosmetic } from "../progress/cosmetics.js";

// Reihenfolge = Reihenfolge auf dem Rad (im Uhrzeigersinn ab oben)
export const WHEEL_SLICES = [
  { coins: 50 }, { coins: 90 }, { xp: 60 }, { coins: 50 },
  { coins: 180 }, { coins: 90 }, { xp: 60 }, { boxId: "basic" },
  { coins: 50 }, { miniBox: 1 }, { xp: 150 }, { coins: 50 },
  { cosmetic: true }, { coins: 90 }, { spin: 1 }, { coins: 300 },
];

export function sliceLabel(sl) {
  if (sl.boxId) return "📦";
  if (sl.miniBox) return "🎁";
  if (sl.cosmetic) return "🎖️";
  if (sl.spin) return "🎡+1";
  if (sl.coins) return `${sl.coins}🪙`;
  return `${sl.xp}XP`;
}
export function describeSlice(sl) {
  if (sl.boxId) return "eine Gratis Basic Box";
  if (sl.cosmetic) return "ein kosmetisches Profil-Geschenk";
  return describeRewardObj(sl);
}

export function canFreeSpin(profile, now = new Date()) {
  return profile.wheel.lastFreeDay !== dayKey(now);
}
export function spinsAvailable(profile, now = new Date()) {
  return (canFreeSpin(profile, now) ? 1 : 0) + (profile.wheel.bonusSpins ?? 0);
}

// Verbraucht einen Dreh (erst den kostenlosen, dann Bonus-Drehs), würfelt das
// Feld aus und bucht die Belohnung sofort ein. Box-Felder öffnet der
// Aufrufer (main.js) anschließend per grantFreeBox.
export function spinWheel(profile, rng = Math.random, now = new Date()) {
  if (spinsAvailable(profile, now) <= 0) return { success: false, reason: "no-spins" };
  let source;
  if (canFreeSpin(profile, now)) { profile.wheel.lastFreeDay = dayKey(now); source = "free"; }
  else { profile.wheel.bonusSpins--; source = "bonus"; }
  profile.stats.wheelSpins = (profile.stats.wheelSpins ?? 0) + 1;

  const index = Math.floor(rng() * WHEEL_SLICES.length);
  let slice = { ...WHEEL_SLICES[index] };
  let text = describeSlice(slice);
  let levelUps = [];
  if (slice.coins || slice.xp) levelUps = grantRewards(profile, { coins: slice.coins ?? 0, xp: slice.xp ?? 0 });
  if (slice.miniBox) addMiniBoxes(profile, slice.miniBox);
  if (slice.spin) {
    const r = addSpin(profile, slice.spin);
    if (r.overflowCoins) text += ` (Vorrat voll: +${r.overflowCoins} 🪙)`;
  }
  if (slice.cosmetic) {
    const pick = randomUnownedCosmetic(profile, rng);
    if (pick) {
      unlockCosmetic(profile, pick.cat, pick.id);
      slice.cosmeticPick = pick;
      text = describeRewardObj({ cosmetic: `${pick.cat}:${pick.id}` });
    } else {
      levelUps = grantRewards(profile, { coins: 200 });
      text = "+200 🪙 (alles Kosmetische schon gesammelt)";
    }
  }
  return { success: true, index, slice, text, source, levelUps };
}
