// js/ui/screens.js
// Bildschirme des Fortschrittssystems: Startseiten-Karte, Shop (Tabs + tägliche
// Belohnung), Profil, öffentliche Profile, Rangliste, Missionen.
import { SKINS, RARITY, getSkinById } from "../skins/skins.js";
import { ARCADE_GAMES } from "../arcade/registry.js";
import { mountSkinAvatar } from "../arcade/engine.js";
import { xpBarHtml } from "./xpbar.js";
import { xpNeeded, describeLevelReward, levelReward } from "../progress/levels.js";
import { COSMETICS, COSMETIC_CATEGORIES, ownsCosmetic, equippedCosmetic, cosmeticCounts, ensureCosmetics, loadoutView } from "../progress/cosmetics.js";
import { totalPartyPoints, bestKey } from "../progress/partyPoints.js";
import { dailyGoalsView, nextMilestones } from "../progress/milestones.js";
import { MINI_BOX_PRICE } from "../shop/shop.js";
import { ROUNDS_PER_BONUS_SPIN, MAX_ROUND_SPINS_PER_DAY, ensureDaily } from "../rewards/profile.js";
import { MAX_BONUS_SPINS } from "../progress/rewardOps.js";
import { canFreeSpin, WHEEL_SLICES } from "../rewards/wheel.js";
import { canClaimDaily, previewReward, getDailyTable } from "../rewards/dailyReward.js";
import { MISSION_CATEGORIES, listMissionProgress } from "../missions/missions.js";
import { DIFFICULTY_ORDER, formatScore } from "../arcade/controller.js";
import { refreshBadges } from "../progress/badges.js";

const el = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n).toLocaleString("de-DE");
const bar = (cur, max, cls = "") => `<div class="mini-bar ${cls}"><div style="width:${Math.min(100, Math.round((cur / Math.max(1, max)) * 100))}%"></div></div>`;

// Name mit Badge, Namensfarbe und Emote (überall gleich dargestellt)
export function nameHtml(name, view) {
  const nc = view?.nameColor?.id && view.nameColor.id !== "none" ? ` namecolor--${view.nameColor.id}` : "";
  return `${view?.badge?.icon ? `<span class="nm-badge">${view.badge.icon}</span>` : ""}<span class="nm-name${nc}">${name ? esc(name) : "<em>Gast</em>"}</span>${view?.emote?.icon ? `<span class="nm-emote">${view.emote.icon}</span>` : ""}`;
}
const myView = (profile) => ({
  badge: equippedCosmetic(profile, "badge"), emote: equippedCosmetic(profile, "emote"), nameColor: equippedCosmetic(profile, "nameColor"),
  title: equippedCosmetic(profile, "title"), frame: equippedCosmetic(profile, "frame"), effect: equippedCosmetic(profile, "effect"),
});

// ---------------------------------------------------------------- Startseite
export function renderHomeCard(profile) {
  const box = el("#profile-summary");
  if (!box) return;
  const v = myView(profile);
  box.innerHTML = `
    <div class="home-card__name">${nameHtml(profile.nickname, v)}<small>${esc(v.title?.name ?? "")}</small></div>
    ${xpBarHtml(profile, "xpbar--home")}
    <div class="home-card__stats"><span>🪙 ${fmt(profile.coins)}</span><span>⭐ ${fmt(totalPartyPoints(profile))} Party-Punkte</span></div>`;
}

// ---------------------------------------------------------------- Shop
export function setShopTab(tab) {
  document.querySelectorAll("#shop-tabs .tab").forEach((b) => b.classList.toggle("tab--active", b.dataset.tab === tab));
  document.querySelectorAll(".shop-tab").forEach((p) => p.classList.toggle("hidden", p.id !== `shop-tab-${tab}`));
}

