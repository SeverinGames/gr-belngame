// js/world/roomRenderer.js
import { drawCharacter } from "./characterSprite.js";

const DOOR_MATERIALS = {
  calm: { base: "#7a5230", trim: "#c9a15f" },   // Holztür
  danger: { base: "#8a2b2b", trim: "#d95f5f" }, // rote Metalltür
};

export function drawRoom(ctx, room, cameraX, cameraY) {
  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  // Boden
  ctx.fillStyle = "#1b1f30";
  ctx.fillRect(0, 0, room.width, room.height);
  // Bodenmuster (dezente Fliesen)
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < room.width; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, room.height); ctx.stroke();
  }
  for (let gy = 0; gy < room.height; gy += 40) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(room.width, gy); ctx.stroke();
  }

  // Wände
  ctx.fillStyle = "#2a3150";
  const w = room.wallThickness;
  ctx.fillRect(0, 0, room.width, w);
  ctx.fillRect(0, room.height - w, room.width, w);
  ctx.fillRect(0, 0, w, room.height);
  ctx.fillRect(room.width - w, 0, w, room.height);

  // Türen
  room.doors.forEach((door) => drawDoor(ctx, door));

  ctx.restore();
}

function drawDoor(ctx, door) {
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
