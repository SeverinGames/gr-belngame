// js/rewards/boxAnimation.js
// Box-Öffnung: Box erscheint -> schwebt -> wackelt -> lädt sich auf (Spannung
// + Glow in Seltenheitsfarbe) -> kurzer "Atem anhalten"-Moment -> Blitz +
// Partikel -> Skin-Reveal. Je seltener der Skin, desto länger/dramatischer
// (Legendär/Mythisch+: Extra-Aufladung, Bildschirm-Beben, Lichtstrahlen,
// Konfetti). Aufbau der Seite (IDs) ist unverändert; alle Extra-Effekte
// werden dynamisch erzeugt und beim Schließen/Überspringen wieder entfernt.
import { RARITY, RARITY_ORDER } from "../skins/skins.js";
import { drawCharacter, getSkinPalette } from "../world/characterSprite.js";
import { audio } from "../audio/audio.js";

const el = (sel) => document.querySelector(sel);

// 1 = normal, 2 = episch, 3 = legendär/mythisch, 4 = superlegendär und höher
function intensityOf(rarityId) {
  const i = RARITY_ORDER.indexOf(rarityId);
  if (i >= RARITY_ORDER.indexOf("superLegendary")) return 4;
  if (i >= RARITY_ORDER.indexOf("legendary")) return 3;
  if (i >= RARITY_ORDER.indexOf("epic")) return 2;
  return 1;
}

