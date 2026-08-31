// js/game/main.js
import { RunManager } from "./runManager.js";
import { RunPlayer } from "../player/player.js";
import { getStarterSkin } from "../skins/skins.js";
import {
  renderHUD, renderOutcome, hideOutcome,
  renderDecision, hideDecision, renderEndScreen, renderSkinBadge, showScreen,
  renderBotRoster, renderBotFeed,
} from "../ui/ui.js";
import { loadProfile, saveProfile, applyRunRewards } from "../rewards/profile.js";
import { canClaimDaily, claimDaily } from "../rewards/dailyReward.js";
import { listMissionProgress, claimMission } from "../missions/missions.js";
import { openMysteryBox } from "../rewards/mysteryBox.js";
import { audio } from "../audio/audio.js";
import { socket } from "../network/socketClient.js";
import { SERVER_URL } from "../network/config.js";
import { WorldGame } from "../world/worldGame.js";
import { createReactionChallenge, scoreReaction, reactionOutcome } from "../minigames/reactionGame.js";
import { createHideChallenge, resolveHideOutcome, hideOutcomeMessage } from "../minigames/hideGame.js";
import {
  renderProfileSummary, renderMissions, renderDailyStatus,
  renderMysteryBoxStatus, renderMysteryBoxResult,
} from "../ui/ui.js";

let runManager = null;
let worldGame = null;
let profile = loadProfile();
let pendingDifficulty = "normal";

function startSoloRun(difficulty, saboteurPreset) {
  const skin = getStarterSkin();
  const player = new RunPlayer("Du", skin.id);
  const urlSeed = new URLSearchParams(location.search).get("seed");
  const seed = urlSeed ? Number(urlSeed) : undefined;
  runManager = new RunManager({ difficulty, player, botCount: 2, saboteurPreset, seed });
  renderSkinBadge(skin.id);
  renderBotRoster(runManager.bots);
  showScreen("screen-game");
  hideOutcome();
  hideDecision();
  renderHUD(runManager);
  audio.playMood("normal");

  if (worldGame) worldGame.destroy();
  worldGame = new WorldGame({
    canvas: el("#world-canvas"),
    joystickEl: el("#mobile-joystick"),
    interactBtnEl: el("#mobile-interact"),
    runManager,
    skinId: skin.id,
    callbacks: { onDoorChosen, onHideTick: updateHideTimerBar },
  });
  worldGame.start();
  nextDoors();
}

function nextDoors() {
  const doors = runManager.generateDoors();
  worldGame.loadRoom(doors);
}

function onDoorChosen(doorId) {
  const door = runManager.currentDoors.find((d) => d.id === doorId);
  if (door && runManager.isMinigameDoor(door)) {
    audio.sfx("doorOpen");
    if (door.roomType.id === "reactionGame") return startReactionMinigame(doorId);
    if (door.roomType.id === "hideGame") return startHideMinigameFlow(doorId);
  }
  audio.sfx("doorOpen");
  worldGame.room.doors = []; // Türen der aktuellen Runde deaktivieren, bis der nächste Raum geladen wird
  const { outcome } = runManager.chooseDoor(doorId);
  handleResolvedOutcome(outcome);
}

// Gemeinsame Weiterverarbeitung, egal ob Tür-Zufallsereignis oder Minispiel-Ergebnis
function handleResolvedOutcome(outcome) {
  renderHUD(runManager);
  renderOutcome(outcome);
  renderBotFeed(runManager.getBotReactions(outcome.kind));

  if (outcome.kind === "reward") audio.sfx("treasure");
  else if (outcome.kind === "danger") { audio.sfx("damage"); audio.playMood("danger"); }

  if (runManager.finished) {
    if (runManager.result === "died") audio.sfx("death");
    setTimeout(() => finishRun(), 900);
    return;
  }

  if (outcome.kind !== "danger") audio.playMood("normal");

  const canExit = runManager.exitAvailable();
  setTimeout(() => {
    if (canExit) renderBotFeed(runManager.getBotFleeVotes().map((v) => ({ bot: v.bot, comment: v.comment })));
    renderDecision(canExit, {
      onFlee: () => {
        audio.sfx("flee");
        runManager.flee();
        finishRun();
      },
      onContinue: () => {
        audio.sfx("click");
        hideOutcome();
        hideDecision();
        nextDoors();
      },
    });
  }, 700);
}

