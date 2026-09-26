// js/arcade/engine.js
// Gemeinsame Bausteine für alle Minispiele: Skin-Avatar (nutzt das bereits
// vorhandene characterSprite.js statt eines eigenen Zeichensystems pro Spiel,
// Punkt 3 des Prompts), Combo-Tracker, Belohnungsstufen, Zufalls-Modifikatoren
// und kleine Feedback-Popups ("+10", "COMBO x5", ...).
import { drawCharacter, getSkinPalette } from "../world/characterSprite.js";
import { audio } from "../audio/audio.js";

// --- Skin-Avatar: kleine animierte Spielfigur, überall im Minispiel einsetzbar ---
// mode: 'idle' (leichtes Wippen) | 'walk' (Laufzyklus, für Obstkorb-Steuerung)
export function mountSkinAvatar(container, skinId, { size = 72, mode = "idle" } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "arcade-avatar";
  wrap.style.width = `${size}px`;
  wrap.style.height = `${size}px`;
  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  const palette = getSkinPalette(skinId);
  let phase = 0;
  let facing = "down";
  let raf = null;
  let destroyed = false;
  const start = performance.now();

  function loop(t) {
    if (destroyed) return;
    const elapsed = (t - start) / 1000;
    ctx.clearRect(0, 0, size, size);
    phase = mode === "walk" ? phase : (elapsed * 0.18) % 1;
    // Skalierung/Fußposition so gewählt, dass die Figur (Kopf bis Schatten,
    // siehe characterSprite.js) sauber in das kleine Avatar-Quadrat passt.
    drawCharacter(ctx, {
      x: size / 2, y: size * 0.9, facing, walkPhase: phase, palette, scale: size / 100,
    });
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return {
    el: wrap,
    setFacing(f) { facing = f; },
    setWalkPhase(p) { phase = p; },
    bump() {
      wrap.classList.remove("arcade-avatar--bump");
      // eslint-disable-next-line no-unused-expressions
      wrap.offsetWidth; // Reflow erzwingen, damit die Animation neu startet
      wrap.classList.add("arcade-avatar--bump");
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      wrap.remove();
    },
  };
}

// --- Combo-Tracker: zählt aufeinanderfolgende Treffer, verfällt nach resetMs ---
export class ComboTracker {
  constructor(resetMs = 1300) {
    this.combo = 0;
    this.maxCombo = 0;
    this.resetMs = resetMs;
    this.timer = null;
  }
  hit() {
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.combo = 0; }, this.resetMs);
    return this.combo;
  }
  miss() {
    this.combo = 0;
    clearTimeout(this.timer);
  }
  destroy() { clearTimeout(this.timer); }
}

// --- Belohnungsstufen: percent (0-100) -> XP/Münzen/Label -----------------
// Bewusst grobstufig und transparent statt einer Blackbox-Formel (analog zum
// bereits vorhandenen Mystery-Box-Prinzip "keine versteckten Zahlen").
export function rewardTierFromPercent(percent) {
  if (percent >= 85) return { tier: "perfekt", label: "PERFEKT!", xp: 120, coins: 25 };
  if (percent >= 65) return { tier: "gut", label: "STARK!", xp: 80, coins: 15 };
  if (percent >= 40) return { tier: "normal", label: "GESCHAFFT", xp: 50, coins: 10 };
  return { tier: "schwach", label: "VERSUCHT", xp: 25, coins: 5 };
}

// --- Zufalls-Modifikatoren, damit Runden nicht gleich bleiben (Punkt 6) ---
export const MODIFIERS = [
  { id: "double", label: "2x PUNKTE!", icon: "✨" },
  { id: "turbo", label: "TURBO!", icon: "⚡" },
  { id: "time", label: "+ZEITBONUS", icon: "⏳" },
];
export function rollModifier(rng, chance = 0.16) {
  if (rng() >= chance) return null;
  return MODIFIERS[Math.floor(rng() * MODIFIERS.length)];
}

// --- Kleine Feedback-Popups (fliegender Text, Combo-Banner) ---------------
export function popFloatingText(container, x, y, text, variant = "") {
  const t = document.createElement("div");
  t.className = `arcade-float arcade-float--${variant}`;
  t.textContent = text;
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 900);
}

export function popBanner(container, text, variant = "") {
  const t = document.createElement("div");
  t.className = `arcade-banner arcade-banner--${variant}`;
  t.textContent = text;
  container.appendChild(t);
  setTimeout(() => t.remove(), 1100);
  audio.sfx("combo");
}

// Einfacher seedbarer RNG-Wrapper - fällt auf Math.random zurück, falls keiner
// übergeben wird. Wird an Math.random-Signatur angeglichen (() => number[0,1)).
export function makeRng(seedFn) {
  return typeof seedFn === "function" ? seedFn : Math.random;
}

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
