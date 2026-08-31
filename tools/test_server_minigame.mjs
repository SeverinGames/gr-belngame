// tools/test_server_minigame.mjs
import WebSocket from "ws";

const URL = "ws://localhost:3003";
let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FEHLER:", msg); failures++; }
  else console.log("OK:", msg);
}

function connectClient(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const handlers = new Map();
    ws.on("open", () => resolve(client));
    ws.on("error", reject);
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      (handlers.get(msg.type) ?? []).forEach((h) => h(msg.payload));
    });
    const client = {
      name, ws,
      on: (type, fn) => { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
      send: (type, payload = {}) => ws.send(JSON.stringify({ type, payload })),
      waitFor: (type, timeoutMs = 4000) => new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error(`Timeout beim Warten auf '${type}' für ${name}`)), timeoutMs);
        client.on(type, (payload) => { clearTimeout(timer); res(payload); });
      }),
    };
  });
}

async function main() {
  const host = await connectClient("Host");
  const guest = await connectClient("Guest");

  host.send("createRoom", { name: "Host", skinId: "mario" });
  const created = await host.waitFor("roomCreated");

  const guestJoined = guest.waitFor("joinedRoom");
  const hostSeesJoin = host.waitFor("lobbyUpdate");
  guest.send("joinRoom", { code: created.code, name: "Guest", skinId: "mario" });
  await guestJoined;
  await hostSeesJoin;

  // Seed 105 mit botCount 0 würfelt Tür 0 als reactionGame (offline vorab ermittelt)
  host.send("updateSettings", { difficulty: "normal", botCount: 0, saboteurPreset: "peaceful", seed: 105 });
  await host.waitFor("lobbyUpdate");

  const hostStarted = host.waitFor("gameStarted");
  const guestStarted = guest.waitFor("gameStarted");
  host.send("startGame");
  const [hStart] = await Promise.all([hostStarted, guestStarted]);

  assert(hStart.doors[0].roomType.id === "reactionGame", `Erste Tür ist wie erwartet ein Reaktionsspiel (ist: ${hStart.doors[0].roomType.id})`);

  const hostMinigame = host.waitFor("minigameStarted");
  const guestMinigame = guest.waitFor("minigameStarted");
  host.send("chooseDoor", { doorId: hStart.doors[0].id });
  const [hMini, gMini] = await Promise.all([hostMinigame, guestMinigame]);

  assert(hMini.type === "reactionGame", "Server broadcastet minigameStarted mit korrektem Typ");
  assert(JSON.stringify(hMini.challenge) === JSON.stringify(gMini.challenge),
    "Host und Guest bekommen exakt dieselbe Challenge (Symbol/Timing) - fair synchronisiert");

  // Zweiter Versuch, ein Minispiel zu starten, während eins läuft, wird ignoriert
  guest.send("chooseDoor", { doorId: hStart.doors[0].id });
  await new Promise((r) => setTimeout(r, 300)); // kurz warten, kein zweites Event erwartet

  const hostResolved = host.waitFor("roomResolved");
  const guestResolved = guest.waitFor("roomResolved");
  host.send("submitMinigameResult", { doorId: hStart.doors[0].id, reactionMs: 150 });
  const [hRes, gRes] = await Promise.all([hostResolved, guestResolved]);

  assert(hRes.outcome.kind === "reward", `Schnelle Reaktion (150ms) gibt Belohnung (Ergebnis: ${hRes.outcome.kind})`);
  assert(hRes.outcome.message === gRes.outcome.message, "Beide Spieler sehen dasselbe Minispiel-Ergebnis");
  assert(hRes.state.players[0].securedCoins + hRes.state.players[0].riskCoins > 0 || hRes.outcome.coins > 0,
    "Belohnung wurde tatsächlich vergeben");

  // Nach Auflösung darf ein erneutes submitMinigameResult für dieselbe Tür nichts mehr bewirken
  const noDoubleResolve = new Promise((res) => {
    const timer = setTimeout(() => res("kein-zweites-event"), 500);
    host.on("roomResolved", () => { clearTimeout(timer); res("FEHLER-doppelt-aufgelöst"); });
  });
  host.send("submitMinigameResult", { doorId: hStart.doors[0].id, reactionMs: 50 });
  const doubleCheck = await noDoubleResolve;
  assert(doubleCheck === "kein-zweites-event", "Bereits aufgelöstes Minispiel kann nicht doppelt ausgewertet werden");

  guest.ws.close();
  host.ws.close();

  console.log(failures === 0 ? "\nALLE TESTS BESTANDEN" : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("UNERWARTETER FEHLER:", e); process.exit(1); });