// --- Reaktionsspiel: gemeinsame Anzeige-/Eingabelogik für Solo UND Online ---
// callback(reactionMs) wird mit reactionMs=-1 (zu früh) oder der gemessenen
// Zeit aufgerufen; die eigentliche Auswertung entscheidet der Aufrufer.
function runReactionMinigamePresentation(challenge, callback) {
  const overlay = el("#minigame-reaction");
  const statusEl = el("#reaction-status");
  const symbolEl = el("#reaction-symbol");
  overlay.classList.remove("hidden");
  statusEl.textContent = "Bereit machen...";
  symbolEl.classList.add("hidden");

  let revealTime = null;
  let finished = false;

  const cleanup = () => {
    window.removeEventListener("keydown", onKey);
    overlay.removeEventListener("click", onTap);
    overlay.classList.add("hidden");
  };
  const finish = (reactionMs) => {
    if (finished) return;
    finished = true;
    cleanup();
    callback(reactionMs);
  };
  const onKey = (e) => {
    if (e.key === "Escape") return;
    finish(revealTime === null ? -1 : performance.now() - revealTime);
  };
  const onTap = () => finish(revealTime === null ? -1 : performance.now() - revealTime);

  window.addEventListener("keydown", onKey);
  overlay.addEventListener("click", onTap);

  setTimeout(() => {
    if (finished) return;
    statusEl.textContent = "JETZT!";
    symbolEl.textContent = challenge.symbol;
    symbolEl.classList.remove("hidden");
    revealTime = performance.now();
    setTimeout(() => finish(challenge.windowMs + 1), challenge.windowMs + 50);
  }, challenge.revealDelayMs);
}

// --- Reaktionsspiel-Ablauf (Solo) ---
function startReactionMinigame(doorId) {
  worldGame.room.doors = [];
  const challenge = createReactionChallenge(() => runManager.rng.next(), runManager.dynamicDifficultyFactor);
  runReactionMinigamePresentation(challenge, (reactionMs) => {
    const result = reactionMs < 0
      ? { success: false, reason: "too-early", speedRatio: 0 }
      : scoreReaction(reactionMs, challenge.windowMs);
    const outcome = reactionOutcome(result, runManager.dynamicDifficultyFactor);
    const { outcome: appliedOutcome } = runManager.resolveMinigameDoor(doorId, outcome);
    handleResolvedOutcome(appliedOutcome);
  });
}

// --- Versteckspiel-Ablauf ---
function startHideMinigameFlow(doorId) {
  const challenge = createHideChallenge(() => runManager.rng.next(), runManager.dynamicDifficultyFactor);
  el("#minigame-hide").classList.remove("hidden");
  updateHideTimerBar(1);

  worldGame.startHideChallenge(challenge, (hiddenSpotIndex, spotCount) => {
    el("#minigame-hide").classList.add("hidden");
    const result = resolveHideOutcome(hiddenSpotIndex, spotCount, () => runManager.rng.next());
    const outcome = hideOutcomeMessage(result, runManager.dynamicDifficultyFactor);
    const { outcome: appliedOutcome } = runManager.resolveMinigameDoor(doorId, outcome);
    handleResolvedOutcome(appliedOutcome);
  });
}

function updateHideTimerBar(fraction) {
  const fill = el("#hide-timer-fill");
  if (fill) fill.style.width = `${Math.round(fraction * 100)}%`;
}

function finishRun() {
  audio.stopMusic();
  if (worldGame) worldGame.stop();
  const fled = runManager.result === "fled";
  const coinsEarned = runManager.player.securedCoins;
  const xpEarned = runManager.player.xp;
  const keysEarned = fled && runManager.roomsCleared >= 5 ? 1 : 0;
  const levelBefore = profile.level;
  applyRunRewards(profile, {
    coinsEarned, xpEarned, keysEarned, fled, roomsCleared: runManager.roomsCleared,
  });
  if (profile.level > levelBefore) audio.sfx("levelUp");
  saveProfile(profile);
  const saboteurReveal = runManager.revealSaboteur();
  renderEndScreen(runManager, saboteurReveal);
}

function el(sel) {
  return document.querySelector(sel);
}

