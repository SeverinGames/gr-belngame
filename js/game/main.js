// js/game/main.js
// "Big Sevis Minispiel Party" - seit der Umstellung besteht das Spiel nur
// noch aus den acht Minispielen (SOLO = alleine, ONLINE = gegen andere
// Spieler mit Rangliste). Das komplette frühere Türen-Dungeon-System wurde
// entfernt (siehe git-Historie/vorherige Version, falls es je gebraucht wird).
import { getStarterSkin, getSkinById, SKINS, RARITY } from "../skins/skins.js";
import {
  renderSkinBadge, renderProfileSummary, showScreen,
} from "../ui/ui.js";
import { renderShop, setShopTab, renderProfile, showNickMessage, destroyProfileAvatar, renderLeaderboard, renderPublicProfile, renderMissions } from "../ui/screens.js";
import { refreshBadges } from "../progress/badges.js";
import { celebrate, playMiniBox } from "../ui/celebrations.js";
import { wasReset, loadProfile, saveProfile, grantRewards, unlockSkin, validateNickname } from "../rewards/profile.js";
import { addSpin, addMiniBoxes, addVoucher } from "../progress/rewardOps.js";
import { unlockCosmetic } from "../progress/cosmetics.js";
import { checkMilestones } from "../progress/milestones.js";
import { applyRound } from "../progress/roundResult.js";
import { rewardTierFromPercent } from "../arcade/engine.js";
import { equipCosmetic, ensureCosmetics } from "../progress/cosmetics.js";
import { fetchTop, submitMyScore, autoSync, fetchPublicProfile, ERROR_TEXT } from "../network/leaderboardClient.js";
import { totalPartyPoints } from "../progress/partyPoints.js";
import { DIFFICULTY_DEFS, DIFFICULTY_ORDER, formatScore, highscoreFor } from "../arcade/controller.js";
import { claimDaily, describeReward } from "../rewards/dailyReward.js";
import { listMissionProgress, claimMission } from "../missions/missions.js";
import { listBoxes, purchaseBox, grantFreeBox, buyMiniBox, redeemVoucher } from "../shop/shop.js";
import { WHEEL_SLICES, sliceLabel, describeSlice, spinsAvailable, canFreeSpin, spinWheel } from "../rewards/wheel.js";
import { redeemCreatorCode } from "../shop/creatorCodes.js";
import { playBoxOpeningAnimation } from "../rewards/boxAnimation.js";
import { createArcadeController } from "../arcade/controller.js";
import { ARCADE_GAMES, getArcadeGame } from "../arcade/registry.js";
import { audio } from "../audio/audio.js";
import { socket } from "../network/socketClient.js";
import { SERVER_URL } from "../network/config.js";
import { drawCharacter, getSkinPalette } from "../world/characterSprite.js";

let profile = loadProfile();
const fallbackOnlineName = getSkinById(profile.equippedSkin ?? "mario").name + "-" + Math.floor(Math.random() * 90 + 10);
const onlineName = () => profile.nickname || fallbackOnlineName;
let pendingArcadeGameId = null; // wartet auf Schwierigkeitsauswahl (SOLO)

const arcadeController = createArcadeController({
  getProfile: () => profile,
  saveProfile: (p) => saveProfile(p),
  showScreen,
  audio,
  renderProfileSummary,
  onPickGame: (gameId) => openArcadeDifficultyScreen(gameId),
  onRoundDone: () => { afterProgress(); },
});

// Nach jeder Aktion mit Fortschritt: speichern, Anzeige auffrischen,
// Erfolgserlebnisse (LEVEL UP, Meilensteine) zeigen, Rangliste leise aktualisieren.
function afterProgress() {
  checkMilestones(profile);
  saveProfile(profile);
  renderProfileSummary(profile);
  refreshHomeBadges();
  autoSync(profile);
  return celebrate(audio);
}

function el(sel) {
  return document.querySelector(sel);
}

// Kurze, nützliche Hinweise nur dort, wo die Stufen sich im Spiel unterscheiden
const DIFF_DETAIL = {
  memory: { easy: "12 Karten", normal: "16 Karten", hard: "20 Karten" },
  maisMission: { easy: "kurzer Weg", normal: "längerer Weg", hard: "langer Weg" },
  mazeRunner: { easy: "kleines Labyrinth", normal: "größeres Labyrinth", hard: "großes Labyrinth" },
};

