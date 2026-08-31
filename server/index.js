// server/index.js
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { PartyRun } from "./partyRun.js";
import { createReactionChallenge, scoreReaction, reactionOutcome } from "../js/minigames/reactionGame.js";
import { createHideChallenge, resolveHideOutcome, hideOutcomeMessage } from "../js/minigames/hideGame.js";

const PORT = process.env.PORT || 3001;

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

const wss = new WebSocketServer({ server: httpServer });

// rooms: Map<code, { code, hostId, clients: Map<playerId, ws>, players: Map<playerId,{name,skinId,ready}>,
//                     settings, status: 'lobby'|'in-progress', run: PartyRun|null }>
const rooms = new Map();

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne verwechselbare Zeichen
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function send(ws, type, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type, payload }));
}

function broadcast(room, type, payload) {
  for (const ws of room.clients.values()) send(ws, type, payload);
}

function lobbyState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    settings: room.settings,
    status: room.status,
    players: [...room.players.entries()].map(([id, p]) => ({ id, ...p, isHost: id === room.hostId })),
  };
}

wss.on("connection", (ws) => {
  ws.playerId = `p_${Math.random().toString(36).slice(2, 10)}`;
  ws.roomCode = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, payload = {} } = msg;

    try {
      switch (type) {
        case "createRoom": return handleCreateRoom(ws, payload);
        case "joinRoom": return handleJoinRoom(ws, payload);
        case "updateSettings": return handleUpdateSettings(ws, payload);
        case "toggleReady": return handleToggleReady(ws, payload);
        case "startGame": return handleStartGame(ws);
        case "chooseDoor": return handleChooseDoor(ws, payload);
        case "submitMinigameResult": return handleSubmitMinigameResult(ws, payload);
        case "flee": return handleFlee(ws);
        case "leaveRoom": return handleLeave(ws);
        default: send(ws, "error", { message: `Unbekannter Nachrichtentyp: ${type}` });
      }
    } catch (err) {
      console.error("Fehler bei Nachricht", type, err);
      send(ws, "error", { message: "Serverfehler bei der Verarbeitung." });
    }
  });

  ws.on("close", () => handleLeave(ws));
});

function handleCreateRoom(ws, { name, skinId }) {
  const code = makeRoomCode();
  const room = {
    code,
    hostId: ws.playerId,
    clients: new Map([[ws.playerId, ws]]),
    players: new Map([[ws.playerId, { name: name || "Spieler", skinId: skinId || "mario", ready: false }]]),
    settings: { difficulty: "normal", botCount: 2, saboteurPreset: "normal", seed: undefined },
    status: "lobby",
    run: null,
    pendingMinigame: null,
  };
  rooms.set(code, room);
  ws.roomCode = code;
  send(ws, "roomCreated", { ...lobbyState(room), yourId: ws.playerId });
}

function handleJoinRoom(ws, { code, name, skinId }) {
  const room = rooms.get((code || "").toUpperCase());
  if (!room) return send(ws, "error", { message: "Raum nicht gefunden." });
  if (room.status !== "lobby") return send(ws, "error", { message: "Runde läuft bereits." });
  if (room.players.size >= 6) return send(ws, "error", { message: "Lobby ist voll (max. 6 Spieler)." });

  room.clients.set(ws.playerId, ws);
  room.players.set(ws.playerId, { name: name || "Spieler", skinId: skinId || "mario", ready: false });
  ws.roomCode = room.code;
  send(ws, "joinedRoom", { ...lobbyState(room), yourId: ws.playerId });
  broadcast(room, "lobbyUpdate", lobbyState(room));
}

function requireRoom(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) { send(ws, "error", { message: "Du bist in keinem Raum." }); return null; }
  return room;
}

function handleUpdateSettings(ws, settings) {
  const room = requireRoom(ws);
  if (!room || ws.playerId !== room.hostId) return;
  room.settings = { ...room.settings, ...settings };
  broadcast(room, "lobbyUpdate", lobbyState(room));
}

function handleToggleReady(ws) {
  const room = requireRoom(ws);
  if (!room) return;
  const p = room.players.get(ws.playerId);
  if (p) p.ready = !p.ready;
  broadcast(room, "lobbyUpdate", lobbyState(room));
}

function handleStartGame(ws) {
  const room = requireRoom(ws);
  if (!room || ws.playerId !== room.hostId) return;

  const humanPlayers = [...room.players.entries()].map(([id, p]) => ({ id, name: p.name, skinId: p.skinId }));
  room.run = new PartyRun({ ...room.settings, humanPlayers });
  room.status = "in-progress";

  const doors = room.run.generateDoors();
  broadcast(room, "gameStarted", { state: room.run.toPublicState(), doors });
}

