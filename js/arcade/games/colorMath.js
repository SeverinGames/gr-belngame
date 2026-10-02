// js/arcade/games/colorMath.js - reine Farb-Berechnung (testbar) für "Farbe Nachmachen"
// Farbabstand in CIE-Lab (ΔE) = wie der Mensch Farbunterschiede wahrnimmt.
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export function rgbToLab([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b);
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function deltaE(a, b) {
  const A = rgbToLab(a), B = rgbToLab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
// Treffer in % (je Schwierigkeit unterschiedlich streng). ΔE ~1 = kaum sichtbar.
export const TOLERANCE = { easy: 0.9, normal: 1.7, hard: 3.0 }; // Prozentpunkte Abzug je ΔE
export function matchPercent(target, mine, difficulty) {
  const k = TOLERANCE[difficulty] ?? TOLERANCE.normal;
  return Math.max(0, Math.min(100, Math.round(100 - deltaE(target, mine) * k)));
}
export function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
// Zielfarben: LEICHT = deutlich unterscheidbare, kräftige Mischungen; MITTEL =
// gemischte Töne; SCHWER = gedämpfte, ähnliche Töne (schwer zu unterscheiden).
export function randomTarget(difficulty, rng) {
  if (difficulty === "easy") {
    const vals = [0, 85, 170, 255]; let c;
    do { c = [0, 1, 2].map(() => vals[Math.floor(rng() * 4)]); } while (Math.max(...c) - Math.min(...c) < 170);
    return c;
  }
  if (difficulty === "hard") return hslToRgb(Math.floor(rng() * 360), 22 + rng() * 26, 38 + rng() * 26);
  return hslToRgb(Math.floor(rng() * 360), 45 + rng() * 40, 35 + rng() * 30);
}