function openArcadeDifficultyScreen(gameId) {
  pendingArcadeGameId = gameId;
  const meta = getArcadeGame(gameId);
  el("#arcade-difficulty-gamename").textContent = meta ? `${meta.icon} ${meta.name}` : "";
  document.querySelectorAll("[data-arcade-difficulty]").forEach((btn) => {
    const d = btn.dataset.arcadeDifficulty;
    const best = highscoreFor(profile, gameId, d);
    const extra = DIFF_DETAIL[gameId]?.[d];
    const parts = [];
    if (extra) parts.push(extra);
    if (best != null) parts.push(`${meta?.lowerIsBetter ? "BESTZEIT" : "DEIN HIGHSCORE"}: ${formatScore(meta, best)}`);
    btn.querySelector(".diff-btn__best").textContent = parts.join(" · ");
  });
  showScreen("screen-arcade-difficulty");
}

// Zähler-Badges (MISSIONEN ③, SHOP ②, GLÜCKSRAD ①) - nur sichtbar, wenn etwas wartet
function refreshHomeBadges() {
  refreshBadges(profile);
}

function resetToMenu() {
  showScreen("screen-menu");
  refreshHomeBadges();
  renderProfileSummary(profile);
  audio.playMood("menu");
}

function openMissionsScreen() {
  showScreen("screen-missions");
  renderMissions(profile, handleClaimMission);
}

function handleClaimMission(missionId) {
  const res = claimMission(profile, missionId, { grantRewards, grantFreeBox, unlockSkin, addSpin, addMiniBoxes, addVoucher, unlockCosmetic });
  if (!res.success) return;
  checkMilestones(profile);
  afterProgress();
  audio.sfx("unlockRare");
  renderMissions(profile, handleClaimMission);
  if (res.boxResult) {
    playBoxOpeningAnimation(res.boxResult).then(() => {
      renderProfileSummary(profile);
      renderSkinBadge(profile.equippedSkin ?? "mario");
    });
  }
}


// --- Glücksrad -------------------------------------------------------------
let wheelRotation = 0;
let wheelSpinning = false;
let wheelBuilt = false;

function buildWheel() {
  if (wheelBuilt) return;
  wheelBuilt = true;
  const wheel = el("#wheel");
  const step = 360 / WHEEL_SLICES.length;
  const colors = ["#ff6b8a", "#6be0ff", "#ffd166", "#7bff9e"];
  wheel.style.background = `conic-gradient(${WHEEL_SLICES.map((_, i) => `${colors[i % 4]} ${i * step}deg ${(i + 1) * step}deg`).join(", ")})`;
  WHEEL_SLICES.forEach((sl, i) => {
    const lab = document.createElement("div");
    lab.className = "wheel__label";
    lab.style.transform = `rotate(${(i + 0.5) * step}deg)`;
    lab.innerHTML = `<span>${sliceLabel(sl)}</span>`;
    wheel.appendChild(lab);
  });
  const hub = document.createElement("div");
  hub.className = "wheel-hub";
  wheel.appendChild(hub);
}

function renderWheelStatus() {
  const free = canFreeSpin(profile);
  const bonus = profile.wheel.bonusSpins ?? 0;
  el("#wheel-status").textContent = free
    ? `Dein kostenloser Tagesdreh ist bereit!${bonus ? ` (+${bonus} Bonus-Dreh${bonus > 1 ? "s" : ""})` : ""}`
    : bonus > 0
      ? `Bonus-Drehs: ${bonus} · weitere gibt's durchs Spielen, bei Level-Ups & Meilensteinen.`
      : "Heute schon gedreht - morgen wartet ein neuer Dreh. Bonus-Drehs gibt's durchs Spielen, bei Level-Ups & Meilensteinen!";
  el("#btn-wheel-spin").disabled = wheelSpinning || spinsAvailable(profile) <= 0;
}

function openWheelScreen() {
  buildWheel();
  showScreen("screen-wheel");
  el("#wheel-result").classList.add("hidden");
  renderWheelStatus();
}

