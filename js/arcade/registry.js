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
    realDifficulty: true,
    load: () => import("./games/fruitCatcher.js"),
  },
  {
    id: "balloonPop",
    name: "Balloon Pop",
    icon: "🎈",
    tagline: "Platze sie alle, bevor die Zeit abläuft!",
    realDifficulty: true,
    load: () => import("./games/balloonPop.js"),
  },
  {
    id: "colorTrick",
    name: "Color Trick",
    icon: "🎨",
    tagline: "Tippe die Farbe, die das Wort nennt - nicht die der Schrift!",
    realDifficulty: true,
    load: () => import("./games/colorTrick.js"),
  },
  {
    id: "memory",
    name: "Mini Memory",
    icon: "🧠",
    tagline: "Finde alle Paare, bevor die Zeit abläuft.",
    realDifficulty: true,
    load: () => import("./games/memoryGame.js"),
  },
  {
    id: "reaction",
    name: "Reaktion",
    icon: "⚡",
    tagline: "Wie schnell sind deine Reflexe?",
    lowerIsBetter: true, unit: "ms",
    load: () => import("./games/reactionArcade.js"),
  },
  {
    id: "stopGreen",
    name: "Stopp bei Grün",
    icon: "🚦",
    tagline: "Triff genau den grünen Bereich!",
    realDifficulty: true,
    load: () => import("./games/stopGreen.js"),
  },
  {
    id: "quickFinger",
    name: "Schnellster Finger",
    icon: "🫵",
    tagline: "Nur ein Button ist der richtige - immer wieder!",
    load: () => import("./games/quickFinger.js"),
  },
  {
    id: "treasurePaths",
    name: "Schatzpfade",
    icon: "💰",
    tagline: "Merk dir den Schatz, bevor die Kisten sich schließen!",
    realDifficulty: true,
    load: () => import("./games/treasurePaths.js"),
  },
  {
    id: "connectFour",
    name: "Vier gewinnt",
    icon: "🔴",
    tagline: "Bring 4 Steine in eine Reihe - gegen die KI!",
    realDifficulty: true,
    load: () => import("./games/connectFour.js"),
  },
  {
    id: "colorTubes",
    name: "Farbröhren",
    icon: "🧪",
    tagline: "Sortiere die Farben, bis jede Röhre nur eine hat.",
    realDifficulty: true,
    load: () => import("./games/colorTubes.js"),
  },
  {
    id: "colorMatch",
    name: "Farbe Nachmachen",
    icon: "🖌️",
    tagline: "Mische die Zielfarbe so genau wie möglich nach.",
    realDifficulty: true,
    soloOnly: true,
    load: () => import("./games/colorMatch.js"),
  },
  {
    id: "mazeRunner",
    name: "Maze",
    icon: "🌀",
    tagline: "Führe die Kugel durchs Labyrinth zum Ziel.",
    realDifficulty: true,
    soloOnly: true,
    load: () => import("./games/mazeRunner.js"),
  },
  {
    id: "drawShape",
    name: "Form Zeichnen",
    icon: "✏️",
    tagline: "Das Glücksrad wählt - du zeichnest die Form nach.",
    realDifficulty: true,
    soloOnly: true,
    load: () => import("./games/drawShape.js"),
  },
  {
    id: "maisMission",
    name: "Mais-Mission",
    icon: "🚁",
    tagline: "3D: Merk dir den Flug durchs Maisfeld - und finde den Schatz!",
    realDifficulty: true,
    soloOnly: true, // 3D-Einzelspiel mit zufälligem Feld, nicht für Online-Runden mit gemeinsamem Seed
    load: () => import("./games/maisMission.js"),
  },
];

export function getArcadeGame(id) {
  return ARCADE_GAMES.find((g) => g.id === id) ?? null;
}
