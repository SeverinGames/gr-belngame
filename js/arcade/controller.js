// js/arcade/controller.js
// Orchestriert das gesamte Minispiel-System: Auswahl-Bildschirm, gemeinsame
// HUD-Leiste (Timer/Score/Combo), Starten/Beenden eines Minispiels und den
// Ergebnis-/Belohnungs-Screen danach. SOLO-Modus von "Big Sevis Minispiel
// Party"; die Belohnungs-Logik (applyRound) wird auch für ONLINE genutzt.
import { ARCADE_GAMES, getArcadeGame } from "./registry.js";
import { rewardTierFromPercent } from "./engine.js";
import { applyRound } from "../progress/roundResult.js";
import { xpBarHtml } from "../ui/xpbar.js";
import { playFinishEffect, showEmoteBubble } from "../ui/effects.js";
import { equippedCosmetic } from "../progress/cosmetics.js";

const el = (sel) => document.querySelector(sel);

// Einheitliche Bezeichnungen überall: LEICHT / MITTEL / SCHWER.
// Spiele mit echter Schwierigkeit (registry: realDifficulty) werden in der
// Spiellogik selbst schwerer; bei den übrigen verschiebt die Schwierigkeit
// die Leistungsschwelle für die Belohnung (percentBonus).
export const DIFFICULTY_DEFS = {
  easy: { label: "LEICHT", icon: "😌", percentBonus: 15, rewardMultiplier: 0.8 },
  normal: { label: "MITTEL", icon: "🙂", percentBonus: 0, rewardMultiplier: 1 },
  hard: { label: "SCHWER", icon: "🔥", percentBonus: -15, rewardMultiplier: 1.5 },
};
export const DIFFICULTY_ORDER = ["easy", "normal", "hard"];

export function formatScore(meta, score) {
  const v = Number(score).toLocaleString("de-DE");
  return meta?.unit ? `${v} ${meta.unit}` : v;
}

// Bestwert eines Spiels für eine Schwierigkeit (null = noch nicht gespielt)
export function highscoreFor(profile, gameId, difficulty) {
  return profile.arcadeHighscoresByDiff?.[gameId]?.[difficulty] ?? null;
}