function handleWheelSpin() {
  if (wheelSpinning) return;
  const res = spinWheel(profile, Math.random);
  if (!res.success) return;
  saveProfile(profile); // sofort speichern - der Dreh ist verbraucht, egal was danach passiert
  wheelSpinning = true;
  el("#btn-wheel-spin").disabled = true;
  el("#wheel-result").classList.add("hidden");

  const step = 360 / WHEEL_SLICES.length;
  const jitter = (Math.random() - 0.5) * step * 0.7;
  const center = (res.index + 0.5) * step + jitter;
  const current = ((wheelRotation % 360) + 360) % 360;
  wheelRotation += 360 * 5 + ((360 - center - current) % 360 + 360) % 360;
  el("#wheel").style.transform = `rotate(${wheelRotation}deg)`;
  // Ticken beim Drehen (langsamer werdend)
  let tickGap = 60, t = 0;
  const tick = () => { if (!wheelSpinning) return; audio.sfx("tick"); tickGap *= 1.09; t += tickGap; if (t < 4000) setTimeout(tick, tickGap); };
  tick();

  setTimeout(() => {
    wheelSpinning = false;
    audio.sfx("unlockRare");
    const box = el("#wheel-result");
    box.textContent = `🎡 Du hast ${res.text} gewonnen!`;
    box.classList.remove("hidden");
    renderWheelStatus();
    afterProgress();
    if (res.slice.boxId) {
      const boxResult = grantFreeBox(profile, res.slice.boxId, Math.random);
      saveProfile(profile);
      playBoxOpeningAnimation(boxResult).then(() => {
        box.textContent = `🎡 Gratis Basic Box: ${boxResult.skin.name}${boxResult.isNew ? " (neu!)" : ` - Duplikat, +${boxResult.compensationCoins} 🪙`}`;
        renderSkinBadge(profile.equippedSkin ?? "mario");
        afterProgress();
      });
    }
  }, 4400);
}

// --- Shop: Boxen · Rad · Bonus · Sammlung ---------------------------------
let shopTab = "boxes";
function handleClaimDaily() {
  const res = claimDaily(profile);
  if (!res.success) return;
  audio.sfx("unlockRare");
  if (res.reward.type === "box") {
    // Gratis-Box (Jackpot-Tag 7) - echt öffnen, mit Öffnungsanimation
    const boxResult = grantFreeBox(profile, res.reward.boxId, Math.random);
    saveProfile(profile);
    playBoxOpeningAnimation(boxResult).then(() => { renderSkinBadge(profile.equippedSkin ?? "mario"); afterProgress(); refreshShop(); });
  } else {
    afterProgress(); refreshShop();
    const b = el("#daily-claimed-banner");
    if (b) { b.textContent = `🎉 Du hast ${describeReward(res.reward)} erhalten!`; b.classList.remove("hidden"); }
  }
}
const shopHandlers = {
  onClaimDaily: handleClaimDaily,
  onBuyBox: (id) => handleBuyBox(id),
  onOpenWheel: () => { audio.sfx("click"); openWheelScreen(); },
  onOpenMiniBox: () => handleOpenMiniBox(),
  onRedeemVoucher: (id) => handleRedeemVoucher(id),
};
function refreshShop() {
  renderShop(profile, listBoxes(), shopHandlers);
  setShopTab(shopTab);
}
function openShopScreen() {
  shopTab = shopTab || "boxes";
  showScreen("screen-shop");
  refreshShop();
  el("#creator-code-message").classList.add("hidden");
  el("#creator-code-input").value = "";
}

function handleBuyBox(boxId) {
  audio.sfx("click");
  const result = purchaseBox(profile, boxId, Math.random);
  if (!result.success) return;
  saveProfile(profile);
  renderProfileSummary(profile);
  playBoxOpeningAnimation(result).then(() => {
    refreshShop();
    renderSkinBadge(profile.equippedSkin ?? "mario");
    afterProgress();
  });
}

function handleOpenMiniBox() {
  audio.sfx("click");
  const result = buyMiniBox(profile, Math.random);
  if (!result.success) return;
  saveProfile(profile);
  playMiniBox(result, audio).then(() => { refreshShop(); afterProgress(); });
}

