// js/arcade/games/treasurePaths.js
// SCHATZPFADE - "Wo ist der Schatz?" (Hütchenspiel). Ablauf pro Runde:
// 1) der Schatz wird kurz unter einer Kiste gezeigt, 2) die Kiste schließt
// sich wieder, 3) die Kisten VERTAUSCHEN sich sichtbar mit Bogenbewegung
// (Web Animations API, läuft flüssig auf dem Compositor), 4) der Spieler
// tippt die Kiste, unter der der Schatz liegt.
// Schwierigkeit: leicht 3 Kisten/langsam, normal 4 Kisten/mittel,
// schwer 5 Kisten/schnell + ab Runde 3 zwei Tausche gleichzeitig. Die
// Tauschdauer bleibt immer >= 210 ms, damit man der Bewegung noch folgen kann.
import { mountSkinAvatar, popBanner, ComboTracker, clamp } from "../engine.js";
import { audio } from "../../audio/audio.js";

const MAX_ROUNDS = 8;
const CHEST_W = 58;
const DIFFICULTY = {
  easy: { lives: 4, chests: 3, reveal: 1100, steps: (r) => 3 + Math.floor(r / 2), dur: (r) => clamp(560 - r * 18, 400, 560), gap: 70, double: false },
  normal: { lives: 3, chests: 4, reveal: 800, steps: (r) => Math.min(12, 5 + r), dur: (r) => clamp(400 - r * 14, 270, 400), gap: 45, double: false },
  hard: { lives: 2, chests: 5, reveal: 550, steps: (r) => Math.min(14, 7 + r), dur: (r) => clamp(320 - r * 12, 210, 320), gap: 20, double: true },
};

