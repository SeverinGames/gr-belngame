// js/ui/xpbar.js - Level-/XP-Balken als HTML (Startseite, Ergebnis, Profil)
import { xpNeeded } from "../progress/levels.js";
export function xpBarHtml(profile, extraClass = "") {
  const need = xpNeeded(profile.level);
  const pct = Math.min(100, Math.round((profile.xp / need) * 100));
  return `<div class="xpbar ${extraClass}"><div class="xpbar__top"><span class="xpbar__level">LEVEL ${profile.level}</span><span class="xpbar__xp">${profile.xp} / ${need} XP</span></div><div class="xpbar__track"><div class="xpbar__fill" style="width:${pct}%"></div></div></div>`;
}
