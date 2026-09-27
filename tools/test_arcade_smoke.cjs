const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // Genug Münzen vorab setzen, damit wir eine Box im Shop kaufen können.
  await page.addInitScript(() => {
    localStorage.setItem('nwo_profile_v1', JSON.stringify({ coins: 5000 }));
  });

  await page.goto('http://localhost:8123/index.html', { timeout: 8000 });
  await page.waitForTimeout(300);

  // --- 0) Branding ---
  const logoText = await page.locator('.logo--party').textContent();
  console.log('Logo-Text:', JSON.stringify(logoText));
  if (!logoText.includes('BIG SEVIS') || !logoText.includes('MINISPIEL PARTY')) {
    errors.push('Logo zeigt nicht "BIG SEVIS MINISPIEL PARTY"');
  }
  const tagline = await page.locator('.tagline').textContent();
  console.log('Tagline:', tagline);
  if (!tagline.includes('Big Sevis Minispiel Party')) errors.push('Tagline erwähnt den neuen Namen nicht');
  if (tagline.includes('Rein ins Ungewisse')) errors.push('Alter Begrüßungssatz ist noch da');
  const pageTitle = await page.title();
  console.log('Browser-Titel:', pageTitle);
  if (pageTitle !== 'Big Sevis Minispiel Party') errors.push('Browser-Titel falsch: ' + pageTitle);

  // Sicherstellen, dass NIRGENDS mehr Tür-Spiel-UI existiert
  const doorLeftovers = await page.locator('.doors, .door, .hud, .world-viewport, .joystick, #btn-arcade').count();
  if (doorLeftovers > 0) errors.push('Tür-Spiel-Überbleibsel im DOM gefunden: ' + doorLeftovers);

  // --- 1) SOLO: Minispiel -> Schwierigkeit -> Spiel -> Ergebnis ---
  await page.click('#btn-play');
  await page.waitForTimeout(150);
  const cardCount = await page.locator('.arcade-card').count();
  console.log('Anzahl Minispiel-Karten (SOLO):', cardCount);
  if (cardCount !== 8) errors.push(`Erwartet 8 Minispiel-Karten, gefunden ${cardCount}`);

  await page.locator('.arcade-card').filter({ hasText: 'Color Trick' }).click();
  await page.waitForTimeout(200);
  const difficultyVisible = await page.locator('#screen-arcade-difficulty').isVisible();
  console.log('Schwierigkeits-Screen sichtbar:', difficultyVisible);
  if (!difficultyVisible) errors.push('Schwierigkeits-Screen erscheint nicht nach Minispiel-Auswahl');
  await page.click('[data-arcade-difficulty="hard"]');
  await page.waitForTimeout(300);

  for (let round = 0; round < 14; round++) {
    const wordText = await page.locator('.ct-word').textContent().catch(() => null);
    if (!wordText) break;
    const options = page.locator('.ct-option');
    const optCount = await options.count();
    for (let j = 0; j < optCount; j++) {
      const t = await options.nth(j).textContent();
      if (t.trim() === wordText.trim()) { await options.nth(j).click(); break; }
    }
    await page.waitForTimeout(320);
  }
  await page.waitForTimeout(300);
  const resultVisible = await page.locator('#arcade-result').isVisible();
  console.log('SOLO Ergebnis-Screen sichtbar:', resultVisible);
  if (!resultVisible) errors.push('Color Trick zeigt keinen Ergebnis-Screen');
  const tierText = await page.locator('.arcade-result__tier').textContent().catch(() => null);
  const diffText = await page.locator('.arcade-result__difficulty').textContent().catch(() => null);
  console.log('Belohnungsstufe:', tierText, '| Schwierigkeit-Label:', diffText);
  if (!diffText || !diffText.includes('Schwer')) errors.push('Schwierigkeit "Schwer" wird im Ergebnis nicht angezeigt');
  await page.click('#btn-arcade-home');
  await page.waitForTimeout(200);

  const bestChip = await page.locator('.arcade-card').filter({ hasText: 'Color Trick' }).locator('.arcade-card__best').count();
  console.log('Highscore-Chip vorhanden:', bestChip > 0);
  if (bestChip === 0) errors.push('Kein Highscore-Chip nach abgeschlossener Runde');

  // --- 2) SHOP: Box kaufen -> Animation -> Skin im Spind ---
  await page.click('[data-back="screen-menu"]:visible');
  await page.waitForTimeout(150);
  await page.click('#btn-shop');
  await page.waitForTimeout(150);
  const boxCount = await page.locator('.shop-card').count();
  console.log('Anzahl Boxen im Shop:', boxCount);
  if (boxCount !== 3) errors.push('Erwartet 3 Boxen im Shop, gefunden ' + boxCount);
  const coinsBefore = await page.locator('#shop-coins').textContent();
  console.log('Münzen vor Kauf:', coinsBefore);

  await page.locator('.shop-card').filter({ hasText: 'Mega Box' }).locator('.shop-card__buy').click();
  await page.waitForTimeout(200);
  const overlayVisible = await page.locator('#mysterybox-animation').isVisible();
  console.log('Box-Öffnungsanimation sichtbar:', overlayVisible);
  if (!overlayVisible) errors.push('Box-Öffnungsanimation erscheint nicht nach Kauf');
  await page.waitForTimeout(1300);
  if (await page.locator('#mb-skip').isVisible()) await page.click('#mb-skip');
  await page.waitForTimeout(400);
  const revealName = await page.locator('#mb-reveal-name').textContent();
  console.log('Aus Mega Box gezogener Skin:', revealName);
  await page.click('#mb-continue');
  await page.waitForTimeout(300);
  const coinsAfter = await page.locator('#shop-coins').textContent();
  console.log('Münzen nach Kauf:', coinsAfter);
  if (coinsBefore === coinsAfter) errors.push('Münzen wurden beim Boxkauf nicht abgezogen');

  await page.click('[data-back="screen-menu"]:visible');
  await page.waitForTimeout(150);
  await page.click('#btn-locker');
  await page.waitForTimeout(200);
  const lockerCards = await page.locator('.locker-skin-card:not(.locker-skin-card--locked)').count();
  console.log('Freigeschaltete Skins im Spind:', lockerCards);
  if (lockerCards < 2) errors.push('Der gezogene Skin taucht nicht als freigeschaltet im Spind auf');

  // --- 3) Missionen & Daily ---
  await page.click('[data-back="screen-menu"]:visible');
  await page.waitForTimeout(150);
  await page.click('#btn-missions');
  await page.waitForTimeout(150);
  const missionRows = await page.locator('.mission-row').count();
  console.log('Anzahl Missionen:', missionRows);
  if (missionRows < 9) errors.push('Weniger Missionen als erwartet: ' + missionRows);
  const missionText = await page.locator('.mission-row').allTextContents();
  if (!missionText.some((t) => t.includes('🪙'))) errors.push('Missionsbelohnungen zeigen keine Münzen an');

  await page.click('[data-back="screen-menu"]:visible');
  await page.waitForTimeout(150);
  await page.click('#btn-daily');
  await page.waitForTimeout(150);
  const dailyStatus = await page.locator('#daily-status').textContent();
  console.log('Daily-Status:', dailyStatus);
  await page.click('#btn-daily-claim');
  await page.waitForTimeout(150);
  const dailyStatusAfter = await page.locator('#daily-status').textContent();
  console.log('Daily-Status nach Abholen:', dailyStatusAfter);
  if (dailyStatus === dailyStatusAfter) errors.push('Daily-Belohnung ändert den Status nach Abholen nicht');

  await browser.close();
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'KEINE JS-FEHLER, ALLE CHECKS OK');
  process.exit(errors.length ? 1 : 0);
})();
