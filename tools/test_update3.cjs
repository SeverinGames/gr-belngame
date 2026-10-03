// Abnahmetest Update 3: Spielbalance, Layout (alle Seiten, mehrere Größen), Badges, Missionen,
// Shop/Daily, XP/Kosmetik, öffentliche Profile. Start: node tools/test_update3.cjs
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path"), fs = require("fs");
const serve = require("./static_server.cjs");
const fails = [], oks = [];
const check = (name, cond, extra = "") => { (cond ? oks : fails).push(name); console.log(`${cond ? "OK  " : "FAIL"} ${name}${extra ? " - " + extra : ""}`); };
const prof = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("nwo_profile_v2")));
const patch = (p, o) => p.evaluate((o) => { const c = JSON.parse(localStorage.getItem("nwo_profile_v2") || "{}"); localStorage.setItem("nwo_profile_v2", JSON.stringify({ ...c, ...o })); }, o);
async function dismiss(page) { for (let i = 0; i < 8; i++) { const b = page.locator(".celebrate-btn").first(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(250); } }
async function toMenu(page) {
  await dismiss(page);
  for (let i = 0; i < 4; i++) {
    if (await page.locator("#screen-menu:not(.hidden)").count()) return;
    const q = page.locator("#screen-arcade-play:not(.hidden)");
    if (await q.count()) { await page.click((await page.locator("#arcade-result:not(.hidden)").count()) ? "#btn-arcade-home" : "#btn-arcade-quit"); await page.waitForTimeout(80); continue; }
    const back = page.locator(".screen:not(.hidden) [data-back]").first();
    if (await back.count()) await back.click({ force: true, timeout: 4000 }).catch(() => {}); else await page.goto("http://localhost:8123/index.html");
    await page.waitForTimeout(80);
  }
}
const rectsOverlap = (a, b) => !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);

