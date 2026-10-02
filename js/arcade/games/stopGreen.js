// js/arcade/games/stopGreen.js
// MINISPIEL 8 - STOPP BEI GRÜN. Ein Zeiger läuft über eine Leiste, der
// Spieler muss ihn möglichst zentral im (schrumpfenden) grünen Bereich anhalten.
//
// Schwierigkeit (echte Spiel-Unterschiede):
//   LEICHT  große Zone, gleichmäßig langsames Tempo, 5 Runden
//   MITTEL  kleinere Zone, schneller, Tempo ändert sich bei jedem Richtungswechsel, 6 Runden
//   SCHWER  kleine Zone, schnell, Tempo schwankt auch DAZWISCHEN (Beschleunigen/Bremsen),
//           ab Runde 4 wandert die Zone langsam, 7 Runden
//
// Fairness-Regel: Der Zeiger braucht für die Zone immer mindestens
// MIN_PASS_MS (Zonenbreite / Tempo). Dadurch wird es hart, aber nie
// zufällig unmöglich - Timing und Vorausschauen entscheiden.
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const LEVELS = {
  easy: { rounds: 5, zone0: 30, shrink: 3, zoneMin: 16, speed0: 42, speedStep: 5, jitter: 0, wobble: 0, drift: 0, minPassMs: 300 },
  normal: { rounds: 6, zone0: 22, shrink: 2.4, zoneMin: 10, speed0: 58, speedStep: 8, jitter: 0.22, wobble: 0, drift: 0, minPassMs: 170 },
  hard: { rounds: 7, zone0: 15, shrink: 1.4, zoneMin: 6.5, speed0: 72, speedStep: 8, jitter: 0.3, wobble: 0.32, drift: 7, minPassMs: 105 },
};

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const L = LEVELS[difficulty] ?? LEVELS.normal;
  const ROUNDS = L.rounds;

  const stage = document.createElement("div");
  stage.className = "sg-playfield";
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "sg-avatar-row";
  const track = document.createElement("div");
  track.className = "sg-track";
  const zone = document.createElement("div");
  zone.className = "sg-zone";
  const pointer = document.createElement("div");
  pointer.className = "sg-pointer";
  const stopBtn = document.createElement("button");
  stopBtn.className = "btn btn--primary sg-stopbtn";
  stopBtn.textContent = "STOPP!";
  track.appendChild(zone);
  track.appendChild(pointer);
  stage.appendChild(avatarWrap);
  stage.appendChild(track);
  stage.appendChild(stopBtn);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 52 });

  let running = true, round = 0, score = 0, pos = 0, dir = 1, raf = null, lastTs = null;
  let baseSpeed = 50, curSpeedMul = 1, zoneCenter = 50, zoneWidth = 24, canStop = true;
  let wobblePhase = 0, driftDir = 1, hits = 0;

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    stopBtn.removeEventListener("click", onStop);
    avatar.destroy();
    stage.innerHTML = "";
    if (!silent) {
      const percent = clamp(Math.round((score / (ROUNDS * 20)) * 100), 0, 100);
      onEnd({ score, percent, maxCombo: hits });
    }
  }

  // Tempo je Zonenbreite begrenzen (Fairness)
  const capSpeed = (sp) => Math.min(sp, (zoneWidth / L.minPassMs) * 1000);

  function nextRound() {
    if (!running) return;
    round++;
    if (round > ROUNDS) { endGame(); return; }
    zoneWidth = clamp(L.zone0 - (round - 1) * L.shrink, L.zoneMin, L.zone0);
    zoneCenter = 18 + rng() * 64;
    baseSpeed = capSpeed(L.speed0 + (round - 1) * L.speedStep);
    curSpeedMul = 1;
    wobblePhase = rng() * Math.PI * 2;
    driftDir = rng() < 0.5 ? -1 : 1;
    placeZone();
    pos = rng() < 0.5 ? 0 : 100;
    dir = pos === 0 ? 1 : -1;
    canStop = true;
    onHud({ round, roundTotal: ROUNDS, score, timeLeft: 1, total: 1 });
  }
  function placeZone() {
    zone.style.left = `${zoneCenter - zoneWidth / 2}%`;
    zone.style.width = `${zoneWidth}%`;
  }
  function bounce() {
    // Bei jedem Richtungswechsel ändert sich das Tempo ein wenig (MITTEL/SCHWER)
    if (L.jitter) curSpeedMul = 1 + (rng() * 2 - 1) * L.jitter;
  }

  function onStop() {
    if (!canStop || !running) return;
    canStop = false;
    const dist = Math.abs(pos - zoneCenter);
    const halfZone = zoneWidth / 2;
    let pts = 0;
    if (dist <= halfZone) {
      const precision = 1 - dist / halfZone;
      pts = Math.round(10 + precision * 15);
      hits++;
      if (precision > 0.85) popBanner(stage, "PERFEKTE MITTE! +Bonus", "gold");
      audio.sfx("pop");
    } else {
      audio.sfx("wrong");
      popBanner(stage, "DANEBEN!", "warn");
    }
    score += pts;
    avatar.bump();
    pointer.classList.add("sg-pointer--stopped");
    setTimeout(() => {
      pointer.classList.remove("sg-pointer--stopped");
      nextRound();
    }, 700);
  }
  stopBtn.addEventListener("click", onStop);

  function tick(ts) {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(48, ts - lastTs);
    lastTs = ts;
    if (canStop) {
      // SCHWER: Tempo schwankt sanft (aber vorhersehbar) innerhalb der Bahn
      let mul = curSpeedMul;
      if (L.wobble) { wobblePhase += dt / 1000 * 2.2; mul *= 1 + Math.sin(wobblePhase) * L.wobble; }
      const sp = capSpeed(baseSpeed * mul);
      pos += dir * sp * (dt / 1000);
      if (pos >= 100) { pos = 100; dir = -1; bounce(); }
      if (pos <= 0) { pos = 0; dir = 1; bounce(); }
      pointer.style.left = `${pos}%`;
      // SCHWER ab Runde 4: Zone wandert langsam hin und her
      if (L.drift && round >= 4) {
        zoneCenter += driftDir * L.drift * (dt / 1000);
        const lo = 14 + zoneWidth / 2, hi = 86 - zoneWidth / 2;
        if (zoneCenter > hi) { zoneCenter = hi; driftDir = -1; }
        if (zoneCenter < lo) { zoneCenter = lo; driftDir = 1; }
        placeZone();
      }
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  nextRound();
  return { destroy: () => endGame(true) };
}
