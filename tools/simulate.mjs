import { RunManager } from "../js/game/runManager.js";

const results = { fled: 0, died: 0 };
const roomTypeCounts = {};
let totalRooms = 0;

for (let i = 0; i < 1000; i++) {
  const rm = new RunManager({ difficulty: "normal" });
  let steps = 0;
  while (!rm.finished && steps < 50) {
    const doors = rm.generateDoors();
    doors.forEach(d => {
      roomTypeCounts[d.roomType.id] = (roomTypeCounts[d.roomType.id] || 0) + 1;
      totalRooms++;
    });
    const pick = Math.floor(Math.random() * doors.length);
    const { door, merchantOffer, secretFound } = rm.chooseDoor(pick);
    if (merchantOffer && Math.random() < 0.5) rm.buyHeal(merchantOffer);
    if (secretFound) rm.collectSecretBonus();
    if (!rm.finished && rm.exitAvailable() && Math.random() < 0.3) {
      rm.flee();
    }
    steps++;
  }
  if (rm.result) results[rm.result]++;
}

console.log("Ergebnisse (1000 Runs):", results);
console.log("Raumtyp-Verteilung (Anteil an allen generierten Türen):");
Object.entries(roomTypeCounts)
  .sort((a,b) => b[1]-a[1])
  .forEach(([id, count]) => console.log(`  ${id}: ${(100*count/totalRooms).toFixed(1)}%`));
