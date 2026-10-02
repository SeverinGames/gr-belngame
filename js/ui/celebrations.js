// js/ui/celebrations.js
// Zeigt die Erfolgserlebnisse aus progress/events.js an:
//  - Meilensteine als kurze Hinweise (Toasts, blockieren nichts)
//  - LEVEL UP als eigene Einblendung mit Belohnung
//  - Mini-Box-Öffnung (kleine kosmetische Bonusbox)
import { drainEvents } from "../progress/events.js";

const root = () => document.querySelector("#celebrate-root");

function toast(icon, title, text) {
  const wrap = root();
  if (!wrap) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span class="toast__icon">${icon}</span><span class="toast__body"><b>${title}</b>${text ? `<small>${text}</small>` : ""}</span>`;
  wrap.querySelector(".toast-stack").appendChild(t);
  setTimeout(() => t.classList.add("toast--out"), 3200);
  setTimeout(() => t.remove(), 3700);
}

function modal({ cls = "", html, buttonLabel = "WEITER" }) {
  return new Promise((resolve) => {
    const wrap = root();
    const m = document.createElement("div");
    m.className = `celebrate-modal ${cls}`;
    m.innerHTML = `<div class="celebrate-card">${html}<button class="btn btn--primary celebrate-btn">${buttonLabel}</button></div>`;
    wrap.querySelector(".modal-layer").appendChild(m);
    const close = () => { m.classList.add("celebrate-modal--out"); setTimeout(() => { m.remove(); resolve(); }, 180); };
    m.querySelector(".celebrate-btn").addEventListener("click", close);
    m.querySelector(".celebrate-btn").focus?.();
  });
}

let busy = Promise.resolve();
// Holt alle neuen Ereignisse und zeigt sie nacheinander an.
export function celebrate(audio) {
  const events = drainEvents();
  if (!events.length) return busy;
  const levelups = events.filter((e) => e.type === "levelup");
  events.filter((e) => e.type === "milestone").forEach((e, i) => {
    setTimeout(() => { toast(e.daily ? "📅" : "🏅", e.label, e.text); audio?.sfx("secretFound"); }, i * 450);
  });
  busy = busy.then(async () => {
    for (const e of levelups) {
      audio?.sfx("levelUp");
      await modal({
        cls: "celebrate-modal--levelup",
        html: `<div class="levelup__burst">✨</div><div class="levelup__title">LEVEL UP!</div><div class="levelup__level">Level ${e.level}</div>
               <div class="levelup__reward">${e.text || ""}</div>${e.note ? `<div class="levelup__note">🔓 ${e.note}</div>` : ""}`,
      });
    }
  });
  return busy;
}

// Mini-Box-Öffnung: schüttelt kurz, dann Belohnung.
export function playMiniBox(result, audio) {
  return new Promise((resolve) => {
    const wrap = root();
    const m = document.createElement("div");
    m.className = "celebrate-modal celebrate-modal--minibox";
    m.innerHTML = `<div class="celebrate-card"><div class="minibox__box">🎁</div><div class="minibox__reveal hidden"></div></div>`;
    wrap.querySelector(".modal-layer").appendChild(m);
    audio?.sfx("boxRumble");
    setTimeout(() => audio?.sfx("boxRumble"), 350);
    setTimeout(() => {
      audio?.sfx(result.jackpot ? "unlockRare" : "boxBurst");
      m.querySelector(".minibox__box").classList.add("minibox__box--open");
      const rev = m.querySelector(".minibox__reveal");
      rev.innerHTML = `<div class="minibox__title">${result.jackpot ? "JACKPOT!" : "MINI-BOX"}</div><div class="minibox__text">${result.text}</div><button class="btn btn--primary celebrate-btn">WEITER</button>`;
      rev.classList.remove("hidden");
      rev.querySelector(".celebrate-btn").addEventListener("click", () => { m.remove(); resolve(); });
    }, 1100);
  });
}
