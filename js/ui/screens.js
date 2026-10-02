// js/ui/screens.js
// Bildschirme des Fortschrittssystems: Shop (Tabs), Profil, Rangliste.
import { SKINS, RARITY, getSkinById } from "../skins/skins.js";
import { ARCADE_GAMES } from "../arcade/registry.js";
import { mountSkinAvatar } from "../arcade/engine.js";
import { xpBarHtml } from "./xpbar.js";
import { xpNeeded, describeLevelReward, BOX_UNLOCK_LEVEL } from "../progress/levels.js";
import { COSMETICS, COSMETIC_CATEGORIES, ownsCosmetic, equippedCosmetic, cosmeticCounts, ensureCosmetics } from "../progress/cosmetics.js";
import { totalPartyPoints, bestKey } from "../progress/partyPoints.js";
import { dailyGoalsView, nextMilestones } from "../progress/milestones.js";
import { MINI_BOX_PRICE } from "../shop/shop.js";
import { ROUNDS_PER_BONUS_SPIN, MAX_ROUND_SPINS_PER_DAY, ensureDaily } from "../rewards/profile.js";
import { MAX_BONUS_SPINS } from "../progress/rewardOps.js";
import { canFreeSpin } from "../rewards/wheel.js";
import { DIFFICULTY_DEFS, DIFFICULTY_ORDER, formatScore } from "../arcade/controller.js";

const el = (s) => document.querySelector(s);
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n).toLocaleString("de-DE");
const bar = (cur, max, cls = "") => `<div class="mini-bar ${cls}"><div style="width:${Math.min(100, Math.round((cur / Math.max(1, max)) * 100))}%"></div></div>`;

