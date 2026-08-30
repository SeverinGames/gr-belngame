// js/world/inputController.js
export class InputController {
  constructor(joystickEl, interactBtnEl) {
    this.state = { up: false, down: false, left: false, right: false, running: false };
    this.interactPressed = false;
    this._interactConsumed = true;

    this._onKeyDown = (e) => this._handleKey(e.key, true);
    this._onKeyUp = (e) => this._handleKey(e.key, false);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    if (joystickEl) this._setupJoystick(joystickEl);
    if (interactBtnEl) {
      interactBtnEl.addEventListener("click", () => { this.interactPressed = true; this._interactConsumed = false; });
    }
  }

  _handleKey(key, isDown) {
    const k = key.toLowerCase();
    if (k === "w" || k === "arrowup") this.state.up = isDown;
    if (k === "s" || k === "arrowdown") this.state.down = isDown;
    if (k === "a" || k === "arrowleft") this.state.left = isDown;
    if (k === "d" || k === "arrowright") this.state.right = isDown;
    if (k === "shift") this.state.running = isDown;
    if (k === "e" && isDown) { this.interactPressed = true; this._interactConsumed = false; }
  }

  _setupJoystick(el) {
    const knob = el.querySelector(".joystick-knob");
    let active = false;
    const maxRadius = 36;

    const setFromVector = (dx, dy) => {
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, maxRadius);
      const nx = len > 0 ? (dx / len) * clamped : 0;
      const ny = len > 0 ? (dy / len) * clamped : 0;
      if (knob) knob.style.transform = `translate(${nx}px, ${ny}px)`;
      const deadzone = 8;
      this.state.up = ny < -deadzone;
      this.state.down = ny > deadzone;
      this.state.left = nx < -deadzone;
      this.state.right = nx > deadzone;
    };

    const reset = () => {
      active = false;
      this.state.up = this.state.down = this.state.left = this.state.right = false;
      if (knob) knob.style.transform = "translate(0px, 0px)";
    };

    const startPos = { x: 0, y: 0 };
    el.addEventListener("pointerdown", (e) => {
      active = true;
      const rect = el.getBoundingClientRect();
      startPos.x = rect.left + rect.width / 2;
      startPos.y = rect.top + rect.height / 2;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!active) return;
      setFromVector(e.clientX - startPos.x, e.clientY - startPos.y);
    });
    el.addEventListener("pointerup", reset);
    el.addEventListener("pointercancel", reset);
  }

  // Interaktion wird nur einmal pro Tastendruck ausgelöst (kein Dauerfeuer)
  consumeInteract() {
    if (this.interactPressed && !this._interactConsumed) {
      this._interactConsumed = true;
      this.interactPressed = false;
      return true;
    }
    return false;
  }

  destroy() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
  }
}
