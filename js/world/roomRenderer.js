// js/world/roomRenderer.js
import { drawCharacter } from "./characterSprite.js";

const DOOR_MATERIALS = {
  calm: { base: "#7a5230", trim: "#c9a15f" },   // Holztür
  danger: { base: "#8a2b2b", trim: "#d95f5f" }, // rote Metalltür
};

// Sichtbar unterschiedliche Räume je nach Typ, statt immer derselbe graue Raum
// (Punkt 84/133 des Prompts: "keine Placeholder-Welt"). Der Raum übernimmt das
// Thema der Tür, durch die der Spieler gerade gekommen ist.
const ROOM_THEMES = {
  lobby:     { floor: "#1b1f30", grid: "rgba(255,255,255,0.04)", wall: "#2a3150" },
  treasure:  { floor: "#2a2210", grid: "rgba(255,215,120,0.08)", wall: "#4a3a12" },
  trap:      { floor: "#2a1414", grid: "rgba(255,90,90,0.07)",   wall: "#4a1e1e" },
  monster:   { floor: "#1a1220", grid: "rgba(180,120,255,0.06)", wall: "#2e1f42" },
  merchant:  { floor: "#241a10", grid: "rgba(230,180,100,0.06)", wall: "#4a3320" },
  safe:      { floor: "#132218", grid: "rgba(120,255,170,0.06)", wall: "#1e3a28" },
  dark:      { floor: "#0a0a0e", grid: "rgba(255,255,255,0.02)", wall: "#161620" },
  secret:    { floor: "#1a1030", grid: "rgba(200,120,255,0.08)", wall: "#3a1f52" },
  default:   { floor: "#1b1f30", grid: "rgba(255,255,255,0.04)", wall: "#2a3150" },
};

export function drawRoom(ctx, room, cameraX, cameraY) {
  const theme = ROOM_THEMES[room.theme] ?? ROOM_THEMES.default;
  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  // Boden
  ctx.fillStyle = theme.floor;
  ctx.fillRect(0, 0, room.width, room.height);
  // Bodenmuster (dezente Fliesen)
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  for (let gx = 0; gx < room.width; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, room.height); ctx.stroke();
  }
  for (let gy = 0; gy < room.height; gy += 40) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(room.width, gy); ctx.stroke();
  }

  drawThemeDecor(ctx, room);

  // Wände
  ctx.fillStyle = theme.wall;
  const w = room.wallThickness;
  ctx.fillRect(0, 0, room.width, w);
  ctx.fillRect(0, room.height - w, room.width, w);
  ctx.fillRect(0, 0, w, room.height);
  ctx.fillRect(room.width - w, 0, w, room.height);

  // Türen
  room.doors.forEach((door) => drawDoor(ctx, door));

  ctx.restore();
}

// Kleine, dezente Deko-Objekte pro Raumthema - "show, don't tell" statt
// eines leeren Platzhalter-Raums.
function drawThemeDecor(ctx, room) {
  const cx = room.width / 2;
  const cy = room.height / 2;
  switch (room.theme) {
    case "treasure": {
      ctx.fillStyle = "#caa04a";
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(cx - 22, cy - 14, 44, 28, 4) : ctx.rect(cx - 22, cy - 14, 44, 28);
      ctx.fill();
      ctx.strokeStyle = "#8a6a1f";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 22, cy - 14, 44, 28);
      break;
    }
    case "trap": {
      ctx.fillStyle = "rgba(255,90,90,0.5)";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - 30 + i * 20, cy + 10);
        ctx.lineTo(cx - 25 + i * 20, cy - 8);
        ctx.lineTo(cx - 20 + i * 20, cy + 10);
        ctx.fill();
      }
      break;
    }
    case "monster": {
      ctx.fillStyle = "rgba(150, 90, 220, 0.35)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 40, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "merchant": {
      ctx.fillStyle = "#5a3f22";
      ctx.fillRect(cx - 40, cy - 6, 80, 16);
      ctx.fillStyle = "#c9a15f";
      ctx.fillRect(cx - 40, cy - 10, 80, 4);
      break;
    }
    case "safe": {
      ctx.fillStyle = "#3a6b4a";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 20); ctx.lineTo(cx - 12, cy + 10); ctx.lineTo(cx + 12, cy + 10);
      ctx.fill();
      break;
    }
    case "secret": {
      ctx.fillStyle = "rgba(200,120,255,0.4)";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 50, cy + Math.sin(a) * 40, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }
}