export function renderShop(profile, boxes, h) {
  el("#shop-coins").textContent = `${fmt(profile.coins)} 🪙`;
  renderDailyCard(profile, h);
  renderBoxesTab(profile, boxes, h);
  renderWheelTab(profile, h);
  renderBonusTab(profile, h);
  renderCollectionTab(profile);
  refreshBadges(profile);
}

// Tägliche Belohnung = Bereich im Shop (kein eigener Bildschirm mehr)
function renderDailyCard(profile, h) {
  const can = canClaimDaily(profile);
  const prev = previewReward(profile);
  const streak = profile.dailyReward.streakDay ?? 0;
  const table = getDailyTable();
  const dots = table.map((_, i) => {
    const day = i + 1;
    const done = can ? day < prev.streakDay : day <= streak;
    const today = can && day === prev.streakDay;
    return `<span class="streak-dot ${done ? "streak-dot--done" : ""} ${today ? "streak-dot--today" : ""}">${day === 7 ? "🎁" : day}</span>`;
  }).join("");
  el("#shop-daily").innerHTML = `
    <div class="daily-card ${can ? "daily-card--ready" : ""}">
      <div class="daily-card__top"><span class="daily-card__title">🎁 TÄGLICHE BELOHNUNG</span>${can ? '<span class="pill pill--ready">BEREIT</span>' : ""}</div>
      <div class="streak">${dots}</div>
      ${can
        ? `<div class="daily-card__text">Tag ${prev.streakDay} von 7: <b>${esc(prev.text)}</b></div><button id="btn-daily-claim" class="btn btn--primary">HEUTE ABHOLEN</button>`
        : `<div class="daily-card__text daily-card__text--dim">✓ Heute abgeholt · Morgen wieder verfügbar (Serie: Tag ${streak})</div>`}
      <div id="daily-claimed-banner" class="daily-claimed-banner hidden"></div>
    </div>`;
  el("#btn-daily-claim")?.addEventListener("click", h.onClaimDaily);
}

