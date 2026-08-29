// js/audio/audio.js
// Alle Sounds werden zur Laufzeit synthetisiert (Oszillatoren/Noise) statt
// externe Audiodateien zu laden - dadurch keine Lizenzfragen (siehe Punkt 31),
// funktioniert offline und braucht keine Assets. Sobald der Nutzer eigene
// Audiodateien liefert, können sie hier einfach zusätzlich eingebunden werden.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.masterVolumes = { music: 0.5, sfx: 0.7, vibration: true };
    this.currentMusicNodes = [];
    this.currentMood = null;
  }

  ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // Browser ohne Web Audio - Spiel läuft trotzdem weiter
    this.ctx = new AC();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.gain.value = this.masterVolumes.music;
    this.sfxGain.gain.value = this.masterVolumes.sfx;
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.ctx.destination);
  }

  setVolume(kind, value) {
    this.masterVolumes[kind] = value;
    if (kind === "music" && this.musicGain) this.musicGain.gain.value = value;
    if (kind === "sfx" && this.sfxGain) this.sfxGain.gain.value = value;
  }

  vibrate(pattern) {
    if (this.masterVolumes.vibration && navigator.vibrate) navigator.vibrate(pattern);
  }

  // --- kurze SFX-Bausteine -------------------------------------------
  _tone(freq, duration, type = "sine", gainTarget = 0.3, delay = 0) {
    this.ensureContext();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainTarget, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  sfx(name) {
    this.ensureContext();
    if (!this.ctx) return;
    switch (name) {
      case "click": this._tone(600, 0.06, "square", 0.15); break;
      case "doorOpen": this._tone(220, 0.25, "sawtooth", 0.2); this._tone(330, 0.2, "sine", 0.15, 0.05); break;
      case "treasure": [523, 659, 784].forEach((f, i) => this._tone(f, 0.25, "triangle", 0.25, i * 0.08)); break;
      case "damage": this._tone(120, 0.3, "sawtooth", 0.3); this.vibrate(80); break;
      case "danger": this._tone(90, 0.4, "square", 0.25); this.vibrate([40, 30, 40]); break;
      case "flee": [392, 523, 659].forEach((f, i) => this._tone(f, 0.3, "sine", 0.25, i * 0.1)); break;
      case "death": [300, 220, 140].forEach((f, i) => this._tone(f, 0.4, "sawtooth", 0.25, i * 0.15)); this.vibrate([100, 50, 100]); break;
      case "levelUp": [392, 523, 659, 784].forEach((f, i) => this._tone(f, 0.3, "triangle", 0.3, i * 0.09)); break;
      case "unlockRare": [261, 329, 392, 523, 659].forEach((f, i) => this._tone(f, 0.35, "triangle", 0.3, i * 0.1)); break;
      case "secretFound": this._tone(880, 0.2, "sine", 0.2); this._tone(1046, 0.25, "sine", 0.2, 0.08); break;
      default: this._tone(440, 0.1, "sine", 0.15);
    }
  }

  // --- Musikstimmungen (einfache Loop-Drones) -------------------------
  playMood(mood) {
    this.ensureContext();
    if (!this.ctx || this.currentMood === mood) return;
    this.stopMusic();
    this.currentMood = mood;
    const moodFreqs = {
      menu: [130.8, 196],
      normal: [110, 164.8],
      danger: [98, 146.8],
      saboteur: [87.3, 130.8],
      endgame: [123.5, 185],
    };
    const freqs = moodFreqs[mood] ?? moodFreqs.normal;
    freqs.forEach((f) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      this.currentMusicNodes.push({ osc, gain });
    });
  }

  stopMusic() {
    this.currentMusicNodes.forEach(({ osc }) => { try { osc.stop(); } catch { /* schon gestoppt */ } });
    this.currentMusicNodes = [];
    this.currentMood = null;
  }
}

export const audio = new AudioEngine();