function handleRedeemVoucher(boxId) {
  audio.sfx("click");
  const result = redeemVoucher(profile, boxId, Math.random);
  if (!result.success) return;
  saveProfile(profile);
  playBoxOpeningAnimation(result).then(() => {
    refreshShop();
    renderSkinBadge(profile.equippedSkin ?? "mario");
    afterProgress();
  });
}

// --- Profil ---------------------------------------------------------------
const profileHandlers = {
  onSaveName(raw) {
    const v = validateNickname(raw);
    if (!v.ok) { showNickMessage(v.reason, false); return; }
    profile.nickname = v.name;
    saveProfile(profile);
    audio.sfx("unlockRare");
    // Name auch in der Rangliste anmelden; bei Namenskonflikt ehrlich melden
    submitMyScore(profile).then((r) => {
      if (!r.ok && r.error === "name-taken") showNickMessage(ERROR_TEXT["name-taken"], false);
    });
    renderProfileSummary(profile);
    showNickMessage(`Name gespeichert: ${v.name}`, true);
  },
  onEquip(cat, id) {
    audio.sfx("click");
    if (id === "") { ensureCosmetics(profile).equipped[cat] = "none"; }
    else if (!equipCosmetic(profile, cat, id)) return;
    saveProfile(profile);
    openProfileScreen();
    renderProfileSummary(profile);
  },
};
function openProfileScreen() {
  showScreen("screen-profile");
  renderProfile(profile, profileHandlers);
}

// --- Rangliste (echt, Server-basiert - keine Fake-Einträge) ----------------
let ppRequestId = 0;
function openPublicProfile(id) {
  audio.sfx("click");
  showScreen("screen-public-profile");
  const my = ++ppRequestId;
  renderPublicProfile({ status: "loading" });
  fetchPublicProfile(id).then((r) => {
    if (my !== ppRequestId) return;
    if (!r.ok) renderPublicProfile({ status: "error", message: ERROR_TEXT[r.error] ?? "Profil konnte nicht geladen werden." });
    else renderPublicProfile({ status: "ok", data: r });
  });
}

let lbRequestId = 0;
function openLeaderboardScreen() {
  showScreen("screen-leaderboard");
  const my = ++lbRequestId;
  renderLeaderboard(profile, { status: "loading" }, openPublicProfile);
  const done = (r) => {
    if (my !== lbRequestId) return;
    if (!r.ok) {
      renderLeaderboard(profile, { status: "error", message: ERROR_TEXT[r.error] ?? "Rangliste konnte nicht geladen werden." }, openPublicProfile);
      el("#btn-lb-retry")?.addEventListener("click", openLeaderboardScreen);
      return;
    }
    renderLeaderboard(profile, { status: "ok", top: r.top, total: r.total, me: r.me ?? null }, openPublicProfile);
    el("#btn-lb-profile")?.addEventListener("click", () => { audio.sfx("click"); openProfileScreen(); });
  };
  // Mit Namen: eigenen Stand melden (liefert gleich den eigenen Platz). Ohne Namen: nur lesen.
  (profile.nickname ? submitMyScore(profile) : fetchTop())
    // Zu schnell hintereinander gemeldet (z.B. Zurück aus einem Profil)? Dann nur die Liste laden.
    .then((r) => (!r.ok && r.error === "too-fast" ? fetchTop() : r))
    .then(done);
}

