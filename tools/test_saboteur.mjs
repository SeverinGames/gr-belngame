// tools/test_saboteur.mjs
import { RunManager } from "../js/game/runManager.js";
import { rollSaboteurChance, SABOTEUR_PRESETS } from "../js/saboteur/saboteur.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FEHLER:", msg); failures++; }
  else console.log("OK:", msg);
}

// Presets liefern plausible Wahrscheinlichkeitsbereiche
for (let i = 0; i < 200; i++) {
  const p = rollSaboteurChance("peaceful", Math.random);
  if (p !== 0) { assert(false, "peaceful liefert immer 0%"); break; }
}
assert(true, "peaceful liefert immer 0%");

let normalOk = true;
for (let i = 0; i < 500; i++) {
  const p = rollSaboteurChance("normal", Math.random);
  if (p < 0.15 || p > 0.25) normalOk = false;
}
assert(normalOk, "normal bleibt im 15-25% Band");

let extremeOk = true;
for (let i = 0; i < 500; i++) {
  const p = rollSaboteurChance("extreme", Math.random);
  if (p < 0.45 || p > 0.55) extremeOk = false;
}
assert(extremeOk, "extreme bleibt im 45-55% Band");

// friedlich: nie ein Saboteur über 300 Runs
let neverAssignedPeaceful = true;
for (let i = 0; i < 300; i++) {
  const rm = new RunManager({ difficulty: "normal", botCount: 3, saboteurPreset: "peaceful" });
  if (rm.saboteur !== null) neverAssignedPeaceful = false;
}
assert(neverAssignedPeaceful, "Bei 'Friedlich' wird nie ein Saboteur zugewiesen (300 Runs)");

// extrem: ungefähr in der erwarteten Größenordnung zugewiesen (Toleranzband)
let assignedExtreme = 0;
const N = 1000;
for (let i = 0; i < N; i++) {
  const rm = new RunManager({ difficulty: "normal", botCount: 3, saboteurPreset: "extreme" });
  if (rm.saboteur !== null) assignedExtreme++;
}
const rateExtreme = assignedExtreme / N;
assert(rateExtreme > 0.35 && rateExtreme < 0.65, `Extrem-Rate plausibel: ${(rateExtreme * 100).toFixed(1)}% (erwartet ~45-55%)`);

// Saboteur ist immer ein existierender Bot, nie null-Referenz später
for (let i = 0; i < 200; i++) {
  const rm = new RunManager({ difficulty: "chaos", botCount: 4, saboteurPreset: "extreme" });
  if (rm.saboteur) {
    const bot = rm.bots.find((b) => b.id === rm.saboteur.botId);
    assert(!!bot, "Saboteur-botId verweist auf existierenden Bot");
    break;
  }
}

// revealSaboteur crasht nie, auch ohne Bots
const noBotRun = new RunManager({ difficulty: "normal", botCount: 0, saboteurPreset: "extreme" });
const reveal0 = noBotRun.revealSaboteur();
assert(reveal0.hadSaboteur === false, "Ohne Bots gibt es nie einen Saboteur");

// Voller Run mit Saboteur bis zum Ende, reveal danach
let crashed = false;
for (let i = 0; i < 100 && !crashed; i++) {
  try {
    const rm = new RunManager({ difficulty: "chaos", botCount: 5, saboteurPreset: "allOrNothing" });
    let steps = 0;
    while (!rm.finished && steps < 40) {
      const doors = rm.generateDoors();
      rm.getBotDoorSuggestions(doors);
      rm.chooseDoor(doors[0].id);
      if (!rm.finished && rm.exitAvailable() && Math.random() < 0.4) rm.flee();
      steps++;
    }
    const reveal = rm.revealSaboteur();
    if (reveal.hadSaboteur) {
      if (typeof reveal.success !== "boolean") throw new Error("success ist kein boolean");
    }
  } catch (e) {
    crashed = true;
    console.error(e);
  }
}
assert(!crashed, "100 volle Runs mit Saboteur + reveal crashen nicht");

console.log(failures === 0 ? "\nALLE TESTS BESTANDEN" : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
