// js/player/player.js
export class RunPlayer {
  constructor(name = "Spieler", skinId = "mario") {
    this.name = name;
    this.skinId = skinId;
    this.hp = 100;
    this.securedCoins = 0; // sicher, bereits "eingesackt" (bei Flucht behalten)
    this.riskCoins = 0;    // noch nicht gesichert, geht bei Niederlage verloren
    this.xp = 0;
    this.alive = true;
  }

  applyOutcome(outcome) {
    this.riskCoins = Math.max(0, this.riskCoins + outcome.coins);
    this.xp += outcome.xp;
    this.hp = Math.max(0, Math.min(100, this.hp + outcome.hp));
    if (this.hp <= 0) this.alive = false;
    return this.alive;
  }

  secureCoins() {
    this.securedCoins += this.riskCoins;
    this.riskCoins = 0;
  }

  loseRiskCoins() {
    this.riskCoins = 0;
  }
}
