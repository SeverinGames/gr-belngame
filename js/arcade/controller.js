// js/arcade/controller.js
// Orchestriert das gesamte Minispiel-System: Auswahl-Bildschirm, gemeinsame
// HUD-Leiste (Timer/Score/Combo), Starten/Beenden eines Minispiels und den
// Ergebnis-/Belohnungs-Screen danach. Seit der Umstellung auf "Big Sevis
// Minispiel Party" ist dies der komplette SOLO-Modus (kein Türen-System
// mehr) und wird für ONLINE-Runden wiederverwendet (siehe main.js).
import { ARCADE_GAMES, getArcadeGame } from "./registry.js";
import { rewardTierFromPercent } from "./engine.js";
import { applyArcadeRewards } from "../rewards/profile.js";

const el = (sel) => document.querySelector(sel);

// Schwierigkeit wirkt bewusst NUR auf die Belohnung, nicht auf die Spiellogik
// selbst - die acht Minispiele bleiben dadurch unverändert und stabil.
// "Schwer" verlangt einen höheren Score für dieselbe Belohnungsstufe, gibt
// dafür aber am Ende spürbar mehr Münzen & XP.
export const DIFFICULTY_DEFS = {
  easy: { label: "Leicht", percentBonus: 15, rewardMultiplier: 0.8 },
  normal: { label: "Normal", percentBonus: 0, rewardMultiplier: 1 },
  hard: { label: "Schwer", percentBonus: -15, rewardMultiplier: 1.4 },
};