export function drawDoor(ctx, door) {
  const mat = DOOR_MATERIALS[door.shownHint] ?? DOOR_MATERIALS.calm;
  ctx.save();
  ctx.translate(door.x, door.y);
  const isHorizontalWall = door.wall === "top" || door.wall === "bottom";
  const w = isHorizontalWall ? door.width : door.height;
  const h = isHorizontalWall ? door.height : door.width;

  ctx.fillStyle = mat.base;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = mat.trim;
  ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  // Türgriff
  ctx.fillStyle = mat.trim;
  ctx.beginPath();
  ctx.arc(w / 2 - 6, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPlayer(ctx, player, cameraX, cameraY, palette) {
  ctx.save();
  ctx.translate(-cameraX, -cameraY);
  drawCharacter(ctx, {
    x: player.x, y: player.y, facing: player.facing,
    walkPhase: player.moving ? player.walkPhase : 0,
    palette,
  });
  ctx.restore();
}

// Statt Emoji: echte gezeichnete Symbole (Schrank/Bett/Kiste/Tür), damit sie
// auf jedem Gerät exakt gleich aussehen statt vom System-Emoji-Font abzuhängen.
function drawWardrobeIcon(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x, y - 14); ctx.lineTo(x, y + 14);
  ctx.moveTo(x - 10, y - 8); ctx.lineTo(x - 10, y + 8);
  ctx.moveTo(x + 10, y - 8); ctx.lineTo(x + 10, y + 8);
  ctx.stroke();
}
function drawBedIcon(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x - 14, y + 8); ctx.lineTo(x + 14, y + 8);
  ctx.moveTo(x - 14, y - 6); ctx.lineTo(x - 14, y + 8);
  ctx.roundRect ? ctx.roundRect(x - 12, y - 6, 10, 8, 2) : ctx.rect(x - 12, y - 6, 10, 8);
  ctx.stroke();
}
function drawCrateIcon(ctx, x, y) {
  ctx.beginPath();
  ctx.rect(x - 12, y - 12, 24, 24);
  ctx.moveTo(x - 12, y - 12); ctx.lineTo(x + 12, y + 12);
  ctx.moveTo(x + 12, y - 12); ctx.lineTo(x - 12, y + 12);
  ctx.stroke();
}
function drawSideDoorIcon(ctx, x, y) {
  ctx.beginPath();
  ctx.rect(x - 10, y - 14, 20, 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 5, y, 1.6, 0, Math.PI * 2);
  ctx.fill();
}
const HIDE_SPOT_ICON_DRAWERS = [drawWardrobeIcon, drawBedIcon, drawCrateIcon, drawSideDoorIcon];

export function drawHideSpots(ctx, spots, cameraX, cameraY) {
  ctx.save();
  ctx.translate(-cameraX, -cameraY);
  spots.forEach((spot, i) => {
    ctx.fillStyle = "#2f6b4f";
    ctx.strokeStyle = "#5fd99a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(spot.x - 23, spot.y - 23, 46, 46, 8) : ctx.rect(spot.x - 23, spot.y - 23, 46, 46);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#dff5e8";
    ctx.lineWidth = 1.6;
    HIDE_SPOT_ICON_DRAWERS[i % HIDE_SPOT_ICON_DRAWERS.length](ctx, spot.x, spot.y);
  });
  ctx.restore();
}

export function drawInteractPrompt(ctx, screenX, screenY, label) {
  ctx.save();
  ctx.font = "600 13px sans-serif";
  ctx.textAlign = "center";
  const padding = 8;
  const textWidth = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(13,15,22,0.85)";
  ctx.fillRect(screenX - textWidth / 2 - padding, screenY - 44, textWidth + padding * 2, 24);
  ctx.strokeStyle = "#6be0ff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(screenX - textWidth / 2 - padding, screenY - 44, textWidth + padding * 2, 24);
  ctx.fillStyle = "#eef2ff";
  ctx.fillText(label, screenX, screenY - 27);
  ctx.restore();
}