function handleRedeemCreatorCode() {
  audio.sfx("click");
  const input = el("#creator-code-input");
  const msg = el("#creator-code-message");
  const res = redeemCreatorCode(profile, input.value, (code) => {
    // Rein statistisch, best-effort - schlägt die Verbindung fehl, bleibt
    // die lokale Einlösung trotzdem gültig (siehe creatorCodes.js).
    ensureConnected().then(() => socket.send("redeemCode", { code })).catch(() => {});
  });

  msg.classList.remove("hidden", "creator-code-message--success", "creator-code-message--error");
  if (res.success) {
    afterProgress();
    audio.sfx("unlockRare");
    refreshShop();
    msg.textContent = `Creator Code ${res.label} aktiviert! +${res.reward.coins} Münzen`;
    msg.classList.add("creator-code-message--success");
    input.value = "";
  } else if (res.reason === "already-redeemed") {
    msg.textContent = `Creator Code ${res.label} wurde bereits eingelöst.`;
    msg.classList.add("creator-code-message--error");
  } else if (res.reason === "invalid") {
    msg.textContent = "Ungültiger Creator Code.";
    msg.classList.add("creator-code-message--error");
  } else {
    msg.textContent = "Bitte einen Creator Code eingeben.";
    msg.classList.add("creator-code-message--error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // --- SOLO: Minispiel -> Schwierigkeit -> Start -------------------------
  el("#btn-play").addEventListener("click", () => { audio.sfx("click"); arcadeController.openHome(); });
  document.querySelectorAll("[data-arcade-difficulty]").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.sfx("click");
      if (!pendingArcadeGameId) return;
      arcadeController.openGame(pendingArcadeGameId, btn.dataset.arcadeDifficulty);
    });
  });

  el("#btn-wheel").addEventListener("click", () => { audio.sfx("click"); openWheelScreen(); });
  el("#btn-wheel-spin").addEventListener("click", handleWheelSpin);
  el("#btn-missions").addEventListener("click", () => { audio.sfx("click"); openMissionsScreen(); });
  el("#btn-shop").addEventListener("click", () => { audio.sfx("click"); openShopScreen(); });
  el("#btn-public-back").addEventListener("click", () => { audio.sfx("click"); destroyProfileAvatar(); openLeaderboardScreen(); });
  el("#btn-profile").addEventListener("click", () => { audio.sfx("click"); openProfileScreen(); });
  el("#profile-summary").addEventListener("click", () => { audio.sfx("click"); openProfileScreen(); });
  el("#btn-leaderboard").addEventListener("click", () => { audio.sfx("click"); openLeaderboardScreen(); });
  document.querySelectorAll("#shop-tabs .tab").forEach((t) => t.addEventListener("click", () => { audio.sfx("click"); shopTab = t.dataset.tab; setShopTab(shopTab); }));
  el("#btn-creator-code-redeem").addEventListener("click", handleRedeemCreatorCode);
  el("#creator-code-input").addEventListener("keydown", (e) => { if (e.key === "Enter") handleRedeemCreatorCode(); });

  el("#btn-settings").addEventListener("click", () => { audio.sfx("click"); openSettingsScreen(); });

  el("#btn-locker").addEventListener("click", () => { audio.sfx("click"); openLockerScreen(); });
  el("#btn-locker-equip").addEventListener("click", () => {
    audio.sfx("unlockRare");
    profile.equippedSkin = lockerSelectedSkin;
    saveProfile(profile);
    renderSkinBadge(profile.equippedSkin);
  });
  el("#vol-music").addEventListener("input", (e) => {
    const v = Number(e.target.value) / 100;
    audio.setVolume("music", v);
    profile.settings.musicVolume = v;
    saveProfile(profile);
  });
  el("#vol-sfx").addEventListener("input", (e) => {
    const v = Number(e.target.value) / 100;
    audio.setVolume("sfx", v);
    profile.settings.sfxVolume = v;
    saveProfile(profile);
    audio.sfx("click");
  });
  el("#vol-vibration").addEventListener("change", (e) => {
    audio.masterVolumes.vibration = e.target.checked;
    profile.settings.vibration = e.target.checked;
    saveProfile(profile);
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => { audio.sfx("click"); destroyProfileAvatar(); showScreen(btn.dataset.back); if (btn.dataset.back === "screen-menu") { refreshHomeBadges(); renderProfileSummary(profile); } });
  });

  // --- ONLINE --------------------------------------------------------------
  el("#btn-online").addEventListener("click", () => { audio.sfx("click"); showScreen("screen-online-choice"); });

  el("#btn-online-create").addEventListener("click", () => {
    audio.sfx("click");
    setupSocketHandlers();
    ensureConnected()
      .then(() => socket.send("createRoom", { name: onlineName(), skinId: (profile.equippedSkin ?? getStarterSkin().id) }))
      .catch(() => alert("Verbindung zum Server fehlgeschlagen. Server erreichbar?"));
  });

  el("#btn-online-join").addEventListener("click", () => { audio.sfx("click"); showScreen("screen-online-join"); });

  el("#btn-join-confirm").addEventListener("click", () => {
    audio.sfx("click");
    el("#join-error").classList.add("hidden");
    const code = el("#join-code-input").value.trim().toUpperCase();
    if (!code) return;
    setupSocketHandlers();
    ensureConnected()
      .then(() => socket.send("joinRoom", { code, name: onlineName(), skinId: (profile.equippedSkin ?? getStarterSkin().id) }))
      .catch(() => alert("Verbindung zum Server fehlgeschlagen. Server erreichbar?"));
  });

  el("#btn-lobby-ready").addEventListener("click", () => { audio.sfx("click"); socket.send("toggleReady"); });
  el("#btn-lobby-leave").addEventListener("click", () => {
    audio.sfx("click");
    socket.send("leaveRoom");
    socket.disconnect();
    resetToMenu();
  });
  el("#btn-lobby-start").addEventListener("click", () => {
    audio.sfx("click");
    socket.send("updateSettings", { gameId: el("#lobby-game").value });
    socket.send("startGame");
  });

  populateLobbyGameSelect();
  if (profile.nickname) autoSync(profile);
  // Neues Konto: einmalig Namen abfragen; nach einem Komplett-Reset kurz erklären
  if (!profile.welcomed) {
    profile.welcomed = true; saveProfile(profile);
    openProfileScreen();
    showNickMessage(wasReset ? "Neustart: Alle Spielstände wurden zurückgesetzt – du startest bei null! Wähle deinen Spielernamen." : "Willkommen! Wähle deinen Spielernamen.", true);
  }
  renderSkinBadge((profile.equippedSkin ?? getStarterSkin().id));
  renderProfileSummary(profile);
  refreshHomeBadges();
  applySettingsToAudio();
  audio.playMood("menu");
});

