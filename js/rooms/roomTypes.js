// js/rooms/roomTypes.js
// Datengetriebene Raumtypen. weight = Basis-Zufallsgewicht (höher = häufiger).
// tags steuern das Anti-Repetition-System (siehe randomEngine.js).

export const ROOM_TYPES = [
  { id: "treasure",     label: "Schatzraum",        weight: 10, tags: ["reward"] },
  { id: "trap",         label: "Fallenraum",        weight: 9,  tags: ["danger"] },
  { id: "monster",      label: "Monsterraum",       weight: 8,  tags: ["danger", "combat"] },
  { id: "puzzle",       label: "Rätselraum",        weight: 7,  tags: ["neutral"] },
  { id: "merchant",     label: "Händlerraum",       weight: 5,  tags: ["neutral"] },
  { id: "mirror",       label: "Spiegelraum",       weight: 4,  tags: ["strange"] },
  { id: "dark",         label: "Dunkelraum",        weight: 5,  tags: ["danger"] },
  { id: "timeChallenge",label: "Zeit-Challenge",    weight: 5,  tags: ["neutral"] },
  { id: "chase",        label: "Verfolgungsraum",   weight: 4,  tags: ["danger"] },
  { id: "safe",         label: "Safe-Room",         weight: 6,  tags: ["safe"] },
  { id: "fakeSafe",     label: "Fake-Safe-Room",    weight: 3,  tags: ["safe", "danger"] },
  { id: "secret",       label: "Geheimraum",        weight: 2,  tags: ["reward", "rare"] },
  { id: "random",       label: "Zufallsraum",       weight: 6,  tags: ["strange"] },
  { id: "boss",         label: "Bossraum",          weight: 1,  tags: ["danger", "rare"] },
  { id: "multiDoor",    label: "Mehrtür-Raum",      weight: 6,  tags: ["neutral"] },
  { id: "teleporter",   label: "Teleporterraum",    weight: 4,  tags: ["strange"] },
  { id: "teamwork",     label: "Teamwork-Raum",     weight: 4,  tags: ["neutral"] },
  { id: "saboteur",     label: "Saboteur-Raum",     weight: 3,  tags: ["strange", "danger"] },
  { id: "mystery",      label: "Mystery-Raum",      weight: 7,  tags: ["strange"] },
];

export function getRoomType(id) {
  return ROOM_TYPES.find((r) => r.id === id) ?? null;
}
