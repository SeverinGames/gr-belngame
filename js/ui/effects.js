// js/ui/effects.js - Abschluss-/Sieg-Effekte (Kosmetik-Kategorie "finish") und Emote-Blasen.
// Neuer Effekt = Eintrag in progress/cosmetics.js (COSMETICS.finish) + Eintrag hier in FINISH.
const FINISH = {
  confetti: { chars: ["🎉", "🎊", "✨"], count: 26, mode: "fall" },
  stars: { chars: ["⭐", "🌟", "✨"], count: 22, mode: "fall" },
  coins: { chars: ["🪙"], count: 22, mode: "fall" },
  hearts: { chars: ["💖", "💗", "💕"], count: 20, mode: "rise" },
  fireworks: { chars: ["🎆", "🎇", "✨"], count: 18, mode: "burst" },
};
export function playFinishEffect(container, id) {
  const def = FINISH[id];
  if (!def || !container) return;
  const layer = document.createElement("div");
  layer.className = "fx-layer";
  for (let i = 0; i < def.count; i++) {
    const p = document.createElement("span");
    p.className = `fx-p fx-p--${def.mode}`;
    p.textContent = def.chars[i % def.chars.length];
    p.style.left = def.mode === "burst" ? `${30 + Math.random() * 40}%` : `${Math.random() * 100}%`;
    p.style.setProperty("--dx", `${(Math.random() - 0.5) * 220}px`);
    p.style.setProperty("--dy", `${-60 - Math.random() * 160}px`);
    p.style.animationDelay = `${Math.random() * 0.6}s`;
    p.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    p.style.fontSize = `${14 + Math.random() * 14}px`;
    layer.appendChild(p);
  }
  container.appendChild(layer);
  setTimeout(() => layer.remove(), 3600);
}
export function showEmoteBubble(container, icon) {
  if (!icon || !container) return;
  const b = document.createElement("div");
  b.className = "emote-bubble";
  b.textContent = icon;
  container.appendChild(b);
  setTimeout(() => b.remove(), 2400);
}
