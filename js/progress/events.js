// js/progress/events.js
// Kleine Ereignis-Warteschlange: Kern-Logik (Level-Ups, Meilensteine, ...)
// legt hier ab, was der Spieler gerade erreicht hat. Die UI
// (ui/celebrations.js) holt die Einträge ab und zeigt sie an - so bleibt die
// Spiellogik frei von DOM-Code und jede Quelle (Minispiel, Mission, Glücksrad,
// Daily, ...) löst automatisch dieselben Erfolgserlebnisse aus.
const queue = [];
export function pushEvent(ev) { queue.push(ev); }
export function drainEvents() { return queue.splice(0, queue.length); }
export function hasEvents() { return queue.length > 0; }
