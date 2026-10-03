// js/progress/levels.js
// Level-Kurve und Level-Up-Belohnungen. Ziel: Aufstiege kommen früh und
// regelmäßig (nach 1-3 Runden am Anfang, später alle paar Runden) und
// belohnen NICHT mit Skins, sondern mit Münzen, Drehs, Mini-Boxen und
// kosmetischen Profil-Elementen.
import { unlockCosmetic } from "./cosmetics.js";
import { addCoinsRaw, addSpin, addMiniBoxes, addVoucher, describeRewardObj, pushEvent } from "./rewardOps.js";

// XP bis zum nächsten Level: 100 am Anfang, wächst langsam bis 550 (Deckel).
export function xpNeeded(level) {
  return 100 + 25 * Math.min(Math.max(level, 1) - 1, 18);
}

// Level, ab dem eine Box-Stufe im Shop kaufbar ist (Freischaltungen).
export const BOX_UNLOCK_LEVEL = { basic: 1, super: 4, mega: 8 };

const TABLE = {
  2: { coins: 70 },
  3: { spin: 1 },
  4: { cosmetic: "badge:clover", note: "Super Box im Shop freigeschaltet!" },
  5: { miniBox: 1 },
  6: { coins: 110 },
  7: { cosmetic: "frame:bronze" },
  8: { coins: 140, note: "Mega Box im Shop freigeschaltet!" },
  9: { spin: 1 },
  10: { miniBox: 1, cosmetic: "badge:star" },
  11: { cosmetic: "finish:confetti", coins: 60 },
  12: { cosmetic: "emote:cool" },
  13: { spin: 1, coins: 40 },
  14: { cosmetic: "nameColor:gold", coins: 80 },
  15: { cosmetic: "frame:silver", coins: 90 },
  16: { cosmetic: "title:fan" },
  17: { miniBox: 1 },
  18: { coins: 220 },
  19: { cosmetic: "effect:sparkle" },
  20: { voucher: "basic", coins: 90 },
  22: { cosmetic: "title:lucky" },
  25: { cosmetic: "frame:neon", miniBox: 1 },
  30: { cosmetic: "badge:rocket", spin: 1, coins: 220 },
  35: { cosmetic: "emote:wow", miniBox: 1 },
  40: { cosmetic: "title:mind", coins: 360 },
  21: { cosmetic: "emote:heart" },
  23: { cosmetic: "nameColor:cyan", coins: 80 },
  24: { cosmetic: "finish:stars" },
  26: { cosmetic: "badge:bolt", miniBox: 1 },
  27: { cosmetic: "frame:ice" },
  28: { cosmetic: "title:collector", spin: 1 },
  29: { cosmetic: "effect:snow" },
  31: { cosmetic: "emote:gg", coins: 100 },
  32: { cosmetic: "badge:puzzle" },
  33: { cosmetic: "nameColor:pink", miniBox: 1 },
  34: { cosmetic: "finish:coins" },
  36: { cosmetic: "frame:forest", coins: 100 },
  37: { cosmetic: "badge:palette" },
  38: { cosmetic: "title:artist", spin: 1 },
  39: { cosmetic: "effect:bubbles" },
  41: { cosmetic: "emote:fire", miniBox: 1 },
  42: { cosmetic: "title:speedy" },
  43: { cosmetic: "nameColor:green", coins: 120 },
  44: { cosmetic: "finish:hearts" },
  45: { cosmetic: "frame:fire", miniBox: 1 },
  46: { cosmetic: "badge:maze" },
  47: { cosmetic: "title:navigator", spin: 1 },
  48: { cosmetic: "effect:flames" },
  49: { cosmetic: "emote:think", coins: 150 },
  50: { cosmetic: "frame:rainbow", voucher: "super" },
  52: { cosmetic: "badge:dice", miniBox: 1 },
  54: { cosmetic: "nameColor:purple" },
  56: { cosmetic: "finish:fireworks", coins: 200 },
  58: { cosmetic: "badge:medal", spin: 1 },
  60: { cosmetic: "frame:royal", voucher: "super" },
  65: { cosmetic: "title:champion", miniBox: 2 },
  70: { cosmetic: "nameColor:rainbow", coins: 300 },
  75: { cosmetic: "emote:crown", miniBox: 2 },
  80: { cosmetic: "title:veteran", voucher: "mega" },
};

export function levelReward(level) {
  if (TABLE[level]) return TABLE[level];
  // Alle übrigen Level: kleine, aber spürbare Belohnung.
  if (level % 10 === 0) return { spin: 1, miniBox: 1, coins: 100 };
  if (level % 5 === 0) return { miniBox: 1, coins: 60 };
  if (level % 4 === 0) return { spin: 1 };
  return { coins: 30 + Math.min(level, 40) * 1 };
}

// Wendet die Belohnung eines Levels an. silent=true (Migration alter
// Spielstände) vergibt nur kosmetische Dinge und löst kein Ereignis aus.
export function applyLevelReward(profile, level, { silent = false } = {}) {
  const r = levelReward(level);
  if (r.cosmetic) {
    const [cat, id] = r.cosmetic.split(":");
    unlockCosmetic(profile, cat, id);
  }
  if (silent) return r;
  if (r.coins) addCoinsRaw(profile, r.coins);
  if (r.spin) addSpin(profile, r.spin);
  if (r.miniBox) addMiniBoxes(profile, r.miniBox);
  if (r.voucher) addVoucher(profile, r.voucher, 1);
  pushEvent({ type: "levelup", level, reward: r, text: describeRewardObj(r), note: r.note ?? null });
  return r;
}

export function describeLevelReward(level) {
  const r = levelReward(level);
  return describeRewardObj(r) + (r.note ? ` · ${r.note}` : "");
}
