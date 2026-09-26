// js/rewards/boxAnimation.js
// Komplett überarbeitete Mystery-Box-Öffnung (Punkt 4 des Prompts): Box
// erscheint, wackelt, baut Spannung auf, öffnet sich, der neue Skin wird
// groß gezeigt (per bereits vorhandenem characterSprite.js gezeichnet statt
// einem neuen Sprite-System). "Überspringen" wird erst nach kurzer Zeit aktiv.
import { RARITY } from "../skins/skins.js";
import { drawCharacter, getSkinPalette } from "../world/characterSprite.js";
import { audio } from "../audio/audio.js";

const el = (sel) => document.querySelector(sel);

// result = Rückgabewert von openMysteryBox() aus mysteryBox.js
export function playBoxOpeningAnimation(result) {
  return new Promise((resolve) => {
    const overlay = el("#mysterybox-animation");
    const box = el("#mb-box");
    const burst = el("#mb-burst");
    const reveal = el("#mb-reveal");
    const skipBtn = el("#mb-skip");
    const continueBtn = el("#mb-continue");

    overlay.classList.remove("hidden");
    box.classList.remove("hidden", "mb-box--wobble", "mb-box--open");
    burst.classList.add("hidden");
    reveal.classList.add("hidden");
    skipBtn.classList.add("hidden");
    continueBtn.classList.add("hidden");

    if (!result.success) {
      // Keine Schlüssel mehr - kurzer, ehrlicher Hinweis statt Fake-Animation.
      box.classList.add("hidden");
      reveal.classList.remove("hidden");
      el("#mb-reveal-canvas").classList.add("hidden");
      el("#mb-reveal-name").textContent = "Keine Schlüssel übrig";
      el("#mb-reveal-rarity").textContent = "";
      el("#mb-reveal-extra").textContent = "Sammle Schlüssel über Missionen und die tägliche Belohnung.";
      continueBtn.classList.remove("hidden");
      const done = () => { cleanup(); resolve(); };
      continueBtn.addEventListener("click", done, { once: true });
      return;
    }

    let skipped = false;
    let timers = [];
    const after = (ms, fn) => { timers.push(setTimeout(fn, ms)); };
    const skip = () => {
      if (skipped) return;
      skipped = true;
      timers.forEach(clearTimeout);
      showReveal();
    };

    after(1000, () => { box.classList.add("mb-box--wobble"); audio.sfx("boxRumble"); });
    after(1000, () => skipBtn.classList.remove("hidden"));
    after(2400, () => { audio.sfx("boxRumble"); });
    after(3100, () => { if (!skipped) openBox(); });

    skipBtn.addEventListener("click", skip, { once: true });

    function openBox() {
      box.classList.add("mb-box--open");
      audio.sfx("boxBurst");
      burst.classList.remove("hidden");
      after(500, () => { if (!skipped) showReveal(); });
    }

    function showReveal() {
      box.classList.add("hidden");
      burst.classList.add("hidden");
      skipBtn.classList.add("hidden");
      const rarity = RARITY[result.skin.rarity];
      const canvas = el("#mb-reveal-canvas");
      canvas.classList.remove("hidden");
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const palette = getSkinPalette(result.skin.id);
      // Gleiche Skalierungs-Faustregel wie beim kleinen Arcade-Avatar (engine.js):
      // scale = Canvasgröße/100, Fußpunkt bei 90% der Höhe - füllt den Canvas,
      // ohne Kopf/Schatten abzuschneiden.
      drawCharacter(ctx, { x: 70, y: 126, facing: "down", walkPhase: 0.25, palette, scale: 1.4 });
      reveal.style.setProperty("--rarity-color", rarity.color);
      reveal.classList.remove("hidden");
      el("#mb-reveal-name").textContent = result.skin.name;
      el("#mb-reveal-rarity").textContent = rarity.label;
      el("#mb-reveal-rarity").style.color = rarity.color;
      el("#mb-reveal-rarity").style.textShadow = rarity.glow ? `0 0 14px ${rarity.color}` : "none";
      el("#mb-reveal-extra").textContent = result.isNew
        ? "Neu freigeschaltet! Im Spind ausrüstbar."
        : `Bereits vorhanden - +${result.compensationCoins} Münzen als Ausgleich.`;
      audio.sfx(result.isNew ? "unlockRare" : "secretFound");
      after(500, () => continueBtn.classList.remove("hidden"));
      const done = () => { cleanup(); resolve(); };
      continueBtn.addEventListener("click", done, { once: true });
    }

    function cleanup() {
      timers.forEach(clearTimeout);
      overlay.classList.add("hidden");
    }
  });
}
