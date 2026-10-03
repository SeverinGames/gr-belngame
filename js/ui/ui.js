// js/ui/ui.js
// Nach der Umstellung auf "Big Sevis Minispiel Party" enthält dieses Modul
// nur noch UI-Funktionen, die weiterhin gebraucht werden: Skin-Badge, Profil-
// Kopfzeile, Missionen, tägliche Belohnung, Shop und der generische
// Screen-Wechsel. Die komplette Tür-Spiel-UI (HUD, Türen, Ausgang/Weiter,
// Endbildschirm, Bot-Anzeigen) wurde entfernt, weil das Türen-Spiel selbst
// entfernt wurde.
import { getSkinById, RARITY } from "../skins/skins.js";
import { mountSkinAvatar } from "../arcade/engine.js";
import { renderHomeCard } from "./screens.js";

const el = (sel) => document.querySelector(sel);

let heroAvatar = null;

export function renderSkinBadge(skinId) {
  const skin = getSkinById(skinId);
  if (!skin) return;
  const rarity = RARITY[skin.rarity];
  const badge = el("#skin-badge");
  badge.textContent = `${skin.name} · ${rarity.label}`;
  badge.style.borderColor = rarity.color;
  badge.style.color = rarity.color;
  badge.style.boxShadow = rarity.glow ? `0 0 12px ${rarity.color}` : "none";

  // Hero-Vorschau auf der Startseite: dieselbe animierte Figur wie in den
  // Minispielen, damit der eigene Skin gleich beim Öffnen der Seite präsent
  // ist (Punkt 8 des Prompts).
  const heroBox = el("#hero-skin-preview");
  if (heroBox) {
    if (heroAvatar) heroAvatar.destroy();
    heroBox.innerHTML = "";
    heroAvatar = mountSkinAvatar(heroBox, skinId, { size: 96 });
    heroBox.style.setProperty("--rarity-color", rarity.color);
    heroBox.classList.toggle("hero-skin-preview--glow", !!rarity.glow);
  }
}

export function renderProfileSummary(profile) {
  renderHomeCard(profile);
}

export function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  el(`#${id}`).classList.remove("hidden");
}