function populateLobbyGameSelect() {
  const select = el("#lobby-game");
  select.innerHTML = ARCADE_GAMES.filter((g) => !g.soloOnly).map((g) => `<option value="${g.id}">${g.icon} ${g.name}</option>`).join("");
}

function applySettingsToAudio() {
  if (!profile.settings) {
    profile.settings = { musicVolume: 0.5, sfxVolume: 0.7, vibration: true };
    saveProfile(profile);
  }
  audio.setVolume("music", profile.settings.musicVolume);
  audio.setVolume("sfx", profile.settings.sfxVolume);
  audio.masterVolumes.vibration = profile.settings.vibration;
}

function openSettingsScreen() {
  showScreen("screen-settings");
  el("#vol-music").value = Math.round(profile.settings.musicVolume * 100);
  el("#vol-sfx").value = Math.round(profile.settings.sfxVolume * 100);
  el("#vol-vibration").checked = profile.settings.vibration;
}

// --- Spind ---
let lockerAnimId = null;
let lockerSelectedSkin = "mario";

function openLockerScreen() {
  showScreen("screen-locker");
  lockerSelectedSkin = profile.equippedSkin ?? "mario";
  renderLockerSkinList();
  startLockerPreviewLoop();
}

function renderLockerSkinList() {
  const box = el("#locker-skin-list");
  box.innerHTML = "";
  SKINS.forEach((skin) => {
    const owned = profile.unlockedSkins.includes(skin.id);
    const card = document.createElement("div");
    card.className = `locker-skin-card ${skin.id === lockerSelectedSkin ? "locker-skin-card--selected" : ""} ${!owned ? "locker-skin-card--locked" : ""}`;
    const palette = getSkinPalette(skin.id);
    card.innerHTML = `<div class="locker-skin-card__swatch" style="background:${palette.body}"></div>${skin.name}<br><small>${RARITY[skin.rarity].label}</small>`;
    if (owned) {
      card.addEventListener("click", () => {
        audio.sfx("click");
        lockerSelectedSkin = skin.id;
        renderLockerSkinList();
      });
    } else {
      card.title = "Noch nicht freigeschaltet.";
    }
    box.appendChild(card);
  });
  const skin = getSkinById(lockerSelectedSkin);
  const rarity = RARITY[skin.rarity];
  const badge = el("#locker-rarity-badge");
  badge.textContent = `${skin.name} · ${rarity.label}`;
  badge.style.borderColor = rarity.color;
  badge.style.color = rarity.color;
  badge.style.boxShadow = rarity.glow ? `0 0 12px ${rarity.color}` : "none";
}

