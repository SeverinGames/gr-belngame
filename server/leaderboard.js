// server/leaderboard.js
// Echte, gemeinsame Gesamt-Rangliste nach PARTY-PUNKTEN (nicht nach Roh-Scores).
//
// So funktioniert's ehrlich:
//  - Der Client berechnet seine Party-Punkte (Summe der persönlichen Bestwerte
//    je Minispiel + Schwierigkeit) und meldet sie samt Spielername an den Server.
//  - Der Server speichert pro Spieler EINEN Eintrag (identifiziert über den
//    Hash eines geheimen Schlüssels, den nur das eigene Gerät kennt - der
//    Schlüssel selbst wird nie gespeichert oder ausgeliefert).
//  - Der Server prüft Name, Wertebereich und Update-Rate. Er kann NICHT prüfen,
//    ob der Client ehrlich gespielt hat (Spielstand liegt lokal im Browser).
//    Für ein manipulationssicheres Ranking bräuchte man Accounts + serverseitige
//    Spiellogik - siehe README.
//  - Persistenz: JSON-Datei. Auf Render Free ist das Dateisystem flüchtig; die
//    Liste füllt sich aber von selbst wieder, weil jeder Client beim nächsten
//    Besuch seinen Stand erneut meldet. Für dauerhafte Speicherung später eine
//    Datenbank anbinden (nur load()/persist() ersetzen).
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.LEADERBOARD_FILE || join(__dirname, "leaderboard.json");

// Bei einem Komplett-Reset diese Kennung ändern: Einträge aus früheren
// Epochen werden beim Start verworfen (Rangliste startet bei null).
const EPOCH = "2026-10-reset-1";
const MAX_PP = 40000; // Obergrenze für plausible Party-Punkte
const MAX_ENTRIES = 5000;
const MIN_SUBMIT_GAP_MS = 1500;
const NAME_RE = /^[A-Za-z0-9ÄÖÜäöüß _\-.]{3,14}$/;
const EMOTES = new Set(["😎", "🥳", "🤩", "😈", "🦄", "🤯"]);

let entries = new Map(); // id -> { id, name, pp, level, title, emote, updated }
const lastSubmit = new Map(); // id -> ms

function load() {
  try {
    if (!existsSync(FILE)) return;
    const data = JSON.parse(readFileSync(FILE, "utf-8"));
    if (!data || Array.isArray(data) || data.epoch !== EPOCH) { entries = new Map(); return; } // alte Rangliste -> Reset
    entries = new Map(data.entries.map((e) => [e.id, e]));
  } catch { entries = new Map(); }
}
let persistTimer = null;
function persist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try { writeFileSync(FILE, JSON.stringify({ epoch: EPOCH, entries: [...entries.values()] })); }
    catch (err) { console.error("Rangliste konnte nicht gespeichert werden:", err.message); }
  }, 2000);
}
load();

const hashKey = (key) => createHash("sha256").update(String(key)).digest("hex").slice(0, 16);
function sorted() {
  return [...entries.values()].sort((a, b) => b.pp - a.pp || a.updated - b.updated);
}
const pub = (e, rank) => ({ rank, name: e.name, pp: e.pp, level: e.level, title: e.title, emote: e.emote });

export function getTop(limit = 50) {
  const all = sorted();
  return { total: all.length, top: all.slice(0, limit).map((e, i) => pub(e, i + 1)) };
}

export function submitScore(body, limit = 50) {
  const { key, name, pp, level, title, emote } = body ?? {};
  if (typeof key !== "string" || key.length < 16 || key.length > 100) return { error: "bad-key" };
  if (typeof name !== "string" || !NAME_RE.test(name.trim())) return { error: "bad-name" };
  const ppN = Math.round(Number(pp));
  if (!Number.isFinite(ppN) || ppN < 0 || ppN > MAX_PP) return { error: "bad-score" };
  const id = hashKey(key);
  const now = Date.now();
  if (now - (lastSubmit.get(id) ?? 0) < MIN_SUBMIT_GAP_MS) return { error: "too-fast" };
  lastSubmit.set(id, now);

  const cleanName = name.trim().replace(/\s+/g, " ");
  for (const e of entries.values()) {
    if (e.id !== id && e.name.toLowerCase() === cleanName.toLowerCase()) return { error: "name-taken" };
  }
  const prev = entries.get(id);
  entries.set(id, {
    id,
    name: cleanName,
    pp: ppN,
    level: Math.min(999, Math.max(1, Math.round(Number(level)) || 1)),
    title: typeof title === "string" ? title.slice(0, 24) : "",
    emote: EMOTES.has(emote) ? emote : "",
    updated: prev && prev.pp === ppN ? prev.updated : now,
  });
  if (entries.size > MAX_ENTRIES) {
    const keep = sorted().slice(0, MAX_ENTRIES);
    entries = new Map(keep.map((e) => [e.id, e]));
  }
  persist();

  const all = sorted();
  const rank = all.findIndex((e) => e.id === id) + 1;
  return { ok: true, me: { ...pub(entries.get(id), rank) }, total: all.length, top: all.slice(0, limit).map((e, i) => pub(e, i + 1)) };
}
