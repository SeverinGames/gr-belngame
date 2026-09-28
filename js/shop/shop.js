// js/shop/shop.js
// Der neue Shop ersetzt das alte Schlüssel-System: Münzen aus Minispielen,
// Missionen und der täglichen Belohnung werden hier gegen Boxen mit
// unterschiedlicher Wertigkeit eingetauscht. Jede Box hat eine eigene
// Drop-Tabelle - je teurer die Box, desto besser die Chancen auf seltene
// Skins (BASIC/SUPER/MEGA, Punkt 7 des Prompts).
import { SKINS, RARITY } from "../skins/skins.js";
import { unlockSkin } from "../rewards/profile.js";

// Nur Skins, die tatsächlich aus einer Box kommen dürfen - Mario ist Starter,
// Löndi kommt exklusiv per Mission. Beide dürfen die Box-Wahrscheinlichkeiten
// nicht verzerren.
function boxEligibleSkins() {
  return SKINS.filter((s) => s.unlockMethod !== "mission" && s.unlockMethod !== "starter");
}

// Gewichte pro Rarity und Box-Stufe. MEGA enthält absichtlich keine
// "superRare"-Gewichtung mehr -> garantierte Mindestseltenheit "Episch".
export const BOX_DEFS = {
  basic: {
    id: "basic",
    name: "Basic Box",
    icon: "📦",
    price: 500,
    tagline: "Günstiger Einstieg mit kleiner Chance auf Seltenes.",
    weights: { superRare: 55, epic: 30, mythic: 12, legendary: 2.6, superLegendary: 0.35, exotic: 0.08, unlimited: 0.01 },
  },
  super: {
    id: "super",
    name: "Super Box",
    icon: "🎁",
    price: 1500,
    tagline: "Bessere Skins, deutlich bessere Chancen.",
    weights: { superRare: 22, epic: 40, mythic: 27, legendary: 9, superLegendary: 1.6, exotic: 0.35, unlimited: 0.05 },
  },
  mega: {
    id: "mega",
    name: "Mega Box",
    icon: "💎",
    price: 4000,
    tagline: "Garantiert mindestens „Episch“ – die besten Chancen im Spiel.",
    weights: { epic: 32, mythic: 36, legendary: 24, superLegendary: 6, exotic: 1.6, unlimited: 0.4 },
  },
};

export function listBoxes() {
  return Object.values(BOX_DEFS);
}

export function getDropTable(boxId) {
  const def = BOX_DEFS[boxId];
  if (!def) return [];
  const dropable = boxEligibleSkins().filter((s) => (def.weights[s.rarity] ?? 0) > 0);
  const total = dropable.reduce((sum, s) => sum + def.weights[s.rarity], 0);
  return dropable.map((s) => ({
    skin: s,
    chancePercent: +((def.weights[s.rarity] / total) * 100).toFixed(2),
  }));
}

// rng: Funktion, die eine Zahl in [0,1) liefert (z.B. Math.random)
export function purchaseBox(profile, boxId, rng = Math.random) {
  const def = BOX_DEFS[boxId];
  if (!def) return { success: false, reason: "unknown-box" };
  if (profile.coins < def.price) return { success: false, reason: "not-enough-coins" };

  profile.coins -= def.price;
  return openBoxInternal(profile, boxId, rng, def.price);
}

// Kostenlose Box-Öffnung (z.B. Jackpot-Tag der täglichen Belohnung) - exakt
// dieselbe Drop-Logik wie ein Kauf, nur ohne Münzabzug.
export function grantFreeBox(profile, boxId, rng = Math.random) {
  const def = BOX_DEFS[boxId];
  if (!def) return { success: false, reason: "unknown-box" };
  return openBoxInternal(profile, boxId, rng, def.price);
}

function openBoxInternal(profile, boxId, rng, referencePrice) {
  const def = BOX_DEFS[boxId];
  profile.stats.boxesOpened = (profile.stats.boxesOpened ?? 0) + 1;

  const table = getDropTable(boxId);
  const total = table.reduce((sum, e) => sum + e.chancePercent, 0);
  let roll = rng() * total;
  let picked = table[table.length - 1].skin;
  for (const entry of table) {
    roll -= entry.chancePercent;
    if (roll <= 0) { picked = entry.skin; break; }
  }

  const isNew = unlockSkin(profile, picked.id);
  // Duplikat wird in kleine Münzentschädigung umgewandelt (kein Feature-Loch)
  const compensationCoins = isNew ? 0 : Math.round(referencePrice * 0.12 * (RARITY[picked.rarity].particles + 1));
  if (!isNew) {
    profile.coins += compensationCoins;
    profile.stats.coinsEverEarned += compensationCoins;
  }

  return { success: true, boxId, skin: picked, isNew, compensationCoins };
}
