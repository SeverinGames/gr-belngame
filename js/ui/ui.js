// js/ui/ui.js
// Nach der Umstellung auf "Big Sevis Minispiel Party" enthält dieses Modul
// nur noch UI-Funktionen, die weiterhin gebraucht werden: Skin-Badge, Profil-
// Kopfzeile, Missionen, tägliche Belohnung, Shop und der generische
// Screen-Wechsel. Die komplette Tür-Spiel-UI (HUD, Türen, Ausgang/Weiter,
// Endbildschirm, Bot-Anzeigen) wurde entfernt, weil das Türen-Spiel selbst
// entfernt wurde.
import { getSkinById, RARITY } from "../skins/skins.js";
import { mountSkinAvatar } from "../arcade/engine.js";

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
  const box = el("#profile-summary");
  if (!box) return;
  box.textContent = `Level ${profile.level} · ${profile.coins} 🪙 Münzen`;
}

export function renderMissions(progressList, onClaim) {
  const box = el("#missions-list");
  box.innerHTML = "";
  progressList.forEach(({ def, current, done, claimed }) => {
    const row = document.createElement("div");
    row.className = "mission-row";
    const pct = Math.min(100, Math.round((current / def.target) * 100));
    row.innerHTML = `
      <div class="mission-label">${def.label}</div>
      <div class="mission-bar"><div style="width:${pct}%"></div></div>
      <div class="mission-progress">${Math.min(current, def.target)}/${def.target}</div>
    `;
    if (done && !claimed) {
      const btn = document.createElement("button");
      btn.className = "btn btn--primary btn--small";
      btn.textContent = `+${rewardLabel(def)} abholen`;
      btn.addEventListener("click", () => onClaim(def.id));
      row.appendChild(btn);
    } else if (claimed) {
      row.insertAdjacentHTML("beforeend", '<div class="mission-claimed">✓ abgeholt</div>');
    }
    box.appendChild(row);
  });
}
function rewardLabel(def) {
  const r = def.reward;
  if (r.boxId) return "Box";
  const parts = [];
  if (r.coins) parts.push(`${r.coins} 🪙`);
  if (r.xp) parts.push(`${r.xp} XP`);
  return parts.join(" + ");
}

export function renderDailyStatus(canClaim, streakDay, nextStreakDay, nextRewardText) {
  el("#daily-status").textContent = canClaim
    ? `Tag ${nextStreakDay} von 7 - heute gibt's: ${nextRewardText}`
    : `Schon abgeholt. Aktuelle Serie: Tag ${streakDay}. Komm morgen wieder!`;
  el("#btn-daily-claim").disabled = !canClaim;
  el("#daily-claimed-banner").classList.add("hidden");
}

export function renderDailyClaimed(rewardText, streakDay) {
  const banner = el("#daily-claimed-banner");
  banner.textContent = `🎉 Du hast ${rewardText} erhalten! (Serie: Tag ${streakDay})`;
  banner.classList.remove("hidden");
}

// --- Shop (ersetzt die alte Mystery-Box-mit-Schlüsseln-Anzeige) -----------
export function renderShop(profile, boxes, onBuy) {
  el("#shop-coins").textContent = `${profile.coins} 🪙`;
  const list = el("#shop-box-list");
  list.innerHTML = "";
  boxes.forEach((def) => {
    const affordable = profile.coins >= def.price;
    const card = document.createElement("div");
    card.className = "shop-card";
    card.innerHTML = `
      <div class="shop-card__icon">${def.icon}</div>
      <div class="shop-card__name">${def.name}</div>
      <div class="shop-card__tagline">${def.tagline}</div>
      <button class="btn btn--primary shop-card__buy" ${affordable ? "" : "disabled"}>${def.price} 🪙</button>
    `;
    card.querySelector(".shop-card__buy").addEventListener("click", () => onBuy(def.id));
    list.appendChild(card);
  });
}

export function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  el(`#${id}`).classList.remove("hidden");
}
