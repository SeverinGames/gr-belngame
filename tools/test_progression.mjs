// tools/test_progression.mjs
import { loadProfile, saveProfile, applyRunRewards, unlockSkin } from "../js/rewards/profile.js";
import { openMysteryBox, getDropTable } from "../js/rewards/mysteryBox.js";
import { claimDaily, canClaimDaily } from "../js/rewards/dailyReward.js";
import { listMissionProgress, claimMission } from "../js/missions/missions.js";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FEHLER:", msg); failures++; }
  else console.log("OK:", msg);
}

// Mock-Storage (kein Browser vorhanden)
const store = {};
const mockStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = v; },
};

let profile = loadProfile(mockStorage);
assert(profile.level === 1 && profile.coins === 0, "Startprofil korrekt initialisiert");
assert(profile.unlockedSkins.includes("mario"), "Mario ist von Anfang an freigeschaltet");

// XP/Level-Up testen
const { profile: p2, levelUps } = applyRunRewards(profile, {
  coinsEarned: 60, xpEarned: 250, keysEarned: 1, fled: true, roomsCleared: 5,
});
assert(p2.level === 3, `Level nach 250 XP sollte 3 sein, ist ${p2.level}`);
assert(p2.coins === 60 && p2.keys === 1, "Münzen/Schlüssel korrekt gutgeschrieben");
saveProfile(p2, mockStorage);

// Persistenz testen (neu laden)
const reloaded = loadProfile(mockStorage);
assert(reloaded.level === 3 && reloaded.coins === 60, "Profil bleibt nach Reload erhalten");

// Mystery Box: Drop-Tabelle summiert sich zu 100%
const table = getDropTable();
const sum = table.reduce((s, e) => s + e.chancePercent, 0);
assert(Math.abs(sum - 100) < 0.5, `Drop-Tabelle summiert zu ~100% (ist ${sum.toFixed(2)}%)`);

// Mystery Box: 500x öffnen, darf nie crashen, muss Schlüssel korrekt abziehen
reloaded.keys = 500;
let unlockedCount = 0;
for (let i = 0; i < 500; i++) {
  const res = openMysteryBox(reloaded, Math.random);
  if (res.success && res.isNew) unlockedCount++;
}
assert(reloaded.keys === 0, "Schlüssel korrekt auf 0 verbraucht nach 500 Öffnungen");
assert(unlockedCount > 0 && unlockedCount <= 8, `Sinnvolle Anzahl neuer Skins freigeschaltet (${unlockedCount})`);
const noKeyResult = openMysteryBox(reloaded, Math.random);
assert(noKeyResult.success === false, "Box lässt sich ohne Schlüssel nicht öffnen");

// Daily Reward
const fresh = loadProfile({ getItem: () => null, setItem: () => {} });
assert(canClaimDaily(fresh), "Frisches Profil kann Daily Reward abholen");
const claim1 = claimDaily(fresh);
assert(claim1.success && claim1.streakDay === 1, "Erster Claim = Tag 1");
const claim2 = claimDaily(fresh);
assert(claim2.success === false, "Zweiter Claim am selben Tag wird blockiert");

// Missionen
fresh.stats.doorsOpened = 5;
const progress = listMissionProgress(fresh);
const doorMission = progress.find((p) => p.def.id === "open5doors");
assert(doorMission.done === true, "Mission 'Öffne 5 Türen' korrekt als erfüllt erkannt");
const claimRes = claimMission(fresh, "open5doors");
assert(claimRes.success && fresh.coins >= 30, "Missions-Belohnung wird gutgeschrieben");
const doubleClaim = claimMission(fresh, "open5doors");
assert(doubleClaim.success === false, "Mission kann nicht doppelt abgeholt werden");

console.log(failures === 0 ? "\nALLE TESTS BESTANDEN" : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
process.exit(failures === 0 ? 0 : 1);
