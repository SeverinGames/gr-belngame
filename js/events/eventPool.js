// js/events/eventPool.js
// Löst aus, was hinter einer gewählten Tür tatsächlich passiert.
// Wichtig (Punkt 6): ein "Hinweis" (hint) an der Tür korreliert NICHT 1:1 mit
// dem Ergebnis - Spieler sollen keine festen Muster auswendig lernen können.

const CLAMP = (v, min, max) => Math.max(min, Math.min(max, v));

// Jede Resolver-Funktion bekommt (rng, context) und gibt ein Outcome zurück.
export const EVENT_RESOLVERS = {
  treasure: (rng, ctx) => {
    const amount = 15 + Math.floor(rng.next() * 25 * ctx.difficultyFactor);
    return outcome("reward", `Ihr findet eine Truhe: +${amount} Münzen.`, { coins: amount });
  },
  trap: (rng, ctx) => {
    const variants = [
      { label: "Stacheln aus dem Boden", mult: 1.0 },
      { label: "Einstürzende Decke", mult: 1.3 },
      { label: "Giftgas-Falle", mult: 0.8 },
      { label: "Pfeilfalle aus der Wand", mult: 1.1 },
    ];
    const v = variants[rng.nextInt(variants.length)];
    const dmg = Math.floor((10 + rng.next() * 15 * ctx.difficultyFactor) * v.mult);
    return outcome("danger", `${v.label}! -${dmg} HP.`, { hp: -dmg });
  },
  monster: (rng, ctx) => {
    const enemies = [
      { name: "Schattenkriecher", winChance: 0.68, dmgMult: 1.0, rewardMult: 1.0 },
      { name: "Klingenwesen", winChance: 0.55, dmgMult: 1.3, rewardMult: 1.2 },
      { name: "Nebelgeist", winChance: 0.75, dmgMult: 0.7, rewardMult: 0.8 },
      { name: "Wächter-Konstrukt", winChance: 0.4, dmgMult: 1.6, rewardMult: 1.6 },
    ];
    const enemy = enemies[rng.nextInt(enemies.length)];
    const win = rng.next() < enemy.winChance / ctx.difficultyFactor;
    if (win) {
      const amount = Math.floor((10 + rng.next() * 20) * enemy.rewardMult);
      return outcome("reward", `Ihr besiegt ${enemy.name}. +${amount} Münzen.`, { coins: amount });
    }
    const dmg = Math.floor((15 + rng.next() * 20 * ctx.difficultyFactor) * enemy.dmgMult);
    return outcome("danger", `${enemy.name} trifft euch! -${dmg} HP.`, { hp: -dmg });
  },
  puzzle: (rng, ctx) => {
    const solved = rng.next() > 0.3;
    return solved
      ? outcome("reward", "Rätsel gelöst! +XP und ein paar Münzen.", { coins: 10, xp: 15 })
      : outcome("neutral", "Ihr kommt nicht weiter und gebt auf. Nichts passiert.", {});
  },
  merchant: (rng, ctx) => {
    // Der Händler selbst richtet nichts an - das eigentliche Angebot wird
    // separat über getMerchantOffer() abgefragt und vom Spieler bestätigt.
    return outcome("neutral", "Ein vermummter Händler bietet einen Handel an.", {});
  },
  mirror: (rng) => outcome("strange", "Euer Spiegelbild verhält sich seltsam... aber nichts passiert.", {}),
  dark: (rng, ctx) => {
    const dmg = rng.next() > 0.5 ? 5 + Math.floor(rng.next() * 10) : 0;
    return dmg > 0
      ? outcome("danger", `Im Dunkeln stolpert ihr. -${dmg} HP.`, { hp: -dmg })
      : outcome("neutral", "Ihr tastet euch sicher durch die Dunkelheit.", {});
  },
  timeChallenge: (rng) => outcome("neutral", "Zeit-Challenge gemeistert. +XP.", { xp: 10 }),
  chase: (rng, ctx) => {
    const dmg = 8 + Math.floor(rng.next() * 12 * ctx.difficultyFactor);
    return outcome("danger", `Etwas verfolgt euch, ihr entkommt knapp. -${dmg} HP.`, { hp: -dmg });
  },
  safe: () => outcome("safe", "Ein ruhiger, sicherer Raum. Kurz verschnaufen.", { hp: 5 }),
  fakeSafe: (rng, ctx) => {
    const surprise = rng.next() > 0.6;
    const dmg = 10 + Math.floor(rng.next() * 10 * ctx.difficultyFactor);
    return surprise
      ? outcome("danger", "Der 'sichere' Raum war eine Falle! -" + dmg + " HP.", { hp: -dmg })
      : outcome("safe", "Diesmal war der sichere Raum wirklich sicher.", { hp: 5 });
  },
  secret: (rng) => {
    const amount = 30 + Math.floor(rng.next() * 40);
    return outcome("reward", `Geheimraum entdeckt! +${amount} Münzen.`, { coins: amount });
  },
  random: (rng, ctx) => {
    const pool = ["treasure", "trap", "puzzle", "safe"];
    const pick = pool[rng.nextInt(pool.length)];
    return EVENT_RESOLVERS[pick](rng, ctx);
  },
  boss: (rng, ctx) => {
    const win = rng.next() > 0.5;
    return win
      ? outcome("reward", "Boss besiegt! Große Belohnung.", { coins: 80, xp: 40 })
      : outcome("danger", "Der Boss trifft euch schwer.", { hp: -35 });
  },
  multiDoor: (rng, ctx) => outcome("neutral", "Mehrere Wege öffnen sich.", {}),
  teleporter: (rng) => outcome("strange", "Ihr werdet an einen anderen Ort teleportiert.", {}),
  teamwork: (rng) => outcome("neutral", "Gemeinsam meistert ihr die Herausforderung. +XP.", { xp: 12 }),
  saboteur: (rng) => outcome("strange", "Irgendetwas hier fühlt sich manipuliert an...", {}),
  mystery: (rng, ctx) => {
    const pool = ["treasure", "trap", "safe", "secret"];
    const pick = pool[rng.nextInt(pool.length)];
    return EVENT_RESOLVERS[pick](rng, ctx);
  },
  // Diese beiden werden normalerweise NICHT hierüber aufgelöst, sondern über
  // das jeweilige Minispiel (js/minigames/) - dies ist nur ein Sicherheitsnetz,
  // falls resolveRoom versehentlich ohne gespieltes Minispiel aufgerufen wird.
  reactionGame: () => outcome("neutral", "Reaktionstest übersprungen.", {}),
  hideGame: () => outcome("neutral", "Versteckspiel übersprungen.", {}),
};

