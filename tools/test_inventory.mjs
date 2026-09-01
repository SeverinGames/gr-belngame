// tools/test_inventory.mjs
import { addItem, hasItem, itemCount, useItem, listInventory } from "../js/inventory/inventory.js";
import { RunPlayer } from "../js/player/player.js";
import { RunManager } from "../js/game/runManager.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FEHLER:", msg); failures++; }
  else console.log("OK:", msg);
}

// --- Reines Inventar ---
const inv = {};
assert(!hasItem(inv, "key"), "Leeres Inventar hat keinen Schlüssel");
addItem(inv, "key", 2);
assert(itemCount(inv, "key") === 2, "2 Schlüssel nach addItem(2)");
assert(hasItem(inv, "key"), "hasItem erkennt vorhandenen Schlüssel");

const useResult = useItem(inv, "key");
assert(useResult.success && itemCount(inv, "key") === 1, "Ein Schlüssel wird nach Benutzung verbraucht");
useItem(inv, "key");
assert(!hasItem(inv, "key"), "Nach Verbrauch aller Schlüssel ist keiner mehr da");
assert(useItem(inv, "key").success === false, "Benutzen ohne Vorrat schlägt sauber fehl (kein Crash)");

const medEffect = useItem(addItem({}, "medkit", 1), "medkit");
assert(medEffect.success && medEffect.effect.hp === 35, "Medkit liefert den erwarteten Heileffekt");

const list = listInventory(addItem(addItem({}, "key", 3), "battery", 1));
assert(list.length === 2 && list.find((e) => e.def.id === "key").count === 3, "listInventory gibt korrekte Bestände zurück");

// --- Im Spielkontext (RunPlayer) ---
const player = new RunPlayer("Test", "mario");
player.applyOutcome({ coins: 0, hp: 0, xp: 0, item: "medkit" });
assert(hasItem(player.inventory, "medkit"), "applyOutcome mit item-Feld legt Item ins Spieler-Inventar");

player.hp = 50;
const useRes = player.useItem("medkit");
assert(useRes.success && player.hp === 85, `Medkit heilt den Spieler wirklich (HP jetzt ${player.hp}, erwartet 85)`);
assert(!hasItem(player.inventory, "medkit"), "Medkit ist nach Benutzung verbraucht");

player.hp = 90;
addItem(player.inventory, "medkit", 1);
player.useItem("medkit");
assert(player.hp === 100, "HP wird beim Heilen auf maximal 100 gedeckelt");

// consumesItem beim Anwenden eines Outcomes
addItem(player.inventory, "key", 1);
player.applyOutcome({ coins: 20, hp: 0, xp: 0, consumesItem: "key" });
assert(!hasItem(player.inventory, "key"), "consumesItem im Outcome verbraucht den Schlüssel automatisch");

// --- Verschlossene Tür im echten RunManager-Kontext ---
let crashed = false;
let sawLockedWithKey = false;
let sawLockedWithoutKey = false;
for (let i = 0; i < 500 && (!sawLockedWithKey || !sawLockedWithoutKey); i++) {
  try {
    const p = new RunPlayer("T", "mario");
    const rm = new RunManager({ difficulty: "normal", player: p, botCount: 0, saboteurPreset: "peaceful" });
    // Künstlich einen Schlüssel vergeben für die Hälfte der Iterationen
    if (i % 2 === 0) addItem(p.inventory, "key", 1);
    let steps = 0;
    while (!rm.finished && steps < 30) {
      const doors = rm.generateDoors();
      const lockedDoor = doors.find((d) => d.roomType.id === "lockedDoor");
      if (lockedDoor) {
        const hadKey = hasItem(p.inventory, "key");
        const { outcome } = rm.chooseDoor(lockedDoor.id);
        if (hadKey && outcome.kind === "reward") sawLockedWithKey = true;
        if (!hadKey && outcome.kind === "danger") sawLockedWithoutKey = true;
      } else {
        rm.chooseDoor(doors[0].id);
      }
      if (!rm.finished && rm.exitAvailable() && Math.random() < 0.3) rm.flee();
      steps++;
    }
  } catch (e) {
    crashed = true;
    console.error(e);
    break;
  }
}
assert(!crashed, "Viele Runs mit verschlossenen Türen crashen nicht");
assert(sawLockedWithKey, "Mit Schlüssel öffnet sich die verschlossene Tür als Belohnung");
assert(sawLockedWithoutKey, "Ohne Schlüssel wird die verschlossene Tür aufgebrochen (Schaden)");

console.log(failures === 0 ? "\nALLE TESTS BESTANDEN" : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
