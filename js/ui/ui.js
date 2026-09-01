// js/ui/ui.js
import { getSkinById, RARITY } from "../skins/skins.js";
import { listInventory } from "../inventory/inventory.js";

const el = (sel) => document.querySelector(sel);

export function renderHUD(runManager) {
  const p = runManager.player;
  el("#hud-hp").style.width = `${p.hp}%`;
  el("#hud-hp-label").textContent = `${p.hp} HP`;
  el("#hud-secured").textContent = p.securedCoins;
  el("#hud-risk").textContent = p.riskCoins;
  el("#hud-rooms").textContent = runManager.roomsCleared;
  renderInventoryBar(p.inventory, runManager);
}

export function renderInventoryBar(inventory, runManager) {
  const box = el("#inventory-bar");
  if (!box) return;
  box.innerHTML = "";
  listInventory(inventory).forEach(({ def, count }) => {
    const chip = document.createElement("div");
    const usable = !!def.useEffect;
    chip.className = `inventory-item ${usable ? "inventory-item--usable" : ""}`;
    chip.title = def.description;
    chip.innerHTML = `${def.icon} ${def.name} <span class="inventory-item__count">x${count}</span>`;
    if (usable) {
      chip.addEventListener("click", () => {
        runManager.useItem(def.id);
        renderHUD(runManager);
      });
    }
    box.appendChild(chip);
  });
}

export function renderDoors(doors, onChoose) {
  const wrap = el("#doors");
  wrap.innerHTML = "";
  doors.forEach((door) => {
    const btn = document.createElement("button");
    btn.className = `door door--${door.shownHint}`;
    btn.dataset.doorId = door.id;
    btn.innerHTML = `
      <span class="door__icon">${door.shownHint === "danger" ? "⚠" : "✦"}</span>
      <span class="door__label">Tür ${door.id + 1}</span>
    `;
    btn.addEventListener("click", () => onChoose(door.id));
    wrap.appendChild(btn);
  });
}

export function renderOutcome(outcome) {
  const box = el("#outcome");
  box.textContent = outcome.message;
  box.className = `outcome outcome--${outcome.kind}`;
  box.classList.remove("outcome--hidden");
}

export function hideOutcome() {
  el("#outcome").classList.add("outcome--hidden");
}

export function renderDecision(exitAvailable, { onFlee, onContinue }) {
  const box = el("#decision");
  box.innerHTML = "";
  if (exitAvailable) {
    const fleeBtn = document.createElement("button");
    fleeBtn.className = "btn btn--flee";
    fleeBtn.textContent = "FLIEHEN (Belohnung sichern)";
    fleeBtn.addEventListener("click", onFlee);
    box.appendChild(fleeBtn);
  }
  const contBtn = document.createElement("button");
  contBtn.className = "btn btn--continue";
  contBtn.textContent = exitAvailable ? "NOCH EINEN RAUM" : "WEITER";
  contBtn.addEventListener("click", onContinue);
  box.appendChild(contBtn);
  box.classList.remove("hidden");
}

export function hideDecision() {
  el("#decision").classList.add("hidden");
}

export function renderEndScreen(runManager, saboteurReveal) {
  const p = runManager.player;
  const title = runManager.result === "fled" ? "ENTKOMMEN!" : "GEFANGEN...";
  el("#end-title").textContent = title;
  el("#end-title").className = runManager.result === "fled" ? "end-title win" : "end-title lose";
  el("#end-summary").textContent =
    runManager.result === "fled"
      ? `Ihr entkommt mit ${p.securedCoins} Münzen nach ${runManager.roomsCleared} Räumen.`
      : `Ihr verliert eure ungesicherten Münzen nach ${runManager.roomsCleared} Räumen.`;

  const saboBox = el("#end-saboteur");
  if (saboteurReveal && saboteurReveal.hadSaboteur) {
    saboBox.textContent = `🎭 Der Saboteur war ${saboteurReveal.bot.name}! Aufgabe „${saboteurReveal.task.label}" wurde ${saboteurReveal.success ? "ERFÜLLT" : "NICHT erfüllt"}.`;
    saboBox.classList.remove("hidden");
  } else {
    saboBox.classList.add("hidden");
  }

  showScreen("screen-end");
}

