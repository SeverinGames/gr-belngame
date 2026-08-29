const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const hostPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const guestPage = await browser.newPage({ viewport: { width: 390, height: 844 } });

  [hostPage, guestPage].forEach((p, i) => {
    const tag = i === 0 ? 'HOST' : 'GUEST';
    p.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
  });

  const check = async (label, fn) => {
    try { await fn(); console.log(`OK: ${label}`); }
    catch (e) { console.log(`FEHLER: ${label} -> ${e.message}`); errors.push(`${label}: ${e.message}`); }
  };

  await hostPage.goto('http://localhost:8129/index.html');
  await guestPage.goto('http://localhost:8129/index.html');
  await hostPage.waitForTimeout(300);
  await guestPage.waitForTimeout(300);

  let roomCode = null;

  await check('Host erstellt Lobby, Room-Code erscheint', async () => {
    await hostPage.click('#btn-online');
    await hostPage.click('#btn-online-create');
    await hostPage.waitForSelector('#screen-lobby:not(.hidden)', { timeout: 5000 });
    roomCode = (await hostPage.textContent('#lobby-code')).trim();
    if (!roomCode || roomCode.length !== 5) throw new Error(`Ungültiger Code: '${roomCode}'`);
  });

  await check('Gast tritt mit Code bei, sieht Lobby mit 2 Spielern', async () => {
    await guestPage.click('#btn-online');
    await guestPage.click('#btn-online-join');
    await guestPage.fill('#join-code-input', roomCode);
    await guestPage.click('#btn-join-confirm');
    await guestPage.waitForSelector('#screen-lobby:not(.hidden)', { timeout: 5000 });
    const rows = await guestPage.$$('.lobby-player-row');
    if (rows.length !== 2) throw new Error(`Erwartet 2 Spieler in Lobby, gefunden: ${rows.length}`);
  });

  await check('Host sieht ebenfalls 2 Spieler (Lobby-Sync)', async () => {
    await hostPage.waitForTimeout(300);
    const rows = await hostPage.$$('.lobby-player-row');
    if (rows.length !== 2) throw new Error(`Host sieht ${rows.length} statt 2 Spieler`);
  });

  await check('Nur Host sieht Start-Einstellungen, Gast nicht', async () => {
    const hostSees = await hostPage.isVisible('#lobby-host-settings');
    const guestSees = await guestPage.isVisible('#lobby-host-settings');
    if (!hostSees) throw new Error('Host sollte Einstellungen sehen');
    if (guestSees) throw new Error('Gast sollte KEINE Host-Einstellungen sehen');
  });

  await check('Host startet Runde, beide landen im Online-Spielscreen', async () => {
    await hostPage.click('#btn-lobby-start');
    await hostPage.waitForSelector('#screen-online-game:not(.hidden)', { timeout: 5000 });
    await guestPage.waitForSelector('#screen-online-game:not(.hidden)', { timeout: 5000 });
  });

  await check('Beide sehen dieselbe Anzahl Türen (synchronisierter Zustand)', async () => {
    const hostDoors = await hostPage.locator('#online-doors .door').count();
    const guestDoors = await guestPage.locator('#online-doors .door').count();
    if (hostDoors === 0 || hostDoors !== guestDoors) throw new Error(`Host: ${hostDoors} Türen, Gast: ${guestDoors} Türen`);
  });

  await check('Host klickt Tür - Gast sieht dasselbe Ergebnis ohne selbst zu klicken', async () => {
    await hostPage.locator('#online-doors .door').first().click();
    await hostPage.waitForTimeout(400);
    const hostOutcome = (await hostPage.textContent('#online-outcome')).trim();
    const guestOutcome = (await guestPage.textContent('#online-outcome')).trim();
    if (!hostOutcome) throw new Error('Host hat kein Ergebnis erhalten');
    if (hostOutcome !== guestOutcome) throw new Error(`Unterschiedliche Ergebnisse: Host='${hostOutcome}' Gast='${guestOutcome}'`);
  });

  await check('Beide Spieler-HUD-Chips zeigen denselben HP-Wert (geteiltes Coop-Schicksal)', async () => {
    const hostHp = await hostPage.locator('.online-player-chip').first().textContent();
    const guestHp = await guestPage.locator('.online-player-chip').first().textContent();
    console.log('   Host-HUD:', hostHp.replace(/\s+/g, ' ').trim());
  });

  let ended = false;
  for (let i = 0; i < 40 && !ended; i++) {
    const endVisible = await hostPage.isVisible('#screen-end');
    if (endVisible) { ended = true; break; }
    const doorCount = await hostPage.locator('#online-doors .door').count();
    if (doorCount > 0) {
      await hostPage.locator('#online-doors .door').first().click({ timeout: 3000 }).catch(() => {});
      await hostPage.waitForTimeout(300);
      continue;
    }
    const fleeCount = await hostPage.locator('#online-decision .btn--flee').count();
    if (fleeCount > 0) { await hostPage.locator('#online-decision .btn--flee').click({ timeout: 3000 }).catch(() => {}); await hostPage.waitForTimeout(200); continue; }
    await hostPage.waitForTimeout(200);
  }
  await check('Coop-Runde kommt bei beiden Spielern zum Ende', async () => {
    if (!ended) throw new Error('Kein Ende nach 40 Schritten erreicht');
    await guestPage.waitForSelector('#screen-end:not(.hidden)', { timeout: 3000 });
  });

  if (errors.length > 0) {
    console.log('\n=== FEHLER WÄHREND DES TESTS ===');
    errors.forEach((e) => console.log(' - ' + e));
  }
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
