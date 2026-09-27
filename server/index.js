// server/index.js
// WebSocket-Server für den Online-Modus von "Big Sevis Minispiel Party".
// Seit der Umstellung gibt es kein Türen-Dungeon mehr - eine Online-Runde
// bedeutet: alle Spieler in der Lobby spielen dasselbe Minispiel (gleicher
// Seed) und werden danach anhand ihres Punktestands verglichen.
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { PartyMinigameRoom, ROUND_TIMEOUT_MS } from "./partyMinigame.js";

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

// rooms: Map<code, PartyMinigameRoom>
const rooms = new Map();
const socketsByRoom = new Map(); // code -> Map<playerId, ws>

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
  const clients = socketsByRoom.get(room.code);
  if (!clients) return;
  for (const ws of clients.values()) send(ws, type, payload);
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
        case "toggleReady": return handleToggleReady(ws);
        case "startGame": return handleStartGame(ws);
        case "submitScore": return handleSubmitScore(ws, payload);
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
  const room = new PartyMinigameRoom(code, ws.playerId);
  room.addPlayer(ws.playerId, { name, skinId });
  rooms.set(code, room);
  socketsByRoom.set(code, new Map([[ws.playerId, ws]]));
  ws.roomCode = code;
  send(ws, "roomCreated", { ...room.lobbyState(), yourId: ws.playerId });
}

function handleJoinRoom(ws, { code, name, skinId }) {
  const room = rooms.get((code || "").toUpperCase());
  if (!room) return send(ws, "error", { message: "Raum nicht gefunden." });
  if (room.status !== "lobby") return send(ws, "error", { message: "Runde läuft bereits." });
  if (room.players.size >= 8) return send(ws, "error", { message: "Lobby ist voll (max. 8 Spieler)." });

  room.addPlayer(ws.playerId, { name, skinId });
  socketsByRoom.get(room.code).set(ws.playerId, ws);
  ws.roomCode = room.code;
  send(ws, "joinedRoom", { ...room.lobbyState(), yourId: ws.playerId });
  broadcast(room, "lobbyUpdate", room.lobbyState());
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
  broadcast(room, "lobbyUpdate", room.lobbyState());
}

function handleToggleReady(ws) {
  const room = requireRoom(ws);
  if (!room) return;
  const p = room.players.get(ws.playerId);
  if (p) p.ready = !p.ready;
  broadcast(room, "lobbyUpdate", room.lobbyState());
}

function handleStartGame(ws) {
  const room = requireRoom(ws);
  if (!room || ws.playerId !== room.hostId || room.status !== "lobby") return;
  const { gameId, seed, players } = room.startRound();
  broadcast(room, "roundStarted", { gameId, seed, players });
  room.round.timeoutHandle = setTimeout(() => finalizeRoom(room), ROUND_TIMEOUT_MS);
}

function handleSubmitScore(ws, { score }) {
  const room = requireRoom(ws);
  if (!room || !room.round) return;
  const allIn = room.submitScore(ws.playerId, score);
  if (allIn) finalizeRoom(room);
}

function finalizeRoom(room) {
  if (!room.round) return;
  clearTimeout(room.round.timeoutHandle);
  const results = room.finishRound();
  broadcast(room, "roundResults", { results });
}

function handleLeave(ws) {
  const room = rooms.get(ws.roomCode);
  if (!room) return;
  socketsByRoom.get(room.code)?.delete(ws.playerId);
  room.removePlayer(ws.playerId);

  if (room.players.size === 0) {
    if (room.round) clearTimeout(room.round.timeoutHandle);
    rooms.delete(room.code);
    socketsByRoom.delete(room.code);
    return;
  }
  if (ws.playerId === room.hostId) {
    room.hostId = [...room.players.keys()][0]; // Host-Übergabe an nächsten Spieler
  }
  // Falls mitten in einer laufenden Runde jemand geht, kann das die
  // Restlichen zum Abschluss bringen (alle verbleibenden haben abgegeben).
  if (room.round && room.round.scores.size >= room.players.size) {
    finalizeRoom(room);
  } else {
    broadcast(room, "lobbyUpdate", room.lobbyState());
  }
}

httpServer.listen(PORT, () => {
  console.log(`Big Sevis Minispiel Party Server läuft auf Port ${PORT}`);
});