export function createArcadeController({ getProfile, saveProfile, showScreen, audio, renderProfileSummary, onPickGame, onRoundDone }) {
  let activeGame = null;
  let currentDifficulty = "normal";
  let runId = 0; // jede gestartete Runde bekommt eine Nummer; ein Ergebnis zählt nur EINMAL
  let runStartedAt = 0;
  const MIN_VALID_RUN_MS = 1500; // schneller kann kein echtes Spiel enden (Schutz vor Klick-Spam)
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
        ${best ? `<div class="arcade-card__best">🏆 ${g.lowerIsBetter ? "Bestzeit: " : ""}${formatScore(g, best)}</div>` : ""}
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
    // Läuft noch ein Spiel, wird es sauber beendet (nie zwei gleichzeitig, keine Doppel-Ergebnisse)
    if (activeGame) { try { activeGame.destroy(); } catch { /* ignore */ } activeGame = null; }
    const myRun = ++runId;
    runStartedAt = performance.now();
    currentDifficulty = DIFFICULTY_DEFS[difficultyId] ? difficultyId : "normal";
    showScreen("screen-arcade-play");
    el("#arcade-play-title").textContent = `${meta.icon} ${meta.name} · ${DIFFICULTY_DEFS[currentDifficulty].label}`;
    el("#arcade-result").classList.add("hidden");
    el("#arcade-result").innerHTML = "";
    el("#arcade-combo").classList.add("hidden");
    el("#arcade-score").textContent = "0";
    el("#arcade-timer-fill").style.width = "100%";
    const stage = el("#arcade-stage");
    stage.innerHTML = "";
    stage.classList.remove("hidden");
    stage.dataset.game = gameId;

    meta.load().then((mod) => {
      if (myRun !== runId) return; // inzwischen anderes Spiel/Abbruch
      const profile = getProfile();
      activeGame = mod.start({
        container: stage,
        skinId: profile.equippedSkin ?? "mario",
        rng,
        difficulty: currentDifficulty,
        onHud: updateHud,
        onEnd: (result) => finishGame(gameId, result, myRun),
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

  const finishedRuns = new Set();
  function finishGame(gameId, result, myRun) {
    if (myRun !== runId || finishedRuns.has(myRun)) return; // Doppel-/Altergebnis: keine zweite Belohnung
    finishedRuns.add(myRun);
    activeGame = null;
    if (result.aborted) { openHome(); return; } // z.B. 3D nicht verfügbar: keine Belohnung
    const tooFast = performance.now() - runStartedAt < MIN_VALID_RUN_MS;
    if (result.invalid || tooFast) { showInvalid(gameId, tooFast ? "Runde zu schnell beendet." : "Es wurde nicht richtig gespielt."); return; }
    const meta = getArcadeGame(gameId);
    const stage = el("#arcade-stage");
    stage.classList.add("hidden");
    const profile = getProfile();
    const diff = DIFFICULTY_DEFS[currentDifficulty];
    const bonus = meta?.realDifficulty ? 0 : diff.percentBonus;
    const adjustedPercent = Math.max(0, Math.min(100, (result.percent ?? 0) + bonus));
    const tier = rewardTierFromPercent(adjustedPercent);
    const xpEarned = Math.round(tier.xp * diff.rewardMultiplier);
    const coinsEarned = Math.round(tier.coins * diff.rewardMultiplier);
    const res = applyRound(profile, {
      gameId, xpEarned, coinsEarned, score: result.score, maxCombo: result.maxCombo ?? 0, tier: tier.tier,
      difficulty: currentDifficulty, percent: adjustedPercent, won: !!result.won, lowerIsBetter: !!meta?.lowerIsBetter,
    });
    saveProfile(profile);
    renderProfileSummary(profile);
    if (onRoundDone) onRoundDone(res);

    if (tier.tier === "perfekt") audio.sfx("unlockRare");
    else if (res.isNewHighscore) audio.sfx("secretFound");
    else audio.sfx("treasure");

    const best = highscoreFor(profile, gameId, currentDifficulty);
    const highscoreLine = res.isNewHighscore
      ? `<div class="arcade-result__highscore">🏆 ${meta?.lowerIsBetter ? "NEUE BESTZEIT!" : "NEUER HIGHSCORE!"}</div>`
      : best != null ? `<div class="arcade-result__best">${meta?.lowerIsBetter ? "DEINE BESTZEIT" : "DEIN HIGHSCORE"}: ${formatScore(meta, best)}</div>` : "";
    const ppLine = `<div class="arcade-result__pp"><span class="pp-chip">⭐ ${res.pp.roundPoints} PARTY-PUNKTE</span>${res.pp.gained > 0 ? `<span class="pp-gain">Gesamt +${res.pp.gained}</span>` : `<span class="pp-gain pp-gain--dim">Bestwert: ${res.pp.newBest}</span>`}</div>`;

    const resultBox = el("#arcade-result");
    resultBox.innerHTML = `
      <div class="arcade-result__card">
        <div class="arcade-result__tier arcade-result__tier--${tier.tier}">${tier.label}</div>
        <div class="arcade-result__score">${result.resultLabel ?? `${result.score} PUNKTE`}</div>
        ${result.maxCombo > 1 && !result.hideCombo ? `<div class="arcade-result__combo">COMBO x${result.maxCombo}</div>` : ""}
        ${highscoreLine}
        ${ppLine}
        <div class="arcade-result__rewards">
          <span class="arcade-reward-chip">+${xpEarned} XP</span>
          <span class="arcade-reward-chip">+${coinsEarned} 🪙</span>
          ${res.highscoreReward ? `<span class="arcade-reward-chip arcade-reward-chip--bonus">+${res.highscoreReward.coins} 🪙 Highscore-Bonus</span>` : ""}
        </div>
        ${xpBarHtml(profile, "xpbar--compact")}
        <div class="arcade-result__difficulty">${diff.label}</div>
        ${res.bonusSpinEarned ? `<div class="arcade-result__levelup">🎡 Bonus-Dreh erhalten!</div>` : ""}
        <div class="arcade-result__actions">
          <button id="btn-arcade-retry" class="btn btn--primary">NOCHMAL SPIELEN</button>
          <button id="btn-arcade-next" class="btn btn--secondary">NÄCHSTES SPIEL</button>
          <button id="btn-arcade-home" class="btn btn--ghost">ZURÜCK</button>
        </div>
      </div>
    `;
    resultBox.classList.remove("hidden");
    el("#arcade-combo").classList.add("hidden");
    // Ausgerüstete Kosmetik: Abschluss-Effekt + Emote nach guten Runden
    if (tier.tier !== "schwach") {
      const fin = equippedCosmetic(profile, "finish");
      if (fin && fin.id !== "none") playFinishEffect(resultBox, fin.id);
      const em = equippedCosmetic(profile, "emote");
      if (em?.icon) showEmoteBubble(resultBox, em.icon);
    }

    el("#btn-arcade-retry").addEventListener("click", () => { audio.sfx("click"); openGame(gameId, currentDifficulty); }, { once: true });
    el("#btn-arcade-next").addEventListener("click", () => { audio.sfx("click"); openGame(pickNextGameId(gameId), currentDifficulty); }, { once: true });
    el("#btn-arcade-home").addEventListener("click", () => { audio.sfx("click"); openHome(); }, { once: true });
  }

  // Ungültige Runde: keine Münzen/XP/Party-Punkte/Spielzähler
  function showInvalid(gameId, why) {
    const stage = el("#arcade-stage");
    stage.classList.add("hidden");
    const box = el("#arcade-result");
    box.innerHTML = `<div class="arcade-result__card"><div class="arcade-result__tier arcade-result__tier--schwach">UNGÜLTIG</div>
      <div class="arcade-result__score">${why}</div><div class="arcade-result__best">Für diese Runde gibt es keine Belohnung.</div>
      <div class="arcade-result__actions"><button id="btn-arcade-retry" class="btn btn--primary">NOCHMAL VERSUCHEN</button><button id="btn-arcade-home" class="btn btn--ghost">ZURÜCK</button></div></div>`;
    box.classList.remove("hidden");
    audio.sfx("wrong");
    el("#btn-arcade-retry").addEventListener("click", () => { audio.sfx("click"); openGame(gameId, currentDifficulty); }, { once: true });
    el("#btn-arcade-home").addEventListener("click", () => { audio.sfx("click"); openHome(); }, { once: true });
  }

  function pickNextGameId(currentId) {
    const idx = ARCADE_GAMES.findIndex((g) => g.id === currentId);
    return ARCADE_GAMES[(idx + 1) % ARCADE_GAMES.length].id;
  }

  function quitActiveGame() {
    runId++; // laufendes/ladendes Spiel verliert seine Gültigkeit
    if (activeGame) { activeGame.destroy(); activeGame = null; }
    openHome();
  }

  // Im Spielbereich nie Text markieren oder Elemente ziehen (Maus/Touch)
  const stageEl = el("#arcade-stage");
  stageEl.addEventListener("selectstart", (e) => { if (e.target?.tagName !== "INPUT") e.preventDefault(); });
  stageEl.addEventListener("dragstart", (e) => e.preventDefault());
  stageEl.addEventListener("pointerdown", () => { try { window.getSelection()?.removeAllRanges(); } catch { /* ignore */ } });

  el("#btn-arcade-quit").addEventListener("click", () => { audio.sfx("click"); quitActiveGame(); });

  return { openHome, openGame, quitActiveGame };
}
