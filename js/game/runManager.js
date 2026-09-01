// js/game/runManager.js
import { RandomEngine } from "../rooms/randomEngine.js";
import { resolveRoom, getMerchantOffer, attemptSecretSearch } from "../events/eventPool.js";
import { hasItem } from "../inventory/inventory.js";
import { RunPlayer } from "../player/player.js";
import { createBot, botPickDoor, botVoteFlee, botComment } from "../bots/personalities.js";
import { assignSaboteur, saboteurDoorScore, checkTaskSuccess } from "../saboteur/saboteur.js";

const DIFFICULTY_PRESETS = {
  easy:     { dangerFactor: 0.7, hintReliability: 0.75 },
  normal:   { dangerFactor: 1.0, hintReliability: 0.6 },
  hard:     { dangerFactor: 1.3, hintReliability: 0.45 },
  chaos:    { dangerFactor: 1.4, hintReliability: 0.35 },
  nightmare:{ dangerFactor: 1.7, hintReliability: 0.25 },
};

export class RunManager {
  constructor({ seed, difficulty = "normal", player, botCount = 0, saboteurPreset = "normal" } = {}) {
    this.rng = new RandomEngine(seed);
    this.difficultyId = difficulty;
    this.difficulty = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS.normal;
    this.player = player ?? new RunPlayer();
    this.roomsCleared = 0;
    this.finished = false;
    this.result = null; // 'fled' | 'died' | null
    this.bots = Array.from({ length: botCount }, () => createBot(() => this.rng.next()));
    this.saboteur = assignSaboteur(this.bots, saboteurPreset, () => this.rng.next());
    this.stats = { dangerRoomsEntered: 0, trapsTriggered: 0, securedCoinsAtEnd: 0 };
  }

  isSaboteur(bot) {
    return this.saboteur && this.saboteur.botId === bot.id;
  }

  // Liefert für jede Tür, welche (noch lebenden) Bots sie bevorzugen - für die UI
  // Der Saboteur (falls vorhanden) bewertet Türen anders, tarnt sich aber nach außen.
  getBotDoorSuggestions(doors) {
    return this.bots
      .filter((b) => b.alive)
      .map((bot) => {
        const preferredDoor = this.isSaboteur(bot)
          ? [...doors].sort((a, b) => saboteurDoorScore(b) - saboteurDoorScore(a))[0]
          : botPickDoor(bot, doors, () => this.rng.next());
        return { bot, preferredDoor };
      });
  }

  // Kommentare der Bots zu einem Ergebnis (kind: 'danger' | 'reward' | ...)
  getBotReactions(outcomeKind) {
    const situation = outcomeKind === "danger" ? "danger" : outcomeKind === "reward" ? "reward" : null;
    if (!situation) return [];
    return this.bots
      .filter((b) => b.alive)
      .map((bot) => ({ bot, comment: botComment(bot, situation, () => this.rng.next()) }))
      .filter((r) => r.comment);
  }

  // Stimmen der Bots zur Flucht-Entscheidung
  getBotFleeVotes() {
    return this.bots
      .filter((b) => b.alive)
      .map((bot) => ({
        bot,
        wantsFlee: botVoteFlee(bot, this.roomsCleared, () => this.rng.next()),
        comment: botComment(bot, "flee", () => this.rng.next()),
      }));
  }

  get dynamicDifficultyFactor() {
    // steigt mit Fortschritt, aber nicht rein linear (leichtes Schwanken via rng)
    const base = 1 + this.roomsCleared * 0.08;
    const wobble = 0.9 + this.rng.next() * 0.2;
    return base * wobble * this.difficulty.dangerFactor;
  }

  // Erzeugt 2-4 Türen. Jede Tür bekommt heimlich einen Raumtyp UND einen
  // "Hinweis" (visuelle Andeutung), der laut Fairness-Regel (Punkt 53)
  // nicht garantiert korrekt sein muss, aber tendenziell nützlich ist.
  generateDoors() {
    const doorCount = 2 + this.rng.nextInt(3); // 2..4
    const doors = [];
    for (let i = 0; i < doorCount; i++) {
      const roomType = this.rng.pickRoomType(this.dynamicDifficultyFactor);
      const trueHint = roomType.tags.includes("danger") ? "danger" : "calm";
      // Hinweis ist nur mit hintReliability-Wahrscheinlichkeit korrekt (Punkt 6)
      const shownHint =
        this.rng.next() < this.difficulty.hintReliability
          ? trueHint
          : trueHint === "danger" ? "calm" : "danger";
      doors.push({ id: i, roomType, shownHint });
    }
    // Fairness-Check (vereinfacht, Punkt 53): mindestens eine Tür darf nicht
    // reiner "boss"-Raum sein, damit nie eine unmögliche Situation entsteht.
    if (doors.every((d) => d.roomType.id === "boss")) {
      doors[0].roomType = this.rng.pickRoomType(0.5);
    }
    this.currentDoors = doors;
    return doors;
  }

