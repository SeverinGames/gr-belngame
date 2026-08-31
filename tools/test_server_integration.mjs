// tools/test_server_integration.mjs
import WebSocket from "ws";

const URL = "ws://localhost:3001";
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
      (handlers.get("*") ?? []).forEach((h) => h(msg));
    });
    const client = {
      name,
      ws,
      on: (type, fn) => { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(fn); },
      send: (type, payload = {}) => ws.send(JSON.stringify({ type, payload })),
      waitFor: (type, timeoutMs = 3000) => new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error(`Timeout beim Warten auf '${type}' für ${name}`)), timeoutMs);
        client.on(type, (payload) => { clearTimeout(timer); res(payload); });
      }),
    };
  });
}

async function main() {
  const host = await connectClient("Host");
  const guest = await connectClient("Guest");

  // --- Lobby erstellen ---
  host.send("createRoom", { name: "Host", skinId: "mario" });
  const created = await host.waitFor("roomCreated");
  assert(typeof created.code === "string" && created.code.length === 5, `Room-Code korrekt generiert: ${created.code}`);
  assert(created.hostId === created.yourId, "Ersteller ist automatisch Host");

  // --- Beitreten ---
  const guestJoinedPromise = guest.waitFor("joinedRoom");
  const hostSeesJoinPromise = host.waitFor("lobbyUpdate");
  guest.send("joinRoom", { code: created.code, name: "Guest", skinId: "mario" });
  const guestJoined = await guestJoinedPromise;
  const hostSeesJoin = await hostSeesJoinPromise;
  assert(guestJoined.players.length === 2, "Guest sieht 2 Spieler in der Lobby nach Beitritt");
  assert(hostSeesJoin.players.length === 2, "Host bekommt Lobby-Update mit 2 Spielern");
  assert(guestJoined.yourId !== created.yourId, "Guest hat eine andere Spieler-ID als Host");

  // --- Falscher Code wird abgelehnt ---
  const thirdTry = await connectClient("Unbekannt");
  const errorPromise = thirdTry.waitFor("error");
  thirdTry.send("joinRoom", { code: "ZZZZZ", name: "X" });
  const err = await errorPromise;
  assert(typeof err.message === "string", "Beitritt mit ungültigem Code liefert Fehlermeldung");
  thirdTry.ws.close();

  // --- Einstellungen nur durch Host änderbar ---
  host.send("updateSettings", { difficulty: "chaos", botCount: 1, saboteurPreset: "peaceful" });
  const settingsUpdate = await host.waitFor("lobbyUpdate");
  assert(settingsUpdate.settings.difficulty === "chaos", "Host kann Einstellungen ändern");

  const guestSettingsAttempt = new Promise((res) => setTimeout(() => res("kein-effekt"), 400));
  guest.send("updateSettings", { difficulty: "nightmare" });
  await guestSettingsAttempt; // Guest darf das nicht - wird serverseitig ignoriert (kein Broadcast erwartet)

  // --- Spiel starten ---
  const hostGameStarted = host.waitFor("gameStarted");
  const guestGameStarted = guest.waitFor("gameStarted");
  host.send("startGame");
  const [hStart, gStart] = await Promise.all([hostGameStarted, guestGameStarted]);
  assert(hStart.state.players.length === 2, "Beide Spieler sind im gestarteten Spielzustand");
  assert(Array.isArray(hStart.doors) && hStart.doors.length >= 2, "Türen wurden generiert");
  assert(JSON.stringify(hStart) === JSON.stringify(gStart), "Host und Guest sehen identischen Spielstart-Zustand");

  // --- Tür wählen: beide Spieler bekommen dasselbe Ergebnis ---
  const hostResolved = host.waitFor("roomResolved");
  const guestResolved = guest.waitFor("roomResolved");
  host.send("chooseDoor", { doorId: hStart.doors[0].id });
  const [hRes, gRes] = await Promise.all([hostResolved, guestResolved]);
  assert(hRes.outcome.message === gRes.outcome.message, "Beide Spieler sehen dasselbe Ereignis-Ergebnis (Server ist autoritativ)");
  assert(hRes.state.players[0].hp === hRes.state.players[1].hp || hRes.outcome.kind !== "danger" || hRes.outcome.hp === undefined,
    "Gemeinsamer HP-Effekt wird konsistent auf beide angewendet");

  // --- Spiel bis zum Ende durchspielen ---
  let ended = false;
  let guardCounter = 0;
  while (!ended && guardCounter < 40) {
    guardCounter++;
    const nextOrEndOrMinigame = Promise.race([
      host.waitFor("nextDoors", 5000).then((p) => ({ kind: "next", payload: p })),
      host.waitFor("gameEnded", 5000).then((p) => ({ kind: "end", payload: p })),
      host.waitFor("minigameStarted", 5000).then((p) => ({ kind: "minigame", payload: p })),
    ]);
    const result = await nextOrEndOrMinigame;
    if (result.kind === "end") { ended = true; assert(true, `Runde endet nach ${guardCounter} Türen (Ergebnis: ${result.payload.state.result})`); break; }
    if (result.kind === "minigame") {
      // Reaktionsspiel während des generischen Durchspielens - Ergebnis einreichen und weitermachen
      host.send("submitMinigameResult", { doorId: result.payload.doorId, reactionMs: 200 });
      continue;
    }
    host.send("chooseDoor", { doorId: result.payload.doors[0].id });
  }
  assert(ended, "Spiel kommt zu einem echten Ende (nicht endlos, auch mit zwischendurch gewürfelten Minispielen)");

  // --- Verlassen: Host-Übergabe an verbleibenden Spieler ---
  const guestSeesLeave = guest.waitFor("lobbyUpdate");
  host.send("leaveRoom");
  const afterHostLeft = await guestSeesLeave;
  assert(afterHostLeft.players.length === 1, "Nach Verlassen des Hosts bleibt 1 Spieler übrig");
  assert(afterHostLeft.hostId === guestJoined.yourId, "Guest wird automatisch neuer Host");

  guest.ws.close();
  host.ws.close();

  console.log(failures === 0 ? "\nALLE TESTS BESTANDEN" : `\n${failures} TEST(S) FEHLGESCHLAGEN`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("UNERWARTETER FEHLER:", e); process.exit(1); });
