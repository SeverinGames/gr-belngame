// server/partyMinigame.js
// Ersetzt die frühere Tür-Dungeon-Logik (partyRun.js) komplett. Eine Online-
// Runde ist jetzt: alle Spieler bekommen dasselbe Minispiel (gleicher Seed,
// damit z.B. Obstkorb für alle exakt dieselben Fruchtmuster hat), spielen es
// lokal im Browser (Wiederverwendung der bestehenden js/arcade/games/*-Module
// - keine Duplizierung der Spiellogik), und melden am Ende ihren Punktestand.
// Der Server ist die einzige Quelle der Wahrheit für die Rangliste.

const ROUND_TIMEOUT_MS = 90_000; // Sicherheitsnetz, falls jemand die Runde nie beendet/die Verbindung verliert

export class PartyMinigameRoom {
  constructor(code, hostId) {
    this.code = code;
    this.hostId = hostId;
    this.players = new Map(); // id -> { name, skinId, ready }
    this.settings = { gameId: "fruitCatcher" };
    this.status = "lobby"; // 'lobby' | 'in-progress'
    this.round = null; // { gameId, seed, scores: Map<id, score>, timeoutHandle }
  }

  addPlayer(id, { name, skinId }) {
    this.players.set(id, { name: name || "Spieler", skinId: skinId || "mario", ready: false });
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.round) this.round.scores.delete(id);
  }

  lobbyState() {
    return {
      code: this.code,
      hostId: this.hostId,
      settings: this.settings,
      status: this.status,
      players: [...this.players.entries()].map(([id, p]) => ({ id, ...p, isHost: id === this.hostId })),
    };
  }

  startRound() {
    const seed = Math.floor(Math.random() * 1_000_000_000);
    this.status = "in-progress";
    this.round = { gameId: this.settings.gameId, seed, scores: new Map(), timeoutHandle: null };
    return { gameId: this.round.gameId, seed, players: this.publicPlayers() };
  }

  publicPlayers() {
    return [...this.players.entries()].map(([id, p]) => ({ id, name: p.name, skinId: p.skinId }));
  }

  submitScore(playerId, score) {
    if (!this.round) return false;
    this.round.scores.set(playerId, Math.max(0, Math.round(score) || 0));
    return this.round.scores.size >= this.players.size;
  }

  finishRound() {
    const round = this.round;
    this.round = null;
    this.status = "lobby";
    for (const p of this.players.values()) p.ready = false;
    if (!round) return [];
    return this.publicPlayers()
      .map((p) => ({ ...p, score: round.scores.get(p.id) ?? 0 }))
      .sort((a, b) => b.score - a.score);
  }
}

export { ROUND_TIMEOUT_MS };
