// js/arcade/controller.js
// Orchestriert das gesamte Minispiel-System: Auswahl-Bildschirm, gemeinsame
// HUD-Leiste (Timer/Score/Combo), Starten/Beenden eines Minispiels und den
// Ergebnis-/Belohnungs-Screen danach (Punkte 2, 9, 11 des Prompts).
// Kein eigenes Schwierigkeits-Auswahlmenü pro Spiel - direkter Ablauf
// Auswahl -> Start -> Spiel -> Ergebnis -> Belohnung -> Zurück/Nächstes (Punkt 10).
import { ARCADE_GAMES, getArcadeGame } from "./registry.js";
import { rewardTierFromPercent } from "./engine.js";
import { applyArcadeRewards } from "../rewards/profile.js";

const el = (sel) => document.querySelector(sel);

export function createArcadeController({ getProfile, saveProfile, showScreen, audio, renderProfileSummary }) {
  let activeGame = null;
  let currentGameId = null;
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
      card.addEventListener("click", () => { audio.sfx("click"); openGame(g.id); });
      list.appendChild(card);
    });
  }

  function openHome() {
    renderHome();
    showScreen("screen-arcade");
  }

  function openGame(gameId) {
    const meta = getArcadeGame(gameId);
    if (!meta) return;
    currentGameId = gameId;
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
    const tier = rewardTierFromPercent(result.percent ?? 0);
    const { isNewHighscore, levelUps } = applyArcadeRewards(profile, {
      gameId, xpEarned: tier.xp, coinsEarned: tier.coins, score: result.score,
    });
    saveProfile(profile);
    renderProfileSummary(profile);

    if (tier.tier === "perfekt") audio.sfx("unlockRare");
    else if (isNewHighscore) audio.sfx("secretFound");
    else audio.sfx("treasure");
    if (levelUps.length) audio.sfx("levelUp");

    const meta = getArcadeGame(gameId);
    const resultBox = el("#arcade-result");
    resultBox.innerHTML = `
      <div class="arcade-result__card">
        <div class="arcade-result__tier arcade-result__tier--${tier.tier}">${tier.label}</div>
        <div class="arcade-result__score">${result.resultLabel ?? `${result.score} PUNKTE`}</div>
        ${result.maxCombo > 1 ? `<div class="arcade-result__combo">COMBO x${result.maxCombo}</div>` : ""}
        ${isNewHighscore ? `<div class="arcade-result__highscore">🏆 NEUER HIGHSCORE!</div>` : ""}
        <div class="arcade-result__rewards">
          <span class="arcade-reward-chip">+${tier.xp} XP</span>
          <span class="arcade-reward-chip">+${tier.coins} 🪙</span>
        </div>
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

    el("#btn-arcade-retry").addEventListener("click", () => { audio.sfx("click"); openGame(gameId); });
    el("#btn-arcade-next").addEventListener("click", () => { audio.sfx("click"); openGame(pickNextGameId(gameId)); });
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
