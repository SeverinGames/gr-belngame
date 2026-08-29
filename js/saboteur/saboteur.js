// js/saboteur/saboteur.js

// Wahrscheinlichkeits-Presets - bewusst nicht exakt, siehe Punkt 10 des Lastenhefts.
export const SABOTEUR_PRESETS = {
  peaceful: { label: "Friedlich", roll: () => 0 },
  normal: { label: "Normal", roll: (rng) => 0.15 + rng() * 0.10 }, // 15-25%
  chaos: { label: "Chaos", roll: (rng) => 0.30 + rng() * 0.10 },   // 30-40%
  extreme: { label: "Extrem", roll: (rng) => 0.45 + rng() * 0.10 }, // 45-55%
  allOrNothing: { label: "Alles oder Nichts", roll: (rng) => rng() }, // 0-100%
};

export const SABOTEUR_TASKS = [
  {
    id: "danger3",
    label: "Bringe die Gruppe in mindestens 3 gefährliche Räume.",
    target: 3,
    getProgress: (stats) => stats.dangerRoomsEntered,
  },
  {
    id: "block10keys",
    label: "Verhindere, dass die Gruppe 200 Münzen sichert.",
    target: 200,
    getProgress: (stats) => stats.securedCoinsAtEnd,
    invert: true, // Erfolg wenn Wert UNTER target bleibt
  },
  {
    id: "trap2",
    label: "Sorge dafür, dass mindestens 2 Fallen ausgelöst werden.",
    target: 2,
    getProgress: (stats) => stats.trapsTriggered,
  },
];

export function rollSaboteurChance(presetId, rng = Math.random) {
  const preset = SABOTEUR_PRESETS[presetId] ?? SABOTEUR_PRESETS.normal;
  return preset.roll(rng);
}

// Wählt heimlich einen Bot als Saboteur aus (oder keinen). Menschlicher Spieler
// bleibt in Phase 6 (Solo-Test) immer unschuldig - echte Multiplayer-Zuweisung
// inkl. menschlicher Spieler folgt in Phase 5/Online-Ausbau.
export function assignSaboteur(bots, presetId, rng = Math.random) {
  if (bots.length === 0) return null;
  const chance = rollSaboteurChance(presetId, rng);
  if (rng() >= chance) return null;
  const pick = bots[Math.floor(rng() * bots.length)];
  const task = SABOTEUR_TASKS[Math.floor(rng() * SABOTEUR_TASKS.length)];
  return { botId: pick.id, task, chanceUsed: chance };
}

// Saboteur-Tür-Bewertung: bevorzugt gefährliche Türen, tarnt sich aber -
// gibt nach außen ganz normale (personality-typische) Kommentare ab.
export function saboteurDoorScore(door) {
  return door.roomType.tags.includes("danger") ? 1.6 : 0.9;
}

export function checkTaskSuccess(task, stats) {
  const progress = task.getProgress(stats);
  return task.invert ? progress < task.target : progress >= task.target;
}
