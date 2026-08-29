// js/rewards/mysteryBox.js
import { SKINS, RARITY } from "../skins/skins.js";
import { unlockSkin } from "./profile.js";

// Transparente Drop-Gewichte pro Rarity - je seltener, desto niedriger.
// Werden dem Spieler im UI so oder ähnlich angezeigt (keine Blackbox, Punkt 20).
const RARITY_WEIGHTS = {
  common: 0,        // Mario ist Starter, kein Box-Drop
  superRare: 40,
  epic: 25,
  mythic: 15,
  legendary: 10,
  superLegendary: 6,
  exotic: 3,
  unlimited: 0.3,
};

export function getDropTable() {
  const dropable = SKINS.filter((s) => RARITY_WEIGHTS[s.rarity] > 0);
  const total = dropable.reduce((sum, s) => sum + RARITY_WEIGHTS[s.rarity], 0);
  return dropable.map((s) => ({
    skin: s,
    chancePercent: +((RARITY_WEIGHTS[s.rarity] / total) * 100).toFixed(2),
  }));
}

// rng: Funktion, die eine Zahl in [0,1) liefert (z.B. Math.random oder RandomEngine.next)
export function openMysteryBox(profile, rng = Math.random) {
  if (profile.keys < 1) return { success: false, reason: "no-keys" };
  profile.keys -= 1;

  const table = getDropTable();
  const total = table.reduce((sum, e) => sum + e.chancePercent, 0);
  let roll = rng() * total;
  let picked = table[table.length - 1].skin;
  for (const entry of table) {
    roll -= entry.chancePercent;
    if (roll <= 0) { picked = entry.skin; break; }
  }

  const isNew = unlockSkin(profile, picked.id);
  // Duplikat wird in kleine Münzentschädigung umgewandelt (kein Feature-Loch)
  const compensationCoins = isNew ? 0 : 25 * (RARITY[picked.rarity].particles + 1);
  if (!isNew) profile.coins += compensationCoins;

  return { success: true, skin: picked, isNew, compensationCoins };
}
