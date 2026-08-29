// js/bots/personalities.js
// Jede Persönlichkeit beeinflusst: wie eine Tür bewertet wird (doorBias),
// wie früh geflohen wird (fleeBias) und welche Kommentare fallen.

export const PERSONALITIES = {
  brave: {
    label: "Der Mutige",
    doorBias: (door) => (door.roomType.tags.includes("danger") ? 1.4 : 1.0),
    fleeBias: -0.3, // will seltener fliehen
    comments: {
      danger: ["Lasst mich das übernehmen!", "Keine Angst, ich geh vor."],
      reward: ["Sehe ich das richtig? Beute!"],
      flee: ["Schon? Wir hätten noch weitermachen können..."],
    },
  },
  cautious: {
    label: "Der Vorsichtige",
    doorBias: (door) => (door.shownHint === "danger" ? 0.5 : 1.2),
    fleeBias: 0.5, // will früh fliehen
    comments: {
      danger: ["Das gefällt mir nicht...", "Vorsicht, das könnte gefährlich sein!"],
      reward: ["Na gut, aber bleibt wachsam."],
      flee: ["Endlich! Raus hier!"],
    },
  },
  greedy: {
    label: "Der Gierige",
    doorBias: (door) => (door.roomType.tags.includes("reward") ? 1.6 : 1.0),
    fleeBias: -0.5,
    comments: {
      danger: ["Ist mir egal, Hauptsache Beute."],
      reward: ["JA! Mehr davon!"],
      flee: ["Nein, nein, noch einen Raum!"],
    },
  },
  dumb: {
    label: "Der Dumme",
    doorBias: () => 1.0 + (Math.random() - 0.5) * 0.8, // fast zufällig
    fleeBias: 0,
    comments: {
      danger: ["Wieso ist da Feuer.", "Hoppla."],
      reward: ["Ooh, glänzend."],
      flee: ["Warten wir noch, oder? Ach, zu spät."],
    },
  },
  helper: {
    label: "Der Helfer",
    doorBias: (door) => (door.shownHint === "danger" ? 0.8 : 1.1),
    fleeBias: 0.2,
    comments: {
      danger: ["Passt aufeinander auf!", "Ich helf dir!"],
      reward: ["Für die Gruppe!"],
      flee: ["Gut, alle sind in Sicherheit."],
    },
  },
  suspicious: {
    label: "Der Verdächtige",
    doorBias: (door) => 1.0,
    fleeBias: 0.1,
    comments: {
      danger: ["War das Absicht...?", "Jemand hat das kommen sehen."],
      reward: ["Zufall? Ich glaube nicht dran."],
      flee: ["Wir sollten reden, wenn wir raus sind."],
    },
  },
};

const BOT_NAMES = ["Kiro", "Sensa", "Dax", "Umi", "Falk", "Nyra", "Boro", "Tessi"];

export function createBot(rng = Math.random) {
  const ids = Object.keys(PERSONALITIES);
  const personalityId = ids[Math.floor(rng() * ids.length)];
  const name = BOT_NAMES[Math.floor(rng() * BOT_NAMES.length)];
  return {
    id: `bot_${Math.floor(rng() * 1e9)}`,
    name,
    personalityId,
    personality: PERSONALITIES[personalityId],
    hp: 100,
    alive: true,
  };
}

// Bewertet Türen aus Bot-Sicht und gibt die bevorzugte Tür zurück (für UI-Hinweis)
export function botPickDoor(bot, doors, rng = Math.random) {
  const scored = doors.map((door) => ({
    door,
    score: bot.personality.doorBias(door) * (0.7 + rng() * 0.6),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].door;
}

export function botVoteFlee(bot, roomsCleared, rng = Math.random) {
  const baseChance = Math.min(0.8, 0.1 + roomsCleared * 0.05);
  return rng() < baseChance + bot.personality.fleeBias;
}

export function botComment(bot, situation, rng = Math.random) {
  const pool = bot.personality.comments[situation];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)];
}
