// js/arcade/games/reactionArcade.js
// MINISPIEL - REAKTION. 5 Runden, dazwischen "HIER NICHT!"-Fallen, am Ende ein
// präziser ms-Wert (WENIGER ms = BESSER).
//
// Missbrauchsschutz (ohne künstliche Cooldowns, Eingaben reagieren sofort):
//  - Gültig ist ein Spiel nur, wenn mindestens MIN_VALID_ROUNDS Runden echt
//    gespielt wurden (echte Reaktion oder Falle korrekt ausgelassen). Reines
//    Draufklicken erzeugt nur "zu früh"-Fehler -> Ergebnis UNGÜLTIG, keine
//    Belohnung, kein Spielzähler, kein Bonus-Dreh.
//  - Reaktionszeiten unter 100 ms sind menschlich nicht möglich (Vorausraten /
//    Spam) und zählen als Fehlstart.
//  - Jeder Tipp wird genau einer Runde zugeordnet (state-Maschine), Doppelklicks
//    in derselben Runde werden ignoriert; es gibt nur EINEN Listener, der beim
//    Beenden entfernt wird.
//  - "HIER NICHT!": Tippen = Spiel sofort verloren, kein gültiger Score.
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const ROUNDS = 5;
const MIN_VALID_ROUNDS = 3;
const MIN_HUMAN_MS = 100;
const TRAP_ROUNDS_BY_DIFF = { easy: 1, normal: 1, hard: 2 };

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const stage = document.createElement("div");
  stage.className = "rx-playfield";
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "rx-avatar-row";
  const zone = document.createElement("div");
  zone.className = "rx-zone rx-zone--wait";
  zone.textContent = "Bereit machen...";
  stage.appendChild(avatarWrap);
  stage.appendChild(zone);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 52 });

  // Zustand je Runde: "idle" (zwischen Runden) | "wait" (noch nicht grün) | "go" | "trap"
  let state = "idle", running = true, round = 0, revealTs = 0, timer = null;
  const times = []; // gültige Reaktionszeiten (ms)
  let validRounds = 0, falseStarts = 0, trapsPassed = 0;
  // Fallen-Runden vorab festlegen (nie Runde 1, nie zwei hintereinander)
  const trapRounds = new Set();
  const want = TRAP_ROUNDS_BY_DIFF[difficulty] ?? 1;
  let guard = 0;
  while (trapRounds.size < want && guard++ < 50) {
    const r = 2 + Math.floor(rng() * (ROUNDS - 1));
    if (!trapRounds.has(r - 1) && !trapRounds.has(r + 1)) trapRounds.add(r);
  }

  function finish(outcome) {
    if (!running) return;
    running = false;
    clearTimeout(timer);
    stage.removeEventListener("pointerdown", onTap);
    avatar.destroy();
    stage.innerHTML = "";
    if (outcome === "silent") return;
    if (validRounds < MIN_VALID_ROUNDS && outcome !== "trap") {
      onEnd({ invalid: true, score: 0, percent: 0, resultLabel: "UNGÜLTIG" });
      return;
    }
    if (outcome === "trap") {
      // Falle erwischt: kein gültiger Score (0 zählt nie als Highscore), Leistung stark gedrückt.
      const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 999;
      const base = clamp(Math.round(100 - (avg - 180) / 5), 0, 100);
      onEnd({ invalid: !times.length, score: 0, percent: Math.min(15, Math.round(base * 0.2)), maxCombo: 0, hideCombo: true, resultLabel: "IN DIE FALLE GETAPPT!" });
      return;
    }
    const avgMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    let percent = clamp(Math.round(100 - (avgMs - 180) / 5), 0, 100);
    percent = clamp(percent - falseStarts * 12, 0, 100);
    onEnd({ score: avgMs, percent, maxCombo: validRounds, resultLabel: `${avgMs} ms` });
  }

  function nextRound() {
    if (!running) return;
    round++;
    if (round > ROUNDS) { finish("done"); return; }
    state = "wait";
    zone.className = "rx-zone rx-zone--wait";
    zone.textContent = "Bereit machen...";
    const isTrap = trapRounds.has(round);
    timer = setTimeout(() => {
      if (!running || state !== "wait") return;
      state = isTrap ? "trap" : "go";
      zone.classList.remove("rx-zone--wait");
      zone.classList.add(isTrap ? "rx-zone--decoy" : "rx-zone--go");
      zone.textContent = isTrap ? "HIER NICHT!" : "JETZT!";
      revealTs = performance.now();
      timer = setTimeout(() => { // Reaktionsfenster abgelaufen
        if (!running) return;
        if (state === "trap") { validRounds++; trapsPassed++; audio.sfx("pop"); popBanner(stage, "RICHTIG WIDERSTANDEN!", "combo"); }
        else if (state === "go") { falseStarts++; popBanner(stage, "ZU LANGSAM!", "warn"); audio.sfx("wrong"); }
        endRound();
      }, isTrap ? 1300 : 1100);
    }, 900 + rng() * 1800);
    onHud({ round, roundTotal: ROUNDS, score: validRounds, timeLeft: 1, total: 1 });
  }

  // Runde abschließen: Zustand sperren, bis die nächste Runde wirklich begonnen hat
  function endRound(delay = 650) {
    clearTimeout(timer);
    state = "idle";
    timer = setTimeout(nextRound, delay);
  }

  function onTap(e) {
    if (!running || state === "idle") return; // zwischen Runden/nach Auswertung zählt kein Tipp
    const s = state;
    state = "idle"; // sofort sperren: genau EIN Tipp pro Runde wirkt
    clearTimeout(timer);
    if (s === "wait") {
      falseStarts++;
      avatar.bump(); audio.sfx("wrong"); popBanner(stage, "ZU FRÜH!", "warn");
      endRound(800);
    } else if (s === "trap") {
      audio.sfx("wrong"); avatar.bump(); popBanner(stage, "HIER NICHT!", "warn");
      zone.classList.add("rx-zone--hit");
      timer = setTimeout(() => finish("trap"), 700);
    } else {
      const ms = Math.round(performance.now() - revealTs);
      if (ms < MIN_HUMAN_MS) { falseStarts++; popBanner(stage, "ZU FRÜH!", "warn"); audio.sfx("wrong"); endRound(800); return; }
      times.push(ms); validRounds++;
      avatar.bump(); audio.sfx("pop"); popBanner(stage, `${ms} ms`, "combo");
      endRound(600);
    }
  }

  stage.addEventListener("pointerdown", onTap);
  nextRound();
  return { destroy: () => finish("silent") };
}
