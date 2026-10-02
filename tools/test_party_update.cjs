// Abschlusstest der Überarbeitung (Fortschritt, Party-Punkte, Profil, Rangliste,
// Memory/Stopp-bei-Grün-Schwierigkeit, Mais-Mission 3D, Mobile-Layout).
// Start:  node tools/test_party_update.cjs   (startet Test-Server selbst;
//         die Rangliste wird gegen den echten Server aus /server geprüft)
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const serve = require("./static_server.cjs");

const fails = [], oks = [];
const check = (name, cond, extra = "") => { (cond ? oks : fails).push(name); console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " - " + extra : ""}`); };
const profileOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("nwo_profile_v2")));
const setProfile = (page, patch) => page.evaluate((p) => { const cur = JSON.parse(localStorage.getItem("nwo_profile_v2") || "{}"); localStorage.setItem("nwo_profile_v2", JSON.stringify({ ...cur, ...p })); }, patch);
async function dismiss(page) {
  for (let i = 0; i < 10; i++) {
    const b = page.locator(".celebrate-btn").first();
    if (await b.count() === 0) break;
    await b.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(260);
  }
}
async function openGame(page, name, diff) {
  await dismiss(page);
  const vis = (sel) => page.locator(sel + ":not(.hidden)").count();
  if (await vis("#screen-arcade-play")) { await page.click((await vis("#arcade-result")) ? "#btn-arcade-home" : "#btn-arcade-quit"); await page.waitForTimeout(100); }
  if (await vis("#screen-arcade-difficulty")) { await page.locator("#screen-arcade-difficulty [data-back]").click(); await page.waitForTimeout(80); }
  if (await vis("#screen-menu")) { await page.locator("#btn-play").click(); await page.waitForTimeout(80); }
  await page.locator(".arcade-card").filter({ hasText: name }).first().click();
  await page.waitForTimeout(120);
  await page.click(`[data-arcade-difficulty="${diff}"]`);
}

(async () => {
  const srv = await serve(8123);
  // Server starten; falls "ws" nicht installiert ist (Sandbox), aus einer temporären Kopie mit verlinktem ws.
  const fs = require("fs");
  let serverDir = path.join(__dirname, "..", "server");
  if (!fs.existsSync(path.join(serverDir, "node_modules", "ws"))) {
    const wsDir = (process.env.WS_DIR) || "/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/ws";
    const tmp = "/tmp/srvtest"; fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp + "/node_modules", { recursive: true });
    for (const f of fs.readdirSync(serverDir)) if (f.endsWith(".js") || f === "package.json") fs.copyFileSync(path.join(serverDir, f), path.join(tmp, f));
    fs.symlinkSync(wsDir, tmp + "/node_modules/ws"); serverDir = tmp;
  }
  const lb = spawn("node", ["index.js"], { cwd: serverDir, env: { ...process.env, PORT: "3001", LEADERBOARD_FILE: "/tmp/lb-test.json" } });
  lb.stderr.on("data", (d) => process.stderr.write("[server] " + d));
  require("fs").rmSync("/tmp/lb-test.json", { force: true });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const errors = [];
  const newPage = async (ctxOpts = {}, serverUp = true) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true, ...ctxOpts });
    await ctx.addInitScript(() => { try { if (!localStorage.getItem("nwo_profile_v2") && !localStorage.getItem("nwo_profile_v1")) localStorage.setItem("nwo_profile_v2", JSON.stringify({ welcomed: true })); } catch (e) {} });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/403|Failed to load resource|fonts/.test(m.text())) errors.push("CONSOLE: " + m.text()); });
    await page.route("https://gr-belngame.onrender.com/**", async (route) => {
      if (!serverUp) return route.abort();
      const u = new URL(route.request().url());
      const r = await fetch("http://localhost:3001" + u.pathname + u.search, { method: route.request().method(), headers: { "Content-Type": "application/json" }, body: route.request().method() === "POST" ? route.request().postData() : undefined });
      await route.fulfill({ status: r.status, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: await r.text() });
    });
    await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    return page;
  };

  // ============================== 0. Komplett-Reset: alter Spielstand (v1) wird auf JEDEM Gerät gelöscht
  {
    const rctx = await browser.newContext({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true });
    await rctx.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("nwo_profile_v1", JSON.stringify({ level: 40, coins: 99999, unlockedSkins: ["mario", "neo", "floet", "floe"], equippedSkin: "floe", nickname: "AltSpieler", stats: { arcadeRoundsPlayed: 500 } })); } });
    const rp = await rctx.newPage();
    await rp.route(/fonts\.(googleapis|gstatic)|onrender\.com/, (r) => r.abort());
    await rp.goto("http://localhost:8123/index.html"); await rp.waitForTimeout(500);
    const fresh = await profileOf(rp);
    check("RESET: alter Spielstand (Level 40, 99.999 Münzen, 4 Skins) ist weg", fresh.level === 1 && fresh.coins === 0 && fresh.unlockedSkins.length === 1 && fresh.nickname === null && fresh.stats.arcadeRoundsPlayed === 0, JSON.stringify({ l: fresh.level, c: fresh.coins, s: fresh.unlockedSkins }));
    check("RESET: alter Schlüssel gelöscht, neuer Spieler-Schlüssel", (await rp.evaluate(() => localStorage.getItem("nwo_profile_v1"))) === null && fresh.playerKey.length > 16);
    const welcome = await rp.locator("#screen-profile:not(.hidden)").count();
    check("Neues Konto: Namensabfrage + Reset-Hinweis erscheint", welcome === 1 && /zurückgesetzt/.test(await rp.locator("#nick-message").innerText()));
    await rctx.close();
  }

  // ============================== A. Start/Layout/Mobile
  let page = await newPage();
  await page.goto("http://localhost:8123/index.html?debug=1");
  await page.waitForTimeout(400);
  const body = await page.locator("body").innerText();
  check("Footer '© Sevi 2026' vorhanden", body.includes("© Sevi 2026"));
  const fsz = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".site-footer")).fontSize));
  check("Footer klein (<= 11px)", fsz <= 11, fsz + "px");
  const footerBelow = await page.evaluate(() => document.querySelector(".site-footer").getBoundingClientRect().top >= document.querySelector("#app").getBoundingClientRect().bottom - 2);
  check("Footer liegt UNTER dem Spielbereich (nicht daneben)", footerBelow);
  check("kein horizontales Scrollen (Mobile)", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check("Startseite zeigt LEVEL + XP", /LEVEL 1/.test(body) && /\/ 100 XP/.test(body));
  check("Buttons PROFIL + RANGLISTE vorhanden", /PROFIL/.test(body) && /RANGLISTE/.test(body));
  await page.click("#btn-play"); await page.waitForTimeout(150);
  const list = await page.locator(".arcade-card__name").allInnerTexts();
  check("14 Minispiele, kein Star Catcher, neue Spiele da", list.length === 14 && !list.some((n) => /Star/i.test(n)) && ["Mais-Mission", "Farbe Nachmachen", "Maze", "Form Zeichnen"].every((n) => list.includes(n)), list.join(", "));
  check("Solo-Text 'Kurz, knackig' entfernt", !(await page.locator("body").innerHTML()).match(/knackig/i));

  // ============================== B. Schwierigkeiten einheitlich
  let allLabels = true;
  for (let i = 0; i < list.length; i++) {
    await page.locator(".arcade-card").nth(i).click(); await page.waitForTimeout(80);
    const labels = (await page.locator(".diff-btn__label").allInnerTexts()).join("|");
    if (!/LEICHT/.test(labels) || !/MITTEL/.test(labels) || !/SCHWER/.test(labels) || /easy|normal|hard|medium/i.test(labels)) allLabels = false;
    await page.locator("[data-back='screen-arcade']").click(); await page.waitForTimeout(60);
  }
  check("LEICHT/MITTEL/SCHWER bei allen 14 Spielen", allLabels);

  // ============================== C. Memory 12/16/20
  const mem = {};
  for (const [d, n] of [["easy", 12], ["normal", 16], ["hard", 20]]) {
    await openGame(page, "Memory", d); await page.waitForTimeout(300);
    mem[d] = await page.locator(".mm-card").count();
    const fits = await page.evaluate(() => { const s = document.querySelector("#arcade-stage").getBoundingClientRect(), g = document.querySelector(".mm-grid").getBoundingClientRect(); return g.top >= s.top - 1 && g.bottom <= s.bottom + 1 && g.right <= s.right + 1; });
    check(`Memory ${d}: ${n} Karten, Feld passt in Spielbereich`, mem[d] === n && fits, `${mem[d]}`);
    if (d === "hard") await page.screenshot({ path: "/tmp/mem_hard.png" });
    await page.click("#btn-arcade-quit"); await page.waitForTimeout(120);
  }
  // Memory komplett lösen (SCHWER) -> Ergebnis + Sieg-Zählung
  await openGame(page, "Memory", "hard"); await page.waitForTimeout(1800); // Mindestdauer (Schutz vor Sofort-Ergebnissen)
  await page.evaluate(async () => {
    const cards = [...document.querySelectorAll(".mm-card")]; const bySym = {};
    cards.forEach((c, i) => { const s = c.querySelector(".mm-card__front").textContent; (bySym[s] ??= []).push(c); });
    for (const pair of Object.values(bySym)) { pair[0].click(); pair[1].click(); await new Promise((r) => setTimeout(r, 80)); }
  });
  await page.waitForSelector("#arcade-result:not(.hidden) .arcade-result__card", { timeout: 8000 });
  const memRes = await page.locator("#arcade-result").innerText();
  check("Ergebnis zeigt Party-Punkte + Highscore-Hinweis + XP-Balken", /PARTY-PUNKTE/.test(memRes) && /HIGHSCORE/.test(memRes) && /XP/.test(memRes), memRes.replace(/\n+/g, " | ").slice(0, 160));
  let pr = await profileOf(page);
  check("Memory SCHWER: gewonnen gezählt, Party-Punkte gespeichert", pr.stats.gamesWon === 1 && pr.partyBest["memory|hard"] > 0, JSON.stringify(pr.partyBest));
  check("Highscore je Schwierigkeit gespeichert", pr.arcadeHighscoresByDiff.memory.hard > 0 && pr.arcadeHighscores.memory > 0);
  check("Meilenstein 'Erstes Spiel heute' erledigt", pr.daily.done.includes("d_first"));
  await dismiss(page);

  // ============================== D. Stopp bei Grün: Runden je Stufe + Fairness-Parameter
  for (const [d, rounds] of [["easy", 5], ["normal", 6], ["hard", 7]]) {
    await openGame(page, "Stopp bei Grün", d); await page.waitForTimeout(250);
    let clicks = 0;
    for (let i = 0; i < 12; i++) {
      if (await page.locator("#arcade-result:not(.hidden)").count()) break;
      await page.waitForTimeout(150 + Math.random() * 500);
      await page.locator(".sg-stopbtn").click({ timeout: 2500, force: true }).catch(() => {}); clicks++;
      await page.waitForTimeout(780);
    }
    await page.waitForSelector("#arcade-result:not(.hidden)", { timeout: 6000 });
    check(`Stopp bei Grün ${d}: ${rounds} Runden`, clicks === rounds, `Klicks ${clicks}`);
    await dismiss(page);
  }
  // Zonenbreiten laut Parametern (Fairness: Durchlaufzeit >= minPassMs) - rein rechnerisch geprüft
  const fair = await page.evaluate(async () => {
    const src = await (await fetch("js/arcade/games/stopGreen.js")).text();
    const m = [...src.matchAll(/(easy|normal|hard): \{ rounds: (\d+), zone0: ([\d.]+), shrink: ([\d.]+), zoneMin: ([\d.]+), speed0: (\d+), speedStep: (\d+), jitter: ([\d.]+), wobble: ([\d.]+), drift: (\d+), minPassMs: (\d+)/g)];
    return m.map((x) => ({ d: x[1], rounds: +x[2], zone0: +x[3], zoneMin: +x[5], speed0: +x[6], minPass: +x[11], wobble: +x[9] }));
  });
  const [fe, fn, fh] = fair;
  check("Stopp bei Grün: Stufen klar gestaffelt (Zone, Tempo, Variation)", fe.zone0 > fn.zone0 && fn.zone0 > fh.zone0 && fe.speed0 < fn.speed0 && fn.speed0 < fh.speed0 && fh.wobble > 0 && fe.wobble === 0, JSON.stringify(fair));
  check("Stopp bei Grün: Fairness-Grenze (Durchlaufzeit >= 100 ms)", fair.every((f) => f.minPass >= 100));

  // ============================== E. Bestehende Spiele starten & beenden ohne Fehler
  const quick = ["Obstkorb", "Ballon Pop", "Color Trick", "Reaktion", "Quick Finger", "Schatzpfade", "Vier Gewinnt", "Farbröhren"];
  const names = await page.locator(".arcade-card__name").allInnerTexts();
  for (const n of names.filter((x) => !["Mini Memory", "Stopp bei Grün", "Mais-Mission", "Reaktion", "Farbe Nachmachen", "Maze", "Form Zeichnen"].includes(x))) {
    await openGame(page, n, "easy"); await page.waitForTimeout(500);
    const started = await page.locator("#arcade-stage").evaluate((e) => e.children.length > 0);
    await page.click("#btn-arcade-quit"); await page.waitForTimeout(100);
    check(`Spiel startet: ${n}`, started);
  }

  // ============================== F. Fortschritt: XP, Level-Up, Belohnungen (Level 2 = 150 Münzen)
  await setProfile(page, { xp: 90, level: 1, rewardedLevel: 1 });
  await page.reload(); await page.waitForTimeout(300);
  const before = (await profileOf(page)).coins;
  await openGame(page, "Stopp bei Grün", "easy");
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(300); await page.locator(".sg-stopbtn").click({ force: true, timeout: 1500 }).catch(() => {}); await page.waitForTimeout(760); }
  await page.waitForSelector(".celebrate-modal--levelup", { timeout: 8000 });
  const lvlTxt = await page.locator(".celebrate-modal--levelup").innerText();
  check("LEVEL UP! mit Belohnung eingeblendet", /LEVEL UP/.test(lvlTxt) && /Level 2/.test(lvlTxt) && /70/.test(lvlTxt), lvlTxt.replace(/\n+/g, " "));
  await dismiss(page);
  pr = await profileOf(page);
  check("Level 2 erreicht, Level-Belohnung (+70) + Rundenmünzen gebucht", pr.level === 2 && pr.coins >= before + 70 + 10, `coins ${before}->${pr.coins}`);
  await page.click("#btn-arcade-home"); await page.waitForTimeout(100);

  // ============================== G. Profil
  await page.goto("http://localhost:8123/index.html"); await page.waitForTimeout(300);
  await page.click("#btn-profile"); await page.waitForTimeout(200);
  await page.fill("#nick-input", "ab"); await page.click("#btn-nick-save");
  check("Name zu kurz wird abgelehnt", /Mindestens 3/.test(await page.locator("#nick-message").innerText()));
  await page.fill("#nick-input", "BigSevi"); await page.click("#btn-nick-save"); await page.waitForTimeout(500);
  pr = await profileOf(page);
  check("Spielername gespeichert", pr.nickname === "BigSevi");
  const prof = await page.locator("#profile-body").innerText();
  check("Profil zeigt Level, XP, Party-Punkte, Siege, Skins, Highscores", /LEVEL \d/.test(prof) && /Party-Punkte/.test(prof) && /Siege/.test(prof) && /\d \/ 8/.test(prof) && /Deine Highscores/.test(prof) && /Memory/.test(prof));
  await page.screenshot({ path: "/tmp/profile.png", fullPage: true });
  // Kosmetik ausrüsten (Level-2-Vorgabe: Level 7 gibt Rahmen; hier per Profil setzen)
  await setProfile(page, { cosmetics: { owned: ["frame:gold", "badge:star"], equipped: {} } });
  await page.reload(); await page.waitForTimeout(250); await page.click("#btn-profile"); await page.waitForTimeout(150);
  await page.locator(".cos-chip", { hasText: "Gold-Rahmen" }).click(); await page.waitForTimeout(150);
  check("Rahmen ausrüstbar", (await profileOf(page)).cosmetics.equipped.frame === "gold");
  await page.click("#screen-profile [data-back]"); await page.waitForTimeout(100);

  // ============================== H. Shop: Tabs, Level-Sperre, Mini-Box, Sammlung
  await page.click("#btn-shop"); await page.waitForTimeout(150);
  const tabs = await page.locator("#shop-tabs .tab").allInnerTexts();
  check("Shop-Tabs: BOXEN/RAD/BONUS/SAMMLUNG", tabs.join(",") === "BOXEN,RAD,BONUS,SAMMLUNG", tabs.join(","));
  const prices = await page.locator(".shop-card__buy").allInnerTexts();
  check("Super/Mega Box sind per Level gesperrt (Level 2)", /ab Level 4/.test(prices[1]) && /ab Level 8/.test(prices[2]), prices.join(" | "));
  await setProfile(page, { coins: 300 }); await page.reload(); await page.waitForTimeout(250); await page.click("#btn-shop"); await page.waitForTimeout(150);
  check("Box-Fortschritt wird angezeigt (300/7.500)", /300 \/ 7\.500/.test(await page.locator(".box-progress").innerText()));
  await page.click('#shop-tabs [data-tab="bonus"]'); await page.waitForTimeout(100);
  check("Bonus-Tab: Tagesziele + Mini-Box + Creator Code", /Tagesziele/.test(await page.locator("#shop-tab-bonus").innerText()) && /Mini-Box/.test(await page.locator("#shop-tab-bonus").innerText()) && await page.locator("#creator-code-input").isVisible());
  await setProfile(page, { bonusBoxes: 1, coins: 9000 });
  await page.reload(); await page.waitForTimeout(250); await page.click("#btn-shop"); await page.click('#shop-tabs [data-tab="bonus"]'); await page.waitForTimeout(100);
  await page.click("#btn-mini-open"); await page.waitForSelector(".minibox__reveal:not(.hidden)", { timeout: 5000 });
  const mb = await page.locator(".celebrate-modal--minibox").innerText();
  await page.locator(".minibox__reveal .celebrate-btn").click(); await page.waitForTimeout(200);
  pr = await profileOf(page);
  check("Mini-Box öffnet (Vorrat -1), liefert Belohnung ohne Skin", pr.bonusBoxes === 0 && pr.unlockedSkins.length === 1, mb.replace(/\n+/g, " "));
  await page.click('#shop-tabs [data-tab="boxes"]'); await page.waitForTimeout(100);
  await page.locator(".shop-card__buy").first().click(); await page.waitForTimeout(300);
  await page.waitForSelector("#mysterybox-animation", { timeout: 4000 }).catch(() => {});
  for (let i = 0; i < 14 && await page.locator("#mysterybox-animation").count(); i++) { await page.locator("#mysterybox-animation").click({ force: true, position: { x: 150, y: 300 } }).catch(() => {}); const b = page.locator("#mysterybox-animation button:visible").first(); if (await b.count()) await b.click({ force: true }).catch(() => {}); await page.waitForTimeout(500); }
  pr = await profileOf(page);
  check("Basic Box kaufbar (7.500 Münzen abgezogen/ggf. Duplikat-Rückzahlung)", pr.coins < 9000 && pr.stats.boxesOpened >= 1, `coins ${pr.coins}`);
  await page.click('#shop-tabs [data-tab="collection"]'); await page.waitForTimeout(100);
  check("Sammlung zeigt Skin-Fortschritt x / 8", /\/ 8/.test(await page.locator("#shop-tab-collection").innerText()));
  await page.click('#shop-tabs [data-tab="wheel"]'); await page.waitForTimeout(100);
  check("Rad-Tab zeigt Gratis-Dreh + Bonus-Vorrat", /Gratis-Dreh/.test(await page.locator("#shop-tab-wheel").innerText()) && /Bonus-Drehs/.test(await page.locator("#shop-tab-wheel").innerText()));

  // ============================== I. Glücksrad: Bonus-Drehs, Deckel, Münz-Umwandlung
  await page.goto("http://localhost:8123/index.html"); await page.waitForTimeout(250);
  await setProfile(page, { wheel: { lastFreeDay: new Date().toISOString().slice(0, 10), bonusSpins: 2 } });
  await page.reload(); await page.waitForTimeout(250); await page.click("#btn-wheel"); await page.waitForTimeout(150);
  check("Bonus-Dreh nutzbar (Button aktiv)", !(await page.locator("#btn-wheel-spin").isDisabled()));
  await page.click("#btn-wheel-spin"); await page.waitForTimeout(4900);
  await dismiss(page);
  pr = await profileOf(page);
  check("Bonus-Dreh verbraucht (2 -> 1 + evtl. Rad-Gewinn)", pr.wheel.bonusSpins <= 2 && pr.stats.wheelSpins === 1, `Vorrat ${pr.wheel.bonusSpins}`);
  const capped = await page.evaluate(async () => { const m = await import("./js/progress/rewardOps.js"); const p = { coins: 0, stats: { coinsEverEarned: 0 }, wheel: { bonusSpins: 5 } }; m.addSpin(p, 3); return [p.wheel.bonusSpins, p.coins]; });
  check("Bonus-Dreh-Vorrat ist gedeckelt (max 6, Überschuss -> Münzen)", capped[0] === 6 && capped[1] === 200, JSON.stringify(capped));

  // ============================== J. Skins bleiben selten (Simulation) + Party-Punkte Vergleichbarkeit
  const sim = await page.evaluate(async () => {
    const shop = await import("./js/shop/shop.js");
    const res = {};
    for (const id of ["basic", "super", "mega"]) {
      const runs = [];
      for (let r = 0; r < 300; r++) { const p = { coins: 1e9, level: 99, unlockedSkins: ["mario"], stats: { boxesOpened: 0, coinsEverEarned: 0 } }; let n = 0; while (p.unlockedSkins.length < 7 && n < 20000) { shop.purchaseBox(p, id, Math.random); n++; } runs.push(n); }
      runs.sort((a, b) => a - b); res[id] = { median: runs[150], price: shop.BOX_DEFS[id].price };
    }
    return res;
  });
  console.log("Boxen bis alle Box-Skins (Median):", JSON.stringify(sim));
  check("Skin-Sammlung bleibt Langzeitziel (>= 500 Basic-Boxen im Median)", sim.basic.median >= 500, `${sim.basic.median} Boxen = ${(sim.basic.median * sim.basic.price).toLocaleString("de-DE")} Münzen`);
  const pp = await page.evaluate(async () => { const m = await import("./js/progress/partyPoints.js"); return { c4win: m.partyPointsFor(90, "normal"), balloon: m.partyPointsFor(90, "normal"), balloonLow: m.partyPointsFor(30, "normal"), hardMid: m.partyPointsFor(60, "hard"), easyMax: m.partyPointsFor(100, "easy"), hardMax: m.partyPointsFor(100, "hard") }; });
  check("Party-Punkte: Leistung% + Schwierigkeit zählen, nicht Rohscore", pp.c4win > pp.balloonLow && pp.hardMid > pp.easyMax * 0.9 && pp.hardMax === 1200 && pp.easyMax === 500, JSON.stringify(pp));

  await page.context().close();

  // ============================== K. Rangliste (echter Server, 3 Spieler, eigener Rang)
  const mk = async (name, pp) => {
    const p = await newPage(); await p.goto("http://localhost:8123/index.html"); await p.waitForTimeout(250);
    await p.evaluate(async () => { const m = await import("./js/rewards/profile.js"); m.saveProfile(m.loadProfile()); });
    await setProfile(p, { nickname: name, partyBest: { "memory|easy": pp }, stats: { ...(await profileOf(p)).stats, partyPoints: pp }, level: 3, rewardedLevel: 3 });
    await p.reload(); await p.waitForTimeout(250); return p;
  };
  const pA = await mk("Anna", 3000), pB = await mk("Bernd", 9000), pC = await mk("Clara", 1200);
  for (const p of [pA, pB, pC]) { await p.click("#btn-leaderboard"); await p.waitForSelector(".lb-row", { timeout: 8000 }); await p.waitForTimeout(1700); }
  await pC.click("#screen-leaderboard [data-back]"); await pC.click("#btn-leaderboard"); await pC.waitForSelector(".lb-row", { timeout: 8000 });
  const lbText = await pC.locator("#leaderboard-body").innerText();
  const rows = await pC.locator(".lb-row .lb-name").allInnerTexts();
  const pps = (await pC.locator(".lb-row .lb-pp").allInnerTexts()).map((t) => +t.replace(/\./g, ""));
  const lbNames = rows.map((r) => r.split("\n")[0].replace(/\s+$/, "").trim());
  check("Rangliste: absteigend nach Party-Punkten sortiert (Bernd vor Anna vor Clara)", pps.every((v, i) => i === 0 || pps[i - 1] >= v) && lbNames.indexOf("Bernd") < lbNames.indexOf("Anna") && lbNames.indexOf("Anna") < lbNames.indexOf("Clara"), lbNames.join(",") + " | " + pps.join(","));
  const myRank = lbNames.findIndex((n) => n.startsWith("Clara")) + 1;
  check("Rangliste: eigener Platz sichtbar und korrekt", new RegExp(`Dein Platz: #${myRank}`).test(lbText) && (await pC.locator(".lb-row--me").count()) === 1, `Platz ${myRank}`);
  check("Rangliste verwendet Party-Punkte", /Party-Punkte/.test(lbText) && /9\.000/.test(lbText));
  await pC.screenshot({ path: "/tmp/leaderboard.png" });
  // Namenskonflikt wird ehrlich gemeldet
  await pA.click("#screen-leaderboard [data-back]"); await pA.click("#btn-profile"); await pA.fill("#nick-input", "bernd"); await pA.click("#btn-nick-save"); await pA.waitForTimeout(1500);
  check("Doppelter Name wird gemeldet (keine stille Fälschung)", /schon vergeben/.test(await pA.locator("#nick-message").innerText()));
  // Offline: ehrliche Fehlermeldung, keine Fake-Einträge
  const pOff = await newPage({}, false); await pOff.goto("http://localhost:8123/index.html"); await pOff.waitForTimeout(250);
  await pOff.click("#btn-leaderboard"); await pOff.waitForSelector(".lb-state--error", { timeout: 8000 });
  check("Offline: Fehlermeldung statt Fake-Rangliste", (await pOff.locator(".lb-row").count()) === 0 && /nicht erreichbar/.test(await pOff.locator("#leaderboard-body").innerText()));
  // Server lehnt unplausible Werte ab
  const bad = await fetch("http://localhost:3001/leaderboard/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "x".repeat(30), name: "Cheater", pp: 99999999 }) });
  check("Server lehnt unmögliche Punktzahl ab", bad.status === 400);
  for (const p of [pA, pB, pC, pOff]) await p.context().close();

  // ============================== L. Mobile: Spielbereich größer
  const pm = await newPage({ viewport: { width: 375, height: 760 } }); await pm.goto("http://localhost:8123/index.html"); await pm.waitForTimeout(250);
  await pm.click("#btn-play"); await pm.locator(".arcade-card").filter({ hasText: "Obstkorb" }).click(); await pm.click('[data-arcade-difficulty="easy"]'); await pm.waitForTimeout(400);
  const dims = await pm.evaluate(() => ({ stage: document.querySelector("#arcade-stage").getBoundingClientRect().height, foot: document.querySelector(".site-footer").getBoundingClientRect().bottom, vh: innerHeight, scroll: document.documentElement.scrollHeight }));
  check("Mobile: Spielbereich deutlich größer als früher (>420px)", dims.stage > 480, JSON.stringify(dims));
  check("Mobile: Footer bleibt sichtbar ohne Scrollen", dims.foot <= dims.vh + 1 && dims.scroll <= dims.vh + 2, JSON.stringify(dims));
  await pm.screenshot({ path: "/tmp/mobile_game.png" });
  await pm.context().close();

  console.log("\nKonsolenfehler:", errors.length ? errors : "keine");
  console.log(`\n${oks.length} OK, ${fails.length} FEHLER`);
  if (fails.length) console.log("Fehlgeschlagen:", fails);
  await browser.close(); srv.close(); lb.kill();
  process.exit(fails.length || errors.length ? 1 : 0);
})().catch((e) => { console.error("TESTABBRUCH:", e.message); process.exit(2); });
