// server/creatorCodeStats.js
// Einfache, dateibasierte Zähler-Persistenz für Creator-Code-Einlösungen -
// das einzige "Backend", das dieses Projekt hat. Kein Fake: wenn niemand
// einen Code einlöst, steht hier ehrlich 0. Auf Plattformen mit flüchtigem
// Dateisystem (z.B. Render Free Tier nach einem Neu-Deploy) können die
// Zähler zurückgesetzt werden - das ist eine bekannte Einschränkung, siehe
// README.
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATS_FILE = join(__dirname, "creator-code-stats.json");

function load() {
  if (!existsSync(STATS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

let stats = load();

export function recordRedemption(code) {
  if (!code) return;
  stats[code] = (stats[code] ?? 0) + 1;
  try {
    writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error("Konnte Creator-Code-Statistik nicht speichern:", err.message);
  }
}

export function getCreatorCodeStats() {
  return { ...stats };
}