export function createArcadeController({ getProfile, saveProfile, showScreen, audio, renderProfileSummary, onPickGame }) {
  let activeGame = null;
  let currentDifficulty = "normal";
  let rng = Math.random;

  function renderHome() {
    const profile = getProfile();
    const list = el("#arcade-game-list");
    list.innerHTML = "";
    ARCADE_GAMES.forEach((g) => {
      const best = profile.arcadeHighscores[g.id];
      const card = document.createElement("button");
      card.className = "arcade-card";
      card.innerHTML = `
        <div class="arcade-card__icon">${g.icon}</div>
        <div class="arcade-card__name">${g.name}</div>
        <div class="arcade-card__tagline">${g.tagline}</div>
        ${best ? `<div class="arcade-card__best">🏆 Highscore: ${best}</div>` : ""}
      `;
      card.addEventListener("click", () => {
        audio.sfx("click");
        if (onPickGame) onPickGame(g.id);
        else openGame(g.id);
      });
      list.appendChild(card);
    });
  }

  function openHome() {
    renderHome();
    showScreen("screen-arcade");
  }

  function openGame(gameId, difficultyId = "normal") {
    const meta = getArcadeGame(gameId);
    if (!meta) return;
    currentDifficulty = DIFFICULTY_DEFS[difficultyId] ? difficultyId : "normal";
    showScreen("screen-arcade-play");
    el("#arcade-play-title").textContent = `${meta.icon} ${meta.name}`;
    el("#arcade-result").classList.add("hidden");
    el("#arcade-result").innerHTML = "";
    el("#arcade-combo").classList.add("hidden");
    el("#arcade-score").textContent = "0";
    el("#arcade-timer-fill").style.width = "100%";
    const stage = el("#arcade-stage");
    stage.innerHTML = "";
    stage.classList.remove("hidden");

    meta.load().then((mod) => {
      const profile = getProfile();
      activeGame = mod.start({
        container: stage,
        skinId: profile.equippedSkin ?? "mario",
        rng,
        difficulty: currentDifficulty,
        onHud: updateHud,
        onEnd: (result) => finishGame(gameId, result),
      });
    });
  }

  function updateHud(patch) {
    if (patch.score !== undefined) el("#arcade-score").textContent = String(patch.score);
    if (patch.combo !== undefined) {
      const badge = el("#arcade-combo");
      if (patch.combo >= 2) { badge.textContent = `x${patch.combo}`; badge.classList.remove("hidden"); }
      else badge.classList.add("hidden");
    }
    if (patch.total) {
      const frac = patch.roundTotal
        ? patch.round / patch.roundTotal
        : 1 - patch.timeLeft / patch.total;
      el("#arcade-timer-fill").style.width = `${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%`;
    }
  }

  function finishGame(gameId, result) {
    activeGame = null;
    const stage = el("#arcade-stage");
    stage.classList.add("hidden");
    const profile = getProfile();
    const diff = DIFFICULTY_DEFS[currentDifficulty];
    const adjustedPercent = Math.max(0, Math.min(100, (result.percent ?? 0) + diff.percentBonus));
    const tier = rewardTierFromPercent(adjustedPercent);
    const xpEarned = Math.round(tier.xp * diff.rewardMultiplier);
    const coinsEarned = Math.round(tier.coins * diff.rewardMultiplier);
    const { isNewHighscore, levelUps } = applyArcadeRewards(profile, {
      gameId, xpEarned, coinsEarned, score: result.score, maxCombo: result.maxCombo ?? 0, tier: tier.tier,
    });
    saveProfile(profile);
    renderProfileSummary(profile);

    if (tier.tier === "perfekt") audio.sfx("unlockRare");
    else if (isNewHighscore) audio.sfx("secretFound");
    else audio.sfx("treasure");
    if (levelUps.length) audio.sfx("levelUp");

    const resultBox = el("#arcade-result");
    resultBox.innerHTML = `
      <div class="arcade-result__card">
        <div class="arcade-result__tier arcade-result__tier--${tier.tier}">${tier.label}</div>
        <div class="arcade-result__score">${result.resultLabel ?? `${result.score} PUNKTE`}</div>
        ${result.maxCombo > 1 ? `<div class="arcade-result__combo">COMBO x${result.maxCombo}</div>` : ""}
        ${isNewHighscore ? `<div class="arcade-result__highscore">🏆 NEUER HIGHSCORE!</div>` : ""}
        <div class="arcade-result__rewards">
          <span class="arcade-reward-chip">+${xpEarned} XP</span>
          <span class="arcade-reward-chip">+${coinsEarned} 🪙</span>
        </div>
        <div class="arcade-result__difficulty">Schwierigkeit: ${diff.label}</div>
        ${levelUps.length ? `<div class="arcade-result__levelup">LEVEL UP! Level ${levelUps[levelUps.length - 1]}</div>` : ""}
        <div class="arcade-result__actions">
          <button id="btn-arcade-retry" class="btn btn--primary">NOCHMAL SPIELEN</button>
          <button id="btn-arcade-next" class="btn btn--secondary">NÄCHSTES SPIEL</button>
          <button id="btn-arcade-home" class="btn btn--ghost">ZURÜCK</button>
        </div>
      </div>
    `;
    resultBox.classList.remove("hidden");
    el("#arcade-combo").classList.add("hidden");

    el("#btn-arcade-retry").addEventListener("click", () => { audio.sfx("click"); openGame(gameId, currentDifficulty); });
    el("#btn-arcade-next").addEventListener("click", () => { audio.sfx("click"); openGame(pickNextGameId(gameId), currentDifficulty); });
    el("#btn-arcade-home").addEventListener("click", () => { audio.sfx("click"); openHome(); });
  }

  function pickNextGameId(currentId) {
    const idx = ARCADE_GAMES.findIndex((g) => g.id === currentId);
    return ARCADE_GAMES[(idx + 1) % ARCADE_GAMES.length].id;
  }

  function quitActiveGame() {
    if (activeGame) { activeGame.destroy(); activeGame = null; }
    openHome();
  }

  el("#btn-arcade-quit").addEventListener("click", () => { audio.sfx("click"); quitActiveGame(); });

  return { openHome, openGame, quitActiveGame };
}