function handleChooseDoor(ws, { doorId }) {
  const room = requireRoom(ws);
  if (!room || !room.run || room.run.finished) return;

  const door = room.run.currentDoors.find((d) => d.id === doorId);
  if (!door) return;

  if (door.roomType.id === "reactionGame") {
    if (room.pendingMinigame) return; // läuft schon eins
    const challenge = createReactionChallenge(() => room.run.rng.next(), room.run.dynamicDifficultyFactor);
    room.pendingMinigame = { doorId, type: "reactionGame", challenge, resolved: false };
    broadcast(room, "minigameStarted", { doorId, type: "reactionGame", challenge });
    return;
  }

  if (door.roomType.id === "hideGame") {
    // Multiplayer-Bewegung für das Versteckspiel folgt in einer späteren Phase.
    // Platzhalter mit fairer, identischer Erfolgswahrscheinlichkeit: der Server
    // "versteckt" die Gruppe automatisch an einem zufälligen von N Plätzen.
    const challenge = createHideChallenge(() => room.run.rng.next(), room.run.dynamicDifficultyFactor);
    const autoSpot = Math.floor(room.run.rng.next() * challenge.spotCount);
    const result = resolveHideOutcome(autoSpot, challenge.spotCount, () => room.run.rng.next());
    const outcome = hideOutcomeMessage(result, room.run.dynamicDifficultyFactor);
    const { outcome: applied } = room.run.resolveMinigameDoor(doorId, outcome);
    finishDoorResolution(room, applied);
    return;
  }

  const { outcome, merchantOffer, secretFound } = room.run.chooseDoor(doorId);
  const botReactions = room.run.getBotReactions(outcome.kind);
  broadcast(room, "roomResolved", {
    outcome, merchantOffer, secretFound, botReactions, state: room.run.toPublicState(),
  });
  finishDoorResolution(room, outcome, { alreadyBroadcastResolved: true });
}

function handleSubmitMinigameResult(ws, { doorId, reactionMs }) {
  const room = requireRoom(ws);
  if (!room || !room.pendingMinigame || room.pendingMinigame.doorId !== doorId || room.pendingMinigame.resolved) return;
  room.pendingMinigame.resolved = true;

  const result = scoreReaction(reactionMs, room.pendingMinigame.challenge.windowMs);
  const outcome = reactionOutcome(result, room.run.dynamicDifficultyFactor);
  const { outcome: applied } = room.run.resolveMinigameDoor(doorId, outcome);
  room.pendingMinigame = null;

  broadcast(room, "roomResolved", {
    outcome: applied, merchantOffer: null, secretFound: false,
    botReactions: room.run.getBotReactions(applied.kind), state: room.run.toPublicState(),
  });
  finishDoorResolution(room, applied, { alreadyBroadcastResolved: true });
}

// Gemeinsamer Abschluss nach jeder Art von Tür-Auflösung (Zufallsereignis,
// Reaktionsspiel oder Versteckspiel-Platzhalter) - vermeidet doppelten Code.
function finishDoorResolution(room, outcome, { alreadyBroadcastResolved = false } = {}) {
  if (!alreadyBroadcastResolved) {
    broadcast(room, "roomResolved", {
      outcome, merchantOffer: null, secretFound: false,
      botReactions: room.run.getBotReactions(outcome.kind), state: room.run.toPublicState(),
    });
  }

  if (room.run.finished) {
    const reveal = room.run.revealSaboteur();
    broadcast(room, "gameEnded", { state: room.run.toPublicState(), reveal });
    room.status = "lobby";
    for (const p of room.players.values()) p.ready = false;
    return;
  }

  const exitAvailable = room.run.exitAvailable();
  const doors = room.run.generateDoors();
  const botSuggestions = room.run.getBotDoorSuggestions(doors);
  broadcast(room, "nextDoors", { doors, exitAvailable, botSuggestions });
}

function handleFlee(ws) {
  const room = requireRoom(ws);
  if (!room || !room.run || room.run.finished) return;
  room.run.flee();
  const reveal = room.run.revealSaboteur();
  broadcast(room, "gameEnded", { state: room.run.toPublicState(), reveal });
  room.status = "lobby";
  for (const p of room.players.values()) p.ready = false;
}

function handleLeave(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  room.clients.delete(ws.playerId);
  room.players.delete(ws.playerId);

  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }
  if (ws.playerId === room.hostId) {
    room.hostId = [...room.players.keys()][0]; // Host-Übergabe an nächsten Spieler
  }
  broadcast(room, "lobbyUpdate", lobbyState(room));
}

httpServer.listen(PORT, () => {
  console.log(`NO WAY OUT Server läuft auf Port ${PORT}`);
});