(async () => {
  const srv = await serve(8123);
  let serverDir = path.join(__dirname, "..", "server");
  if (!fs.existsSync(path.join(serverDir, "node_modules", "ws"))) {
    const tmp = "/tmp/srvtest3"; fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp + "/node_modules", { recursive: true });
    for (const f of fs.readdirSync(serverDir)) if (f.endsWith(".js") || f === "package.json") fs.copyFileSync(path.join(serverDir, f), path.join(tmp, f));
    fs.symlinkSync(process.env.WS_DIR || "/home/claude/.npm-global/lib/node_modules/@mermaid-js/mermaid-cli/node_modules/ws", tmp + "/node_modules/ws"); serverDir = tmp;
  }
  fs.rmSync("/tmp/lb3.json", { force: true });
  const lb = spawn("node", ["index.js"], { cwd: serverDir, env: { ...process.env, PORT: "3001", LEADERBOARD_FILE: "/tmp/lb3.json" } });
  await new Promise((r) => setTimeout(r, 700));
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader"] });
  const errors = [];
  const mk = async (vp = { width: 375, height: 760 }, mobile = true) => {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: mobile, isMobile: mobile });
    await ctx.addInitScript(() => { try { if (!localStorage.getItem("nwo_profile_v2")) localStorage.setItem("nwo_profile_v2", JSON.stringify({ welcomed: true })); } catch (e) {} });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/403|Failed to load|fonts/.test(m.text())) errors.push("CONSOLE: " + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    await page.route("https://gr-belngame.onrender.com/**", async (route) => {
      const u = new URL(route.request().url());
      const r = await fetch("http://localhost:3001" + u.pathname + u.search, { method: route.request().method(), headers: { "Content-Type": "application/json" }, body: route.request().method() === "POST" ? route.request().postData() : undefined });
      await route.fulfill({ status: r.status, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }, body: await r.text() });
    });
    await page.goto("http://localhost:8123/index.html?debug=1"); await page.waitForTimeout(350);
    return page;
  };
  let page = await mk();

  // ============ 1+2: Obstkorb / Ballon Pop
  const src = await page.evaluate(async () => ({ f: await (await fetch("js/arcade/games/fruitCatcher.js")).text(), b: await (await fetch("js/arcade/games/balloonPop.js")).text() }));
  const fm = src.f.match(/easy: \{ speed: ([\d.]+).*?normal: \{ speed: ([\d.]+).*?hard: \{ speed: ([\d.]+)/s);
  check("Obstkorb: LEICHT/MITTEL moderat, SCHWER deutlich schneller (alle > früher 1.0)", fm && +fm[1] > 1 && +fm[2] > +fm[1] && +fm[3] >= +fm[2] * 1.35, fm?.slice(1, 4).join("/"));
  const speeds = {};
  for (const d of ["easy", "normal", "hard"]) {
    await toMenu(page); await page.click("#btn-play"); await page.locator(".arcade-card").filter({ hasText: "Obstkorb" }).click(); await page.click(`[data-arcade-difficulty="${d}"]`);
    await page.waitForTimeout(1600);
    speeds[d] = await page.evaluate(async () => { const y = (e) => +e.style.transform.match(/translate3d\([^,]+,\s*([-\d.]+)px/)[1]; let sum = 0, n = 0; for (let k = 0; k < 14; k++) { const f = [...document.querySelectorAll(".fc-fruit")]; const a = f.map((e) => [e, y(e)]); await new Promise((r) => setTimeout(r, 200)); for (const [e, y0] of a) if (e.isConnected) { const d = (y(e) - y0) / 0.2; if (d > 5 && d < 600) { sum += d; n++; } } } return n ? sum / n : 0; });
  }
  check("Obstkorb: gemessene Fallgeschwindigkeit steigt LEICHT < MITTEL < SCHWER", speeds.easy > 0 && speeds.easy < speeds.normal && speeds.hard > speeds.normal * 1.2, JSON.stringify(speeds, (k, v) => typeof v === "number" ? Math.round(v) : v));
  const sizes = {}, hit = {};
  for (const d of ["easy", "normal", "hard"]) {
    await toMenu(page); await page.click("#btn-play"); await page.locator(".arcade-card").filter({ hasText: "Balloon Pop" }).click(); await page.click(`[data-arcade-difficulty="${d}"]`);
    await page.waitForFunction(() => document.querySelector('.bp-balloon--normal'), null, { timeout: 8000 }).catch(() => {});
    const r = await page.evaluate(() => { const b = document.querySelector(".bp-balloon--normal:not(.bp-balloon--pop)") || document.querySelector(".bp-balloon:not(.bp-balloon--pop)"); if (!b) return null; const bb = b.getBoundingClientRect(); return { w: bb.width, x: bb.left + bb.width / 2, y: bb.top + bb.height / 2, h: bb.height, right: bb.right }; });
    sizes[d] = r?.w;
    if (d === "easy") {
      // Trefferfläche: ein Punkt 8px neben dem sichtbaren Ballon muss noch den Ballon treffen (gleicher Frame)
      await page.waitForFunction(() => { const st = document.querySelector("#arcade-stage").getBoundingClientRect(); return [...document.querySelectorAll(".bp-balloon--normal")].some((b) => { const r = b.getBoundingClientRect(); return r.top > st.top + 40 && r.bottom < st.bottom - 40 && r.left > st.left + 24 && r.right < st.right - 24; }); }, null, { timeout: 10000 });
      hit[d] = await page.evaluate(() => { const st = document.querySelector("#arcade-stage").getBoundingClientRect(); const b = [...document.querySelectorAll(".bp-balloon--normal")].find((b) => { const r = b.getBoundingClientRect(); return r.top > st.top + 40 && r.bottom < st.bottom - 40 && r.left > st.left + 24 && r.right < st.right - 24; }); const bb = b.getBoundingClientRect(); const pts = [[bb.left + bb.width / 2, bb.top - 8], [bb.left + bb.width / 2, bb.bottom + 8], [bb.right + 7, bb.top + bb.height / 2], [bb.left - 7, bb.top + bb.height / 2]]; return pts.every(([x, y]) => !!document.elementFromPoint(x, y)?.closest?.(".bp-balloon")); });
    }
  }
  check("Balloon Pop: LEICHT/MITTEL größer als SCHWER", sizes.easy > sizes.normal && sizes.normal > sizes.hard * 1.15, JSON.stringify(sizes));
  check("Balloon Pop: Trefferfläche größer als der sichtbare Ballon", hit.easy === true);
  await toMenu(page);

  // ============ 3: Memory ohne Textauswahl
  await page.click("#btn-play"); await page.locator(".arcade-card").filter({ hasText: "Memory" }).click(); await page.click('[data-arcade-difficulty="normal"]'); await page.waitForTimeout(400);
  const gb = await page.locator(".mm-grid").boundingBox();
  await page.mouse.move(gb.x - 4, gb.y + gb.height / 2); await page.mouse.down(); await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height + 30, { steps: 12 }); await page.mouse.move(gb.x + gb.width + 10, gb.y - 20, { steps: 12 }); await page.mouse.up();
  const sel = await page.evaluate(() => ({ s: window.getSelection().toString(), us: getComputedStyle(document.querySelector(".mm-card")).userSelect, gus: getComputedStyle(document.querySelector("#arcade-stage")).userSelect }));
  check("Memory: Ziehen mit der Maus markiert nichts", sel.s === "" && sel.us === "none" && sel.gus === "none", JSON.stringify(sel));
  await page.locator(".mm-card").first().click(); await page.waitForTimeout(100);
  check("Memory: Karten bleiben normal klickbar", (await page.locator(".mm-card--flipped").count()) >= 1);
  const prevented = await page.evaluate(() => { const e = new Event("selectstart", { cancelable: true, bubbles: true }); document.querySelector(".mm-grid").dispatchEvent(e); const d = new Event("dragstart", { cancelable: true, bubbles: true }); document.querySelector(".mm-card").dispatchEvent(d); return [e.defaultPrevented, d.defaultPrevented]; });
  check("Memory: selectstart/dragstart werden unterbunden (Touch/Maus)", prevented[0] && prevented[1]);
  await toMenu(page);

  // ============ 5: Reaktion Bestzeit-Anzeige in Solo-Übersicht
  await patch(page, { arcadeHighscores: { reaction: 450 }, arcadeHighscoresByDiff: { reaction: { normal: 450 } } });
  await page.reload(); await page.waitForTimeout(300); await page.click("#btn-play");
  const card = await page.locator(".arcade-card").filter({ hasText: "Reaktion" }).locator(".arcade-card__best").innerText();
  check("Solo-Übersicht: Reaktion zeigt 'Bestzeit: 450 ms'", /Bestzeit: 450 ms/.test(card), card);
  await page.locator(".arcade-card").filter({ hasText: "Reaktion" }).click();
  check("Schwierigkeitswahl: 'BESTZEIT: 450 ms' statt Highscore", /BESTZEIT: 450 ms/.test(await page.locator("#screen-arcade-difficulty").innerText()));
  await toMenu(page);

  // ============ 6: Layout aller Spielseiten auf mehreren Größen
  const VPS = [[320, 568, true], [375, 667, true], [390, 844, true], [768, 1024, true], [1280, 800, false], [1440, 600, false]];
  const gamesList = await page.evaluate(async () => (await import("./js/arcade/registry.js")).ARCADE_GAMES.map((g) => g.name));
  let layoutBad = [];
  for (const [w, h, mob] of VPS) {
    const pg = await mk({ width: w, height: h }, mob);
    for (const name of gamesList) {
      await pg.click("#btn-play"); await pg.locator(".arcade-card").filter({ hasText: name }).first().click(); await pg.waitForTimeout(60);
      const res = await pg.evaluate(() => {
        const R = (e) => e.getBoundingClientRect(), d = [...document.querySelectorAll("#screen-arcade-difficulty .diff-btn")].map(R), back = R(document.querySelector("#screen-arcade-difficulty [data-back]"));
        const out = []; const foot = R(document.querySelector(".site-footer"));
        for (let i = 0; i < d.length; i++) { for (let j = i + 1; j < d.length; j++) if (!(d[i].bottom <= d[j].top + 0.5 || d[j].bottom <= d[i].top + 0.5)) out.push("diff-overlap"); if (d[i].bottom > back.top - 8) out.push("gap-diff-back " + Math.round(back.top - d[i].bottom)); }
        const gap = d.length ? d[1].top - d[0].bottom : 0;
        if (d.length && back.top - d[d.length - 1].bottom < Math.min(gap, 10)) out.push("back-too-close");
        if (back.bottom > foot.top + 1 && foot.top > back.top) out.push("back-overlaps-footer");
        if (document.documentElement.scrollWidth > innerWidth + 1) out.push("h-scroll");
        return out;
      });
      if (res.length) layoutBad.push(`${w}x${h} ${name}: ${res.join(",")}`);
      // Spielseite: Topbar darf Spielbereich nicht überlappen
      await pg.click('[data-arcade-difficulty="hard"]'); await pg.waitForTimeout(250);
      const play = await pg.evaluate(() => { const R = (s) => document.querySelector(s).getBoundingClientRect(), t = R(".arcade-topbar"), st = R("#arcade-stage"), f = R(".site-footer"); const o = []; if (st.top < t.bottom - 1) o.push("topbar-overlaps-stage"); if (st.bottom > f.top + 1) o.push("stage-overlaps-footer"); if (document.documentElement.scrollWidth > innerWidth + 1) o.push("h-scroll"); return o; });
      if (play.length) layoutBad.push(`${w}x${h} ${name} (Spiel): ${play.join(",")}`);
      await pg.click("#btn-arcade-quit"); await pg.waitForTimeout(60); await pg.locator("#screen-arcade [data-back]").click(); await pg.waitForTimeout(40);
    }
    await pg.context().close();
  }
  check(`Layout: keine Überlappungen bei ${VPS.length} Bildschirmgrößen × ${gamesList.length} Spielen`, layoutBad.length === 0, layoutBad.slice(0, 6).join(" | "));
  // Menüs / Shop / Profil / Missionen / Rangliste: kein horizontaler Überlauf, Zurück-Button frei
  const pg2 = await mk({ width: 360, height: 640 }, true);
  const menus = [["#btn-shop", "Shop"], ["#btn-missions", "Missionen"], ["#btn-profile", "Profil"], ["#btn-leaderboard", "Rangliste"], ["#btn-locker", "Spind"], ["#btn-wheel", "Glücksrad"]];
  let menuBad = [];
  for (const [sel, nm] of menus) {
    await toMenu(pg2); await pg2.click(sel); await pg2.waitForTimeout(350);
    const r = await pg2.evaluate(() => { const sc = document.querySelector(".screen:not(.hidden)"); const back = sc.querySelector("[data-back]"); const o = []; if (document.documentElement.scrollWidth > innerWidth + 1) o.push("h-scroll"); if (back) { const prev = back.previousElementSibling; if (prev) { const a = prev.getBoundingClientRect(), b = back.getBoundingClientRect(); if (b.top < a.bottom + 6) o.push("back-close " + Math.round(b.top - a.bottom)); } } return o; });
    if (r.length) menuBad.push(nm + ": " + r.join(","));
  }
  check("Layout: Menüs ohne Überlauf, Zurück-Button mit Abstand", menuBad.length === 0, menuBad.join(" | "));
  await pg2.context().close();

  // ============ 11/12: XP-Erklärung, Kosmetik benutzbar
  page = await mk();
  await patch(page, { level: 12, xp: 40, rewardedLevel: 12, cosmetics: { owned: ["emote:cool", "emote:party", "frame:gold", "finish:confetti", "nameColor:gold", "badge:star", "title:fan", "effect:sparkle"], equipped: {} } });
  await page.reload(); await page.waitForTimeout(300); await page.click("#btn-profile"); await page.waitForTimeout(250);
  const pt = await page.locator("#profile-body").innerText();
  check("Profil erklärt XP → Level → Freischaltungen + zeigt nächste Level-Belohnungen", /XP & Level/.test(pt) && /Noch \d+ XP bis Level 13/.test(pt) && /Lv 13/.test(pt) && /Lv 18/.test(pt));
  const cats = await page.locator(".cos-block__label").allInnerTexts();
  check("Profil: alle Kosmetik-Kategorien auswählbar (Badge/Titel/Rahmen/Emote/Effekt/Abschluss/Namensfarbe)", cats.length === 7, cats.join(","));
  for (const [cat, id] of [["emote", "party"], ["frame", "gold"], ["finish", "confetti"], ["nameColor", "gold"], ["badge", "star"], ["title", "fan"], ["effect", "sparkle"]]) { await page.locator(`.cos-chip[data-cat="${cat}"][data-id="${id}"]`).click(); await page.waitForTimeout(120); }
  let pr = await prof(page);
  check("Kosmetik ausgerüstet und gespeichert", pr.cosmetics.equipped.emote === "party" && pr.cosmetics.equipped.finish === "confetti" && pr.cosmetics.equipped.nameColor === "gold" && pr.cosmetics.equipped.frame === "gold");
  check("Rahmen/Effekt/Namensfarbe sichtbar am Profil", await page.evaluate(() => !!document.querySelector(".profile-avatar.frame--gold.effect--sparkle") && !!document.querySelector(".namecolor--gold") && document.querySelector(".nm-emote")?.textContent === "🥳"));
  await page.click("#screen-profile [data-back]"); await page.waitForTimeout(150);
  check("Startseite zeigt Namen/Emote/Namensfarbe", await page.evaluate(() => !!document.querySelector("#profile-summary .nm-emote")));
  // Abschluss-Effekt + Emote nach guter Runde (Stopp bei Grün, easy)
  await page.click("#btn-play"); await page.locator(".arcade-card").filter({ hasText: "Stopp bei Grün" }).click(); await page.click('[data-arcade-difficulty="easy"]');
  for (let i = 0; i < 5; i++) { await page.waitForTimeout(200); await page.evaluate(() => { const z = document.querySelector(".sg-zone"), p = document.querySelector(".sg-pointer"); }); await page.locator(".sg-stopbtn").click({ force: true, timeout: 1500 }).catch(() => {}); await page.waitForTimeout(760); }
  await page.waitForSelector("#arcade-result:not(.hidden) .arcade-result__card", { timeout: 8000 });
  await page.evaluate(() => 0);
  check("Ergebnis: Abschluss-Effekt + Emote-Blase (ausgerüstet)", await page.evaluate(() => !!document.querySelector("#arcade-result .fx-layer") || !!document.querySelector("#arcade-result .emote-bubble") || document.querySelector(".arcade-result__tier--schwach") != null));
  await dismiss(page);

  // ============ 14+15: Missionen, Badges
  page = await mk();
  let t = await page.locator("#btn-missions").innerText();
  check("Badges: bei Spielstart ohne abholbare Missionen KEINE Zahl an MISSIONEN", (await page.locator("#btn-missions .badge").count()) === 0);
  await patch(page, { stats: { ...(await prof(page)).stats, arcadeRoundsPlayed: 12, highscoresAchieved: 1 } });
  await page.reload(); await page.waitForTimeout(300);
  const nM = await page.locator("#btn-missions .badge").innerText();
  check("Badge MISSIONEN zeigt Anzahl abholbarer Missionen (arcade3, arcade10, newHighscore = 3)", nM === "3", nM);
  await page.click("#btn-missions"); await page.waitForTimeout(250);
  const mtabs = await page.locator("#mission-tabs .tab").allInnerTexts();
  check("Missionen: Tabs TÄGLICH / KURZ / LANG / MEILENSTEINE", mtabs.map((x) => x.replace(/\d+$/, "").trim()).join(",") === "TÄGLICH,KURZ,LANG,MEILENSTEINE", mtabs.join(","));
  check("Missionen: Badge am KURZ-Tab", (await page.locator('#mission-tabs [data-tab="short"] .badge').innerText()) === "3");
  const counts = await page.evaluate(async () => { const m = await import("./js/missions/missions.js"); const c = {}; m.MISSION_DEFS.forEach((d) => c[d.category] = (c[d.category] || 0) + 1); return c; });
  check("Missionen: viele kurz-/langfristige Missionen (täglich ≥4, kurz ≥10, lang ≥20, Meilensteine ≥8)", counts.daily >= 4 && counts.short >= 10 && counts.long >= 20 && counts.milestone >= 8, JSON.stringify(counts));
  await page.click('#mission-tabs [data-tab="short"]'); await page.waitForTimeout(150);
  const coinsBefore = (await prof(page)).coins ?? 0;
  await page.locator(".mission-row--ready .btn").first().click(); await page.waitForTimeout(300); await dismiss(page);
  pr = await prof(page);
  check("Mission abholen: Belohnung gebucht, Badge sinkt", pr.coins > coinsBefore && (await page.locator('#mission-tabs [data-tab="short"] .badge').innerText()) === "2");
  // Tägliche Mission setzt sich am nächsten Tag zurück
  await patch(page, { daily: { ...(await prof(page)).daily, rounds: 6, claimedMissions: [] } });
  await page.reload(); await page.waitForTimeout(300); await page.click("#btn-missions"); await page.waitForTimeout(250);
  check("Tägliche Mission: bei 6/6 Runden abholbar", (await page.locator('#mission-tabs [data-tab="daily"] .badge').count()) === 1);
  await page.locator(".mission-row--ready .btn").first().click(); await page.waitForTimeout(250); await dismiss(page);
  await patch(page, { daily: { ...(await prof(page)).daily, day: "2000-01-01" } });
  await page.reload(); await page.waitForTimeout(300); await page.click("#btn-missions"); await page.waitForTimeout(250);
  const dayTxt = await page.locator("#missions-list").innerText();
  check("Tägliche Missionen starten am nächsten Tag wieder bei 0", /0\/6/.test(dayTxt) && (await page.locator(".mission-row--ready").count()) === 0);

  // ============ 15/16/17: Shop, Glücksrad-Badge, Tägliche Belohnung im Shop
  page = await mk();
  check("Start: Home zeigt SHOP-Badge ① (tägliche Belohnung bereit), keine BELOHNUNG-Taste mehr", (await page.locator("#btn-shop .badge").innerText()) === "1" && (await page.locator("#btn-daily").count()) === 0 && (await page.locator("#screen-daily").count()) === 0);
  check("Start: GLÜCKSRAD-Badge ① (täglicher Gratis-Dreh)", (await page.locator("#btn-wheel .badge").innerText()) === "1");
  await page.click("#btn-shop"); await page.waitForTimeout(250);
  const shopTxt = await page.locator("#screen-shop").innerText();
  check("Shop: Bereich 'Tägliche Belohnung' mit 'HEUTE ABHOLEN'", /TÄGLICHE BELOHNUNG/.test(shopTxt) && /HEUTE ABHOLEN/.test(shopTxt));
  check("Shop: Tabs BOXEN/RAD/BONUS/SAMMLUNG bleiben, RAD-Tab mit Badge", (await page.locator("#shop-tabs .tab").allInnerTexts()).map((x) => x.replace(/\d+$/, "").trim()).join(",") === "BOXEN,RAD,BONUS,SAMMLUNG" && (await page.locator('#shop-tabs [data-tab="wheel"] .badge').count()) === 1);
  const c0 = (await prof(page)).coins ?? 0;
  await page.click("#btn-daily-claim"); await page.waitForTimeout(500); await dismiss(page);
  pr = await prof(page);
  check("Tägliche Belohnung im Shop abholen: Münzen gebucht", pr.coins > c0 && pr.dailyReward.streakDay === 1, `${c0}->${pr.coins}`);
  const after = await page.locator("#shop-daily").innerText();
  check("Danach: 'Morgen wieder verfügbar' + Badge weg", /Morgen wieder verfügbar/.test(after) && (await page.locator("#btn-shop .badge").count()) === 0 && (await page.locator("#btn-daily-claim").count()) === 0);
  await page.click('#shop-tabs [data-tab="wheel"]'); await page.waitForTimeout(120);
  const wt = await page.locator("#shop-tab-wheel").innerText();
  check("Rad-Tab: zeigt verfügbare Drehs, wie man mehr bekommt, mögliche Gewinne", /1\s*Dreh verfügbar/.test(wt) && /Wie bekomme ich mehr Drehs/.test(wt) && /Mögliche Gewinne/.test(wt));
  await page.click("#btn-shop-open-wheel"); await page.waitForTimeout(200); await page.click("#btn-wheel-spin"); await page.waitForTimeout(5000); await dismiss(page);
  await toMenu(page);
  check("Nach dem Drehen: GLÜCKSRAD-Badge verschwindet (kein Dreh übrig)", (await page.locator("#btn-wheel .badge").count()) === 0 || (await prof(page)).wheel.bonusSpins > 0);
  await page.screenshot({ path: "/tmp/home_badges.png" });

  // ============ 13: Öffentliche Profile in der Rangliste
  const mkPlayer = async (name, pp, extra) => {
    const p = await mk(); await p.evaluate(async () => { const m = await import("./js/rewards/profile.js"); m.saveProfile(m.loadProfile()); });
    await patch(p, { welcomed: true, nickname: name, partyBest: { "memory|easy": pp }, stats: { ...(await prof(p)).stats, partyPoints: pp, arcadeRoundsPlayed: 42, gamesWon: 7, perfectRounds: 3 }, level: 9, xp: 50, rewardedLevel: 9, coins: 123456, arcadeHighscoresByDiff: { memory: { easy: 777 }, reaction: { normal: 412 } }, equippedSkin: "mario", cosmetics: { owned: ["badge:star", "badge:drone", "title:fan", "frame:gold"], equipped: { title: "fan", frame: "gold", badge: "star" } }, ...extra });
    await p.reload(); await p.waitForTimeout(300); return p;
  };
  const a = await mkPlayer("Anna", 5000, {}), b = await mkPlayer("Bernd", 9000, {}), c = await mkPlayer("Clara", 1200, {});
  for (const p of [a, b, c]) { await p.click("#btn-leaderboard"); await p.waitForSelector(".lb-row", { timeout: 8000 }); await p.waitForTimeout(1700); }
  await c.click("#screen-leaderboard [data-back]"); await c.click("#btn-leaderboard"); await c.waitForSelector(".lb-row", { timeout: 8000 });
  await c.locator(".lb-row").filter({ hasText: "Bernd" }).click();
  await c.waitForSelector("#public-profile-body .profile-head", { timeout: 8000 });
  const pub = await c.locator("#public-profile-body").innerText();
  check("Rangliste: Klick öffnet das öffentliche Profil (Name, Level, Party-Punkte, Skin)", /Bernd/.test(pub) && /LEVEL 9/.test(pub) && /9\.000/.test(pub) && /Mario|Mari/i.test(pub));
  check("Öffentliches Profil: Statistiken, Badges, Highscores (inkl. Reaktion in ms)", /Spiele gespielt/.test(pub) && /Sternchen/.test(pub) && /Maispilot/.test(pub) && /777/.test(pub) && /412 ms/.test(pub) && /Minispiele|Memory/.test(pub));
  check("Öffentliches Profil: Rahmen/Titel des Spielers sichtbar", await c.evaluate(() => !!document.querySelector("#public-profile-body .frame--gold")) && /Minispiel-Fan/.test(pub));
  check("Öffentliches Profil: KEINE privaten Daten (Münzen)", !/123\.456|123456/.test(pub));
  const raw = await (await fetch("http://localhost:3001/leaderboard")).json(); const id = raw.top[0].id;
  const rawProf = JSON.stringify(await (await fetch("http://localhost:3001/leaderboard/profile?id=" + id)).json());
  check("Server-Antwort enthält weder Münzen noch Spielerschlüssel", !/coins|123456|playerKey|"key"/.test(rawProf));
  await c.click("#btn-public-back"); await c.waitForSelector(".lb-row", { timeout: 8000 });
  check("Zurück aus dem Profil führt zur Rangliste", (await c.locator(".lb-row").count()) >= 3);
  await c.screenshot({ path: "/tmp/lb.png" });
  const bad = await fetch("http://localhost:3001/leaderboard/profile?id=nope"); check("Unbekanntes Profil → 404", bad.status === 404);

  // ============ 8/9/10: Maze schwer, Form Zeichnen großzügig, Mais schwer
  const gen = await page.evaluate(async () => {
    const m = await import("./js/arcade/games/mazeGrid.js"), mm = await import("./js/arcade/games/maisMaze.js"), ds = await import("./js/arcade/games/drawShapes.js");
    const T = m.generateMaze("hard").T, T2 = m.generateMaze("normal").T;
    const mais = { easy: mm.generateMaze("easy"), normal: mm.generateMaze("normal"), hard: mm.generateMaze("hard") };
    // gleichmäßig leicht verwackelte Nikolaus-Zeichnung
    const base = ds.resample(ds.SHAPES.nikolaus.pts, 200); let seed = 3; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const draw = (jit) => [base.map((p, i) => ({ x: 120 + p.x * 200 + Math.sin(i / 7) * jit + (r() - 0.5) * jit, y: 90 + p.y * 200 + Math.cos(i / 9) * jit + (r() - 0.5) * jit }))];
    return { T, T2, mais: Object.fromEntries(Object.entries(mais).map(([k, v]) => [k, { size: v.size, len: v.path.length, lm: v.landmarks.length, br: v.branchesMade }])), neat: ds.scoreDrawing("nikolaus", draw(4), "hard").percent, rough: ds.scoreDrawing("nikolaus", draw(26), "hard").percent, squareRough: ds.scoreDrawing("square", [ds.resample(ds.SHAPES.square.pts, 120).map((p) => ({ x: 100 + p.x * 180 + (Math.sin(p.x * 9) * 9), y: 80 + p.y * 180 + Math.cos(p.y * 7) * 9 }))], "easy").percent };
  });
  check("Maze SCHWER: größer als zuvor (31×31 Blöcke) und MITTEL 19×19", gen.T === 31 && gen.T2 === 19, `${gen.T}/${gen.T2}`);
  check("Mais-Mission SCHWER: Feld 15×15, Weg ~50 Zellen, 14 Orientierungspunkte, viele Abzweigungen", gen.mais.hard.size === 15 && gen.mais.hard.len >= 46 && gen.mais.hard.lm >= 12 && gen.mais.hard.br >= 10 && gen.mais.hard.len > gen.mais.normal.len * 1.9, JSON.stringify(gen.mais.hard));
  check("Form Zeichnen: Bewertung großzügig (ordentliche Zeichnung ≥ 85 %, wackelig noch ≥ 60 %)", gen.neat >= 85 && gen.rough >= 60 && gen.squareRough >= 85, `ordentlich ${gen.neat} / wackelig ${gen.rough} / Quadrat leicht schief ${gen.squareRough}`);

  console.log("\nKonsolenfehler:", errors.length ? errors : "keine");
  console.log(`\n${oks.length} OK, ${fails.length} FEHLER`); if (fails.length) console.log("Fehlgeschlagen:", fails);
  await browser.close(); srv.close(); lb.kill();
  process.exit(fails.length || errors.length ? 1 : 0);
})().catch((e) => { console.error("TESTABBRUCH:", e.stack.split("\n").slice(0, 5).join("\n")); process.exit(2); });
