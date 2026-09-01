// js/inventory/inventory.js
import { getItemDef } from "./items.js";

// inventory: { itemId: count }
export function addItem(inventory, itemId, count = 1) {
  inventory[itemId] = (inventory[itemId] ?? 0) + count;
  return inventory;
}

export function hasItem(inventory, itemId) {
  return (inventory[itemId] ?? 0) > 0;
}

export function itemCount(inventory, itemId) {
  return inventory[itemId] ?? 0;
}

// Gibt { success, effect } zurück. effect enthält z.B. { hp: 35 }, das der
// Aufrufer (RunManager/UI) auf den Spieler anwenden muss - Inventory kennt
// den Spielerzustand selbst nicht (klare Verantwortlichkeit, Punkt 131).
export function useItem(inventory, itemId) {
  if (!hasItem(inventory, itemId)) return { success: false, effect: null };
  const def = getItemDef(itemId);
  if (!def) return { success: false, effect: null };
  inventory[itemId] -= 1;
  if (inventory[itemId] <= 0) delete inventory[itemId];
  return { success: true, effect: def.useEffect ?? null, def };
}

export function listInventory(inventory) {
  return Object.entries(inventory)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => ({ def: getItemDef(id), count }))
    .filter((entry) => entry.def);
}