function resetToMenu() {
  showScreen("screen-menu");
  el("#screen-end").classList.add("hidden");
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

function openMysteryBoxScreen() {
  showScreen("screen-mysterybox");
  renderMysteryBoxStatus(profile);
  el("#mysterybox-result").innerHTML = "";
}

document.addEventListener("DOMContentLoaded", () => {
  el("#btn-play").addEventListener("click", () => { audio.sfx("click"); showScreen("screen-difficulty"); });
  document.querySelectorAll("[data-difficulty]").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.sfx("click");
      pendingDifficulty = btn.dataset.difficulty;
      showScreen("screen-saboteur");
    });
  });
  document.querySelectorAll("[data-saboteur]").forEach((btn) => {
    btn.addEventListener("click", () => { audio.sfx("click"); startSoloRun(pendingDifficulty, btn.dataset.saboteur); });
  });
  el("#btn-play-again").addEventListener("click", () => { audio.sfx("click"); resetToMenu(); });

  el("#btn-daily").addEventListener("click", () => { audio.sfx("click"); openDailyScreen(); });
  el("#btn-daily-claim").addEventListener("click", () => {
    const res = claimDaily(profile);
    if (res.success) { saveProfile(profile); audio.sfx("unlockRare"); }
    renderDailyStatus(canClaimDaily(profile), profile.dailyReward.streakDay);
    renderProfileSummary(profile);
  });

  el("#btn-missions").addEventListener("click", () => { audio.sfx("click"); openMissionsScreen(); });

  el("#btn-mysterybox").addEventListener("click", () => { audio.sfx("click"); openMysteryBoxScreen(); });
  el("#btn-mysterybox-open").addEventListener("click", () => {
    const result = openMysteryBox(profile, Math.random);
    saveProfile(profile);
    if (result.success && result.isNew) audio.sfx("unlockRare");
    else audio.sfx("secretFound");
    renderMysteryBoxResult(result);
    renderMysteryBoxStatus(profile);
    renderProfileSummary(profile);
  });

  el("#btn-settings").addEventListener("click", () => { audio.sfx("click"); openSettingsScreen(); });
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

  el("#btn-online").addEventListener("click", () => { audio.sfx("click"); showScreen("screen-online-choice"); });

  el("#btn-online-create").addEventListener("click", () => {
    audio.sfx("click");
    setupSocketHandlers();
    ensureConnected()
      .then(() => socket.send("createRoom", { name: "Du", skinId: getStarterSkin().id }))
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
      .then(() => socket.send("joinRoom", { code, name: "Du", skinId: getStarterSkin().id }))
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
    socket.send("updateSettings", {
      difficulty: el("#lobby-difficulty").value,
      botCount: Number(el("#lobby-bots").value),
      saboteurPreset: el("#lobby-saboteur").value,
    });
    socket.send("startGame");
  });

  renderSkinBadge(getStarterSkin().id);
  renderProfileSummary(profile);
  applySettingsToAudio();
  audio.playMood("menu");
});

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

// ===== Online-Multiplayer =====
let myPlayerId = null;
let iAmHost = false;
let lastExitAvailable = false;
let socketHandlersReady = false;

