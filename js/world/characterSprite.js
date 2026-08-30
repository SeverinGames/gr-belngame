// js/world/characterSprite.js
// Zeichnet eine stilisierte Spielfigur direkt auf Canvas - keine Fotos.
// Jeder Skin bekommt ein eigenes, deterministisches Farbschema (aus dem
// Skin-Namen abgeleitet), damit sich jede Figur unterscheidet.

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

export function getSkinPalette(skinId) {
  const hue = hashHue(skinId);
  return {
    body: `hsl(${hue}, 55%, 45%)`,
    bodyLight: `hsl(${hue}, 60%, 60%)`,
    accent: `hsl(${(hue + 40) % 360}, 70%, 55%)`,
    skin: "#f2c48a",
  };
}

// x,y = Fußposition (Mitte unten). facing: 'down'|'up'|'left'|'right'.
// walkPhase: 0..1 laufender Zyklus für Beinanimation (0 = Idle-Bounce).
export function drawCharacter(ctx, { x, y, facing, walkPhase, palette, scale = 1 }) {
  if (!ctx.roundRect) {
    // Fallback für Browser ohne CanvasRenderingContext2D.roundRect (Punkt 39 - kein Absturz)
    ctx.roundRect = function (rx, ry, rw, rh) { this.rect(rx, ry, rw, rh); };
  }
  const s = scale;
  const legSwing = Math.sin(walkPhase * Math.PI * 2) * 6 * s;
  const bounce = Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 2 * s;

  ctx.save();
  ctx.translate(x, y - bounce);

  // Schatten
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 14 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Beine
  ctx.strokeStyle = palette.body;
  ctx.lineWidth = 6 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5 * s, -6 * s); ctx.lineTo(-5 * s + legSwing, -26 * s);
  ctx.moveTo(5 * s, -6 * s); ctx.lineTo(5 * s - legSwing, -26 * s);
  ctx.stroke();

  // Körper
  ctx.fillStyle = palette.body;
  ctx.beginPath();
  ctx.roundRect(-12 * s, -52 * s, 24 * s, 30 * s, 8 * s);
  ctx.fill();

  // Arme
  ctx.strokeStyle = palette.bodyLight;
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  const armSwing = facing === "left" || facing === "right" ? 0 : legSwing * 0.6;
  ctx.moveTo(-12 * s, -46 * s); ctx.lineTo(-18 * s, -32 * s - armSwing);
  ctx.moveTo(12 * s, -46 * s); ctx.lineTo(18 * s, -32 * s + armSwing);
  ctx.stroke();

  // Kopf
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(0, -62 * s, 13 * s, 0, Math.PI * 2);
  ctx.fill();

  // Haar/Accent-Kappe
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(0, -66 * s, 13 * s, Math.PI, Math.PI * 2);
  ctx.fill();

  // Blickrichtung (kleine Augen, verschieben sich mit facing)
  const eyeOffsetX = facing === "left" ? -4 * s : facing === "right" ? 4 * s : 0;
  ctx.fillStyle = "#20232b";
  ctx.beginPath();
  ctx.arc(-4 * s + eyeOffsetX, -62 * s, 1.6 * s, 0, Math.PI * 2);
  ctx.arc(4 * s + eyeOffsetX, -62 * s, 1.6 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
