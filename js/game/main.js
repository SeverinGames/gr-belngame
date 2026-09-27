// js/game/main.js
// "Big Sevis Minispiel Party" - seit der Umstellung besteht das Spiel nur
// noch aus den acht Minispielen (SOLO = alleine, ONLINE = gegen andere
// Spieler mit Rangliste). Das komplette frühere Türen-Dungeon-System wurde
// entfernt (siehe git-Historie/vorherige Version, falls es je gebraucht wird).
import { getStarterSkin, getSkinById, SKINS, RARITY } from "../skins/skins.js";
import {
  renderSkinBadge, renderProfileSummary, renderMissions, renderDailyStatus,
  renderShop, showScreen,
} from "../ui/ui.js";
import { loadProfile, saveProfile, grantCoins } from "../rewards/profile.js";
import { canClaimDaily, claimDaily } from "../rewards/dailyReward.js";
import { listMissionProgress, claimMission } from "../missions/missions.js";
import { listBoxes, purchaseBox } from "../shop/shop.js";
import { playBoxOpeningAnimation } from "../rewards/boxAnimation.js";
import { createArcadeController } from "../arcade/controller.js";
import { ARCADE_GAMES, getArcadeGame } from "../arcade/registry.js";
import { audio } from "../audio/audio.js";
import { socket } from "../network/socketClient.js";
import { SERVER_URL } from "../network/config.js";
import { drawCharacter, getSkinPalette } from "../world/characterSprite.js";

let profile = loadProfile();
const myOnlineName = getSkinById(profile.equippedSkin ?? "mario").name + "-" + Math.floor(Math.random() * 90 + 10);
let pendingArcadeGameId = null; // wartet auf Schwierigkeitsauswahl (SOLO)

const arcadeController = createArcadeController({
  getProfile: () => profile,
  saveProfile: (p) => saveProfile(p),
  showScreen,
  audio,
  renderProfileSummary,
  onPickGame: (gameId) => openArcadeDifficultyScreen(gameId),
});

function el(sel) {
  return document.querySelector(sel);
}

function openArcadeDifficultyScreen(gameId) {
  pendingArcadeGameId = gameId;
  const meta = getArcadeGame(gameId);
  el("#arcade-difficulty-gamename").textContent = meta ? `${meta.icon} ${meta.name}` : "";
  showScreen("screen-arcade-difficulty");
}

function resetToMenu() {
  showScreen("screen-menu");
  renderProfileSummary(profile);
  audio.playMood("menu");
}

function openDailyScreen() {
  showScreen("screen-daily");
  renderDailyStatus(canClaimDaily(profile), profile.dailyReward.streakDay);
}

function openMissionsScreen() {
  showScreen("screen-missions");
  renderMissions(listMissionProgress(profile), handleClaimMission);
}

function handleClaimMission(missionId) {
  claimMission(profile, missionId);
  saveProfile(profile);
  renderMissions(listMissionProgress(profile), handleClaimMission);
  renderProfileSummary(profile);
}

// --- Shop (ersetzt das alte Schlüssel-/Mystery-Box-System) ---------------
function openShopScreen() {
  showScreen("screen-shop");
  renderShop(profile, listBoxes(), handleBuyBox);
}

function handleBuyBox(boxId) {
  audio.sfx("click");
  const result = purchaseBox(profile, boxId, Math.random);
  saveProfile(profile);
  renderProfileSummary(profile);
  playBoxOpeningAnimation(result).then(() => {
    renderShop(profile, listBoxes(), handleBuyBox);
    renderProfileSummary(profile);
    renderSkinBadge(profile.equippedSkin ?? "mario");
  });
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

  el("#btn-daily").addEventListener("click", () => { audio.sfx("click"); openDailyScreen(); });
  el("#btn-daily-claim").addEventListener("click", () => {
    const res = claimDaily(profile);
    if (res.success) { saveProfile(profile); audio.sfx("unlockRare"); }
    renderDailyStatus(canClaimDaily(profile), profile.dailyReward.streakDay);
    renderProfileSummary(profile);
  });

  el("#btn-missions").addEventListener("click", () => { audio.sfx("click"); openMissionsScreen(); });
  el("#btn-shop").addEventListener("click", () => { audio.sfx("click"); openShopScreen(); });

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
    btn.addEventListener("click", () => { audio.sfx("click"); showScreen(btn.dataset.back); });
  });

  // --- ONLINE --------------------------------------------------------------
  el("#btn-online").addEventListener("click", () => { audio.sfx("click"); showScreen("screen-online-choice"); });

  el("#btn-online-create").addEventListener("click", () => {
    audio.sfx("click");
    setupSocketHandlers();
    ensureConnected()
      .then(() => socket.send("createRoom", { name: myOnlineName, skinId: (profile.equippedSkin ?? getStarterSkin().id) }))
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
      .then(() => socket.send("joinRoom", { code, name: myOnlineName, skinId: (profile.equippedSkin ?? getStarterSkin().id) }))
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
  renderSkinBadge((profile.equippedSkin ?? getStarterSkin().id));
  renderProfileSummary(profile);
  applySettingsToAudio();
  audio.playMood("menu");
});

function populateLobbyGameSelect() {
  const select = el("#lobby-game");
  select.innerHTML = ARCADE_GAMES.map((g) => `<option value="${g.id}">${g.icon} ${g.name}</option>`).join("");
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

  // Eigene Münzen/XP fürs Ergebnis der Online-Runde gutschreiben (kleiner,
  // pauschaler Bonus - die Feinabstimmung passiert weiterhin im SOLO-Modus).
  if (me) {
    const placement = results.findIndex((r) => r.id === myPlayerId);
    const bonus = placement === 0 ? 40 : placement === 1 ? 25 : placement === 2 ? 15 : 8;
    grantCoins(profile, bonus);
    saveProfile(profile);
    renderProfileSummary(profile);
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