function startLockerPreviewLoop() {
  const canvas = el("#locker-canvas");
  const ctx = canvas.getContext("2d");
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const start = performance.now();

  function loop(t) {
    if (el("#screen-locker").classList.contains("hidden")) { lockerAnimId = null; return; }
    const elapsed = (t - start) / 1000;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const palette = getSkinPalette(lockerSelectedSkin);
    drawCharacter(ctx, {
      x: canvas.clientWidth / 2, y: canvas.clientHeight * 0.8,
      facing: "down", walkPhase: (elapsed * 0.15) % 1, palette, scale: 2.4,
    });
    lockerAnimId = requestAnimationFrame(loop);
  }
  if (lockerAnimId) cancelAnimationFrame(lockerAnimId);
  lockerAnimId = requestAnimationFrame(loop);
}

// ===== Online-Multiplayer =====
// Seit der Umstellung: keine Türen mehr - alle Spieler einer Lobby bekommen
// dasselbe Minispiel (gleicher Seed vom Server) und werden danach per
// Punktestand verglichen (Rangliste statt Sieg/Niederlage).
let myPlayerId = null;
let iAmHost = false;
let socketHandlersReady = false;
let onlineActiveGame = null;
let onlineGameId = null;
let pendingOnline = null;

function ensureConnected() {
  if (socket.connected) return Promise.resolve();
  return socket.connect(SERVER_URL);
}

// Kleiner seedbarer PRNG (mulberry32), damit alle Spieler exakt dasselbe
// Muster sehen (z.B. dieselben Obstkorb-Fruchtpositionen) - fair, weil
// niemand einen zufällig leichteren Ablauf bekommt.
function makeSeededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setupSocketHandlers() {
  if (socketHandlersReady) return;
  socketHandlersReady = true;

  socket.on("roomCreated", (payload) => {
    myPlayerId = payload.yourId;
    iAmHost = true;
    renderLobby(payload);
    showScreen("screen-lobby");
  });
  socket.on("joinedRoom", (payload) => {
    myPlayerId = payload.yourId;
    iAmHost = false;
    renderLobby(payload);
    showScreen("screen-lobby");
  });
  socket.on("lobbyUpdate", (payload) => renderLobby(payload));
  socket.on("error", (payload) => {
    const errBox = el("#join-error");
    errBox.textContent = payload.message;
    errBox.classList.remove("hidden");
  });
  socket.on("roundStarted", ({ gameId, seed }) => startOnlineRound(gameId, seed));
  socket.on("roundResults", ({ results }) => renderOnlineResult(results));
  socket.on("_disconnected", () => {
    if (el("#screen-lobby") && !el("#screen-lobby").classList.contains("hidden")) {
      resetToMenu();
    }
  });
}

function renderLobby(state) {
  iAmHost = state.hostId === myPlayerId;
  el("#lobby-code").textContent = state.code;
  const box = el("#lobby-players");
  box.innerHTML = state.players
    .map((p) => `<div class="lobby-player-row"><span>${p.name}${p.isHost ? " <em class=\"host-tag\">Host</em>" : ""}</span><span class="${p.ready ? "ready-dot" : "not-ready-dot"}">${p.ready ? "● bereit" : "○ wartet"}</span></div>`)
    .join("");
  el("#lobby-host-settings").classList.toggle("hidden", !iAmHost);
  if (state.settings?.gameId) el("#lobby-game").value = state.settings.gameId;
}

function startOnlineRound(gameId, seed) {
  const meta = getArcadeGame(gameId);
  onlineGameId = gameId;
  pendingOnline = null;
  showScreen("screen-online-game");
  el("#online-play-title").textContent = meta ? `${meta.icon} ${meta.name}` : "";
  el("#online-score").textContent = "0";
  el("#online-combo").classList.add("hidden");
  el("#online-timer-fill").style.width = "100%";
  el("#online-waiting").classList.add("hidden");
  const stage = el("#online-stage");
  stage.innerHTML = "";
  stage.classList.remove("hidden");

  meta.load().then((mod) => {
    onlineActiveGame = mod.start({
      container: stage,
      skinId: profile.equippedSkin ?? "mario",
      rng: makeSeededRng(seed),
      onHud: updateOnlineHud,
      onEnd: (result) => finishOnlineRound(result),
    });
  });
}

