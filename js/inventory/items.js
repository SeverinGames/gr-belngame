// js/inventory/items.js
export const ITEM_DEFS = [
  {
    id: "key",
    name: "Schlüssel",
    icon: "🔑",
    description: "Öffnet verschlossene Türen.",
    stackable: true,
  },
  {
    id: "medkit",
    name: "Medkit",
    icon: "🩹",
    description: "Heilt sofort einen Teil deiner HP.",
    stackable: true,
    useEffect: { hp: 35 },
  },
  {
    id: "battery",
    name: "Batterie",
    icon: "🔋",
    description: "Aktiviert Geräte in dunklen Räumen.",
    stackable: true,
  },
  {
    id: "map",
    name: "Karte",
    icon: "🗺",
    description: "Zeigt an, dass in diesem Raum garantiert kein Softlock lauert.",
    stackable: true,
  },
];

export function getItemDef(id) {
  return ITEM_DEFS.find((i) => i.id === id) ?? null;
}
