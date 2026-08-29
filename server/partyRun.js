// server/partyRun.js
// Wiederverwendet dieselbe Spiellogik wie der Solo-Client (js/rooms, js/events,
// js/player, js/bots, js/saboteur - alles reines JS ohne DOM-Abhängigkeit).
// Wichtig (Punkt 74): Der Server ist die einzige Quelle der Wahrheit für
// Würfelergebnisse, Belohnungen und Sieg/Niederlage - der Client zeigt nur an.

import { RandomEngine } from "../js/rooms/randomEngine.js";
import { resolveRoom, getMerchantOffer, attemptSecretSearch } from "../js/events/eventPool.js";
import { RunPlayer } from "../js/player/player.js";
import { createBot, botPickDoor, botVoteFlee, botComment } from "../js/bots/personalities.js";
import { assignSaboteur, saboteurDoorScore, checkTaskSuccess } from "../js/saboteur/saboteur.js";

const DIFFICULTY_PRESETS = {
  easy: { dangerFactor: 0.7, hintReliability: 0.75 },
  normal: { dangerFactor: 1.0, hintReliability: 0.6 },
  hard: { dangerFactor: 1.3, hintReliability: 0.45 },
  chaos: { dangerFactor: 1.4, hintReliability: 0.35 },
  nightmare: { dangerFactor: 1.7, hintReliability: 0.25 },
};

// Eine Runde mit mehreren MENSCHLICHEN Spielern (statt nur einem wie im Solo-Client)
// plus optionalen Bots. Alle Menschen erleben dieselben Türen/Ereignisse gemeinsam;
// wer zuerst klickt, entscheidet für die Gruppe (siehe README für Details/Grenzen).
export class PartyRun {
  constructor({ seed, difficulty = "normal", botCount = 0, saboteurPreset = "normal", humanPlayers = [] } = {}) {
    this.rng = new RandomEngine(seed);
    this.difficultyId = difficulty;
    this.difficulty = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.normal;
    this.humans = new Map(humanPlayers.map((p) => [p.id, new RunPlayer(p.name, p.skinId)]));
    this.bots = Array.from({ length: botCount }, () => createBot(() => this.rng.next()));
    this.saboteur = assignSaboteur(this.bots, saboteurPreset, () => this.rng.next());
    this.roomsCleared = 0;
    this.finished = false;
    this.result = null;
    this.stats = { dangerRoomsEntered: 0, trapsTriggered: 0, securedCoinsAtEnd: 0 };
    this.currentDoors = [];
  }

  isSaboteur(bot) {
    return this.saboteur && this.saboteur.botId === bot.id;
  }

  anyHumanAlive() {
    return [...this.humans.values()].some((p) => p.alive);
  }

  get dynamicDifficultyFactor() {
    const base = 1 + this.roomsCleared * 0.08;
    const wobble = 0.9 + this.rng.next() * 0.2;
    return base * wobble * this.difficulty.dangerFactor;
  }

  generateDoors() {
    const doorCount = 2 + this.rng.nextInt(3);
    const doors = [];
    for (let i = 0; i < doorCount; i++) {
      const roomType = this.rng.pickRoomType(this.dynamicDifficultyFactor);
      const trueHint = roomType.tags.includes("danger") ? "danger" : "calm";
      const shownHint =
        this.rng.next() < this.difficulty.hintReliability
          ? trueHint
          : trueHint === "danger" ? "calm" : "danger";
      doors.push({ id: i, roomType: { id: roomType.id, tags: roomType.tags }, shownHint });
    }
    this.currentDoors = doors;
    return doors;
  }

  // Wendet das Ergebnis auf ALLE lebenden menschlichen Spieler gemeinsam an
  // (geteiltes Coop-Erlebnis - siehe Punkt 27/28 "gemeinsam ein Gebäude betreten")
  chooseDoor(doorId) {
    const door = this.currentDoors.find((d) => d.id === doorId);
    if (!door) throw new Error("Ungültige Tür");
    const ctx = { difficultyFactor: this.dynamicDifficultyFactor };
    const outcome = resolveRoom(door.roomType, this.rng, ctx);

    for (const player of this.humans.values()) {
      if (!player.alive) continue;
      player.applyOutcome(outcome);
    }
    this.rng.reportOutcome(outcome.kind === "danger");
    this.roomsCleared++;
    if (outcome.kind === "danger") this.stats.dangerRoomsEntered++;
    if (door.roomType.id === "trap") this.stats.trapsTriggered++;

    let merchantOffer = null;
    if (door.roomType.id === "merchant") merchantOffer = getMerchantOffer(this.rng, ctx);
    const secretFound = door.roomType.id !== "secret" && attemptSecretSearch(this.rng, this.rng.luck);

    if (!this.anyHumanAlive()) {
      this.finished = true;
      this.result = "died";
      for (const p of this.humans.values()) p.loseRiskCoins();
    }
    return { door, outcome, merchantOffer, secretFound };
  }

  exitAvailable() {
    if (this.roomsCleared < 2) return false;
    const chance = Math.min(0.8, 0.15 + this.roomsCleared * 0.06);
    return this.rng.next() < chance;
  }

  flee() {
    for (const p of this.humans.values()) p.secureCoins();
    this.finished = true;
    this.result = "fled";
    this.stats.securedCoinsAtEnd = [...this.humans.values()].reduce((s, p) => s + p.securedCoins, 0);
  }

  getBotDoorSuggestions(doors) {
    return this.bots
      .filter((b) => b.alive)
      .map((bot) => {
        const preferredDoor = this.isSaboteur(bot)
          ? [...doors].sort((a, b) => saboteurDoorScore(b) - saboteurDoorScore(a))[0]
          : botPickDoor(bot, doors, () => this.rng.next());
        return { botId: bot.id, botName: bot.name, preferredDoorId: preferredDoor.id };
      });
  }

  getBotReactions(outcomeKind) {
    const situation = outcomeKind === "danger" ? "danger" : outcomeKind === "reward" ? "reward" : null;
    if (!situation) return [];
    return this.bots
      .filter((b) => b.alive)
      .map((bot) => ({ botName: bot.name, comment: botComment(bot, situation, () => this.rng.next()) }))
      .filter((r) => r.comment);
  }

  revealSaboteur() {
    if (!this.saboteur) return { hadSaboteur: false };
    if (this.result !== "fled") {
      this.stats.securedCoinsAtEnd = [...this.humans.values()].reduce((s, p) => s + p.securedCoins, 0);
    }
    const bot = this.bots.find((b) => b.id === this.saboteur.botId);
    const success = checkTaskSuccess(this.saboteur.task, this.stats);
    return { hadSaboteur: true, botName: bot?.name, task: this.saboteur.task, success };
  }

  // Serialisierbarer Zustand für die Broadcast-Nachricht an alle Clients
  toPublicState() {
    return {
      roomsCleared: this.roomsCleared,
      finished: this.finished,
      result: this.result,
      doors: this.currentDoors.map((d) => ({ id: d.id, shownHint: d.shownHint })),
      players: [...this.humans.entries()].map(([id, p]) => ({
        id, name: p.name, hp: p.hp, securedCoins: p.securedCoins, riskCoins: p.riskCoins, alive: p.alive,
      })),
      bots: this.bots.map((b) => ({ id: b.id, name: b.name, personality: b.personality.label, alive: b.alive })),
    };
  }
}
