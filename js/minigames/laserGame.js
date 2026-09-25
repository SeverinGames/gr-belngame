// js/minigames/laserGame.js
export const LASER_GAME = {
  id: "laserGame",
  name: "Laserraum",
  description: "Weiche den beweglichen Lasern aus und erreiche den Ausgang.",
  minPlayers: 1,
  maxPlayers: 6,
};

// difficultyFactor > 1 = mehr/schnellere Laser, weniger erlaubte Treffer
export function createLaserChallenge(rng, difficultyFactor = 1) {
  const laserCount = 2 + Math.floor(rng() * 2); // 2 oder 3
  const speed = 55 * Math.min(1.8, difficultyFactor);
  const timeLimitMs = Math.max(5000, Math.round(10000 / difficultyFactor));
  const maxHits = difficultyFactor > 1.3 ? 1 : 2;
  return { laserCount, speed, timeLimitMs, maxHits };
}

// Erzeugt eine Laser-Definition (abwechselnd horizontal/vertikal) für einen
// Raum mit den Maßen width x height.
export function createLaser(index, speed, width, height, rng) {
  const axis = index % 2 === 0 ? "horizontal" : "vertical";
  const margin = 60;
  if (axis === "horizontal") {
    return { axis, fixedCoord: margin + rng() * (height - margin * 2), t: 0, range: width, dir: 1, speed };
  }
  return { axis, fixedCoord: margin + rng() * (width - margin * 2), t: 0, range: height, dir: 1, speed };
}

export function updateLaserPosition(laser, dt) {
  laser.t += dt * laser.speed * laser.dir;
  if (laser.t > laser.range) { laser.t = laser.range; laser.dir = -1; }
  if (laser.t < 0) { laser.t = 0; laser.dir = 1; }
  return laser;
}

// Prüft, ob ein Punkt (Spieler) den Laserstrahl berührt.
export function isPointOnLaser(px, py, laser, hitRadius = 10) {
  if (laser.axis === "horizontal") {
    return Math.abs(py - laser.fixedCoord) < hitRadius && Math.abs(px - laser.t) < hitRadius * 1.6;
  }
  return Math.abs(px - laser.fixedCoord) < hitRadius && Math.abs(py - laser.t) < hitRadius * 1.6;
}

export function laserOutcome(hits, maxHits, reachedExit, difficultyFactor = 1) {
  if (reachedExit && hits <= maxHits) {
    const coins = Math.round(20 + (maxHits - hits) * 15);
    return {
      kind: "reward",
      message: `Ausgang erreicht (${hits}/${maxHits} Treffer)! +${coins} Münzen.`,
      coins, hp: -hits * 5, xp: 12,
    };
  }
  const dmg = Math.round(12 * difficultyFactor * Math.max(1, hits));
  const reason = hits > maxHits ? "Zu oft von Lasern getroffen" : "Zeit abgelaufen, bevor ihr den Ausgang erreicht habt";
  return { kind: "danger", message: `${reason}! -${dmg} HP.`, coins: 0, hp: -dmg, xp: 0 };
}