export function start({ container, skinId, rng, onHud, onEnd, difficulty = "normal" }) {
  const diff = DIFFICULTY[difficulty] ?? DIFFICULTY.normal;
  const N = diff.chests;

  const stage = document.createElement("div");
  stage.className = "tp2-playfield";
  const avatarWrap = document.createElement("div");
  avatarWrap.className = "tp2-avatar";
  const livesEl = document.createElement("div");
  livesEl.className = "tp2-lives";
  const hintEl = document.createElement("div");
  hintEl.className = "tp2-hint";
  const lane = document.createElement("div");
  lane.className = "tp2-lane";
  stage.append(avatarWrap, livesEl, hintEl, lane);
  container.appendChild(stage);
  const avatar = mountSkinAvatar(avatarWrap, skinId, { size: 52 });

  let running = true, round = 0, score = 0, lives = diff.lives, canPick = false;
  const combo = new ComboTracker(60000);
  const timers = new Set();
  const animations = new Set();
  let chests = [];          // { el, slot }
  let target = null;        // Chest-Objekt mit dem Schatz

  const sleep = (ms) => new Promise((res) => { const t = setTimeout(() => { timers.delete(t); res(); }, ms); timers.add(t); });
  const laneW = () => lane.clientWidth || 300;
  const slotX = (slot) => (slot + 0.5) * (laneW() / N) - CHEST_W / 2;
  const put = (chest) => { chest.el.style.transform = `translate3d(${slotX(chest.slot)}px,0,0)`; };
  const onResize = () => chests.forEach(put);
  window.addEventListener("resize", onResize);

  function renderLives() {
    livesEl.textContent = "❤️".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, diff.lives - lives));
  }
  renderLives();

  function cleanup() {
    running = false;
    timers.forEach(clearTimeout);
    timers.clear();
    animations.forEach((a) => { try { a.cancel(); } catch { /* egal */ } });
    animations.clear();
    window.removeEventListener("resize", onResize);
    avatar.destroy();
    stage.remove();
  }

  function finish() {
    if (!running) return;
    running = false;
    const percent = clamp(Math.round((score / (MAX_ROUNDS * 12)) * 100), 0, 100);
    const t = setTimeout(() => { cleanup(); onEnd({ score, percent, maxCombo: combo.maxCombo }); }, 900);
    timers.add(t);
  }

  function buildChests() {
    lane.innerHTML = "";
    chests = [];
    for (let i = 0; i < N; i++) {
      const el = document.createElement("button");
      el.className = "tp2-chest";
      el.setAttribute("aria-label", `Kiste ${i + 1}`);
      el.innerHTML = '<div class="tp2-box"><span>?</span></div>';
      const chest = { el, slot: i };
      el.addEventListener("click", () => pick(chest));
      lane.appendChild(el);
      chests.push(chest);
      put(chest);
    }
  }

  const box = (c) => c.el.querySelector(".tp2-box");
  function addGem(c) {
    if (c.el.querySelector(".tp2-gem")) return;
    const gem = document.createElement("div");
    gem.className = "tp2-gem";
    gem.textContent = "💎";
    c.el.insertBefore(gem, c.el.firstChild);
  }
  function removeGem(c) { c.el.querySelector(".tp2-gem")?.remove(); }

  // Zwei Kisten tauschen die Plätze - mit Bogen (eine hebt sich, eine senkt sich)
  function swap(a, b, dur) {
    const xa = slotX(a.slot), xb = slotX(b.slot);
    const mid = (xa + xb) / 2;
    const arc = 26;
    const run = (chest, from, to, dy) => {
      chest.el.style.transform = `translate3d(${to}px,0,0)`; // Endzustand sofort, Animation liegt darüber
      const anim = chest.el.animate(
        [{ transform: `translate3d(${from}px,0,0)` }, { transform: `translate3d(${mid}px,${dy}px,0)` }, { transform: `translate3d(${to}px,0,0)` }],
        { duration: dur, easing: "ease-in-out" },
      );
      animations.add(anim);
      anim.onfinish = () => animations.delete(anim);
    };
    run(a, xa, xb, -arc);
    run(b, xb, xa, arc);
    const s = a.slot; a.slot = b.slot; b.slot = s;
    audio.sfx("swoosh");
  }

  function randomPair(exclude = []) {
    const free = chests.filter((c) => !exclude.includes(c));
    const a = free[Math.floor(rng() * free.length)];
    let b;
    do { b = free[Math.floor(rng() * free.length)]; } while (b === a);
    return [a, b];
  }

  async function playRound() {
    if (!running) return;
    round++;
    if (round > MAX_ROUNDS || lives <= 0) { finish(); return; }
    canPick = false;
    buildChests();
    target = chests[Math.floor(rng() * N)];
    onHud({ round, roundTotal: MAX_ROUNDS, score, combo: combo.combo, total: 1 });

    // 1) Schatz zeigen (nur kurz)
    hintEl.textContent = "MERK DIR DEN SCHATZ!";
    await sleep(350); if (!running) return;
    addGem(target);
    box(target).classList.add("tp2-box--lifted");
    await sleep(diff.reveal); if (!running) return;
    box(target).classList.remove("tp2-box--lifted");
    await sleep(320); if (!running) return;
    removeGem(target); // Schatz-Position steht nirgends mehr im DOM

    // 2) Mischen
    hintEl.textContent = "AUGEN AUF!";
    const r0 = round - 1;
    const dur = diff.dur(r0);
    let remaining = diff.steps(r0);
    let last = null;
    while (remaining > 0) {
      if (!running) return;
      const dbl = diff.double && r0 >= 2 && remaining >= 2 && N >= 4;
      const [a, b] = randomPair();
      if (last && ((a === last[0] && b === last[1]) || (a === last[1] && b === last[0]))) continue; // nicht sofort zurücktauschen
      swap(a, b, dur);
      last = [a, b];
      remaining--;
      if (dbl) {
        const [c, d] = randomPair([a, b]);
        swap(c, d, dur);
        remaining--;
      }
      await sleep(dur + diff.gap);
    }
    if (!running) return;

    // 3) Auswahl
    hintEl.textContent = "WO IST DER SCHATZ?";
    canPick = true;
  }

  async function pick(chest) {
    if (!running || !canPick) return;
    canPick = false;
    const correct = chest === target;
    box(chest).classList.add("tp2-box--lifted");
    if (correct) {
      addGem(target);
      const n = combo.hit();
      const pts = 10 + Math.min(n - 1, 5) * 2;
      score += pts;
      avatar.bump();
      audio.sfx("pop");
      hintEl.textContent = `RICHTIG! +${pts}`;
      if (n >= 3) popBanner(stage, `SERIE x${n}!`, "combo");
    } else {
      combo.miss();
      lives--;
      renderLives();
      addGem(target);
      box(target).classList.add("tp2-box--lifted");
      audio.sfx("wrong");
      hintEl.textContent = lives <= 0 ? "GAME OVER" : "LEIDER FALSCH!";
      if (lives <= 0) popBanner(stage, "GAME OVER", "warn");
    }
    onHud({ round, roundTotal: MAX_ROUNDS, score, combo: combo.combo, total: 1 });
    await sleep(1200);
    playRound();
  }

  playRound();
  return { destroy: () => { if (stage.isConnected || running) cleanup(); } };
}
