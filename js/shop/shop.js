// js/shop/shop.js
// Der neue Shop ersetzt das alte Schlüssel-System: Münzen aus Minispielen,
// Missionen und der täglichen Belohnung werden hier gegen Boxen mit
// unterschiedlicher Wertigkeit eingetauscht. Jede Box hat eine eigene
// Drop-Tabelle - je teurer die Box, desto besser die Chancen auf seltene
// Skins (BASIC/SUPER/MEGA, Punkt 7 des Prompts).
import { SKINS } from "../skins/skins.js";
import { unlockSkin, grantRewards } from "../rewards/profile.js";
import { BOX_UNLOCK_LEVEL } from "../progress/levels.js";
import { randomUnownedCosmetic, unlockCosmetic } from "../progress/cosmetics.js";
import { addSpin, addCoinsRaw, describeRewardObj } from "../progress/rewardOps.js";

// Nur Skins, die tatsächlich aus einer Box kommen dürfen - Mario ist Starter,
// Löndi kommt exklusiv per Mission. Beide dürfen die Box-Wahrscheinlichkeiten
// nicht verzerren.
function boxEligibleSkins() {
  return SKINS.filter((s) => s.unlockMethod !== "mission" && s.unlockMethod !== "starter");
}

// Gewichte pro Rarity und Box-Stufe (Summe muss nicht 100 sein - es wird auf
// die tatsächlich droppbaren Skins normiert). Ziel: Langzeit-Sammeln.
// Die Skin-Sammlung soll sich über viele Boxen strecken, deshalb bleiben die
// hohen Stufen auch in der Mega Box selten (Mythisch ~1 von 5, Superlegendär
// ~1 von 20, Exotisch ~1 von 80, Unlimited ~1 von 500). Doppelte Skins geben
// nur eine kleine Münzen-Entschädigung (DUPLICATE_COINS), damit man sich den
// Rest nicht "zurückerspielt".
export const BOX_DEFS = {
  basic: {
    id: "basic",
    name: "Basic Box",
    icon: "📦",
    price: 7500,
    tagline: "Meist Häufiges - mit kleiner Chance auf Seltenes.",
    weights: { superRare: 72, epic: 22, mythic: 4.6, superLegendary: 1.1, exotic: 0.25, unlimited: 0.05 },
  },
  super: {
    id: "super",
    name: "Super Box",
    icon: "🎁",
    price: 20000,
    tagline: "Bessere Chancen auf Episches und Mythisches.",
    weights: { superRare: 46, epic: 37, mythic: 13, superLegendary: 3.2, exotic: 0.7, unlimited: 0.1 },
  },
  mega: {
    id: "mega",
    name: "Mega Box",
    icon: "💎",
    price: 45000,
    tagline: "Die besten Chancen - aber auch hier bleibt das Beste selten.",
    weights: { superRare: 26, epic: 46, mythic: 21, superLegendary: 5.5, exotic: 1.3, unlimited: 0.2 },
  },
};

// Münzen-Entschädigung für Duplikate (nach Seltenheit, unabhängig von der Box)
const DUPLICATE_COINS = {
  common: 10, rare: 20, superRare: 40, epic: 90, legendary: 180,
  mythic: 300, superLegendary: 600, exotic: 1000, unlimited: 2000,
};

export function listBoxes() {
  return Object.values(BOX_DEFS).map((b) => ({ ...b, unlockLevel: BOX_UNLOCK_LEVEL[b.id] ?? 1 }));
}

// Mini-Box: kleine Bonusbox OHNE Skins (Münzen, XP, Kosmetik, Bonus-Dreh).
// Kommt aus Level-Ups/Meilensteinen/Rad oder kostet MINI_BOX_PRICE Münzen.
export const MINI_BOX_PRICE = 300;
export const MINI_BOX_TABLE = [
  { w: 36, kind: "coins", min: 60, max: 180 },
  { w: 24, kind: "xp", min: 60, max: 160 },
  { w: 20, kind: "cosmetic" },
  { w: 12, kind: "spin" },
  { w: 8, kind: "coins", min: 300, max: 500, jackpot: true },
];
export function openMiniBox(profile, rng = Math.random) {
  const total = MINI_BOX_TABLE.reduce((s, e) => s + e.w, 0);
  let roll = rng() * total, e = MINI_BOX_TABLE[0];
  for (const entry of MINI_BOX_TABLE) { roll -= entry.w; if (roll <= 0) { e = entry; break; } }
  let reward = {}, levelUps = [];
  if (e.kind === "coins") {
    const amount = Math.round((e.min + rng() * (e.max - e.min)) / 10) * 10;
    reward = { coins: amount };
    levelUps = grantRewards(profile, reward);
  } else if (e.kind === "xp") {
    reward = { xp: Math.round(e.min + rng() * (e.max - e.min)) };
    levelUps = grantRewards(profile, reward);
  } else if (e.kind === "spin") {
    reward = { spin: 1 };
    addSpin(profile, 1);
  } else {
    const pick = randomUnownedCosmetic(profile, rng);
    if (pick) { unlockCosmetic(profile, pick.cat, pick.id); reward = { cosmetic: `${pick.cat}:${pick.id}` }; }
    else { reward = { coins: 200 }; levelUps = grantRewards(profile, reward); }
  }
  profile.stats.miniBoxesOpened = (profile.stats.miniBoxesOpened ?? 0) + 1;
  return { success: true, reward, text: describeRewardObj(reward), jackpot: !!e.jackpot, levelUps };
}
export function buyMiniBox(profile, rng = Math.random) {
  if ((profile.bonusBoxes ?? 0) > 0) { profile.bonusBoxes--; return openMiniBox(profile, rng); }
  if (profile.coins < MINI_BOX_PRICE) return { success: false, reason: "not-enough-coins" };
  profile.coins -= MINI_BOX_PRICE;
  return openMiniBox(profile, rng);
}

// Gratis-Box-Gutschein einlösen (aus Level-Ups/Meilensteinen)
export function redeemVoucher(profile, boxId, rng = Math.random) {
  if (!(profile.vouchers?.[boxId] > 0)) return { success: false, reason: "no-voucher" };
  profile.vouchers[boxId]--;
  return grantFreeBox(profile, boxId, rng);
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
  if ((profile.level ?? 1) < (BOX_UNLOCK_LEVEL[boxId] ?? 1)) return { success: false, reason: "locked" };
  if (profile.coins < def.price) return { success: false, reason: "not-enough-coins" };

  profile.coins -= def.price;
  return openBoxInternal(profile, boxId, rng);
}

// Kostenlose Box-Öffnung (z.B. Jackpot-Tag der täglichen Belohnung) - exakt
// dieselbe Drop-Logik wie ein Kauf, nur ohne Münzabzug.
export function grantFreeBox(profile, boxId, rng = Math.random) {
  const def = BOX_DEFS[boxId];
  if (!def) return { success: false, reason: "unknown-box" };
  return openBoxInternal(profile, boxId, rng);
}

function openBoxInternal(profile, boxId, rng) {
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
  const compensationCoins = isNew ? 0 : (DUPLICATE_COINS[picked.rarity] ?? 20);
  if (!isNew) {
    profile.coins += compensationCoins;
    profile.stats.coinsEverEarned += compensationCoins;
  }

  return { success: true, boxId, skin: picked, isNew, compensationCoins };
}