function renderBoxesTab(profile, boxes, h) {
  const next = boxes.find((b) => profile.level >= b.unlockLevel && profile.coins < b.price);
  const root = el("#shop-box-list");
  root.innerHTML = `<div class="shop-section-title">Skin-Boxen</div>` + (next
    ? `<div class="box-progress"><div class="box-progress__top"><span>Nächste Box: ${next.icon} ${next.name}</span><span>${fmt(profile.coins)} / ${fmt(next.price)} 🪙</span></div>${bar(profile.coins, next.price)}</div>`
    : "");
  const grid = document.createElement("div");
  grid.className = "shop-box-grid";
  boxes.forEach((def) => {
    const locked = profile.level < def.unlockLevel;
    const affordable = profile.coins >= def.price;
    const card = document.createElement("div");
    card.className = `shop-card ${locked ? "shop-card--locked" : ""} ${!locked && affordable ? "shop-card--ready" : ""}`;
    card.innerHTML = `
      <div class="shop-card__icon">${def.icon}</div>
      <div class="shop-card__name">${def.name}</div>
      <div class="shop-card__tagline">${def.tagline}</div>
      ${locked ? "" : !affordable ? `${bar(profile.coins, def.price)}<div class="shop-card__missing">noch ${fmt(def.price - profile.coins)} 🪙</div>` : ""}
      <button class="btn btn--primary shop-card__buy" ${!locked && affordable ? "" : "disabled"}>${locked ? `🔒 ab Level ${def.unlockLevel}` : `${fmt(def.price)} 🪙`}</button>`;
    card.querySelector(".shop-card__buy").addEventListener("click", () => h.onBuyBox(def.id));
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

function renderWheelTab(profile, h) {
  const daily = ensureDaily(profile);
  const free = canFreeSpin(profile);
  const stock = profile.wheel.bonusSpins ?? 0;
  const total = (free ? 1 : 0) + stock;
  const progress = profile.stats.arcadeRoundsPlayed % ROUNDS_PER_BONUS_SPIN;
  const capped = daily.roundSpins >= MAX_ROUND_SPINS_PER_DAY;
  el("#shop-tab-wheel").innerHTML = `
    <div class="info-card ${total > 0 ? "info-card--ready" : ""}">
      <div class="spin-count"><span class="spin-count__n">${total}</span><span class="spin-count__l">${total === 1 ? "Dreh verfügbar" : "Drehs verfügbar"}</span></div>
      <div class="info-row"><span>Täglicher Gratis-Dreh</span><b>${free ? "bereit ✅" : "morgen wieder"}</b></div>
      <div class="info-row"><span>Bonus-Drehs im Vorrat</span><b>${stock} / ${MAX_BONUS_SPINS}</b></div>
      <button id="btn-shop-open-wheel" class="btn ${total > 0 ? "btn--primary" : "btn--arcade"}">${total > 0 ? "JETZT DREHEN" : "ZUM GLÜCKSRAD"}</button>
    </div>
    <div class="info-card">
      <div class="info-card__title">Wie bekomme ich mehr Drehs?</div>
      <div class="howto"><span>🎮</span><div>Alle ${ROUNDS_PER_BONUS_SPIN} Runden ein Bonus-Dreh${capped ? " (heute 3/3 erreicht)" : ""}${capped ? "" : `${bar(progress, ROUNDS_PER_BONUS_SPIN)}<small>${progress} / ${ROUNDS_PER_BONUS_SPIN} Runden · heute ${daily.roundSpins}/${MAX_ROUND_SPINS_PER_DAY}</small>`}</div></div>
      <div class="howto"><span>⬆️</span><div>Bei bestimmten Level-Ups<small>z. B. Level 3, 9, 12, 16 ...</small></div></div>
      <div class="howto"><span>🎯</span><div>Missionen, Meilensteine &amp; Daily-Serie (Tag 6)</div></div>
      <div class="howto"><span>🎡</span><div>Seltenes Feld direkt am Rad</div></div>
    </div>
    <div class="info-card">
      <div class="info-card__title">Mögliche Gewinne</div>
      <div class="chip-row"><span class="chip">🪙 Münzen</span><span class="chip">⚡ XP</span><span class="chip">🎁 Mini-Box</span><span class="chip">🎡 Bonus-Dreh</span><span class="chip">🎖️ Kosmetik</span><span class="chip chip--rare">📦 selten: Basic Box</span></div>
    </div>`;
  el("#btn-shop-open-wheel").addEventListener("click", h.onOpenWheel);
}

function renderBonusTab(profile, h) {
  const body = el("#shop-bonus-body");
  const mini = profile.bonusBoxes ?? 0;
  const vouchers = Object.entries(profile.vouchers ?? {}).filter(([, n]) => n > 0);
  const goals = dailyGoalsView(profile);
  const next = nextMilestones(profile, 3);
  const vName = { basic: "Basic", super: "Super", mega: "Mega" };
  body.innerHTML = `
    <div class="shop-section-title">Geschenke</div>
    <div class="info-card ${mini > 0 ? "info-card--ready" : ""}">
      <div class="info-card__title">🎁 Mini-Box <small>(ohne Skins)</small></div>
      <div class="info-sub">Münzen, XP, Bonus-Dreh oder Kosmetik. Gibt es bei Level-Ups &amp; Meilensteinen - oder für ${MINI_BOX_PRICE} 🪙.</div>
      <div class="info-row"><span>Im Vorrat</span><b>${mini}</b></div>
      <button id="btn-mini-open" class="btn btn--primary" ${mini > 0 || profile.coins >= MINI_BOX_PRICE ? "" : "disabled"}>${mini > 0 ? "KOSTENLOS ÖFFNEN" : `KAUFEN · ${MINI_BOX_PRICE} 🪙`}</button>
    </div>
    ${vouchers.map(([id, n]) => `<div class="info-card info-card--ready"><div class="info-card__title">📦 Gratis ${vName[id] ?? id} Box ×${n}</div><button class="btn btn--primary" data-voucher="${id}">EINLÖSEN</button></div>`).join("")}
    <div class="shop-section-title">Ziele</div>
    <div class="info-card">
      <div class="info-card__title">📅 Tagesziele</div>
      ${goals.map((g) => `<div class="goal ${g.done ? "goal--done" : ""}"><div class="goal__top"><span>${g.done ? "✅" : "⬜"} ${g.label}</span><small>${g.done ? "erledigt" : `${g.cur}/${g.max}`}</small></div><div class="goal__reward">${g.text}</div></div>`).join("")}
    </div>
    <div class="info-card">
      <div class="info-card__title">🏅 Als Nächstes</div>
      ${next.map((n) => `<div class="goal"><div class="goal__top"><span>${n.label}</span></div><div class="goal__reward">${n.text}</div></div>`).join("") || "<div class=\"info-sub\">Alle Meilensteine erreicht!</div>"}
    </div>`;
  el("#btn-mini-open").addEventListener("click", h.onOpenMiniBox);
  body.querySelectorAll("[data-voucher]").forEach((b) => b.addEventListener("click", () => h.onRedeemVoucher(b.dataset.voucher)));
}

function renderCollectionTab(profile) {
  const owned = SKINS.filter((s) => profile.unlockedSkins.includes(s.id)).length;
  const cc = cosmeticCounts(profile);
  el("#shop-collection-body").innerHTML = `
    <div class="shop-section-title">Skins</div>
    <div class="info-card">
      <div class="info-card__title">Skin-Sammlung <b>${owned} / ${SKINS.length}</b></div>
      ${bar(owned, SKINS.length)}
      <div class="skin-grid">${SKINS.map((s) => {
        const has = profile.unlockedSkins.includes(s.id);
        const r = RARITY[s.rarity];
        return `<div class="skin-tile ${has ? "" : "skin-tile--locked"}" style="border-color:${has ? r.color : "#2a3150"}"><div class="skin-tile__name">${has ? esc(s.name) : "???"}</div><small style="color:${r.color}">${r.label}</small></div>`;
      }).join("")}</div>
      <div class="info-sub">Skins gibt es nur aus Boxen (und einer sehr langen Mission). Alles andere ist kosmetisch.</div>
    </div>
    <div class="shop-section-title">Kosmetik</div>
    <div class="info-card">
      <div class="info-card__title">Kosmetik <b>${cc.owned} / ${cc.total}</b></div>
      ${bar(cc.owned, cc.total)}
      ${Object.entries(COSMETICS).map(([cat, list]) => {
        const real = list.filter((c) => !c.free);
        const n = real.filter((c) => ownsCosmetic(profile, cat, c.id)).length;
        return `<div class="info-row"><span>${COSMETIC_CATEGORIES[cat].label}</span><b>${n} / ${real.length}</b></div>`;
      }).join("")}
      <div class="info-sub">Ausrüsten kannst du alles im Profil.</div>
    </div>`;
}

// ---------------------------------------------------------------- Missionen
let missionTab = "daily";
export function renderMissions(profile, onClaim, tab = missionTab) {
  missionTab = tab;
  const list = listMissionProgress(profile);
  const tabs = el("#mission-tabs");
  tabs.innerHTML = Object.entries(MISSION_CATEGORIES).map(([k, c]) => `<button class="tab ${k === tab ? "tab--active" : ""}" data-tab="${k}">${c.label}</button>`).join("");
  tabs.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => renderMissions(profile, onClaim, b.dataset.tab)));
  const box = el("#missions-list");
  box.innerHTML = `<div class="info-sub center">${MISSION_CATEGORIES[tab].hint}</div>`;
  list.filter((m) => m.def.category === tab)
    .sort((a, b) => (b.done && !b.claimed) - (a.done && !a.claimed) || a.claimed - b.claimed)
    .forEach(({ def, current, done, claimed }) => {
      const row = document.createElement("div");
      row.className = `mission-row ${done && !claimed ? "mission-row--ready" : ""} ${claimed ? "mission-row--claimed" : ""}`;
      const pct = Math.min(100, Math.round((current / def.target) * 100));
      row.innerHTML = `<div class="mission-label">${def.label}</div><div class="mission-bar"><div style="width:${pct}%"></div></div><div class="mission-progress">${fmt(Math.min(current, def.target))}/${fmt(def.target)}</div>`;
      if (done && !claimed) {
        const btn = document.createElement("button");
        btn.className = "btn btn--primary btn--small";
        btn.textContent = `+${rewardLabel(def)} abholen`;
        btn.addEventListener("click", () => onClaim(def.id));
        row.appendChild(btn);
      } else if (claimed) row.insertAdjacentHTML("beforeend", '<div class="mission-claimed">✓ abgeholt</div>');
      else row.insertAdjacentHTML("beforeend", `<div class="mission-reward">Belohnung: ${rewardLabel(def)}</div>`);
      box.appendChild(row);
    });
  refreshBadges(profile);
}
function rewardLabel(def) {
  const r = def.reward, parts = [];
  if (r.skinId) return "Skin";
  if (r.boxId) parts.push(`${r.boxId === "basic" ? "Basic" : "Super"} Box`);
  if (r.coins) parts.push(`${r.coins} 🪙`);
  if (r.xp) parts.push(`${r.xp} XP`);
  if (r.spin) parts.push("Dreh");
  if (r.miniBox) parts.push(`${r.miniBox > 1 ? r.miniBox + "× " : ""}Mini-Box`);
  if (r.voucher) parts.push("Gratis-Box");
  if (r.cosmetic) parts.push("Kosmetik");
  return parts.join(" + ");
}

// ---------------------------------------------------------------- Profil
let profileAvatar = null;
function hsTable(hsByGame, ppByGame) {
  const rows = ARCADE_GAMES.map((g) => {
    const v = hsByGame?.[g.id] ?? {};
    const cells = DIFFICULTY_ORDER.map((d) => `<span class="hs-cell">${v[d] != null ? formatScore(g, v[d]) : "–"}</span>`).join("");
    const pp = ppByGame ? `<span class="hs-pp">${fmt(ppByGame(g.id))}</span>` : "";
    return `<div class="hs-row ${ppByGame ? "" : "hs-row--nopp"}"><span class="hs-game">${g.icon} ${g.name}</span>${cells}${pp}</div>`;
  }).join("");
  return `<div class="hs-table"><div class="hs-row hs-row--head ${ppByGame ? "" : "hs-row--nopp"}"><span class="hs-game"></span><span class="hs-cell">LEICHT</span><span class="hs-cell">MITTEL</span><span class="hs-cell">SCHWER</span>${ppByGame ? '<span class="hs-pp">⭐ PP</span>' : ""}</div>${rows}</div>`;
}

export function renderProfile(profile, h) {
  const body = el("#profile-body");
  const skin = getSkinById(profile.equippedSkin ?? "mario");
  const rarity = RARITY[skin.rarity];
  const v = myView(profile);
  const cs = ensureCosmetics(profile);
  const owned = SKINS.filter((s) => profile.unlockedSkins.includes(s.id)).length;
  const cc = cosmeticCounts(profile);

  const chips = (cat) => {
    const list = COSMETICS[cat];
    const hasNone = list.some((c) => c.id === "none");
    const cur = equippedCosmetic(profile, cat)?.id ?? null;
    const items = list.filter((c) => ownsCosmetic(profile, cat, c.id) && c.id !== "none").map((c) =>
      `<button class="cos-chip ${cur === c.id ? "cos-chip--active" : ""}" data-cat="${cat}" data-id="${c.id}">${c.icon ?? ""} ${esc(c.name)}</button>`);
    // "Keins": bei Kategorien mit "none" als Standard, sonst Abwählen
    const none = `<button class="cos-chip cos-chip--none ${cur == null || cur === "none" ? "cos-chip--active" : ""}" data-cat="${cat}" data-id="${hasNone ? "none" : ""}">✕ Keins</button>`;
    if (!items.length) return `<span class="info-sub">Noch nichts freigeschaltet – Level-Ups, Missionen, Mini-Boxen &amp; das Glücksrad schalten Kosmetik frei.</span>`;
    return none + items.join("");
  };

  // Level-Fahrplan: die nächsten Belohnungen
  const roadmap = [];
  for (let l = profile.level + 1; l <= profile.level + 6; l++) roadmap.push(l);

  body.innerHTML = `
    <div class="profile-head">
      <div id="profile-avatar" class="profile-avatar frame--${v.frame?.id ?? "none"} effect--${v.effect?.id ?? "none"}"></div>
      <div class="profile-head__info">
        <div class="profile-name">${nameHtml(profile.nickname, v)}</div>
        <div class="profile-title">${esc(v.title?.name ?? "")}</div>
        <div class="profile-skin" style="color:${rarity.color}">${esc(skin.name)} · ${rarity.label}</div>
      </div>
    </div>
    <div class="name-row">
      <input id="nick-input" class="text-input text-input--name" maxlength="14" placeholder="Spielername" value="${esc(profile.nickname ?? "")}" autocomplete="off" />
      <button id="btn-nick-save" class="btn btn--primary">SPEICHERN</button>
    </div>
    <p id="nick-message" class="creator-code-message hidden"></p>

    <div class="info-card">
      <div class="info-card__title">⚡ XP &amp; Level</div>
      ${xpBarHtml(profile, "", true)}
      <div class="info-sub">XP bekommst du für jede Runde, Missionen und Meilensteine. Mit genug XP steigst du ein <b>Level</b> auf – und jedes Level schaltet etwas frei: Münzen, Bonus-Drehs, Mini-Boxen und Profil-Kosmetik (Badges, Titel, Rahmen, Emotes, Effekte, Namensfarben). Skins gibt es nur aus Boxen.</div>
      <div class="roadmap">${roadmap.map((l) => { const r = levelReward(l); return `<div class="roadmap__row ${r.cosmetic ? "roadmap__row--cos" : ""}"><span class="roadmap__lvl">Lv ${l}</span><span>${esc(describeLevelReward(l))}</span></div>`; }).join("")}</div>
    </div>

    <div class="stat-grid">
      <div class="stat"><b>${fmt(totalPartyPoints(profile))}</b><span>Party-Punkte</span></div>
      <div class="stat"><b>${fmt(profile.coins)}</b><span>Münzen</span></div>
      <div class="stat"><b>${fmt(profile.stats.arcadeRoundsPlayed)}</b><span>Spiele gespielt</span></div>
      <div class="stat"><b>${fmt(profile.stats.gamesWon)}</b><span>Siege</span></div>
      <div class="stat"><b>${owned} / ${SKINS.length}</b><span>Skins</span></div>
      <div class="stat"><b>${cc.owned} / ${cc.total}</b><span>Kosmetik</span></div>
      <div class="stat"><b>${fmt(profile.stats.highscoresAchieved)}</b><span>Neue Highscores</span></div>
      <div class="stat"><b>${fmt(profile.stats.treasuresFound)}</b><span>Maisfeld-Schätze</span></div>
    </div>
    <h3 class="section-h">Anpassen</h3>
    ${Object.entries(COSMETIC_CATEGORIES).map(([cat, c]) => `<div class="cos-block"><div class="cos-block__label">${c.label}</div><div class="cos-row">${chips(cat)}</div></div>`).join("")}
    <h3 class="section-h">Deine Highscores</h3>
    ${hsTable(profile.arcadeHighscoresByDiff, (gid) => DIFFICULTY_ORDER.reduce((s, d) => s + (profile.partyBest?.[bestKey(gid, d)] ?? 0), 0))}
    <div class="info-sub center">⭐ PP = Party-Punkte (beste Leistung je Spiel &amp; Schwierigkeit) · Reaktion in ms (weniger ist besser)</div>`;

  if (profileAvatar) profileAvatar.destroy();
  profileAvatar = mountSkinAvatar(el("#profile-avatar"), profile.equippedSkin ?? "mario", { size: 84 });
  el("#btn-nick-save").addEventListener("click", () => h.onSaveName(el("#nick-input").value));
  el("#nick-input").addEventListener("keydown", (e) => { if (e.key === "Enter") h.onSaveName(el("#nick-input").value); });
  body.querySelectorAll(".cos-chip").forEach((b) => b.addEventListener("click", () => h.onEquip(b.dataset.cat, b.dataset.id)));
}
export function showNickMessage(text, ok) {
  const m = el("#nick-message");
  if (!m) return;
  m.textContent = text;
  m.classList.remove("hidden", "creator-code-message--success", "creator-code-message--error");
  m.classList.add(ok ? "creator-code-message--success" : "creator-code-message--error");
}
export function destroyProfileAvatar() { if (profileAvatar) { profileAvatar.destroy(); profileAvatar = null; } }

// ---------------------------------------------------------------- Öffentliches Profil (fremde Spieler)
export function renderPublicProfile(state) {
  const body = el("#public-profile-body");
  destroyProfileAvatar();
  if (state.status === "loading") { body.innerHTML = `<div class="lb-state"><div class="spinner"></div><p>Profil wird geladen …</p></div>`; return; }
  if (state.status === "error") { body.innerHTML = `<div class="lb-state lb-state--error"><p>${esc(state.message)}</p></div>`; return; }
  const d = state.data, p = d.profile;
  if (!p) { body.innerHTML = `<div class="lb-state"><p><b>${esc(d.name)}</b> · Level ${d.level}</p><p>${fmt(d.pp)} Party-Punkte</p><small>Dieser Spieler hat noch kein ausführliches Profil veröffentlicht (es erscheint nach seinem nächsten Spiel).</small></div>`; return; }
  const v = loadoutView(p.loadout);
  const skin = getSkinById(p.skin), rarity = RARITY[skin.rarity];
  const need = xpNeeded(p.level), pct = Math.min(100, Math.round((p.xp / need) * 100));
  const badges = (p.badges ?? []).map((id) => COSMETICS.badge.find((b) => b.id === id)).filter(Boolean);
  body.innerHTML = `
    <div class="profile-head">
      <div id="public-avatar" class="profile-avatar frame--${v.frame?.id ?? "none"} effect--${v.effect?.id ?? "none"}"></div>
      <div class="profile-head__info">
        <div class="profile-name">${nameHtml(d.name, v)}</div>
        <div class="profile-title">${esc(v.title?.name ?? "")}</div>
        <div class="profile-skin" style="color:${rarity.color}">${esc(skin.name)} · ${rarity.label}</div>
        <div class="profile-rank">Platz #${d.rank} der Rangliste</div>
      </div>
    </div>
    <div class="xpbar"><div class="xpbar__top"><span class="xpbar__level">LEVEL ${p.level}</span><span class="xpbar__xp">${p.xp} / ${need} XP</span></div><div class="xpbar__track"><div class="xpbar__fill" style="width:${pct}%"></div></div></div>
    <div class="stat-grid">
      <div class="stat"><b>${fmt(d.pp)}</b><span>Party-Punkte</span></div>
      <div class="stat"><b>${fmt(p.stats.rounds)}</b><span>Spiele gespielt</span></div>
      <div class="stat"><b>${fmt(p.stats.wins)}</b><span>Siege</span></div>
      <div class="stat"><b>${fmt(p.stats.perfect)}</b><span>PERFEKT-Runden</span></div>
      <div class="stat"><b>${p.skins} / ${SKINS.length}</b><span>Skins</span></div>
      <div class="stat"><b>${p.cosmetics}</b><span>Kosmetik</span></div>
      <div class="stat"><b>${fmt(p.stats.highscores)}</b><span>Neue Highscores</span></div>
      <div class="stat"><b>${fmt(p.stats.days)}</b><span>Tage gespielt</span></div>
    </div>
    <h3 class="section-h">Badges</h3>
    <div class="badge-grid">${badges.length ? badges.map((b) => `<div class="badge-tile" title="${esc(b.name)}"><span>${b.icon}</span><small>${esc(b.name)}</small></div>`).join("") : '<span class="info-sub">Noch keine Badges.</span>'}</div>
    <h3 class="section-h">Highscores</h3>
    ${hsTable(p.hs, null)}
    <div class="info-sub center">Öffentliches Profil – Münzen und private Daten werden nicht angezeigt.</div>`;
  profileAvatar = mountSkinAvatar(el("#public-avatar"), p.skin, { size: 84 });
}

// ---------------------------------------------------------------- Rangliste
export function renderLeaderboard(profile, state, onOpenProfile) {
  const body = el("#leaderboard-body");
  const myPP = totalPartyPoints(profile);
  const mine = `<div class="lb-mine"><span>DEINE PARTY-PUNKTE</span><b>⭐ ${fmt(myPP)}</b></div>`;
  let main = "";
  if (state.status === "loading") {
    main = `<div class="lb-state"><div class="spinner"></div><p>Rangliste wird geladen …</p><small>Der Server wacht eventuell gerade erst auf (kann bis zu einer Minute dauern).</small></div>`;
  } else if (state.status === "error") {
    main = `<div class="lb-state lb-state--error"><p>${esc(state.message)}</p><button id="btn-lb-retry" class="btn btn--secondary">NOCHMAL VERSUCHEN</button></div>`;
  } else {
    const row = (r, isMe) => {
      const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`;
      return `<button class="lb-row ${isMe ? "lb-row--me" : ""}" data-id="${esc(r.id)}"><span class="lb-rank">${medal}</span><span class="lb-name">${esc(r.name)} ${esc(r.emote)}<small>Lv ${r.level}${r.title ? " · " + esc(r.title) : ""}</small></span><span class="lb-pp">${fmt(r.pp)}</span><span class="lb-chev">›</span></button>`;
    };
    const isMe = (r) => state.me && r.id === state.me.id;
    const rows = state.top.map((r) => row(r, isMe(r))).join("");
    const meOutside = state.me && !state.top.some((r) => r.id === state.me.id) ? `<div class="lb-gap">…</div>${row(state.me, true)}` : "";
    const hint = !profile.nickname
      ? `<div class="lb-hint">Lege im Profil einen Spielernamen fest, um in der Rangliste zu erscheinen.<button id="btn-lb-profile" class="btn btn--secondary btn--small">ZUM PROFIL</button></div>` : "";
    main = `<div class="lb-meta">Spieler in der Rangliste: ${fmt(state.total)}${state.me ? ` · Dein Platz: <b>#${state.me.rank}</b>` : ""}<br><small>Tippe auf einen Spieler, um sein Profil zu öffnen.</small></div>
      ${rows || "<div class=\"lb-state\"><p>Noch niemand in der Rangliste - sei der Erste!</p></div>"}${meOutside}${hint}`;
  }
  body.innerHTML = `${mine}<div class="lb-title">GESAMTRANGLISTE · Party-Punkte</div>${main}
    <p class="lb-note">Party-Punkte = deine besten Leistungen je Minispiel &amp; Schwierigkeit, vergleichbar über alle Spiele. Die Werte werden vom Gerät gemeldet.</p>`;
  body.querySelectorAll(".lb-row").forEach((r) => r.addEventListener("click", () => onOpenProfile?.(r.dataset.id)));
}
