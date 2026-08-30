// js/world/player.js
import { isInsideRoom } from "./roomLayout.js";

const SPEED = 160; // Pixel/Sekunde
const RUN_MULT = 1.6;

export class WorldPlayer {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.facing = "down";
    this.moving = false;
    this.walkPhase = 0;
  }

  update(dt, input, room) {
    let dx = 0, dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? "right" : "left";
      else this.facing = dy > 0 ? "down" : "up";

      const speed = SPEED * (input.running ? RUN_MULT : 1);
      const nextX = this.x + dx * speed * dt;
      const nextY = this.y + dy * speed * dt;

      // Achsengetrennte Kollision, damit man an Wänden entlanggleitet
      if (isInsideRoom(room, nextX, this.y)) this.x = nextX;
      if (isInsideRoom(room, this.x, nextY)) this.y = nextY;

      this.walkPhase = (this.walkPhase + dt * (input.running ? 3.2 : 2.2)) % 1;
    }
  }
}
