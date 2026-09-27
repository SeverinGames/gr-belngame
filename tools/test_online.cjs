const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  for (const [label, page] of [['A', pageA], ['B', pageB]]) {
    page.on('pageerror', (e) => errors.push(`PAGEERROR[${label}]: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().includes('403')) errors.push(`CONSOLE[${label}]: ${m.text()}`);
    });
  }

  await pageA.goto('http://localhost:8123/index.html');
  await pageB.goto('http://localhost:8123/index.html');
  await pageA.waitForTimeout(200);
  await pageB.waitForTimeout(200);

  // --- A erstellt eine Lobby ---
  await pageA.click('#btn-online');
  await pageA.waitForTimeout(150);
  await pageA.click('#btn-online-create');
  await pageA.waitForTimeout(600);
  const lobbyVisibleA = await pageA.locator('#screen-lobby').isVisible();
  console.log('Lobby sichtbar (Host A):', lobbyVisibleA);
  if (!lobbyVisibleA) errors.push('Host A landet nicht in der Lobby');
  const code = (await pageA.locator('#lobby-code').textContent()).trim();
  console.log('Room-Code:', code);
  const hostSettingsVisible = await pageA.locator('#lobby-host-settings').isVisible();
  console.log('Host-Einstellungen bei A sichtbar:', hostSettingsVisible);
  if (!hostSettingsVisible) errors.push('Host-Einstellungen (Minispiel-Auswahl) sind für den Host nicht sichtbar');

  // --- B tritt der Lobby bei ---
  await pageB.click('#btn-online');
  await pageB.waitForTimeout(150);
  await pageB.click('#btn-online-join');
  await pageB.waitForTimeout(150);
  await pageB.fill('#join-code-input', code);
  await pageB.click('#btn-join-confirm');
  await pageB.waitForTimeout(600);
  const lobbyVisibleB = await pageB.locator('#screen-lobby').isVisible();
  console.log('Lobby sichtbar (Beitreter B):', lobbyVisibleB);
  if (!lobbyVisibleB) errors.push('Spieler B kann der Lobby nicht beitreten');
  const bHostSettingsHidden = await pageB.locator('#lobby-host-settings').isVisible();
  if (bHostSettingsHidden) errors.push('Nicht-Host B sieht fälschlich die Host-Einstellungen');

  await pageA.waitForTimeout(300);
  const playerRowsA = await pageA.locator('.lobby-player-row').count();
  console.log('Spieleranzahl in Lobby (bei A sichtbar):', playerRowsA);
  if (playerRowsA !== 2) errors.push('Host sieht nicht beide Spieler in der Lobby: ' + playerRowsA);

  // --- Host wählt Balloon Pop und startet die Runde ---
  await pageA.selectOption('#lobby-game', 'balloonPop');
  await pageA.click('#btn-lobby-start');
  await pageA.waitForTimeout(500);

  const onlineGameVisibleA = await pageA.locator('#screen-online-game').isVisible();
  const onlineGameVisibleB = await pageB.locator('#screen-online-game').isVisible();
  console.log('Online-Minispiel-Screen sichtbar A/B:', onlineGameVisibleA, onlineGameVisibleB);
  if (!onlineGameVisibleA || !onlineGameVisibleB) errors.push('Online-Minispiel startet nicht bei beiden Spielern');
  const titleA = await pageA.locator('#online-play-title').textContent();
  console.log('Gestartetes Minispiel:', titleA);
  if (!titleA.includes('Balloon Pop')) errors.push('Falsches Minispiel gestartet: ' + titleA);

  // --- Beide "spielen" kurz mit (A pop mehr Ballons als B, damit ein klarer Sieger feststeht) ---
  async function popBalloons(page, count) {
    for (let i = 0; i < count; i++) {
      const balloon = page.locator('.bp-balloon').first();
      if (await balloon.count() === 0) { await page.waitForTimeout(200); continue; }
      const box = await balloon.boundingBox().catch(() => null);
      if (!box) { await page.waitForTimeout(150); continue; }
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(180);
    }
  }
  await popBalloons(pageA, 5);
  await popBalloons(pageB, 1);

  // --- Restliche Zeit der Runde (Balloon Pop läuft ~32s) abwarten, bis beide
  // Clients ihre Runde beendet und den Score an den Server gemeldet haben,
  // und prüfen, dass am Ende bei BEIDEN dieselbe, korrekt sortierte
  // Rangliste ankommt (Server ist die alleinige Quelle der Wahrheit).
  await pageA.waitForSelector('#screen-online-result:not(.hidden)', { timeout: 45000 });
  await pageB.waitForSelector('#screen-online-result:not(.hidden)', { timeout: 45000 });

  const rowsA = await pageA.locator('.online-leaderboard-row').allTextContents();
  const rowsB = await pageB.locator('.online-leaderboard-row').allTextContents();
  console.log('Rangliste bei A:', rowsA);
  console.log('Rangliste bei B:', rowsB);
  if (rowsA.length !== 2 || rowsB.length !== 2) errors.push('Rangliste zeigt nicht beide Spieler');
  const firstRowA = rowsA[0] || '';
  if (!firstRowA.includes('🏆')) errors.push('Erster Platz ist nicht als Sieger markiert');
  // A hat mehr Ballons gepoppt als B, sollte also vorne liegen
  const aIsFirst = firstRowA.includes('(Du)'); // bei A ist "Du" == Spieler A
  console.log('Spieler A liegt vorne:', aIsFirst);
  if (!aIsFirst) errors.push('Spieler mit mehr Punkten liegt nicht vorne in der Rangliste');

  const hostActionVisible = await pageA.locator('#btn-online-result-actions, .online-result-actions button').first().isVisible().catch(() => false);
  console.log('Aktions-Buttons nach Runde vorhanden:', hostActionVisible);

  await browser.close();
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'KEINE FEHLER - LOBBY/BEITRITT/RUNDENSTART FUNKTIONIEREN ECHT ÜBER DEN SERVER');
  process.exit(errors.length ? 1 : 0);
})();