function outcome(kind, message, deltas) {
  return {
    kind, // 'reward' | 'danger' | 'neutral' | 'safe' | 'strange'
    message,
    coins: deltas.coins ?? 0,
    hp: deltas.hp ?? 0,
    xp: deltas.xp ?? 0,
  };
}

export function resolveRoom(roomType, rng, ctx) {
  const resolver = EVENT_RESOLVERS[roomType.id] ?? EVENT_RESOLVERS.random;
  return resolver(rng, ctx);
}

export function clampHp(hp) {
  return CLAMP(hp, 0, 100);
}

// Händlerangebot: Heilung gegen riskierte Münzen (echte Entscheidung, kein Zufall)
export function getMerchantOffer(rng, ctx) {
  const healAmount = 20 + Math.floor(rng.next() * 15);
  const cost = Math.floor(healAmount * 1.2 * ctx.difficultyFactor);
  return { healAmount, cost };
}

// Geheimraum-Suche (Punkt 48): nach einem Raum kleine Chance, dass eine
// versteckte Tür sichtbar wird. Chance steigt leicht mit Glück (Fairness).
export function attemptSecretSearch(rng, luck) {
  const baseChance = 0.12;
  const chance = CLAMP(baseChance + luck * 0.05, 0.03, 0.3);
  return rng.next() < chance;
}
