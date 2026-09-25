// tools/test_laser_game.mjs
import { createLaserChallenge, createLaser, updateLaserPosition, isPointOnLaser, laserOutcome } from "../js/minigames/laserGame.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FEHLER:", msg); failures++; }
  else console.log("OK:", msg);
}

const challenge = createLaserChallenge(Math.random, 1);
assert(challenge.laserCount === 2 || challenge.laserCount === 3, "2 oder 3 Laser werden generiert");
assert(challenge.timeLimitMs > 0 && challenge.maxHits >= 1, "Zeitlimit und erlaubte Treffer sind sinnvoll gesetzt");

const harder = createLaserChallenge(Math.random, 2);
assert(harder.timeLimitMs < challenge.timeLimitMs, "Höhere Schwierigkeit = weniger Zeit");
assert(harder.maxHits <= challenge.maxHits, "Höhere Schwierigkeit erlaubt nicht mehr Treffer als leichter");

const laser = createLaser(0, 100, 640, 420, () => 0.5);
assert(laser.axis === "horizontal", "Gerader Index erzeugt horizontalen Laser");
let steps = 0;
let hitMax = false;
for (let i = 0; i < 2000 && !hitMax; i++) {
  updateLaserPosition(laser, 0.05);
  if (laser.t >= laser.range) hitMax = true;
  steps++;
}
assert(hitMax, `Laser erreicht irgendwann sein Bewegungsmaximum (nach ${steps} Schritten)`);
updateLaserPosition(laser, 0.05);
assert(laser.dir === -1, "Laser kehrt am Rand die Richtung um");

const hLaser = { axis: "horizontal", fixedCoord: 200, t: 300, range: 640 };
assert(isPointOnLaser(300, 200, hLaser), "Punkt direkt auf dem horizontalen Laser wird erkannt");
assert(!isPointOnLaser(300, 350, hLaser), "Punkt weit entfernt vom Laser wird nicht als Treffer erkannt");

const vLaser = { axis: "vertical", fixedCoord: 150, t: 100, range: 420 };
assert(isPointOnLaser(150, 100, vLaser), "Punkt direkt auf dem vertikalen Laser wird erkannt");
assert(!isPointOnLaser(400, 100, vLaser), "Punkt weit vom vertikalen Laser wird nicht erkannt");

const win = laserOutcome(0, 2, true, 1);
assert(win.kind === "reward" && win.coins > 0, "Ausgang erreicht ohne Treffer = Belohnung");
const winWithHits = laserOutcome(2, 2, true, 1);
assert(winWithHits.kind === "reward" && winWithHits.coins < win.coins, "Mehr Treffer = weniger Belohnung, auch bei Erfolg");
const failTooManyHits = laserOutcome(3, 2, true, 1);
assert(failTooManyHits.kind === "danger", "Zu viele Treffer = Fehlschlag, auch wenn Ausgang erreicht wurde");
const failTimeout = laserOutcome(0, 2, false, 1);
assert(failTimeout.kind === "danger" && failTimeout.message.includes("Zeit"), "Zeitablauf ohne Ausgang = Fehlschlag mit passender Meldung");

console.log(failures === 0 ? "\nALLE TESTS BESTANDEN" : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
