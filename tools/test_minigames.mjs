// tools/test_minigames.mjs
import { createReactionChallenge, scoreReaction, reactionOutcome } from "../js/minigames/reactionGame.js";
import { createHideChallenge, resolveHideOutcome, hideOutcomeMessage } from "../js/minigames/hideGame.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FEHLER:", msg); failures++; }
  else console.log("OK:", msg);
}

// --- Reaktionsspiel ---
const challenge = createReactionChallenge(Math.random, 1);
assert(challenge.revealDelayMs >= 600 && challenge.revealDelayMs <= 2400, "Verzögerung liegt im erwarteten Bereich");
assert(challenge.windowMs > 0, "Zeitfenster ist positiv");

const harder = createReactionChallenge(Math.random, 2);
assert(harder.windowMs < challenge.windowMs, "Höherer Schwierigkeitsfaktor verkürzt das Zeitfenster");

assert(scoreReaction(-10, 900).success === false, "Zu früh gedrückt = Fehlschlag");
assert(scoreReaction(1500, 900).success === false, "Zu langsam = Fehlschlag");
const goodScore = scoreReaction(100, 900);
assert(goodScore.success === true && goodScore.speedRatio > 0.8, "Schnelle Reaktion = Erfolg mit hoher Geschwindigkeitsbewertung");

const rewardOutcome = reactionOutcome(goodScore, 1);
assert(rewardOutcome.kind === "reward" && rewardOutcome.coins > 0, "Erfolgreiches Ergebnis gibt Münzen-Belohnung");
const failOutcome = reactionOutcome({ success: false, reason: "too-slow" }, 1);
assert(failOutcome.kind === "danger" && failOutcome.hp < 0, "Fehlgeschlagenes Ergebnis gibt Schaden");

// Schnellere Reaktion muss mehr Belohnung geben als eine langsame (aber noch erfolgreiche)
const fastReward = reactionOutcome(scoreReaction(50, 900), 1);
const slowReward = reactionOutcome(scoreReaction(850, 900), 1);
assert(fastReward.coins > slowReward.coins, `Schnellere Reaktion gibt mehr Münzen (${fastReward.coins} > ${slowReward.coins})`);

// --- Versteckspiel ---
const hideChallenge = createHideChallenge(Math.random, 1);
assert(hideChallenge.spotCount === 3 || hideChallenge.spotCount === 4, "3 oder 4 Verstecke werden generiert");
assert(hideChallenge.timeLimitMs > 0, "Zeitlimit ist positiv");

const hiderHarder = createHideChallenge(Math.random, 2);
assert(hiderHarder.timeLimitMs < hideChallenge.timeLimitMs, "Schwerer = weniger Zeit zum Verstecken");

const notHidden = resolveHideOutcome(null, 4, Math.random);
assert(notHidden.success === false && notHidden.reason === "too-slow", "Nicht rechtzeitig versteckt = automatischer Fehlschlag");

// Statistischer Test: bei 4 Verstecken sollte die Erfolgsquote bei zufälligem
// Verstecken ungefähr 75% sein (3 von 4 Plätzen werden nicht durchsucht)
let successes = 0;
const N = 20000;
for (let i = 0; i < N; i++) {
  const res = resolveHideOutcome(0, 4, Math.random);
  if (res.success) successes++;
}
const rate = successes / N;
assert(rate > 0.7 && rate < 0.8, `Erfolgsquote bei 4 Verstecken liegt bei ~75% (gemessen: ${(rate * 100).toFixed(1)}%)`);

const hideReward = hideOutcomeMessage({ success: true }, 1);
assert(hideReward.kind === "reward", "Erfolgreiches Verstecken gibt Belohnung");
const hideFail = hideOutcomeMessage({ success: false, reason: "found" }, 1);
assert(hideFail.kind === "danger", "Entdeckt werden gibt Schaden");

console.log(failures === 0 ? "\nALLE TESTS BESTANDEN" : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
