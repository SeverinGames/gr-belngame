// js/world/roomLayout.js
// Erzeugt eine begehbare Raumgeometrie und platziert die (vom bestehenden
// RandomEngine gelieferten) Türen als echte Objekte an den Wänden - der
// Spieler läuft hin, statt einen Button zu klicken (Punkt 7 des Prompts).

export const ROOM_WIDTH = 640;
export const ROOM_HEIGHT = 420;
const WALL = 24;

// Feste Wand-Slots, in dieser Reihenfolge belegt (bis zu 4 Türen)
const DOOR_SLOTS = [
  { wall: "right", x: ROOM_WIDTH - WALL, y: ROOM_HEIGHT / 2, facing: "left" },
  { wall: "left", x: WALL, y: ROOM_HEIGHT / 2, facing: "right" },
  { wall: "bottom", x: ROOM_WIDTH / 2, y: ROOM_HEIGHT - WALL, facing: "up" },
  { wall: "top", x: ROOM_WIDTH / 2, y: WALL, facing: "down" },
];

// doors: Array aus generateDoors() (id, roomType, shownHint)
export function buildRoomLayout(doors) {
  const placedDoors = doors.map((door, i) => ({
    ...door,
    ...DOOR_SLOTS[i % DOOR_SLOTS.length],
    width: 46,
    height: 46,
  }));
  return {
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    wallThickness: WALL,
    doors: placedDoors,
    // Spawnpunkt in der Raummitte, leicht versetzt von Türen
    spawn: { x: ROOM_WIDTH / 2, y: ROOM_HEIGHT / 2 },
  };
}

export function isInsideRoom(room, x, y, radius = 12) {
  return (
    x - radius > room.wallThickness &&
    x + radius < room.width - room.wallThickness &&
    y - radius > room.wallThickness &&
    y + radius < room.height - room.wallThickness
  );
}

export function distanceToDoor(door, x, y) {
  const dx = door.x - x;
  const dy = door.y - y;
  return Math.sqrt(dx * dx + dy * dy);
}

export const INTERACT_RANGE = 46;