function ensureConnected() {
  if (socket.connected) return Promise.resolve();
  return socket.connect(SERVER_URL);
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
  socket.on("gameStarted", ({ state, doors }) => {
    audio.playMood("normal");
    showScreen("screen-online-game");
    hideOnlineOutcome();
    hideOnlineDecision();
    renderOnlinePlayers(state.players);
    renderOnlineDoors(doors);
  });
  socket.on("nextDoors", ({ doors, exitAvailable }) => {
    lastExitAvailable = exitAvailable;
    hideOnlineOutcome();
    hideOnlineDecision();
    renderOnlineDoors(doors);
  });
  socket.on("minigameStarted", ({ doorId, type, challenge }) => {
    el("#online-doors").innerHTML = "";
    if (type === "reactionGame") startOnlineReactionMinigame(doorId, challenge);
  });
  socket.on("roomResolved", ({ outcome, state, botReactions }) => {
    renderOnlinePlayers(state.players);
    renderOnlineOutcome(outcome);
    el("#online-doors").innerHTML = "";
    renderOnlineBotFeed(botReactions);
    if (outcome.kind === "reward") audio.sfx("treasure");
    else if (outcome.kind === "danger") { audio.sfx("damage"); audio.playMood("danger"); }
    setTimeout(() => renderOnlineDecision(lastExitAvailable), 250);
  });
  socket.on("gameEnded", ({ state, reveal }) => {
    audio.stopMusic();
    renderOnlineEnd(state, reveal);
  });
  socket.on("_disconnected", () => {
    // Einfache Behandlung: zurück ins Menü, keine automatische Wiederverbindung in v1
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
    .map((p) => `<div class="lobby-player-row"><span>${p.isHost ? "👑 " : ""}${p.name}</span><span class="${p.ready ? "ready-dot" : "not-ready-dot"}">${p.ready ? "● bereit" : "○ wartet"}</span></div>`)
    .join("");
  el("#lobby-host-settings").classList.toggle("hidden", !iAmHost);
}

function renderOnlinePlayers(players) {
  el("#online-players-hud").innerHTML = players
    .map((p) => `
      <div class="online-player-chip ${p.alive ? "" : "online-player-chip--dead"}">
        <div>${p.name}</div>
        <div class="op-hpbar"><div style="width:${p.hp}%"></div></div>
        <div>${p.securedCoins}💰 +${p.riskCoins}</div>
      </div>
    `).join("");
}

function renderOnlineDoors(doors) {
  const wrap = el("#online-doors");
  wrap.innerHTML = "";
  doors.forEach((door) => {
    const btn = document.createElement("button");
    btn.className = `door door--${door.shownHint}`;
    btn.innerHTML = `<span class="door__icon">${door.shownHint === "danger" ? "⚠" : "✦"}</span><span class="door__label">Tür ${door.id + 1}</span>`;
    btn.addEventListener("click", () => { audio.sfx("doorOpen"); socket.send("chooseDoor", { doorId: door.id }); });
    wrap.appendChild(btn);
  });
}

function renderOnlineOutcome(outcome) {
  const box = el("#online-outcome");
  box.textContent = outcome.message;
  box.className = `outcome outcome--${outcome.kind}`;
}
function hideOnlineOutcome() { el("#online-outcome").className = "outcome outcome--hidden"; }

function renderOnlineBotFeed(entries) {
  const box = el("#online-bot-feed");
  (entries ?? []).forEach(({ botName, comment }) => {
    const line = document.createElement("div");
    line.className = "bot-line";
    line.textContent = `${botName}: „${comment}"`;
    box.prepend(line);
  });
  while (box.children.length > 4) box.removeChild(box.lastChild);
}

function renderOnlineDecision(exitAvailable) {
  const box = el("#online-decision");
  box.innerHTML = "";
  if (exitAvailable) {
    const fleeBtn = document.createElement("button");
    fleeBtn.className = "btn btn--flee";
    fleeBtn.textContent = "FLIEHEN (für alle)";
    fleeBtn.addEventListener("click", () => { audio.sfx("flee"); socket.send("flee"); });
    box.appendChild(fleeBtn);
  }
  box.classList.remove("hidden");
}
function hideOnlineDecision() { el("#online-decision").classList.add("hidden"); el("#online-decision").innerHTML = ""; }

function startOnlineReactionMinigame(doorId, challenge) {
  runReactionMinigamePresentation(challenge, (reactionMs) => {
    socket.send("submitMinigameResult", { doorId, reactionMs });
  });
}

function renderOnlineEnd(state, reveal) {
  el("#end-title").textContent = state.result === "fled" ? "ENTKOMMEN!" : "GEFANGEN...";
  el("#end-title").className = state.result === "fled" ? "end-title win" : "end-title lose";
  el("#end-summary").textContent = `Gemeinsam ${state.roomsCleared} Räume geschafft.`;
  const saboBox = el("#end-saboteur");
  if (reveal && reveal.hadSaboteur) {
    saboBox.textContent = `🎭 Der Saboteur war ${reveal.botName}! Aufgabe „${reveal.task.label}" wurde ${reveal.success ? "ERFÜLLT" : "NICHT erfüllt"}.`;
    saboBox.classList.remove("hidden");
  } else {
    saboBox.classList.add("hidden");
  }
  showScreen("screen-end");
}
