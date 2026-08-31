// js/world/worldGame.js
import { WorldPlayer } from "./player.js";
import { InputController } from "./inputController.js";
import { buildRoomLayout, isInsideRoom, distanceToDoor, INTERACT_RANGE, DOOR_SLOTS } from "./roomLayout.js";
import { drawRoom, drawPlayer, drawInteractPrompt, drawHideSpots } from "./roomRenderer.js";
import { getSkinPalette } from "./characterSprite.js";

export class WorldGame {
  constructor({ canvas, joystickEl, interactBtnEl, runManager, skinId, callbacks }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.runManager = runManager;
    this.palette = getSkinPalette(skinId);
    this.callbacks = callbacks; // { onDoorChosen(doorId), onNoDoorsLeft }
    this.input = new InputController(joystickEl, interactBtnEl);
    this.room = null;
    this.player = null;
    this.nearestDoor = null;
    this.running = false;
    this._lastTime = 0;
    this._resizeCanvas();
    this._onResize = () => this._resizeCanvas();
    window.addEventListener("resize", this._onResize);
  }

  _resizeCanvas() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = Math.min(parent.clientHeight || 420, 420);
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewWidth = width;
    this.viewHeight = height;
  }

  // Lädt einen neuen Raum aus den (bereits getesteten) generierten Türen
  loadRoom(doors) {
    this.room = buildRoomLayout(doors);
    this.player = new WorldPlayer(this.room.spawn.x, this.room.spawn.y);
  }

  // --- Versteckspiel: nutzt dieselbe Bewegung/Kamera, aber Verstecke statt Türen ---
  startHideChallenge(challenge, onResult) {
    this.hideMode = true;
    this.hideResult = null;
    this.hideCallback = onResult;
    this.hideTimeRemaining = challenge.timeLimitMs;
    this.hideTimeTotal = challenge.timeLimitMs;

    const slots = DOOR_SLOTS.slice(0, challenge.spotCount);
    this.hideSpots = slots.map((slot, i) => ({ id: i, ...slot, width: 46, height: 46 }));
    this.room.doors = []; // echte Türen währenddessen deaktiviert
    this.player = new WorldPlayer(this.room.spawn.x, this.room.spawn.y);
  }

  _updateHideMode(dt) {
    this.hideTimeRemaining -= dt * 1000;
    if (this.callbacks.onHideTick) {
      this.callbacks.onHideTick(Math.max(0, this.hideTimeRemaining / this.hideTimeTotal));
    }

    const nearSpot = this.hideSpots.find((s) => distanceToDoor(s, this.player.x, this.player.y) < INTERACT_RANGE);
    this.nearestDoor = nearSpot ?? null;

    if (nearSpot && this.input.consumeInteract()) {
      this._finishHide(nearSpot.id);
      return;
    }
    if (this.hideTimeRemaining <= 0) {
      this._finishHide(null);
    }
  }

  _finishHide(spotIndex) {
    this.hideMode = false;
    const cb = this.hideCallback;
    this.hideCallback = null;
    if (cb) cb(spotIndex, this.hideSpots.length);
  }

  start() {
    this.running = true;
    this._lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  stop() {
    this.running = false;
  }

  destroy() {
    this.stop();
    this.input.destroy();
    window.removeEventListener("resize", this._onResize);
  }

  _loop(time) {
    if (!this.running) return;
    const dt = Math.min(0.05, (time - this._lastTime) / 1000);
    this._lastTime = time;

    this.player.update(dt, this.input.state, this.room);

    if (this.hideMode) {
      this._updateHideMode(dt);
    } else {
      this.nearestDoor = this._findNearbyDoor();
      if (this.nearestDoor && this.input.consumeInteract()) {
        this.callbacks.onDoorChosen(this.nearestDoor.id);
      }
    }

    this._draw();
    requestAnimationFrame((t) => this._loop(t));
  }

  _findNearbyDoor() {
    let closest = null;
    let closestDist = INTERACT_RANGE;
    for (const door of this.room.doors) {
      const d = distanceToDoor(door, this.player.x, this.player.y);
      if (d < closestDist) { closest = door; closestDist = d; }
    }
    return closest;
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewWidth, this.viewHeight);

    // Kamera folgt dem Spieler, geklemmt an Raumgrenzen
    const camX = clamp(this.player.x - this.viewWidth / 2, 0, Math.max(0, this.room.width - this.viewWidth));
    const camY = clamp(this.player.y - this.viewHeight / 2, 0, Math.max(0, this.room.height - this.viewHeight));

    drawRoom(ctx, this.room, camX, camY);
    if (this.hideMode) drawHideSpots(ctx, this.hideSpots, camX, camY);
    drawPlayer(ctx, this.player, camX, camY, this.palette);

    if (this.nearestDoor) {
      const label = this.hideMode ? "E - VERSTECKEN" : "E - ÖFFNEN";
      drawInteractPrompt(ctx, this.nearestDoor.x - camX, this.nearestDoor.y - camY, label);
    }
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
