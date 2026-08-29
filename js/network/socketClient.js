// js/network/socketClient.js
// Verbindet zum Node/WebSocket-Server. Die Server-URL wird über eine globale
// Config gesetzt (siehe js/network/config.js), damit sie beim Deploy einfach
// angepasst werden kann, ohne Code zu durchsuchen.

class SocketClient {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.connected = false;
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
      } catch (err) {
        reject(err);
        return;
      }
      this.ws.addEventListener("open", () => { this.connected = true; resolve(); });
      this.ws.addEventListener("error", (err) => { if (!this.connected) reject(err); });
      this.ws.addEventListener("close", () => {
        this.connected = false;
        this._emit("_disconnected", {});
      });
      this.ws.addEventListener("message", (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        this._emit(msg.type, msg.payload);
      });
    });
  }

  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(handler);
  }

  _emit(type, payload) {
    (this.handlers.get(type) ?? []).forEach((h) => h(payload));
  }

  send(type, payload = {}) {
    if (!this.connected || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type, payload }));
    return true;
  }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}

export const socket = new SocketClient();
