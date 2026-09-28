const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('403')) errors.push('CONSOLE: ' + m.text());
  });

  await page.goto('http://localhost:8123/index.html', { timeout: 8000 });
  await page.waitForTimeout(300);

  // --- 1) Daily Reward: erste Abholung zeigt klares Feedback ---
  await page.click('#btn-daily');
  await page.waitForTimeout(150);
  const statusBefore = await page.locator('#daily-status').textContent();
  console.log('Daily-Status vor Abholen:', statusBefore);
  if (!statusBefore.includes('🪙')) errors.push('Daily-Vorschau zeigt keine konkrete Belohnung an');

  const coinsBeforeText = await page.evaluate(() => JSON.parse(localStorage.getItem('nwo_profile_v1') || '{"coins":0}').coins);
  await page.click('#btn-daily-claim');
  await page.waitForTimeout(200);
  const bannerVisible = await page.locator('#daily-claimed-banner').isVisible();
  const bannerText = await page.locator('#daily-claimed-banner').textContent();
  console.log('Banner sichtbar:', bannerVisible, '| Text:', bannerText);
  if (!bannerVisible) errors.push('Nach Abholen erscheint kein Bestätigungs-Banner');
  if (!bannerText.includes('erhalten')) errors.push('Banner-Text nennt die Belohnung nicht klar');
  const btnDisabled = await page.locator('#btn-daily-claim').isDisabled();
  if (!btnDisabled) errors.push('Abholen-Button ist nach Abholen nicht deaktiviert');
  const coinsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('nwo_profile_v1')).coins);
  console.log('Münzen vorher/nachher:', coinsBeforeText, '->', coinsAfter);
  if (coinsAfter <= coinsBeforeText) errors.push('Münzen wurden beim Daily-Claim nicht wirklich gutgeschrieben');

  // Zweiter Klick am selben Tag darf nichts mehr auslösen
  await page.click('#btn-daily-claim', { force: true }).catch(() => {});
  await page.waitForTimeout(150);
  const coinsAfterSecondClick = await page.evaluate(() => JSON.parse(localStorage.getItem('nwo_profile_v1')).coins);
  if (coinsAfterSecondClick !== coinsAfter) errors.push('Daily Reward konnte zweimal am selben Tag abgeholt werden!');

  // --- 2) Jackpot-Tag 7: freie Box wird tatsächlich geöffnet ---
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('nwo_profile_v1'));
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    p.dailyReward = { lastClaimDate: yesterday, streakDay: 6 };
    localStorage.setItem('nwo_profile_v1', JSON.stringify(p));
  });
  await page.reload();
  await page.waitForTimeout(300);
  await page.click('#btn-daily');
  await page.waitForTimeout(150);
  const day7Status = await page.locator('#daily-status').textContent();
  console.log('Status vor Tag-7-Abholung:', day7Status);
  await page.click('#btn-daily-claim');
  await page.waitForTimeout(200);
  const boxOverlayVisible = await page.locator('#mysterybox-animation').isVisible();
  console.log('Jackpot-Tag öffnet Box-Animation:', boxOverlayVisible);
  if (!boxOverlayVisible) errors.push('Tag-7-Belohnung (Gratis-Box) öffnet keine Box-Animation');
  await page.waitForTimeout(1300);
  if (await page.locator('#mb-skip').isVisible()) await page.click('#mb-skip');
  await page.waitForTimeout(400);
  await page.click('#mb-continue');
  await page.waitForTimeout(300);
  const bannerAfterBox = await page.locator('#daily-claimed-banner').textContent();
  console.log('Banner nach Jackpot-Box:', bannerAfterBox);

  // --- 3) Missionen: neue Anzahl + Box-/XP-Belohnungen sichtbar ---
  await page.click('[data-back="screen-menu"]:visible');
  await page.waitForTimeout(150);
  await page.click('#btn-missions');
  await page.waitForTimeout(150);
  const missionCount = await page.locator('.mission-row').count();
  console.log('Anzahl Missionen:', missionCount);
  if (missionCount !== 14) errors.push(`Erwartet 14 Missionen, gefunden ${missionCount}`);
  const missionTexts = await page.locator('.mission-row').allTextContents();
  if (!missionTexts.some((t) => t.includes('verschiedenen Tagen'))) errors.push('Mission "an mehreren Tagen spielen" fehlt');
  if (!missionTexts.some((t) => t.includes('hintereinander'))) errors.push('Mission "Runden hintereinander" fehlt');

  // --- 4) Creator Codes ---
  await page.click('[data-back="screen-menu"]:visible');
  await page.waitForTimeout(150);
  await page.click('#btn-shop');
  await page.waitForTimeout(150);
  const coinsBeforeCode = await page.evaluate(() => JSON.parse(localStorage.getItem('nwo_profile_v1')).coins);

  await page.fill('#creator-code-input', 'bigsevi');
  await page.click('#btn-creator-code-redeem');
  await page.waitForTimeout(200);
  const msg1 = await page.locator('#creator-code-message').textContent();
  console.log('Creator-Code (klein geschrieben) Ergebnis:', msg1);
  if (!msg1.includes('aktiviert')) errors.push('Kleingeschriebener Creator Code "bigsevi" wurde nicht akzeptiert');
  const coinsAfterCode = await page.evaluate(() => JSON.parse(localStorage.getItem('nwo_profile_v1')).coins);
  if (coinsAfterCode <= coinsBeforeCode) errors.push('Creator-Code-Belohnung wurde nicht gutgeschrieben');

  // Erneutes Einlösen desselben Codes muss abgelehnt werden
  await page.fill('#creator-code-input', 'BIGSEVI');
  await page.click('#btn-creator-code-redeem');
  await page.waitForTimeout(200);
  const msg2 = await page.locator('#creator-code-message').textContent();
  console.log('Erneutes Einlösen von BIGSEVI:', msg2);
  if (!msg2.includes('bereits')) errors.push('Mehrfaches Einlösen desselben Creator Codes wurde nicht verhindert');

  // LÖNDI mit Umlaut
  await page.fill('#creator-code-input', 'LÖNDI');
  await page.click('#btn-creator-code-redeem');
  await page.waitForTimeout(200);
  const msg3 = await page.locator('#creator-code-message').textContent();
  console.log('Creator-Code "LÖNDI" Ergebnis:', msg3);
  if (!msg3.includes('aktiviert')) errors.push('Creator Code "LÖNDI" (mit Umlaut) wurde nicht akzeptiert');

  // Ungültiger Code
  await page.fill('#creator-code-input', 'ZUFALLSCODE123');
  await page.click('#btn-creator-code-redeem');
  await page.waitForTimeout(200);
  const msg4 = await page.locator('#creator-code-message').textContent();
  console.log('Ungültiger Code Ergebnis:', msg4);
  if (!msg4.includes('Ungültig')) errors.push('Ungültiger Creator Code zeigt keine verständliche Fehlermeldung');

  await browser.close();
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'ALLE CHECKS OK (Teil 2)');
  process.exit(errors.length ? 1 : 0);
})();
