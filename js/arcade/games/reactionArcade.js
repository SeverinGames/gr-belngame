// js/arcade/games/reactionArcade.js
// MINISPIEL 5 - REAKTION. 3 Runden, inkl. gelegentlicher Fehlalarme
// ("NICHT KLICKEN!"), am Ende ein präziser ms-Wert. Keine unfairen Mechaniken.
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const ROUNDS = 3;

export function start({ container, skinId, rng, onHud, onEnd }) {
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

  let running = true, round = 0, revealTs = null, timer = null;
  const times = [];
  let decoyThisRound = false;

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    clearTimeout(timer);
    stage.removeEventListener("pointerdown", onTap);
    avatar.destroy();
    stage.innerHTML = "";
    if (silent) return;
    const validTimes = times.filter((t) => typeof t === "number" && t > 0);
    const failed = times.filter((t) => t === "early").length;
    const avgMs = validTimes.length ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) : 999;
    let percent = clamp(Math.round(100 - (avgMs - 180) / 5), 0, 100);
    percent = clamp(percent - failed * 20, 0, 100);
    onEnd({ score: avgMs, percent, maxCombo: ROUNDS - failed, resultLabel: `${avgMs} ms` });
  }

  function nextRound() {
    if (!running) return;
    round++;
    if (round > ROUNDS) { endGame(); return; }
    decoyThisRound = rng() < 0.28 && round > 1;
    zone.className = "rx-zone rx-zone--wait";
    zone.textContent = "Bereit machen...";
    revealTs = null;
    const delay = 900 + rng() * 1800;
    timer = setTimeout(() => {
      if (!running) return;
      zone.classList.remove("rx-zone--wait");
      if (decoyThisRound) {
        zone.classList.add("rx-zone--decoy");
        zone.textContent = "NICHT KLICKEN!";
      } else {
        zone.classList.add("rx-zone--go");
        zone.textContent = "JETZT!";
      }
      revealTs = performance.now();
      timer = setTimeout(() => {
        if (!running) return;
        if (decoyThisRound) times.push(200); // richtig nicht geklickt = ok-Zeit
        else times.push("early"); // verpasst -> wie ein Fehlversuch gewertet
        nextRound();
      }, 1100);
    }, delay);
    onHud({ round, roundTotal: ROUNDS, score: times.length, timeLeft: 1, total: 1 });
  }

  function onTap() {
    if (!running) return;
    if (zone.classList.contains("rx-zone--wait")) {
      times.push("early");
      avatar.bump();
      audio.sfx("wrong");
      popBanner(stage, "ZU FRÜH!", "warn");
      clearTimeout(timer);
      nextRound();
      return;
    }
    if (decoyThisRound) {
      audio.sfx("wrong");
      popBanner(stage, "OH NEIN!", "warn");
      times.push("early");
      clearTimeout(timer);
      nextRound();
      return;
    }
    const ms = Math.round(performance.now() - revealTs);
    times.push(ms);
    avatar.bump();
    audio.sfx("pop");
    popBanner(stage, `${ms} ms`, "combo");
    clearTimeout(timer);
    setTimeout(nextRound, 500);
  }

  stage.addEventListener("pointerdown", onTap);
  nextRound();
  return { destroy: () => endGame(true) };
}
