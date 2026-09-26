// js/arcade/registry.js
// Zentrale Liste aller Minispiele. Neues Minispiel hinzufügen = ein Eintrag
// hier + eine Datei in js/arcade/games/ mit dem gemeinsamen Interface
// { start({ container, skinId, rng, onEnd }) -> { destroy() } }.
export const ARCADE_GAMES = [
  {
    id: "fruitCatcher",
    name: "Obstkorb",
    icon: "🍎",
    tagline: "Fang so viel Obst wie möglich!",
    load: () => import("./games/fruitCatcher.js"),
  },
  {
    id: "balloonPop",
    name: "Balloon Pop",
    icon: "🎈",
    tagline: "Platze sie alle, bevor die Zeit abläuft!",
    load: () => import("./games/balloonPop.js"),
  },
  {
    id: "colorTrick",
    name: "Color Trick",
    icon: "🎨",
    tagline: "Trau deinen Augen nicht - lies das Wort, nicht die Farbe!",
    load: () => import("./games/colorTrick.js"),
  },
  {
    id: "memory",
    name: "Mini Memory",
    icon: "🧠",
    tagline: "Finde alle Paare, bevor die Zeit abläuft.",
    load: () => import("./games/memoryGame.js"),
  },
  {
    id: "reaction",
    name: "Reaktion",
    icon: "⚡",
    tagline: "Wie schnell sind deine Reflexe?",
    load: () => import("./games/reactionArcade.js"),
  },
  {
    id: "starCatcher",
    name: "Star Catcher",
    icon: "⭐",
    tagline: "Schnapp dir die Sterne, bevor sie verglühen!",
    load: () => import("./games/starCatcher.js"),
  },
  {
    id: "stopGreen",
    name: "Stopp bei Grün",
    icon: "🚦",
    tagline: "Triff genau den grünen Bereich!",
    load: () => import("./games/stopGreen.js"),
  },
  {
    id: "quickFinger",
    name: "Schnellster Finger",
    icon: "🫵",
    tagline: "Nur ein Button ist der richtige - immer wieder!",
    load: () => import("./games/quickFinger.js"),
  },
];

export function getArcadeGame(id) {
  return ARCADE_GAMES.find((g) => g.id === id) ?? null;
}
