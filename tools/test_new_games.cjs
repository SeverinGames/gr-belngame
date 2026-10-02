// Tests für: Color Trick (Farbkleckse), Reaktion (Highscore/Spam/Falle), Farbe Nachmachen, Maze, Form Zeichnen.
const { chromium } = require("playwright");
const serve = require("./static_server.cjs");
const fails = [], oks = [];
const check = (name, cond, extra = "") => { (cond ? oks : fails).push(name); console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " - " + extra : ""}`); };
const profileOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("nwo_profile_v2")));
async function dismiss(page) { for (let i = 0; i < 8; i++) { const b = page.locator(".celebrate-btn").first(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(250); } }
async function open(page, name, diff) {
  await dismiss(page);
  const vis = (s) => page.locator(s + ":not(.hidden)").count();
  if (await vis("#screen-arcade-play")) { await page.click((await vis("#arcade-result")) ? "#btn-arcade-home" : "#btn-arcade-quit"); await page.waitForTimeout(100); }
  if (await vis("#screen-arcade-difficulty")) { await page.locator("#screen-arcade-difficulty [data-back]").click(); await page.waitForTimeout(80); }
  if (await vis("#screen-menu")) { await page.locator("#btn-play").click(); await page.waitForTimeout(80); }
  await page.locator(".arcade-card").filter({ hasText: name }).first().click(); await page.waitForTimeout(100);
  await page.click(`[data-arcade-difficulty="${diff}"]`);
}
(async () => {
  const srv = await serve(8123);
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem("nwo_profile_v2") && !localStorage.getItem("nwo_profile_v1")) localStorage.setItem("nwo_profile_v2", JSON.stringify({ welcomed: true })); } catch (e) {} });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/403|Failed to load|fonts/.test(m.text())) errors.push("CONSOLE: " + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)|onrender\.com/, (r) => r.abort());
  await page.goto("http://localhost:8123/index.html?debug=1"); await page.waitForTimeout(300);

  // ===== Listener-Zähler (für "keine doppelten Event-Listener")
  const installLC = () => page.evaluate(() => { window.__lc = 0; const a = window.addEventListener.bind(window), r = window.removeEventListener.bind(window); window.addEventListener = (t, ...x) => { if (t === "keydown" || t === "keyup") window.__lc++; return a(t, ...x); }; window.removeEventListener = (t, ...x) => { if (t === "keydown" || t === "keyup") window.__lc--; return r(t, ...x); }; });
  await installLC();

  // ===== COLOR TRICK
  for (const [d, n] of [["easy", 3], ["normal", 4], ["hard", 4]]) {
    await open(page, "Color Trick", d); await page.waitForTimeout(250);
    const info = await page.evaluate(() => {
      const w = document.querySelector(".ct-word"), blobs = [...document.querySelectorAll(".ct-blob")];
      return { n: blobs.length, text: blobs.map((b) => b.textContent.trim()).join(""), word: w.textContent, ink: getComputedStyle(w).color, colors: blobs.map((b) => getComputedStyle(b).backgroundColor) };
    });
    check(`Color Trick ${d}: ${n} Farbkleckse, ohne Farbnamen/Text`, info.n === n && info.text === "", JSON.stringify(info.colors));
    check(`Color Trick ${d}: alle Klekse verschieden`, new Set(info.colors).size === n);
    if (d === "normal") {
      // Die richtige Antwort = Farbe der Schrift (nicht das Wort). Alle 12 Runden korrekt lösen.
      let right = 0;
      for (let r = 0; r < 12; r++) {
        const ok = await page.evaluate(() => {
          const ink = getComputedStyle(document.querySelector(".ct-word")).color;
          const b = [...document.querySelectorAll(".ct-blob")].find((x) => getComputedStyle(x).backgroundColor === ink);
          if (b) { b.click(); return true; } return false;
        });
        if (ok) right++;
        await page.waitForTimeout(420);
      }
      await page.waitForSelector("#arcade-result:not(.hidden) .arcade-result__card", { timeout: 6000 });
      const txt = await page.locator("#arcade-result").innerText();
      check("Color Trick: Schriftfarbe wählen = richtig (12/12, PERFEKT)", right === 12 && /PERFEKT/.test(txt), `${right}/12`);
    }
  }

  // ===== REAKTION: Highscore-Logik (weniger ms = besser) direkt gegen die Profil-Logik
  const hs = await page.evaluate(async () => {
    const m = await import("./js/rewards/profile.js");
    const p = m.loadProfile({ getItem: () => null, setItem() {} });
    const run = (ms) => { const r = m.applyArcadeRewards(p, { gameId: "reaction", xpEarned: 1, coinsEarned: 1, score: ms, lowerIsBetter: true, difficulty: "normal" }); return [p.arcadeHighscoresByDiff.reaction.normal, p.arcadeHighscores.reaction, r.isNewHighscore]; };
    return [run(999), run(450), run(620), run(300), run(0)];
  });
  check("Reaktion-Highscore: 999 -> 450 -> 620 (bleibt 450) -> 300", JSON.stringify(hs) === JSON.stringify([[999, 999, true], [450, 450, true], [450, 450, false], [300, 300, true], [300, 300, false]]), JSON.stringify(hs));

  // ===== REAKTION: Spam -> UNGÜLTIG, keine Belohnung
  let before = await profileOf(page);
  await open(page, "Reaktion", "normal"); await page.waitForTimeout(200);
  for (let i = 0; i < 60; i++) { await page.locator(".rx-playfield").dispatchEvent("pointerdown").catch(() => {}); await page.waitForTimeout(40); }
  await page.waitForSelector("#arcade-result:not(.hidden) .arcade-result__card", { timeout: 15000 });
  let after = await profileOf(page);
  const spamTxt = await page.locator("#arcade-result").innerText();
  check("Reaktion Spam: Runde UNGÜLTIG", /UNGÜLTIG/.test(spamTxt), spamTxt.replace(/\n+/g, " | ").slice(0, 100));
  check("Reaktion Spam: keine Münzen/XP/Spielzähler/Spins", after.coins === before.coins && after.xp === before.xp && after.stats.arcadeRoundsPlayed === before.stats.arcadeRoundsPlayed && JSON.stringify(after.wheel) === JSON.stringify(before.wheel));

  // ===== REAKTION: "HIER NICHT!" -> sofort verloren, kein gültiger Score
  before = await profileOf(page);
  await page.click("#btn-arcade-retry"); await page.waitForTimeout(200);
  let trapHit = false, reacted = 0;
  for (let i = 0; i < 400 && !trapHit; i++) {
    const cls = await page.evaluate(() => document.querySelector(".rx-zone")?.className ?? "");
    if (cls.includes("rx-zone--go") && reacted < 2) { await page.waitForTimeout(150); await page.locator(".rx-playfield").dispatchEvent("pointerdown"); reacted++; await page.waitForTimeout(700); }
    else if (cls.includes("rx-zone--decoy")) { await page.locator(".rx-playfield").dispatchEvent("pointerdown"); trapHit = true; }
    else await page.waitForTimeout(50);
  }
  await page.waitForSelector("#arcade-result:not(.hidden) .arcade-result__card", { timeout: 8000 });
  const trapTxt = await page.locator("#arcade-result").innerText();
  after = await profileOf(page);
  check("'HIER NICHT!' getippt: Spiel sofort verloren, schlechte Wertung", trapHit && /FALLE/.test(trapTxt) && /VERSUCHT/.test(trapTxt), trapTxt.replace(/\n+/g, " | ").slice(0, 120));
  check("'HIER NICHT!': kein Highscore (Reaktion-Score bleibt unverändert)", (after.arcadeHighscoresByDiff.reaction?.normal ?? null) === (before.arcadeHighscoresByDiff.reaction?.normal ?? null));
  await dismiss(page);

  // ===== REAKTION: Normalspiel zählt genau einmal (auch bei Mehrfachklick auf Buttons)
  before = await profileOf(page);
  await page.click("#btn-arcade-retry"); await page.waitForTimeout(200);
  for (let i = 0, done = 0; i < 600 && done < 5; i++) {
    const cls = await page.evaluate(() => document.querySelector(".rx-zone")?.className ?? "");
    if (cls.includes("rx-zone--go")) { await page.waitForTimeout(160); await page.locator(".rx-playfield").dispatchEvent("pointerdown"); await page.locator(".rx-playfield").dispatchEvent("pointerdown"); done++; await page.waitForTimeout(700); }
    else if (!(await page.locator("#arcade-result:not(.hidden)").count())) await page.waitForTimeout(40);
    else break;
  }
  await page.waitForSelector("#arcade-result:not(.hidden) .arcade-result__card", { timeout: 15000 });
  await dismiss(page);
  for (let i = 0; i < 5; i++) await page.locator("#btn-arcade-home").dispatchEvent("click").catch(() => {});
  after = await profileOf(page);
  check("Reaktion: gültiges Spiel zählt genau 1x (Doppelklicks ohne Zusatz-Belohnung)", after.stats.arcadeRoundsPlayed === before.stats.arcadeRoundsPlayed + 1, `${before.stats.arcadeRoundsPlayed}->${after.stats.arcadeRoundsPlayed}`);
  check("Reaktion: Highscore in ms gespeichert (kleiner = besser)", after.arcadeHighscoresByDiff.reaction.normal > 0 && after.arcadeHighscoresByDiff.reaction.normal < 1200, String(after.arcadeHighscoresByDiff.reaction.normal));
  await page.goto("http://localhost:8123/index.html?debug=1"); await page.waitForTimeout(300); await installLC();
  await page.click("#btn-profile"); await page.waitForTimeout(200);
  check("Profil zeigt Reaktion in ms", /\d+ ms/.test(await page.locator("#profile-body").innerText()));
  await page.click("#screen-profile [data-back]");

  // ===== FARBE NACHMACHEN (alle Schwierigkeiten starten; MITTEL komplett lösen)
  for (const d of ["easy", "normal", "hard"]) {
    await open(page, "Farbe Nachmachen", d); await page.waitForTimeout(250);
    const ok = await page.evaluate(() => document.querySelectorAll(".cm-range").length === 3 && !!document.querySelector(".cm-target"));
    check(`Farbe Nachmachen ${d}: startet (Zielfarbe + 3 Regler)`, ok);
    if (d !== "normal") continue;
    const pcts = [];
    for (let r = 0; r < 3; r++) {
      await page.evaluate(() => { const rgb = getComputedStyle(document.querySelector(".cm-target")).backgroundColor.match(/\d+/g).map(Number); document.querySelectorAll(".cm-range").forEach((el, i) => { el.value = rgb[i]; el.dispatchEvent(new Event("input")); }); });
      await page.click(".cm-done"); await page.click(".cm-done", { force: true }).catch(() => {});
      pcts.push(await page.locator(".cm-result__pct").innerText());
      await page.waitForTimeout(2100);
    }
    await page.waitForSelector("#arcade-result:not(.hidden) .arcade-result__card", { timeout: 6000 });
    const txt = await page.locator("#arcade-result").innerText();
    check("Farbe Nachmachen: Farbtreffer in % angezeigt, Treffer ~100 %", pcts.every((p) => /Farbtreffer: (9[89]|100) %/.test(p)) && /PARTY-PUNKTE/.test(txt), pcts.join(" | "));
    const pr = await profileOf(page);
    check("Farbe Nachmachen: Party-Punkte/XP/Münzen gebucht", pr.partyBest["colorMatch|normal"] >= 700 && pr.stats.arcadeRoundsPlayed >= 1);
  }
  // Falsche Farbe -> niedrigerer Treffer
  await open(page, "Farbe Nachmachen", "hard"); await page.waitForTimeout(200);
  await page.click(".cm-done"); const bad = await page.locator(".cm-result__pct").innerText();
  check("Farbe Nachmachen: grob falsch = niedriger Treffer", +bad.match(/(\d+) %/)[1] < 70, bad);

  // ===== MAZE (Autopilot per BFS-Weg, Tastatur) + Listener-Check
  for (const d of ["easy", "normal", "hard"]) {
    const lcBefore = await page.evaluate(() => window.__lc);
    await open(page, "Maze", d); await page.waitForTimeout(300);
    const dims = await page.evaluate(() => ({ T: window.__maze.maze.T, shortest: window.__maze.maze.shortest }));
    check(`Maze ${d}: Labyrinth ${dims.T}x${dims.T} Blöcke, Weg ${dims.shortest}`, dims.T === { easy: 13, normal: 19, hard: 25 }[d]);
    if (d === "hard") { await page.screenshot({ path: "/tmp/maze_hard.png" }); }
    if (d === "easy" || d === "normal") {
      await page.evaluate(() => {
        const m = window.__maze, { grid, dist, goal } = m.maze;
        window.__mzAp = setInterval(() => {
          const x = m.ball.x, y = m.ball.y, cx = Math.floor(x), cy = Math.floor(y);
          // nächster Block mit kleinerer Distanz zum Ziel
          let best = null, bd = dist[cy][cx];
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const nd = dist[cy + dy]?.[cx + dx]; if (nd >= 0 && nd < bd) { bd = nd; best = [cx + dx, cy + dy]; } }
          if (!best) { m.setKeys({ up: false, down: false, left: false, right: false }); return; }
          const tx = best[0] + 0.5, ty = best[1] + 0.5, ex = tx - x, ey = ty - y;
          // erst auf die Mittellinie des aktuellen Blocks, dann Richtung nächster Block (kein Wandstreifen)
          const along = Math.abs(best[0] - cx) ? "x" : "y";
          const off = along === "x" ? (cy + 0.5 - y) : (cx + 0.5 - x);
          const k = { up: false, down: false, left: false, right: false };
          if (Math.abs(off) > 0.12) { if (along === "x") { k[off > 0 ? "down" : "up"] = true; } else { k[off > 0 ? "right" : "left"] = true; } }
          else { if (along === "x") k[ex > 0 ? "right" : "left"] = true; else k[ey > 0 ? "down" : "up"] = true; }
          m.setKeys(k);
        }, 16);
      });
      await page.waitForSelector("#arcade-result:not(.hidden) .arcade-result__card", { timeout: 60000 });
      const txt = await page.locator("#arcade-result").innerText();
      check(`Maze ${d}: Ziel erreichbar, Ergebnis + Party-Punkte`, /ZIEL in/.test(txt) && /PARTY-PUNKTE/.test(txt), txt.replace(/\n+/g, " | ").slice(0, 110));
    } else { await page.click("#btn-arcade-quit"); }
    await page.waitForTimeout(150);
    const lcAfter = await page.evaluate(() => window.__lc);
    check(`Maze ${d}: keine übrig gebliebenen Tastatur-Listener`, lcAfter === lcBefore, `${lcBefore}->${lcAfter}`);
  }
  // Wände: Kugel darf nicht durch Wand
  await open(page, "Maze", "easy"); await page.waitForTimeout(250);
  const wall = await page.evaluate(async () => {
    const m = window.__maze; m.setKeys({ left: true, up: true }); await new Promise((r) => setTimeout(r, 900)); m.setKeys({ left: false, up: false });
    const T = m.maze.T, g = m.maze.grid; const bx = Math.floor(m.ball.x), by = Math.floor(m.ball.y);
    return { inWall: g[by][bx] === 1, x: m.ball.x, y: m.ball.y, bumps: m.state().bumps };
  });
  check("Maze: Kugel kann Wände nicht durchqueren, Wandkontakt wird gezählt", !wall.inWall && wall.x >= 1 && wall.y >= 1 && wall.bumps >= 1, JSON.stringify(wall));
  // Touch/Wisch-Steuerung
  const box = await page.locator(".mz-canvas").boundingBox();
  const startPos = await page.evaluate(() => ({ x: window.__maze.ball.x, y: window.__maze.ball.y }));
  const cdp = await ctx.newCDPSession(page);
  const dirs = [[40, 0], [-40, 0], [0, 40], [0, -40]]; let moved = false;
  for (const [dx, dy] of dirs) {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx + dx, y: cy + dy }] });
    await page.waitForTimeout(500);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const p = await page.evaluate(() => ({ x: window.__maze.ball.x, y: window.__maze.ball.y }));
    if (Math.hypot(p.x - startPos.x, p.y - startPos.y) > 0.2) moved = true;
  }
  check("Maze: Touch-Steuerung (Ziehen) bewegt die Kugel", moved);
  await page.click("#btn-arcade-quit");

  // ===== FORM ZEICHNEN
  const POOLS = await page.evaluate(async () => (await import("./js/arcade/games/drawShapes.js")).POOLS);
  for (const d of ["easy", "normal", "hard"]) {
    await open(page, "Form Zeichnen", d); await page.waitForTimeout(300);
    const wheelShown = await page.locator(".ds-wheel-layer:not(.hidden)").count();
    check(`Form Zeichnen ${d}: Glücksrad dreht zu Beginn`, wheelShown === 1);
    if (d !== "normal") { await page.waitForFunction(() => window.__draw?.state().phase === "draw", null, { timeout: 8000 }); const id = await page.evaluate(() => window.__draw.state().shapeId); check(`Form Zeichnen ${d}: gewürfelte Form liegt im ${d}-Pool (${id})`, POOLS[d].includes(id)); await page.click("#btn-arcade-quit"); continue; }
    const scores = [];
    for (let r = 0; r < 3; r++) {
      await page.waitForFunction(() => window.__draw?.state().phase === "draw", null, { timeout: 9000 });
      const id = await page.evaluate(() => window.__draw.state().shapeId);
      check(`Form Zeichnen normal: Runde ${r + 1} Form aus Pool (${id})`, POOLS.normal.includes(id));
      const box = await page.locator(".ds-canvas").boundingBox();
      const pts = await page.evaluate(async (id) => { const m = await import("./js/arcade/games/drawShapes.js"); return m.resample(m.SHAPES[id].pts, 90); }, id);
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), s = Math.min(box.width * 0.7 / w, box.height * 0.7 / h);
      const ox = box.x + box.width / 2 - (Math.min(...xs) + w / 2) * s, oy = box.y + box.height / 2 - (Math.min(...ys) + h / 2) * s;
      await page.mouse.move(ox + pts[0].x * s, oy + pts[0].y * s); await page.mouse.down();
      for (const p of pts) await page.mouse.move(ox + p.x * s + (Math.random() - 0.5) * 3, oy + p.y * s + (Math.random() - 0.5) * 3);
      await page.mouse.up();
      await page.click(".ds-done"); await page.click(".ds-done", { force: true }).catch(() => {});
      const t = await page.locator(".ds-result__pct").innerText(); scores.push(+t.match(/(\d+)/)[1]);
      await page.waitForTimeout(2100);
    }
    await page.waitForSelector("#arcade-result:not(.hidden) .arcade-result__card", { timeout: 8000 });
    const txt = await page.locator("#arcade-result").innerText(); const pr = await profileOf(page);
    check("Form Zeichnen: Nachzeichnen wird bewertet (>= 85 %), XP/Party-Punkte gebucht", scores.every((x) => x >= 85) && /PARTY-PUNKTE/.test(txt) && pr.partyBest["drawShape|normal"] > 0, scores.join("/"));
    await dismiss(page);
  }
  // falsche Form zeichnen -> niedrige Wertung
  await open(page, "Form Zeichnen", "easy"); await page.waitForFunction(() => window.__draw?.state().phase === "draw", null, { timeout: 9000 });
  const bb = await page.locator(".ds-canvas").boundingBox();
  await page.mouse.move(bb.x + 40, bb.y + 40); await page.mouse.down(); for (let i = 0; i < 40; i++) await page.mouse.move(bb.x + 40 + Math.random() * (bb.width - 80), bb.y + 40 + Math.random() * (bb.height - 80)); await page.mouse.up();
  await page.click(".ds-done"); const wrongTxt = await page.locator(".ds-result__pct").innerText();
  check("Form Zeichnen: Gekritzel wird schlecht bewertet", +wrongTxt.match(/(\d+)/)[1] < 40, wrongTxt);
  // Touch-Zeichnen (Stift/Finger)
  await page.click("#btn-arcade-quit");

  // ===== Mehrfach-Start: kein doppeltes Spiel, Listener-Bilanz
  const lc0 = await page.evaluate(() => window.__lc);
  for (let i = 0; i < 4; i++) { await open(page, "Maze", "easy"); await page.waitForTimeout(100); }
  await page.click("#btn-arcade-quit"); await page.waitForTimeout(150);
  const lc1 = await page.evaluate(() => window.__lc);
  check("Mehrfach starten/beenden: keine doppelten Listener", lc1 === lc0, `${lc0}->${lc1}`);
  check("Nur ein Spielfeld-Element aktiv", (await page.locator("#arcade-stage > *").count()) === 0);

  // ===== Entfernte Inhalte
  const src = await page.evaluate(async () => (await (await fetch("js/arcade/registry.js")).text()));
  check("Star Catcher komplett entfernt", !/starCatcher/i.test(src));

  console.log("\nKonsolenfehler:", errors.length ? errors : "keine");
  console.log(`\n${oks.length} OK, ${fails.length} FEHLER`); if (fails.length) console.log("Fehlgeschlagen:", fails);
  await browser.close(); srv.close(); process.exit(fails.length || errors.length ? 1 : 0);
})().catch((e) => { console.error("TESTABBRUCH:", e.stack.split("\n").slice(0, 4).join("\n")); process.exit(2); });
