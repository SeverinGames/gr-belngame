// js/rooms/randomEngine.js
// Mehrschichtiges prozedurales Zufallssystem.
// Schichten: Seed (reproduzierbar) -> gewichtete Pools -> Anti-Repetition ->
// dynamische Schwierigkeit -> Glück-Ausgleich.

import { ROOM_TYPES } from "./roomTypes.js";

// --- Seedable PRNG (mulberry32) ---------------------------------------
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RandomEngine {
  constructor(seed = Math.floor(Math.random() * 1e9)) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.recentHistory = []; // letzte N Raumtypen für Anti-Repetition
    this.luck = 0; // -1..+1, Pech/Glück-Ausgleich (Punkt 50)
    this.roundIndex = 0;
  }

  next() {
    return this.rng();
  }

  // Ganzzahl in [0, max)
  nextInt(max) {
    return Math.floor(this.next() * max);
  }

  // Aktuelle Raumtypen-Gewichte inkl. Anti-Repetition + dynamischer Schwierigkeit
  getWeightedPool(difficultyFactor = 1) {
    return ROOM_TYPES.map((room) => {
      let weight = room.weight;

      // Anti-Repetition: kürzlich verwendete Typen/Tags werden gedämpft,
      // lange nicht verwendete werden leicht angehoben.
      const recentSameType = this.recentHistory.filter((h) => h === room.id).length;
      weight *= Math.max(0.15, 1 - recentSameType * 0.4);

      const sinceLastSeen = this.roundsSinceLastSeen(room.id);
      if (sinceLastSeen > 5) weight *= 1.3;

      // Dynamische Schwierigkeit: je weiter die Gruppe kommt, desto mehr
      // "danger"-Räume, aber auch mehr "reward" (Punkt 49).
      if (room.tags.includes("danger")) weight *= difficultyFactor;
      if (room.tags.includes("reward")) weight *= 1 + (difficultyFactor - 1) * 0.5;

      // Glücks-Ausgleich: bei Pechsträhne werden gefährliche Räume seltener,
      // sichere/reward-Räume häufiger (Punkt 50/6 - "fair, nicht unfair").
      if (this.luck < 0 && room.tags.includes("danger")) weight *= 1 + this.luck * 0.4;
      if (this.luck < 0 && (room.tags.includes("reward") || room.tags.includes("safe"))) {
        weight *= 1 - this.luck * 0.3;
      }

      return { room, weight: Math.max(0.01, weight) };
    });
  }

  roundsSinceLastSeen(roomId) {
    const idx = [...this.recentHistory].reverse().indexOf(roomId);
    return idx === -1 ? 99 : idx;
  }

  pickRoomType(difficultyFactor = 1) {
    const pool = this.getWeightedPool(difficultyFactor);
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = this.next() * total;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) {
        this.registerPick(entry.room.id);
        return entry.room;
      }
    }
    const fallback = pool[pool.length - 1].room;
    this.registerPick(fallback.id);
    return fallback;
  }

  registerPick(roomId) {
    this.recentHistory.push(roomId);
    if (this.recentHistory.length > 10) this.recentHistory.shift();
    this.roundIndex++;
  }

  // Ergebnis eines riskanten Events beeinflusst den Glücks-Ausgleich
  reportOutcome(wasNegative) {
    if (wasNegative) {
      this.luck = Math.max(-1, this.luck - 0.15);
    } else {
      this.luck = Math.min(1, this.luck + 0.05);
    }
  }
}
