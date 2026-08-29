// tools/test_bots.mjs
import { RunManager } from "../js/game/runManager.js";
import { PERSONALITIES } from "../js/bots/personalities.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FEHLER:", msg); failures++; }
  else console.log("OK:", msg);
}

const rm = new RunManager({ difficulty: "normal", botCount: 3 });
assert(rm.bots.length === 3, "3 Bots wurden erzeugt");
assert(rm.bots.every((b) => PERSONALITIES[b.personalityId]), "Jeder Bot hat eine gültige Persönlichkeit");
assert(new Set(rm.bots.map((b) => b.id)).size === 3, "Bot-IDs sind eindeutig");

const doors = rm.generateDoors();
const suggestions = rm.getBotDoorSuggestions(doors);
assert(suggestions.length === 3, "Alle 3 Bots geben eine Türempfehlung ab");
assert(suggestions.every((s) => doors.includes(s.preferredDoor)), "Empfohlene Tür ist eine der generierten Türen");

const { outcome } = rm.chooseDoor(doors[0].id);
const reactions = rm.getBotReactions(outcome.kind);
assert(Array.isArray(reactions), "Bot-Reaktionen liefern ein Array zurück (auch wenn leer)");

const votes = rm.getBotFleeVotes();
assert(votes.length <= 3, "Fluchtabstimmung liefert höchstens so viele Einträge wie lebende Bots");

// Crashtest: 200 volle Runs mit 5 Bots dürfen nie werfen
let crashed = false;
for (let i = 0; i < 200 && !crashed; i++) {
  try {
    const run = new RunManager({ difficulty: "chaos", botCount: 5 });
    let steps = 0;
    while (!run.finished && steps < 40) {
      const d = run.generateDoors();
      run.getBotDoorSuggestions(d);
      const { outcome: o } = run.chooseDoor(d[0].id);
      run.getBotReactions(o.kind);
      if (!run.finished) {
        run.getBotFleeVotes();
        if (run.exitAvailable() && Math.random() < 0.4) run.flee();
      }
      steps++;
    }
  } catch (e) {
    crashed = true;
    console.error(e);
  }
}
assert(!crashed, "200 volle Runs mit 5 Bots crashen nicht");

console.log(failures === 0 ? "\nALLE TESTS BESTANDEN" : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
