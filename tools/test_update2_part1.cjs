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

  // --- 0) Homepage / Hero ---
  const heroCanvas = await page.locator('#hero-skin-preview canvas').count();
  console.log('Hero-Skin-Vorschau-Canvas vorhanden:', heroCanvas > 0);
  if (heroCanvas === 0) errors.push('Hero-Skin-Vorschau fehlt auf der Startseite');

  // --- 1) SOLO -> alle 10 Minispiele erreichbar ---
  await page.click('#btn-play');
  await page.waitForTimeout(150);
  const cardCount = await page.locator('.arcade-card').count();
  console.log('Anzahl Minispiel-Karten:', cardCount);
  if (cardCount !== 10) errors.push(`Erwartet 10 Minispiel-Karten, gefunden ${cardCount}`);
  const cardNames = await page.locator('.arcade-card__name').allTextContents();
  console.log('Karten:', cardNames);
  if (!cardNames.some((n) => n.includes('Meteor Dash'))) errors.push('Meteor Dash fehlt in der Liste');
  if (!cardNames.some((n) => n.includes('Schatzpfade'))) errors.push('Schatzpfade fehlt in der Liste');

  // --- 2) Color Trick: keine farbigen Hinweise an den Buttons ---
  await page.locator('.arcade-card').filter({ hasText: 'Color Trick' }).click();
  await page.waitForTimeout(150);
  await page.click('[data-arcade-difficulty="normal"]');
  await page.waitForTimeout(300);
  const optionStyles = await page.locator('.ct-option').evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).borderColor + '|' + getComputedStyle(el).backgroundColor)
  );
  console.log('Color-Trick Options-Styles (sollten alle identisch sein):', optionStyles);
  const allSame = optionStyles.every((s) => s === optionStyles[0]);
  if (!allSame) errors.push('Color-Trick-Optionen sehen NICHT alle gleich aus (visueller Hinweis vorhanden): ' + optionStyles.join(' / '));
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(200);

  // --- 3) Memory: erweiterten Pool + mehr Karten bei "Schwer" prüfen ---
  await page.locator('.arcade-card').filter({ hasText: 'Mini Memory' }).click();
  await page.waitForTimeout(150);
  await page.click('[data-arcade-difficulty="hard"]');
  await page.waitForTimeout(300);
  const hardCardCount = await page.locator('.mm-card').count();
  console.log('Memory-Kartenanzahl bei "Schwer":', hardCardCount);
  if (hardCardCount !== 12) errors.push(`Erwartet 12 Karten (6 Paare) bei "Schwer", gefunden ${hardCardCount}`);
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(150);

  await page.locator('.arcade-card').filter({ hasText: 'Mini Memory' }).click();
  await page.waitForTimeout(150);
  await page.click('[data-arcade-difficulty="easy"]');
  await page.waitForTimeout(300);
  const easyCardCount = await page.locator('.mm-card').count();
  console.log('Memory-Kartenanzahl bei "Leicht":', easyCardCount);
  if (easyCardCount !== 8) errors.push(`Erwartet 8 Karten (4 Paare) bei "Leicht", gefunden ${easyCardCount}`);
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(150);

  // --- 4) Meteor Dash spielbar ---
  await page.locator('.arcade-card').filter({ hasText: 'Meteor Dash' }).click();
  await page.waitForTimeout(150);
  await page.click('[data-arcade-difficulty="normal"]');
  await page.waitForTimeout(500);
  const livesVisible = await page.locator('.md-lives').textContent();
  console.log('Meteor Dash Leben-Anzeige:', livesVisible);
  if (!livesVisible.includes('❤️')) errors.push('Meteor Dash zeigt keine Leben an');
  const shipVisible = await page.locator('.md-ship').count();
  if (shipVisible === 0) errors.push('Meteor Dash zeigt kein Schiff/Skin an');
  await page.waitForTimeout(1000);
  const objectCount = await page.locator('.md-object').count();
  console.log('Meteor Dash: Objekte nach 1.5s:', objectCount);
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(200);

  // --- 5) Schatzpfade spielbar (Peek -> Entscheidung) ---
  await page.locator('.arcade-card').filter({ hasText: 'Schatzpfade' }).click();
  await page.waitForTimeout(150);
  await page.click('[data-arcade-difficulty="easy"]');
  await page.waitForTimeout(300);
  const chestCountPeek = await page.locator('.tp-chest').count();
  console.log('Schatzpfade Kisten während Peek:', chestCountPeek);
  if (chestCountPeek < 3) errors.push('Schatzpfade zeigt zu wenige Kisten');
  await page.waitForTimeout(2200); // Peek-Phase abwarten (easy hat längere Peek-Zeit)
  const chest = page.locator('.tp-chest').first();
  const box = await chest.boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  console.log('Schatzpfade: Klick auf erste Kiste nach Peek ausgeführt, kein Absturz');
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(200);

  await browser.close();
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'ALLE CHECKS OK (Teil 1)');
  process.exit(errors.length ? 1 : 0);
})();
