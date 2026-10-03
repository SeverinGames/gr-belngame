// js/progress/badges.js
// Zähler-Badges ("MISSIONEN ③"): zeigen, WO etwas abholbar ist. Es erscheinen
// nur Zahlen > 0 - wenn nichts wartet, bleibt der Bereich sauber.
import { claimableMissions } from "../missions/missions.js";
import { canClaimDaily } from "../rewards/dailyReward.js";
import { spinsAvailable } from "../rewards/wheel.js";

export function badgeCounts(profile) {
  const daily = canClaimDaily(profile) ? 1 : 0;
  const mini = profile.bonusBoxes ?? 0;
  const vouchers = Object.values(profile.vouchers ?? {}).reduce((a, b) => a + b, 0);
  const wheel = spinsAvailable(profile);
  const missions = claimableMissions(profile);
  return {
    missions,
    wheel,
    shop: daily + mini + vouchers, // Gratis-Boxen & tägliche Belohnung
    shopTabs: { wheel, bonus: daily + mini + vouchers },
    missionTabs: {
      daily: claimableMissions(profile, "daily"), short: claimableMissions(profile, "short"),
      long: claimableMissions(profile, "long"), milestone: claimableMissions(profile, "milestone"),
    },
    daily, mini, vouchers,
  };
}

// Kleines Badge an ein Element hängen/aktualisieren (n = 0 -> entfernen)
export function setBadge(elm, n) {
  if (!elm) return;
  let b = elm.querySelector(":scope > .badge");
  if (!n) { b?.remove(); elm.classList.remove("has-badge"); return; }
  if (!b) { b = document.createElement("span"); b.className = "badge"; elm.appendChild(b); }
  b.textContent = n > 9 ? "9+" : String(n);
  elm.classList.add("has-badge");
}
export function refreshBadges(profile) {
  const c = badgeCounts(profile);
  setBadge(document.querySelector("#btn-missions"), c.missions);
  setBadge(document.querySelector("#btn-shop"), c.shop);
  setBadge(document.querySelector("#btn-wheel"), c.wheel);
  setBadge(document.querySelector('#shop-tabs [data-tab="wheel"]'), c.shopTabs.wheel);
  setBadge(document.querySelector('#shop-tabs [data-tab="bonus"]'), c.shopTabs.bonus);
  for (const [k, n] of Object.entries(c.missionTabs)) setBadge(document.querySelector(`#mission-tabs [data-tab="${k}"]`), n);
  return c;
}
