// js/progress/rewardOps.js
// Gemeinsame, einfache Belohnungs-Bausteine ohne Abhängigkeit zu profile.js
// (damit Level-/Meilenstein-Logik keine Import-Zyklen erzeugt).
import { pushEvent } from "./events.js";

export const MAX_BONUS_SPINS = 6; // Vorrat an Bonus-Drehs ist gedeckelt (langfristiges System)

export function addCoinsRaw(profile, n) {
  if (!n) return;
  profile.coins += n;
  if (n > 0) profile.stats.coinsEverEarned += n;
}

// Gibt zurück, wie viele Drehs wirklich gutgeschrieben wurden. Überschuss
// wird in Münzen umgewandelt, damit nichts verfällt.
export function addSpin(profile, n = 1) {
  const have = profile.wheel.bonusSpins ?? 0;
  const gained = Math.max(0, Math.min(n, MAX_BONUS_SPINS - have));
  profile.wheel.bonusSpins = have + gained;
  const overflow = n - gained;
  if (overflow > 0) addCoinsRaw(profile, overflow * 100);
  return { gained, overflowCoins: overflow * 100 };
}

export function addMiniBoxes(profile, n = 1) {
  profile.bonusBoxes = (profile.bonusBoxes ?? 0) + n;
}
export function addVoucher(profile, boxId, n = 1) {
  if (!profile.vouchers) profile.vouchers = {};
  profile.vouchers[boxId] = (profile.vouchers[boxId] ?? 0) + n;
}

// Menschlich lesbare Beschreibung eines Belohnungs-Objekts
// { coins, xp, spin, miniBox, voucher:"basic", cosmetic:"badge:star", note }
import { getCosmetic, COSMETIC_CATEGORIES } from "./cosmetics.js";
export function describeRewardObj(r) {
  const parts = [];
  if (r.coins) parts.push(`+${r.coins} 🪙`);
  if (r.xp) parts.push(`+${r.xp} XP`);
  if (r.spin) parts.push(`+${r.spin} Bonus-Dreh${r.spin > 1 ? "s" : ""} 🎡`);
  if (r.miniBox) parts.push(`+${r.miniBox} Mini-Box 🎁`);
  if (r.voucher) parts.push("Gratis Basic Box 📦");
  if (r.cosmetic) {
    const [cat, id] = r.cosmetic.split(":");
    const c = getCosmetic(cat, id);
    if (c) parts.push(`${COSMETIC_CATEGORIES[cat].single} ${c.icon ?? ""} ${c.name}`.replace("  ", " "));
  }
  return parts.join(" · ");
}
export { pushEvent };
