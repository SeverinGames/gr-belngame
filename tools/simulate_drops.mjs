// Balance-Simulation der Box-Drop-Raten: node tools/simulate_drops.mjs
// Zeigt (1) Verteilung pro Box und (2) wie viele Boxen / wie viele Münzen
// im Schnitt nötig sind, bis ALLE Box-Skins gesammelt sind.
import { BOX_DEFS, getDropTable, purchaseBox } from "../js/shop/shop.js";
import { SKINS, RARITY } from "../js/skins/skins.js";

for (const id of Object.keys(BOX_DEFS)) {
  console.log(`\n${BOX_DEFS[id].name} (${BOX_DEFS[id].price} Münzen):`);
  for (const e of getDropTable(id)) console.log(`  ${e.skin.name.padEnd(9)} ${RARITY[e.skin.rarity].label.padEnd(14)} ${e.chancePercent}%  (~1 von ${Math.round(100 / e.chancePercent)})`);
}

const boxSkins = SKINS.filter((s) => s.unlockMethod !== "mission" && s.unlockMethod !== "starter");
function runsUntilComplete(boxId, runs = 2000) {
  const counts = [];
  for (let r = 0; r < runs; r++) {
    const profile = { coins: 1e9, unlockedSkins: ["mario"], stats: { boxesOpened: 0, coinsEverEarned: 0 } };
    let n = 0;
    while (!boxSkins.every((s) => profile.unlockedSkins.includes(s.id))) { purchaseBox(profile, boxId, Math.random); n++; if (n > 1e6) break; }
    counts.push(n);
  }
  counts.sort((a, b) => a - b);
  return { median: counts[Math.floor(runs / 2)], p10: counts[Math.floor(runs * 0.1)], p90: counts[Math.floor(runs * 0.9)] };
}
console.log("\nBoxen bis ALLE Box-Skins gesammelt (2000 Simulationen):");
for (const id of Object.keys(BOX_DEFS)) {
  const r = runsUntilComplete(id);
  console.log(`  ${BOX_DEFS[id].name.padEnd(10)} Median ${String(r.median).padStart(5)} Boxen (~${(r.median * BOX_DEFS[id].price).toLocaleString("de-DE")} Münzen) | 10%: ${r.p10} | 90%: ${r.p90}`);
}
