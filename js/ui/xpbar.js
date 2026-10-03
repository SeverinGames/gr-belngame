// js/ui/xpbar.js - Level-/XP-Balken als HTML (Startseite, Ergebnis, Profil)
import { xpNeeded, describeLevelReward } from "../progress/levels.js";
export function xpBarHtml(profile, extraClass = "", withNext = false) {
  const need = xpNeeded(profile.level);
  const pct = Math.min(100, Math.round((profile.xp / need) * 100));
  const next = withNext ? `<div class="xpbar__next">Noch ${need - profile.xp} XP bis Level ${profile.level + 1} → ${describeLevelReward(profile.level + 1)}</div>` : "";
  return `<div class="xpbar ${extraClass}"><div class="xpbar__top"><span class="xpbar__level">LEVEL ${profile.level}</span><span class="xpbar__xp">${profile.xp} / ${need} XP</span></div><div class="xpbar__track"><div class="xpbar__fill" style="width:${pct}%"></div></div>${next}</div>`;
}
