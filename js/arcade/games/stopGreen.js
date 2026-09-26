// js/arcade/games/stopGreen.js
// MINISPIEL 8 - STOPP BEI GRÜN. Ein Zeiger läuft über eine Leiste, der
// Spieler muss ihn möglichst zentral im (schrumpfenden) grünen Bereich anhalten.
import { mountSkinAvatar, popBanner, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const ROUNDS = 5;

export function start({ container, skinId, rng, onHud, onEnd }) {
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

  let running = true, round = 0, score = 0, pos = 0, dir = 1, speed = 55, raf = null, lastTs = null;
  let zoneCenter = 50, zoneWidth = 24, canStop = true;

  function endGame(silent = false) {
    if (!running) return;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    stopBtn.removeEventListener("click", onStop);
    avatar.destroy();
    stage.innerHTML = "";
    if (!silent) {
      const percent = clamp(Math.round((score / (ROUNDS * 20)) * 100), 0, 100);
      onEnd({ score, percent, maxCombo: round });
    }
  }

  function nextRound() {
    if (!running) return;
    round++;
    if (round > ROUNDS) { endGame(); return; }
    zoneWidth = clamp(24 - round * 3, 9, 24);
    zoneCenter = 20 + rng() * 60;
    zone.style.left = `${zoneCenter - zoneWidth / 2}%`;
    zone.style.width = `${zoneWidth}%`;
    speed = 50 + round * 9;
    pos = rng() < 0.5 ? 0 : 100;
    dir = pos === 0 ? 1 : -1;
    canStop = true;
    onHud({ round, roundTotal: ROUNDS, score, timeLeft: 1, total: 1 });
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
      pos += dir * speed * (dt / 1000);
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      pointer.style.left = `${pos}%`;
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  nextRound();
  return { destroy: () => endGame(true) };
}
