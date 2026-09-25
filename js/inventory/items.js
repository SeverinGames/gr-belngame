// js/inventory/items.js
// Icons als kleine, monochrome Inline-SVGs (currentColor) statt Emoji - damit
// sie auf jedem Gerät identisch aussehen und nicht wie generische KI-Optik wirken.
const ICON_KEY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="4"/><line x1="11" y1="11" x2="20" y2="20"/><line x1="15" y1="15" x2="17.5" y2="12.5"/><line x1="17.5" y1="17.5" x2="20" y2="15"/></svg>';
const ICON_MEDKIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>';
const ICON_BATTERY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="8" width="17" height="8" rx="1.5"/><line x1="21" y1="11" x2="21" y2="13"/><line x1="6" y1="11" x2="6" y2="13"/><line x1="10" y1="11" x2="10" y2="13"/></svg>';
const ICON_MAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><line x1="9" y1="4" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="20"/></svg>';

export const ITEM_DEFS = [
  {
    id: "key",
    name: "Schlüssel",
    icon: ICON_KEY,
    description: "Öffnet verschlossene Türen.",
    stackable: true,
  },
  {
    id: "medkit",
    name: "Medkit",
    icon: ICON_MEDKIT,
    description: "Heilt sofort einen Teil deiner HP.",
    stackable: true,
    useEffect: { hp: 35 },
  },
  {
    id: "battery",
    name: "Batterie",
    icon: ICON_BATTERY,
    description: "Aktiviert Geräte in dunklen Räumen.",
    stackable: true,
  },
  {
    id: "map",
    name: "Karte",
    icon: ICON_MAP,
    description: "Zeigt an, dass in diesem Raum garantiert kein Softlock lauert.",
    stackable: true,
  },
];

export function getItemDef(id) {
  return ITEM_DEFS.find((i) => i.id === id) ?? null;
}