export function renderSkinBadge(skinId) {
  const skin = getSkinById(skinId);
  if (!skin) return;
  const rarity = RARITY[skin.rarity];
  const badge = el("#skin-badge");
  badge.textContent = `${skin.name} · ${rarity.label}`;
  badge.style.borderColor = rarity.color;
  badge.style.color = rarity.color;
  badge.style.boxShadow = rarity.glow ? `0 0 12px ${rarity.color}` : "none";
}

export function renderProfileSummary(profile) {
  const box = el("#profile-summary");
  if (!box) return;
  box.textContent = `Level ${profile.level} · ${profile.coins} Münzen · ${profile.keys} Schlüssel`;
}

export function renderMissions(progressList, onClaim) {
  const box = el("#missions-list");
  box.innerHTML = "";
  progressList.forEach(({ def, current, done, claimed }) => {
    const row = document.createElement("div");
    row.className = "mission-row";
    const pct = Math.min(100, Math.round((current / def.target) * 100));
    row.innerHTML = `
      <div class="mission-label">${def.label}</div>
      <div class="mission-bar"><div style="width:${pct}%"></div></div>
      <div class="mission-progress">${Math.min(current, def.target)}/${def.target}</div>
    `;
    if (done && !claimed) {
      const btn = document.createElement("button");
      btn.className = "btn btn--primary btn--small";
      btn.textContent = "Belohnung abholen";
      btn.addEventListener("click", () => onClaim(def.id));
      row.appendChild(btn);
    } else if (claimed) {
      row.insertAdjacentHTML("beforeend", '<div class="mission-claimed">✓ abgeholt</div>');
    }
    box.appendChild(row);
  });
}

export function renderDailyStatus(canClaim, streakDay) {
  el("#daily-status").textContent = canClaim
    ? "Deine heutige Belohnung wartet!"
    : `Schon abgeholt. Aktuelle Serie: Tag ${streakDay}. Komm morgen wieder!`;
  el("#btn-daily-claim").disabled = !canClaim;
}

export function renderMysteryBoxStatus(profile) {
  el("#mysterybox-status").textContent = `Du hast ${profile.keys} Schlüssel.`;
  el("#btn-mysterybox-open").disabled = profile.keys < 1;
}

export function renderMysteryBoxResult(result) {
  const box = el("#mysterybox-result");
  if (!result.success) {
    box.textContent = "Keine Schlüssel mehr übrig.";
    return;
  }
  const rarity = RARITY[result.skin.rarity];
  box.innerHTML = `
    <div class="box-result" style="border-color:${rarity.color}; box-shadow:${rarity.glow ? `0 0 16px ${rarity.color}` : "none"}">
      <strong>${result.skin.name}</strong> · ${rarity.label}
      ${result.isNew ? "<div>Neu freigeschaltet!</div>" : `<div>Bereits vorhanden - +${result.compensationCoins} Münzen</div>`}
    </div>
  `;
}

export function renderBotRoster(bots) {
  const box = el("#bot-roster");
  if (!box) return;
  box.innerHTML = bots
    .map((b) => `<span class="bot-chip ${b.alive ? "" : "bot-chip--dead"}">${b.name} · ${b.personality.label}</span>`)
    .join("");
}

export function renderBotFeed(entries) {
  const box = el("#bot-feed");
  if (!box || !entries.length) return;
  entries.forEach(({ bot, comment }) => {
    const line = document.createElement("div");
    line.className = "bot-line";
    line.textContent = `${bot.name}: „${comment}"`;
    box.prepend(line);
  });
  while (box.children.length > 4) box.removeChild(box.lastChild);
}

export function renderDoorSuggestions(suggestions) {
  suggestions.forEach(({ bot, preferredDoor }) => {
    const doorEl = document.querySelector(`.door[data-door-id="${preferredDoor.id}"]`);
    if (!doorEl) return;
    let tagBox = doorEl.querySelector(".door__bots");
    if (!tagBox) {
      tagBox = document.createElement("span");
      tagBox.className = "door__bots";
      doorEl.appendChild(tagBox);
    }
    tagBox.textContent += (tagBox.textContent ? " " : "") + bot.name[0];
  });
}

export function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  el(`#${id}`).classList.remove("hidden");
}
