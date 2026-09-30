// js/shop/creatorCodes.js
// Creator-Code-Einlösung. Die "schon eingelöst"-Sperre pro Spieler läuft
// bewusst rein lokal im Profil (kein Accountsystem vorhanden) - die globale
// Nutzungsstatistik (wie oft ein Code INSGESAMT eingelöst wurde) läuft
// separat über den Server (server/creatorCodeStats.js, nur für den Host
// über einen geschützten Endpunkt einsehbar, siehe README).
import { grantRewards } from "../rewards/profile.js";

// Ö technisch unproblematisch in JS, aber Eingaben werden trotzdem auf eine
// eindeutige Schreibweise normalisiert, damit "LÖNDI", "Löndi" und "LOENDI"
// alle denselben Code treffen.
function normalize(raw) {
  return (raw || "")
    .trim()
    .toUpperCase()
    .replace(/Ä/g, "AE")
    .replace(/Ö/g, "OE")
    .replace(/Ü/g, "UE")
    .replace(/ß/g, "SS");
}

// Tolerierte Alternativschreibweisen (Ü als U getippt o.ä.)
const CODE_ALIASES = { BRUSHKA: "BRUESHKA", LONDI: "LOENDI" };

export const CREATOR_CODES = {
  BIGSEVI: { label: "BIGSEVI", reward: { coins: 250 } },
  LOENDI: { label: "LÖNDI", reward: { coins: 250 } },
  BRUESHKA: { label: "BRÜSHKA", reward: { coins: 250 } }, // Eingabe "BRÜSHKA" wird zu BRUESHKA normalisiert
};

// notifyServer: optionale Funktion (code) => void, um die globale
// Nutzungsstatistik hochzuzählen (fire-and-forget, siehe main.js).
export function redeemCreatorCode(profile, rawInput, notifyServer) {
  let code = normalize(rawInput);
  if (CODE_ALIASES[code]) code = CODE_ALIASES[code]; // z.B. BRUSHKA (Ü -> U) tolerieren
  if (!code) return { success: false, reason: "empty" };
  const def = CREATOR_CODES[code];
  if (!def) return { success: false, reason: "invalid" };
  if (!profile.redeemedCodes) profile.redeemedCodes = [];
  if (profile.redeemedCodes.includes(code)) return { success: false, reason: "already-redeemed", label: def.label };

  grantRewards(profile, def.reward);
  profile.redeemedCodes.push(code);
  if (typeof notifyServer === "function") notifyServer(code);

  return { success: true, code, label: def.label, reward: def.reward };
}
