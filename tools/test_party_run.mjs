// tools/test_party_run.mjs
import { PartyRun } from "../server/partyRun.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FEHLER:", msg); failures++; }
  else console.log("OK:", msg);
}

const humans = [
  { id: "p1", name: "Alice", skinId: "mario" },
  { id: "p2", name: "Bob", skinId: "mario" },
  { id: "p3", name: "Charlie", skinId: "mario" },
];

// Grundfunktion: Party mit 3 Menschen + 2 Bots erzeugen
const pr = new PartyRun({ difficulty: "normal", botCount: 2, saboteurPreset: "normal", humanPlayers: humans });
assert(pr.humans.size === 3, "Alle 3 menschlichen Spieler wurden angelegt");
assert(pr.bots.length === 2, "2 Bots wurden angelegt");

const doors = pr.generateDoors();
assert(doors.length >= 2 && doors.length <= 4, "2-4 Türen generiert");

const { outcome } = pr.chooseDoor(doors[0].id);
assert(typeof outcome.message === "string", "Ergebnis hat eine Nachricht");

// Ergebnis muss auf ALLE lebenden Spieler gleich angewendet worden sein (Coop-Prinzip)
const hpValues = [...pr.humans.values()].map((p) => p.hp);
assert(new Set(hpValues).size === 1, `Alle Spieler haben denselben HP-Wert nach gemeinsamem Ereignis (${hpValues.join(",")})`);

// toPublicState darf keine internen/serverseitigen Felder leaken und muss JSON-sicher sein
const state = pr.toPublicState();
assert(state.players.length === 3, "toPublicState listet alle 3 Spieler");
assert(() => { JSON.stringify(state); return true; }, "toPublicState ist JSON-serialisierbar");
try { JSON.stringify(state); assert(true, "toPublicState ist tatsächlich JSON.stringify-fähig"); }
catch { assert(false, "toPublicState ist tatsächlich JSON.stringify-fähig"); }

// Crashtest: 300 volle Coop-Runs mit unterschiedlicher Spieler-/Botzahl
let crashed = false;
for (let i = 0; i < 300 && !crashed; i++) {
  try {
    const n = 1 + Math.floor(Math.random() * 6);
    const hp = Array.from({ length: n }, (_, i) => ({ id: `h${i}`, name: `H${i}`, skinId: "mario" }));
    const run = new PartyRun({
      difficulty: ["easy", "normal", "hard", "chaos", "nightmare"][Math.floor(Math.random() * 5)],
      botCount: Math.floor(Math.random() * 6),
      saboteurPreset: ["peaceful", "normal", "chaos", "extreme", "allOrNothing"][Math.floor(Math.random() * 5)],
      humanPlayers: hp,
    });
    let steps = 0;
    while (!run.finished && steps < 50) {
      const d = run.generateDoors();
      run.getBotDoorSuggestions(d);
      const res = run.chooseDoor(d[Math.floor(Math.random() * d.length)].id);
      run.getBotReactions(res.outcome.kind);
      if (!run.finished && run.exitAvailable() && Math.random() < 0.35) run.flee();
      JSON.stringify(run.toPublicState()); // muss immer serialisierbar bleiben
      steps++;
    }
    if (run.finished) run.revealSaboteur();
  } catch (e) {
    crashed = true;
    console.error("Crash bei Iteration", i, e);
  }
}
assert(!crashed, "300 volle Coop-Runs mit 1-6 Spielern + 0-5 Bots crashen nicht");

// Sterben: alle Menschen müssen tot sein, damit die Runde als "died" endet
const dyingHumans = [{ id: "solo", name: "Solo", skinId: "mario" }];
const dyingRun = new PartyRun({ difficulty: "nightmare", botCount: 0, saboteurPreset: "peaceful", humanPlayers: dyingHumans });
let deathSteps = 0;
while (!dyingRun.finished && deathSteps < 200) {
  const d = dyingRun.generateDoors();
  dyingRun.chooseDoor(d[0].id);
  deathSteps++;
}
assert(dyingRun.finished, "Runde endet irgendwann (Tod oder Flucht) statt endlos zu laufen");

console.log(failures === 0 ? "\nALLE TESTS BESTANDEN" : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