// ---------------------------------------------------------------- Startseite
export function renderHomeCard(profile) {
  const box = el("#profile-summary");
  if (!box) return;
  const emote = equippedCosmetic(profile, "emote");
  const badge = equippedCosmetic(profile, "badge");
  const title = equippedCosmetic(profile, "title");
  box.innerHTML = `
    <div class="home-card__name">${badge?.icon ? `<span>${badge.icon}</span>` : ""}${profile.nickname ? esc(profile.nickname) : "<em>Gast</em>"}${emote?.icon ? `<span>${emote.icon}</span>` : ""}<small>${esc(title?.name ?? "")}</small></div>
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
  renderBoxesTab(profile, boxes, h);
  renderWheelTab(profile, h);
  renderBonusTab(profile, h);
  renderCollectionTab(profile);
}

function renderBoxesTab(profile, boxes, h) {
  // Box-Fortschritt: nächste noch nicht bezahlbare, freigeschaltete Box
  const next = boxes.find((b) => profile.level >= b.unlockLevel && profile.coins < b.price);
  const root = el("#shop-box-list");
  root.innerHTML = next
    ? `<div class="box-progress"><div class="box-progress__top"><span>Nächste Box: ${next.icon} ${next.name}</span><span>${fmt(profile.coins)} / ${fmt(next.price)} 🪙</span></div>${bar(profile.coins, next.price)}</div>`
    : "";
  boxes.forEach((def) => {
    const locked = profile.level < def.unlockLevel;
    const affordable = profile.coins >= def.price;
    const card = document.createElement("div");
    card.className = `shop-card ${locked ? "shop-card--locked" : ""}`;
    card.innerHTML = `
      <div class="shop-card__icon">${def.icon}</div>
      <div class="shop-card__name">${def.name}</div>
      <div class="shop-card__tagline">${def.tagline}</div>
      ${locked ? "" : !affordable ? `${bar(profile.coins, def.price)}<div class="shop-card__missing">noch ${fmt(def.price - profile.coins)} 🪙</div>` : ""}
      <button class="btn btn--primary shop-card__buy" ${!locked && affordable ? "" : "disabled"}>${locked ? `🔒 ab Level ${def.unlockLevel}` : `${fmt(def.price)} 🪙`}</button>`;
    card.querySelector(".shop-card__buy").addEventListener("click", () => h.onBuyBox(def.id));
    root.appendChild(card);
  });
}

function renderWheelTab(profile, h) {
  const daily = ensureDaily(profile);
  const free = canFreeSpin(profile);
  const stock = profile.wheel.bonusSpins ?? 0;
  const progress = profile.stats.arcadeRoundsPlayed % ROUNDS_PER_BONUS_SPIN;
  const capped = daily.roundSpins >= MAX_ROUND_SPINS_PER_DAY;
  el("#shop-tab-wheel").innerHTML = `
    <div class="info-card">
      <div class="info-card__title">🎡 Glücksrad</div>
      <div class="info-row"><span>Täglicher Gratis-Dreh</span><b>${free ? "bereit ✅" : "morgen wieder"}</b></div>
      <div class="info-row"><span>Bonus-Drehs im Vorrat</span><b>${stock} / ${MAX_BONUS_SPINS}</b></div>
      <div class="info-sub">Nächster Bonus-Dreh durchs Spielen${capped ? " (heute erreicht: 3/3)" : ""}</div>
      ${capped ? "" : `${bar(progress, ROUNDS_PER_BONUS_SPIN)}<div class="info-sub">${progress} / ${ROUNDS_PER_BONUS_SPIN} Runden</div>`}
      <div class="info-sub">Weitere Drehs: Level-Ups, Meilensteine, Daily-Serie, Missionen und ein seltenes Feld am Rad.</div>
      <button id="btn-shop-open-wheel" class="btn btn--arcade">ZUM GLÜCKSRAD</button>
    </div>
    <div class="info-card">
      <div class="info-card__title">Mögliche Gewinne</div>
      <div class="chip-row"><span class="chip">🪙 Münzen</span><span class="chip">XP</span><span class="chip">🎁 Mini-Box</span><span class="chip">🎡 Bonus-Dreh</span><span class="chip">🎖️ Kosmetik</span><span class="chip">📦 selten: Basic Box</span></div>
    </div>`;
  el("#btn-shop-open-wheel").addEventListener("click", h.onOpenWheel);
}

function renderBonusTab(profile, h) {
  const body = el("#shop-bonus-body");
  const mini = profile.bonusBoxes ?? 0;
  const vouchers = Object.entries(profile.vouchers ?? {}).filter(([, n]) => n > 0);
  const goals = dailyGoalsView(profile);
  const next = nextMilestones(profile, 3);
  body.innerHTML = `
    <div class="info-card">
      <div class="info-card__title">🎁 Mini-Box <small>(ohne Skins)</small></div>
      <div class="info-sub">Münzen, XP, Bonus-Dreh oder Kosmetik. Gibt es bei Level-Ups & Meilensteinen - oder für ${MINI_BOX_PRICE} 🪙.</div>
      <div class="info-row"><span>Im Vorrat</span><b>${mini}</b></div>
      <button id="btn-mini-open" class="btn btn--primary" ${mini > 0 || profile.coins >= MINI_BOX_PRICE ? "" : "disabled"}>${mini > 0 ? "KOSTENLOS ÖFFNEN" : `KAUFEN · ${MINI_BOX_PRICE} 🪙`}</button>
    </div>
    ${vouchers.map(([id, n]) => `<div class="info-card"><div class="info-card__title">📦 Gratis ${id === "basic" ? "Basic" : id === "super" ? "Super" : "Mega"} Box ×${n}</div><button class="btn btn--primary" data-voucher="${id}">EINLÖSEN</button></div>`).join("")}
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
    <div class="info-card">
      <div class="info-card__title">Skin-Sammlung <b>${owned} / ${SKINS.length}</b></div>
      ${bar(owned, SKINS.length)}
      <div class="skin-grid">${SKINS.map((s) => {
        const has = profile.unlockedSkins.includes(s.id);
        const r = RARITY[s.rarity];
        return `<div class="skin-tile ${has ? "" : "skin-tile--locked"}" style="border-color:${has ? r.color : "#2a3150"}"><div class="skin-tile__name">${has ? esc(s.name) : "???"}</div><small style="color:${r.color}">${r.label}</small></div>`;
      }).join("")}</div>
      <div class="info-sub">Skins gibt es nur aus Boxen (und einer langen Mission). Alles andere hier ist kosmetisch.</div>
    </div>
    <div class="info-card">
      <div class="info-card__title">Kosmetik <b>${cc.owned} / ${cc.total}</b></div>
      ${bar(cc.owned, cc.total)}
      ${Object.entries(COSMETICS).map(([cat, list]) => {
        const real = list.filter((c) => !c.free);
        const n = real.filter((c) => ownsCosmetic(profile, cat, c.id)).length;
        return `<div class="info-row"><span>${COSMETIC_CATEGORIES[cat].label}</span><b>${n} / ${real.length}</b></div>`;
      }).join("")}
    </div>`;
}

// ---------------------------------------------------------------- Profil
let profileAvatar = null;
export function renderProfile(profile, h) {
  const body = el("#profile-body");
  const skin = getSkinById(profile.equippedSkin ?? "mario");
  const rarity = RARITY[skin.rarity];
  const frame = equippedCosmetic(profile, "frame");
  const effect = equippedCosmetic(profile, "effect");
  const title = equippedCosmetic(profile, "title");
  const badge = equippedCosmetic(profile, "badge");
  const emote = equippedCosmetic(profile, "emote");
  const cs = ensureCosmetics(profile);
  const owned = SKINS.filter((s) => profile.unlockedSkins.includes(s.id)).length;
  const cc = cosmeticCounts(profile);
  const nextLvl = profile.level + 1;

  const chips = (cat) => COSMETICS[cat].map((c) => {
    const has = ownsCosmetic(profile, cat, c.id);
    if (!has) return "";
    const active = (cs.equipped[cat] ?? (c.free && cat !== "badge" ? c.id : null)) === c.id || (equippedCosmetic(profile, cat)?.id === c.id);
    return `<button class="cos-chip ${active ? "cos-chip--active" : ""}" data-cat="${cat}" data-id="${c.id}">${c.icon ?? ""} ${esc(c.name)}</button>`;
  }).join("") || `<span class="info-sub">Noch nichts freigeschaltet</span>`;

  const hsRows = ARCADE_GAMES.map((g) => {
    const cells = DIFFICULTY_ORDER.map((d) => {
      const v = profile.arcadeHighscoresByDiff?.[g.id]?.[d];
      return `<span class="hs-cell">${v != null ? formatScore(g, v) : "–"}</span>`;
    }).join("");
    const pp = DIFFICULTY_ORDER.reduce((s, d) => s + (profile.partyBest?.[bestKey(g.id, d)] ?? 0), 0);
    return `<div class="hs-row"><span class="hs-game">${g.icon} ${g.name}</span>${cells}<span class="hs-pp">${fmt(pp)}</span></div>`;
  }).join("");

  body.innerHTML = `
    <div class="profile-head">
      <div id="profile-avatar" class="profile-avatar frame--${frame?.id ?? "none"} effect--${effect?.id ?? "none"}"></div>
      <div class="profile-head__info">
        <div class="profile-name">${badge?.icon ?? ""} ${profile.nickname ? esc(profile.nickname) : "<em>Gast</em>"} ${emote?.icon ?? ""}</div>
        <div class="profile-title">${esc(title?.name ?? "")}</div>
        <div class="profile-skin" style="color:${rarity.color}">${esc(skin.name)} · ${rarity.label}</div>
      </div>
    </div>
    <div class="name-row">
      <input id="nick-input" class="text-input text-input--name" maxlength="14" placeholder="Spielername" value="${esc(profile.nickname ?? "")}" autocomplete="off" />
      <button id="btn-nick-save" class="btn btn--primary">SPEICHERN</button>
    </div>
    <p id="nick-message" class="creator-code-message hidden"></p>
    ${xpBarHtml(profile)}
    <div class="info-sub center">Nächste Belohnung (Level ${nextLvl}): ${esc(describeLevelReward(nextLvl))}</div>
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
    <div class="cos-block"><div class="cos-block__label">Badge</div><div class="cos-row">${chips("badge")}</div></div>
    <div class="cos-block"><div class="cos-block__label">Titel</div><div class="cos-row">${chips("title")}</div></div>
    <div class="cos-block"><div class="cos-block__label">Rahmen</div><div class="cos-row">${chips("frame")}</div></div>
    <div class="cos-block"><div class="cos-block__label">Emote</div><div class="cos-row">${chips("emote")}</div></div>
    <div class="cos-block"><div class="cos-block__label">Effekt</div><div class="cos-row">${chips("effect")}</div></div>
    <h3 class="section-h">Deine Highscores</h3>
    <div class="hs-table"><div class="hs-row hs-row--head"><span class="hs-game"></span><span class="hs-cell">LEICHT</span><span class="hs-cell">MITTEL</span><span class="hs-cell">SCHWER</span><span class="hs-pp">⭐ PP</span></div>${hsRows}</div>
    <div class="info-sub center">⭐ PP = Party-Punkte (beste Leistung je Spiel &amp; Schwierigkeit)</div>`;

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

// ---------------------------------------------------------------- Rangliste
export function renderLeaderboard(profile, state) {
  const body = el("#leaderboard-body");
  const myPP = totalPartyPoints(profile);
  const mine = `<div class="lb-mine"><span>DEINE PARTY-PUNKTE</span><b>⭐ ${fmt(myPP)}</b></div>`;
  let main = "";
  if (state.status === "loading") {
    main = `<div class="lb-state"><div class="spinner"></div><p>Rangliste wird geladen …</p><small>Der Server wacht eventuell gerade erst auf (kann bis zu einer Minute dauern).</small></div>`;
  } else if (state.status === "error") {
    main = `<div class="lb-state lb-state--error"><p>${esc(state.message)}</p><button id="btn-lb-retry" class="btn btn--secondary">NOCHMAL VERSUCHEN</button></div>`;
  } else {
    const rows = state.top.map((r) => {
      const isMe = state.me && r.rank === state.me.rank && r.name === state.me.name;
      const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`;
      return `<div class="lb-row ${isMe ? "lb-row--me" : ""}"><span class="lb-rank">${medal}</span><span class="lb-name">${esc(r.name)} ${esc(r.emote)}<small>Lv ${r.level}${r.title ? " · " + esc(r.title) : ""}</small></span><span class="lb-pp">${fmt(r.pp)}</span></div>`;
    }).join("");
    const meOutside = state.me && !state.top.some((r) => r.rank === state.me.rank && r.name === state.me.name)
      ? `<div class="lb-gap">…</div><div class="lb-row lb-row--me"><span class="lb-rank">#${state.me.rank}</span><span class="lb-name">${esc(state.me.name)} (Du)<small>Lv ${state.me.level}</small></span><span class="lb-pp">${fmt(state.me.pp)}</span></div>` : "";
    const hint = !profile.nickname
      ? `<div class="lb-hint">Lege im Profil einen Spielernamen fest, um in der Rangliste zu erscheinen.<button id="btn-lb-profile" class="btn btn--secondary btn--small">ZUM PROFIL</button></div>` : "";
    main = `<div class="lb-meta">Spieler in der Rangliste: ${fmt(state.total)}${state.me ? ` · Dein Platz: <b>#${state.me.rank}</b>` : ""}</div>
      ${rows || "<div class=\"lb-state\"><p>Noch niemand in der Rangliste - sei der Erste!</p></div>"}${meOutside}${hint}`;
  }
  body.innerHTML = `${mine}<div class="lb-title">GESAMTRANGLISTE · Party-Punkte</div>${main}
    <p class="lb-note">Party-Punkte = deine besten Leistungen je Minispiel &amp; Schwierigkeit, vergleichbar über alle Spiele. Die Werte werden vom Gerät gemeldet.</p>`;
}
