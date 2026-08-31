// js/world/characterSprite.js
// Zeichnet eine stilisierte Spielfigur direkt auf Canvas - keine echten Fotos
// (Datenschutz bei öffentlicher Multiplayer-URL). Farben/Accessoires kommen
// aus den vom Nutzer hinterlegten appearance-Daten pro Skin (js/skins/skins.js),
// abgeleitet aus den Referenzfotos der jeweiligen Person.
import { getSkinById } from "../skins/skins.js";

function lighten(hex, amount = 30) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amount);
  const g = Math.min(255, ((n >> 8) & 255) + amount);
  const b = Math.min(255, (n & 255) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

export function getSkinPalette(skinId) {
  const skin = getSkinById(skinId);
  const appearance = skin?.appearance ?? { hairColor: "#2b2320", topColor: "#3a63c9", accessory: null };
  return {
    body: appearance.topColor,
    bodyLight: lighten(appearance.topColor),
    hair: appearance.hairColor,
    skin: "#f2c48a",
    accessory: appearance.accessory,
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

  // Bamados' Fahrrad steht neben ihm - wichtiges Erkennungsmerkmal laut Nutzer
  if (palette.accessory === "bike") drawSideBike(ctx, s, facing);

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

  // Haar (Farbe pro Person) + optionales Accessoire
  drawHairAndAccessory(ctx, s, palette);

  // Blickrichtung (kleine Augen, verschieben sich mit facing)
  const eyeOffsetX = facing === "left" ? -4 * s : facing === "right" ? 4 * s : 0;
  ctx.fillStyle = "#20232b";
  ctx.beginPath();
  ctx.arc(-4 * s + eyeOffsetX, -62 * s, 1.6 * s, 0, Math.PI * 2);
  ctx.arc(4 * s + eyeOffsetX, -62 * s, 1.6 * s, 0, Math.PI * 2);
  ctx.fill();

  // Brille wird über den Augen gezeichnet (muss nach den Augen kommen)
  if (palette.accessory === "glasses") {
    ctx.strokeStyle = "#2b2320";
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.rect(-8 * s + eyeOffsetX, -65 * s, 6 * s, 5 * s);
    ctx.rect(2 * s + eyeOffsetX, -65 * s, 6 * s, 5 * s);
    ctx.moveTo(-2 * s + eyeOffsetX, -62.5 * s); ctx.lineTo(2 * s + eyeOffsetX, -62.5 * s);
    ctx.stroke();
  }

  ctx.restore();
}

function drawHairAndAccessory(ctx, s, palette) {
  ctx.fillStyle = palette.hair;

  if (palette.accessory === "cap") {
    // Volle Kappe mit Schirm (Neo)
    ctx.beginPath();
    ctx.arc(0, -66 * s, 14 * s, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(9 * s, -62 * s, 7 * s, 3 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (palette.accessory === "curly") {
    // Lockiges/unordentliches Haar (Mayo, Flö) - mehrere kleine Kreise statt Halbkreis
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(i * 4 * s, -68 * s + Math.abs(i % 2) * 2 * s, 4.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Standard-Frisur (Mario, Flöt, Löndi, Zewy, Brüshka)
  ctx.beginPath();
  ctx.arc(0, -66 * s, 13 * s, Math.PI, Math.PI * 2);
  ctx.fill();
}

function drawSideBike(ctx, s, facing) {
  const dir = facing === "left" ? -1 : 1;
  ctx.save();
  ctx.translate(24 * s * dir, -4 * s);
  ctx.strokeStyle = "#2a3150";
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(-8 * s, 0, 8 * s, 0, Math.PI * 2);
  ctx.arc(8 * s, 0, 8 * s, 0, Math.PI * 2);
  ctx.moveTo(-8 * s, 0); ctx.lineTo(0, -14 * s); ctx.lineTo(8 * s, 0);
  ctx.lineTo(0, -14 * s); ctx.lineTo(-3 * s, -20 * s);
  ctx.stroke();
  ctx.restore();
}
