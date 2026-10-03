// js/network/leaderboardClient.js
// Client für die echte Gesamt-Rangliste (siehe server/leaderboard.js).
// Fehlschläge werden ehrlich gemeldet - es gibt KEINE Fake-Einträge.
import { SERVER_URL } from "./config.js";
import { totalPartyPoints } from "../progress/partyPoints.js";
import { equippedCosmetic } from "../progress/cosmetics.js";
import { buildPublicProfile } from "./publicProfile.js";

const apiBase = () => SERVER_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:").replace(/\/$/, "");

// Render Free schläft nach Leerlauf ein und braucht beim Aufwecken bis ~1 Min.
async function request(path, opts = {}, timeoutMs = 70000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(apiBase() + path, { ...opts, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || `http-${res.status}` };
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: err.name === "AbortError" ? "timeout" : "offline" };
  } finally {
    clearTimeout(t);
  }
}

export function fetchTop() { return request("/leaderboard"); }
export function fetchPublicProfile(id) { return request(`/leaderboard/profile?id=${encodeURIComponent(id)}`); }

export function submitMyScore(profile) {
  const title = equippedCosmetic(profile, "title");
  const emote = equippedCosmetic(profile, "emote");
  return request("/leaderboard/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: profile.playerKey, name: profile.nickname, pp: totalPartyPoints(profile), level: profile.level,
      title: title?.name ?? "", emote: emote?.icon ?? "", profile: buildPublicProfile(profile),
    }),
  });
}

// Leise im Hintergrund melden (nur mit Namen; höchstens alle 20 s, nur bei Änderung)
let lastSent = { pp: -1, name: null, at: 0 };
export function autoSync(profile) {
  if (!profile.nickname) return;
  const pp = totalPartyPoints(profile);
  const now = Date.now();
  if (lastSent.pp === pp && lastSent.name === profile.nickname) return;
  if (now - lastSent.at < 20000) return;
  lastSent = { pp, name: profile.nickname, at: now };
  submitMyScore(profile).catch(() => {});
}

export const ERROR_TEXT = {
  offline: "Server nicht erreichbar. Bist du online?",
  timeout: "Der Server antwortet nicht (er wacht evtl. gerade erst auf). Bitte später erneut versuchen.",
  "name-taken": "Dieser Name ist in der Rangliste schon vergeben. Wähle im Profil einen anderen.",
  "not-found": "Dieses Profil gibt es nicht mehr.",
  "too-fast": "Zu viele Anfragen - bitte kurz warten.",
  "bad-name": "Der Name ist für die Rangliste ungültig.",
  "bad-score": "Die Punktzahl wurde vom Server nicht akzeptiert.",
};