// result = Rückgabewert von purchaseBox()/grantFreeBox() aus shop/shop.js
export function playBoxOpeningAnimation(result) {
  return new Promise((resolve) => {
    const overlay = el("#mysterybox-animation");
    const stage = overlay.querySelector(".mb-stage");
    const box = el("#mb-box");
    const burst = el("#mb-burst");
    const reveal = el("#mb-reveal");
    const skipBtn = el("#mb-skip");
    const continueBtn = el("#mb-continue");

    // Zustand zurücksetzen (Overlay wird für jede Öffnung wiederverwendet)
    overlay.classList.remove("hidden", "mb-overlay--shake");
    overlay.querySelectorAll(".mb-fx, .mb-flash, .mb-rays").forEach((n) => n.remove());
    box.className = "mb-box";
    box.style.removeProperty("--charge-color");
    burst.classList.add("hidden");
    burst.style.removeProperty("--burst-color");
    reveal.classList.add("hidden");
    skipBtn.classList.add("hidden");
    continueBtn.classList.add("hidden");
    el("#mb-reveal-canvas").classList.remove("hidden");

    if (!result.success) {
      // Sollte durch den deaktivierten Kaufen-Button im Shop nicht vorkommen -
      // trotzdem ein ehrlicher Hinweis statt einer Fake-Animation.
      box.classList.add("hidden");
      reveal.classList.remove("hidden");
      el("#mb-reveal-canvas").classList.add("hidden");
      el("#mb-reveal-name").textContent = "Kauf nicht möglich";
      el("#mb-reveal-rarity").textContent = "";
      el("#mb-reveal-extra").textContent = "Nicht genug Münzen für diese Box.";
      continueBtn.classList.remove("hidden");
      continueBtn.addEventListener("click", () => { cleanup(); resolve(); }, { once: true });
      return;
    }

    const rarity = RARITY[result.skin.rarity];
    const intensity = intensityOf(result.skin.rarity);
    const timers = [];
    const after = (ms, fn) => { timers.push(setTimeout(() => { if (!finished) fn(); }, ms)); };
    let finished = false;   // Overlay geschlossen
    let revealed = false;

    // Effekt-Ebene (Partikel/Konfetti)
    const fx = document.createElement("div");
    fx.className = "mb-fx";
    overlay.appendChild(fx);

    function particles(count, { spread = 170, shape = "dot", colors, life = 0.9 } = {}) {
      const palette = colors ?? [rarity.color, "#ffffff", "#ffd166"];
      for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = `mb-particle${shape === "rect" ? " mb-particle--rect" : ""}`;
        const ang = Math.random() * Math.PI * 2;
        const dist = spread * (0.35 + Math.random() * 0.75);
        const size = shape === "rect" ? 6 + Math.random() * 6 : 4 + Math.random() * 7;
        p.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
        p.style.setProperty("--dy", `${Math.sin(ang) * dist + (shape === "rect" ? 120 : 0)}px`);
        p.style.setProperty("--t", `${life * (0.7 + Math.random() * 0.6)}s`);
        p.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
        p.style.width = `${size}px`;
        p.style.height = `${shape === "rect" ? size * 1.6 : size}px`;
        p.style.background = palette[i % palette.length];
        fx.appendChild(p);
      }
    }

    // ---- Zeitplan (ms) ----
    const T_WOBBLE = 1300, T_CHARGE = 2100;
    const T_OVER = intensity >= 3 ? 3000 : null;
    const T_OPEN = intensity >= 4 ? 4300 : intensity >= 3 ? 3900 : intensity === 2 ? 3300 : 3000;

    box.classList.add("mb-box--enter");
    audio.sfx("swoosh");
    after(650, () => { box.classList.remove("mb-box--enter"); box.classList.add("mb-box--float"); });
    after(900, () => skipBtn.classList.remove("hidden"));
    after(T_WOBBLE, () => {
      box.classList.remove("mb-box--float");
      box.classList.add("mb-box--wobble");
      audio.sfx("boxRumble");
    });
    after(T_CHARGE, () => {
      // Aufladen: härteres Wackeln, Glow wechselt (ab Episch) in die Seltenheitsfarbe
      if (intensity >= 2) box.style.setProperty("--charge-color", rarity.color);
      box.classList.remove("mb-box--wobble");
      box.classList.add("mb-box--charge");
      audio.sfx("boxRumble");
    });
    if (T_OVER) {
      after(T_OVER, () => {
        // Extra-Spannung bei ganz Seltenem: noch stärkeres Beben + Funken
        box.classList.remove("mb-box--charge");
        box.classList.add("mb-box--over");
        particles(10, { spread: 90, life: 0.7 });
        audio.sfx("boxRumble");
      });
    }
    after(T_OPEN - 260, () => {
      // Kurz vor dem Öffnen: Zittern stoppt, Box bläht sich leuchtend auf
      box.classList.remove("mb-box--charge", "mb-box--over", "mb-box--wobble");
      box.classList.add("mb-box--pre");
    });
    after(T_OPEN, openBox);

    skipBtn.addEventListener("click", skip, { once: true });

    function skip() {
      if (finished || revealed) return;
      timers.forEach(clearTimeout);
      showReveal(false);
    }

    function openBox() {
      audio.sfx("boxBurst");
      const flash = document.createElement("div");
      flash.className = "mb-flash";
      overlay.appendChild(flash);
      box.classList.remove("mb-box--pre");
      box.classList.add("mb-box--open");
      burst.style.setProperty("--burst-color", rarity.color);
      burst.classList.toggle("mb-burst--epic", !!rarity.glow);
      burst.classList.remove("hidden");
      particles(16 + intensity * 8, { spread: 130 + intensity * 30 });
      if (intensity >= 3) {
        overlay.classList.add("mb-overlay--shake");
        audio.vibrate([40, 30, 80]);
      }
      after(intensity >= 3 ? 650 : 480, () => showReveal(true));
    }

    function showReveal(withEffects) {
      revealed = true;
      box.classList.add("hidden");
      burst.classList.add("hidden");
      skipBtn.classList.add("hidden");
      const canvas = el("#mb-reveal-canvas");
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // scale = Canvasgröße/100, Fußpunkt bei 90% der Höhe (siehe engine.js)
      drawCharacter(ctx, { x: 70, y: 126, facing: "down", walkPhase: 0.25, palette: getSkinPalette(result.skin.id), scale: 1.4 });
      reveal.style.setProperty("--rarity-color", rarity.color);
      reveal.classList.remove("hidden");
      reveal.classList.toggle("mb-reveal--epic", intensity >= 2);
      if (intensity >= 2) {
        const rays = document.createElement("div");
        rays.className = "mb-rays";
        reveal.insertBefore(rays, reveal.firstChild);
      }
      el("#mb-reveal-name").textContent = result.skin.name;
      el("#mb-reveal-rarity").textContent = rarity.label;
      el("#mb-reveal-rarity").style.color = rarity.color;
      el("#mb-reveal-rarity").style.textShadow = rarity.glow ? `0 0 14px ${rarity.color}` : "none";
      el("#mb-reveal-extra").textContent = result.isNew
        ? "Neu freigeschaltet! Im Spind ausrüstbar."
        : `Bereits vorhanden - +${result.compensationCoins} Münzen als Ausgleich.`;
      audio.sfx(result.isNew ? "unlockRare" : "secretFound");
      if (withEffects && intensity >= 3) particles(34, { spread: 260, shape: "rect", life: 1.6 });
      after(500, () => continueBtn.classList.remove("hidden"));
      continueBtn.addEventListener("click", () => { cleanup(); resolve(); }, { once: true });
    }

    function cleanup() {
      finished = true;
      timers.forEach(clearTimeout);
      overlay.classList.add("hidden");
      overlay.classList.remove("mb-overlay--shake");
      overlay.querySelectorAll(".mb-fx, .mb-flash, .mb-rays").forEach((n) => n.remove());
      box.className = "mb-box";
    }
  });
}
