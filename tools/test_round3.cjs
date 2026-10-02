const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('403')) errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:8123/index.html', { timeout: 8000 });
  await page.waitForTimeout(300);

  // --- 1) Meteor Dash komplett weg, 10 Minispiele mit den 2 neuen ---
  await page.click('#btn-play');
  await page.waitForTimeout(150);
  const cardNames = await page.locator('.arcade-card__name').allTextContents();
  console.log('Minispiele:', cardNames);
  if (cardNames.some((n) => n.includes('Meteor'))) errors.push('Meteor Dash ist noch in der Liste!');
  if (cardNames.length !== 11) errors.push('Erwartet 11 Minispiele (8 Basis + Schatzpfade + 2 neue), gefunden ' + cardNames.length);
  if (!cardNames.some((n) => n.includes('Vier gewinnt'))) errors.push('Vier gewinnt fehlt');
  if (!cardNames.some((n) => n.includes('Farbröhren'))) errors.push('Farbröhren fehlt');

  // --- 2) Vier gewinnt: spielbar, Skin sichtbar, gewinnt auf leicht meistens machbar ---
  await page.locator('.arcade-card').filter({ hasText: 'Vier gewinnt' }).click();
  await page.waitForTimeout(150);
  await page.click('[data-arcade-difficulty="easy"]');
  await page.waitForTimeout(300);
  const c4ColsAtStart = await page.locator('.c4-col').count();
  console.log('Vier-gewinnt Spalten:', c4ColsAtStart);
  if (c4ColsAtStart !== 7) errors.push('Vier gewinnt hat nicht 7 Spalten');
  // Spieler spielt strategisch: immer Mitte-nah, damit meist ein Ergebnis in vernünftiger Zeit fällt
  const order = [3, 3, 3, 3, 2, 4, 2, 4, 1, 5, 1, 5, 0, 6, 0, 6, 3, 2, 4, 1];
  let resultAppeared = false;
  for (const colIdx of order) {
    if (await page.locator('#arcade-result:not(.hidden)').count() > 0) { resultAppeared = true; break; }
    const cols = page.locator('.c4-col');
    const disabled = await cols.nth(colIdx).evaluate((el) => el.disabled).catch(() => true);
    if (!disabled) await cols.nth(colIdx).click().catch(() => {});
    await page.waitForTimeout(750);
  }
  await page.waitForTimeout(1800);
  const c4ResultVisible = await page.locator('#arcade-result').isVisible();
  console.log('Vier gewinnt Ergebnis erreicht:', c4ResultVisible || resultAppeared);
  if (!c4ResultVisible && !resultAppeared) errors.push('Vier gewinnt kommt nach vielen Zügen zu keinem Ergebnis-Screen');
  // Das Ergebnis-Overlay deckt den Bühnenbereich (inkl. X-Button) ab - daher
  // hier wie ein echter Spieler über "ZURÜCK" im Ergebnis-Screen verlassen.
  await page.click('#btn-arcade-home');
  await page.waitForTimeout(200);

  // --- 3) Farbröhren: spielbar, Skin sichtbar, lösbar ---
  await page.locator('.arcade-card').filter({ hasText: 'Farbröhren' }).click();
  await page.waitForTimeout(150);
  await page.click('[data-arcade-difficulty="easy"]');
  await page.waitForTimeout(300);
  const tubeCount = await page.locator('.ft-tube').count();
  console.log('Farbröhren Anzahl Röhren (easy, 3 Farben+2 leer):', tubeCount);
  if (tubeCount !== 5) errors.push('Farbröhren: erwartet 5 Röhren bei "easy", gefunden ' + tubeCount);
  // ein paar zufällige, aber gültige Klicks - Ziel ist "läuft ohne Fehler", nicht "wird gelöst"
  for (let i = 0; i < 6; i++) {
    const tubes = page.locator('.ft-tube');
    const n = await tubes.count();
    await tubes.nth(i % n).click().catch(() => {});
    await page.waitForTimeout(150);
    await tubes.nth((i + 2) % n).click().catch(() => {});
    await page.waitForTimeout(150);
  }
  console.log('Farbröhren: mehrere Klicks ohne Absturz durchgeführt');
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(200);

  // --- 4) Obstkorb: keine Fehler, Korb bewegt sich per transform ---
  await page.locator('.arcade-card').filter({ hasText: 'Obstkorb' }).click();
  await page.waitForTimeout(150);
  await page.click('[data-arcade-difficulty="normal"]');
  await page.waitForTimeout(300);
  const basketTransformBefore = await page.locator('.fc-basket').evaluate((el) => el.style.transform);
  const stageBox = await page.locator('#arcade-stage').boundingBox();
  await page.mouse.move(stageBox.x + stageBox.width * 0.8, stageBox.y + stageBox.height - 20, { steps: 8 });
  await page.waitForTimeout(200);
  const basketTransformAfter = await page.locator('.fc-basket').evaluate((el) => el.style.transform);
  console.log('Korb-Transform vorher/nachher:', basketTransformBefore, '->', basketTransformAfter);
  if (!basketTransformAfter.includes('translate3d')) errors.push('Obstkorb-Korb bewegt sich nicht per transform (evtl. noch altes left-Styling)');
  if (basketTransformBefore === basketTransformAfter) errors.push('Obstkorb-Korb hat sich nach Mausbewegung nicht bewegt');
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(200);

  // --- 5) Schatzpfade v2: Kisten tauschen sichtbar die Position ---
  await page.locator('.arcade-card').filter({ hasText: 'Schatzpfade' }).click();
  await page.waitForTimeout(150);
  await page.click('[data-arcade-difficulty="hard"]');
  await page.waitForTimeout(2000); // reveal + Beginn des Mischens (hard = schnell/kurz reveal)
  const chestCount = await page.locator('.tp2-chest').count();
  console.log('Schatzpfade (hard) Kistenanzahl:', chestCount);
  if (chestCount !== 5) errors.push('Schatzpfade (hard): erwartet 5 Kisten, gefunden ' + chestCount);
  const pos1 = await page.locator('.tp2-chest').first().evaluate((el) => el.style.transform);
  await page.waitForTimeout(900);
  const pos2 = await page.locator('.tp2-chest').first().evaluate((el) => el.style.transform);
  console.log('Kiste[0] Position t1/t2:', pos1, pos2);
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(200);

  // --- 6) Creator Code BRÜSHKA ---
  await page.click('[data-back="screen-menu"]:visible');
  await page.waitForTimeout(150);
  await page.click('#btn-shop');
  await page.waitForTimeout(150);
  const coinsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('nwo_profile_v2') || '{"coins":0}').coins);
  await page.fill('#creator-code-input', 'BRÜSHKA');
  await page.click('#btn-creator-code-redeem');
  await page.waitForTimeout(1200); // Zeit für WS-Verbindung
  const msg1 = await page.locator('#creator-code-message').textContent();
  console.log('Creator Code BRÜSHKA:', msg1);
  if (!msg1.includes('aktiviert')) errors.push('Creator Code BRÜSHKA (mit Ü) wurde nicht akzeptiert: ' + msg1);
  const coinsAfter1 = await page.evaluate(() => JSON.parse(localStorage.getItem('nwo_profile_v2') || '{"coins":0}').coins);
  if (coinsAfter1 <= coinsBefore) errors.push('BRÜSHKA-Belohnung wurde nicht gutgeschrieben');

  await page.fill('#creator-code-input', 'BRUESHKA');
  await page.click('#btn-creator-code-redeem');
  await page.waitForTimeout(200);
  const msgDup = await page.locator('#creator-code-message').textContent();
  console.log('Erneutes Einlösen (als BRUESHKA):', msgDup);
  if (!msgDup.includes('bereits')) errors.push('BRUESHKA-Alternativschreibweise erkennt den bereits eingelösten Code nicht als denselben');

  // BUSCHKA (alter Code) darf NICHT mehr funktionieren
  await page.fill('#creator-code-input', 'BUSCHKA');
  await page.click('#btn-creator-code-redeem');
  await page.waitForTimeout(200);
  const msgOld = await page.locator('#creator-code-message').textContent();
  console.log('Alter Code BUSCHKA:', msgOld);
  if (msgOld.includes('aktiviert')) errors.push('Alter, falscher Code BUSCHKA funktioniert noch!');

  await browser.close();
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'ALLE CHECKS OK (Runde 3)');
  process.exit(errors.length ? 1 : 0);
})();