  // Kürzel für UI: ist diese Tür ein Minispiel statt sofortiger Text-Auflösung?
  isMinigameDoor(door) {
    return door.roomType.tags.includes("minigame");
  }

  // Wird von der UI aufgerufen, NACHDEM das Minispiel gespielt wurde - wendet
  // das extern ermittelte Ergebnis genauso an wie chooseDoor() ein Zufallsereignis
  resolveMinigameDoor(doorId, outcome) {
    const door = this.currentDoors.find((d) => d.id === doorId);
    if (!door) throw new Error("Ungültige Tür");
    this.player.applyOutcome(outcome);
    this.rng.reportOutcome(outcome.kind === "danger");
    this.roomsCleared++;
    if (outcome.kind === "danger") this.stats.dangerRoomsEntered++;

    if (!this.player.alive) {
      this.finished = true;
      this.result = "died";
      this.player.loseRiskCoins();
    }
    return { door, outcome, merchantOffer: null, secretFound: false };
  }

  chooseDoor(doorId) {
    const door = this.currentDoors.find((d) => d.id === doorId);
    if (!door) throw new Error("Ungültige Tür");
    const ctx = { difficultyFactor: this.dynamicDifficultyFactor, hasKey: hasItem(this.player.inventory, "key") };
    const outcome = resolveRoom(door.roomType, this.rng, ctx);
    this.player.applyOutcome(outcome);
    this.rng.reportOutcome(outcome.kind === "danger");
    this.roomsCleared++;

    if (outcome.kind === "danger") this.stats.dangerRoomsEntered++;
    if (door.roomType.id === "trap") this.stats.trapsTriggered++;

    // Händlerraum: Angebot wird mitgeliefert, Kauf ist eine separate Aktion (buyHeal)
    let merchantOffer = null;
    if (door.roomType.id === "merchant") {
      merchantOffer = getMerchantOffer(this.rng, ctx);
    }

    // Geheimraum-Suche: nach jedem regulären Raum kleine Chance auf Bonus-Fund
    const secretFound =
      door.roomType.id !== "secret" && attemptSecretSearch(this.rng, this.rng.luck);

    if (!this.player.alive) {
      this.finished = true;
      this.result = "died";
      this.player.loseRiskCoins();
    }
    return { door, outcome, merchantOffer, secretFound };
  }

  // Kauf beim Händler: Münzen gegen HP. Gibt false zurück, wenn zu wenig Münzen.
  buyHeal(offer) {
    if (this.player.riskCoins < offer.cost) return false;
    this.player.riskCoins -= offer.cost;
    this.player.hp = Math.min(100, this.player.hp + offer.healAmount);
    return true;
  }

  // Geheimraum-Bonus einsammeln (nach positivem attemptSecretSearch)
  collectSecretBonus() {
    const bonus = 20 + Math.floor(this.rng.next() * 30);
    this.player.riskCoins += bonus;
    return bonus;
  }

  // Ab Raum 3 kann ein Ausgang auftauchen; Wahrscheinlichkeit steigt mit Fortschritt.
  exitAvailable() {
    if (this.roomsCleared < 2) return false;
    const chance = Math.min(0.8, 0.15 + this.roomsCleared * 0.06);
    return this.rng.next() < chance;
  }

  useItem(itemId) {
    return this.player.useItem(itemId);
  }

  flee() {
    this.player.secureCoins();
    this.finished = true;
    this.result = "fled";
    this.stats.securedCoinsAtEnd = this.player.securedCoins;
  }

  // Am Ende einer Runde: wer war der Saboteur, hat er seine Aufgabe erfüllt?
  revealSaboteur() {
    if (!this.saboteur) return { hadSaboteur: false };
    if (this.result !== "fled") this.stats.securedCoinsAtEnd = this.player.securedCoins;
    const bot = this.bots.find((b) => b.id === this.saboteur.botId);
    const success = checkTaskSuccess(this.saboteur.task, this.stats);
    return { hadSaboteur: true, bot, task: this.saboteur.task, success };
  }
}