function updateOnlineHud(patch) {
  if (patch.score !== undefined) el("#online-score").textContent = String(patch.score);
  if (patch.combo !== undefined) {
    const badge = el("#online-combo");
    if (patch.combo >= 2) { badge.textContent = `x${patch.combo}`; badge.classList.remove("hidden"); }
    else badge.classList.add("hidden");
  }
  if (patch.total) {
    const frac = patch.roundTotal ? patch.round / patch.roundTotal : 1 - patch.timeLeft / patch.total;
    el("#online-timer-fill").style.width = `${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%`;
  }
}

function finishOnlineRound(result) {
  onlineActiveGame = null;
  el("#online-stage").classList.add("hidden");
  pendingOnline = result;
  el("#online-waiting-score").textContent = result.resultLabel ?? `${result.score} PUNKTE`;
  el("#online-waiting").classList.remove("hidden");
  audio.sfx("treasure");
  socket.send("submitScore", { score: result.score });
}

function renderOnlineResult(results) {
  const me = results.find((r) => r.id === myPlayerId);
  const box = el("#online-leaderboard");
  box.innerHTML = results
    .map((r, i) => `
      <div class="online-leaderboard-row ${i === 0 ? "online-leaderboard-row--first" : ""} ${r.id === myPlayerId ? "online-leaderboard-row--me" : ""}">
        <span class="online-leaderboard-rank">${i === 0 ? "🏆" : `#${i + 1}`}</span>
        <span class="online-leaderboard-name">${r.name}${r.id === myPlayerId ? " (Du)" : ""}</span>
        <span class="online-leaderboard-score">${r.score}</span>
      </div>
    `).join("");

  // Online-Runde zählt wie eine MITTEL-Runde (gleiches Belohnungssystem,
  // Party-Punkte, Meilensteine) + Platzierungsbonus.
  if (me && pendingOnline && onlineGameId) {
    const placement = results.findIndex((r) => r.id === myPlayerId);
    const placeCoins = placement === 0 ? 120 : placement === 1 ? 80 : placement === 2 ? 50 : 25;
    const placeXp = placement === 0 ? 60 : placement === 1 ? 40 : 25;
    const meta = getArcadeGame(onlineGameId);
    const tier = rewardTierFromPercent(pendingOnline.percent ?? 0);
    applyRound(profile, {
      gameId: onlineGameId, xpEarned: tier.xp + placeXp, coinsEarned: tier.coins + placeCoins,
      score: pendingOnline.score, maxCombo: pendingOnline.maxCombo ?? 0, tier: tier.tier,
      difficulty: "normal", percent: pendingOnline.percent ?? 0, won: !!pendingOnline.won,
      lowerIsBetter: !!meta?.lowerIsBetter, online: true,
    });
    pendingOnline = null;
    afterProgress();
  }

  const actions = el("#online-result-actions");
  actions.innerHTML = "";
  if (iAmHost) {
    const again = document.createElement("button");
    again.className = "btn btn--primary";
    again.textContent = "NÄCHSTE RUNDE";
    again.addEventListener("click", () => { audio.sfx("click"); showScreen("screen-lobby"); });
    actions.appendChild(again);
  } else {
    const waitInfo = document.createElement("p");
    waitInfo.className = "arcade-subtitle";
    waitInfo.textContent = "Warte, bis der Host die nächste Runde startet …";
    actions.appendChild(waitInfo);
    const backBtn = document.createElement("button");
    backBtn.className = "btn btn--secondary";
    backBtn.textContent = "Zur Lobby";
    backBtn.addEventListener("click", () => { audio.sfx("click"); showScreen("screen-lobby"); });
    actions.appendChild(backBtn);
  }
  const leaveBtn = document.createElement("button");
  leaveBtn.className = "btn btn--ghost";
  leaveBtn.textContent = "Verlassen";
  leaveBtn.addEventListener("click", () => {
    audio.sfx("click");
    socket.send("leaveRoom");
    socket.disconnect();
    resetToMenu();
  });
  actions.appendChild(leaveBtn);

  showScreen("screen-online-result");
}
