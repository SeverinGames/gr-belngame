const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.googleapis')) errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:8123/index.html');
  await page.waitForTimeout(200);

  // Kein horizontales Scrollen auf Mobile (Punkt 14)
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  console.log('Kein horizontales Scrollen (Mobile):', noHScroll);
  if (!noHScroll) errors.push('Horizontales Scrollen auf Mobile vorhanden');

  await page.click('#btn-arcade');
  await page.waitForTimeout(150);
  const noHScrollArcadeHome = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  if (!noHScrollArcadeHome) errors.push('Horizontales Scrollen im Minispiel-Menü (Mobile)');

  // --- Obstkorb: per Touch bewegen + prüfen, dass mind. eine Frucht erscheint ---
  await page.locator('.arcade-card').filter({ hasText: 'Obstkorb' }).click();
  await page.waitForTimeout(1200);
  const fruitCount = await page.locator('.fc-fruit').count();
  console.log('Obstkorb: sichtbare Früchte nach 1.2s:', fruitCount);
  if (fruitCount === 0) errors.push('Obstkorb erzeugt keine Früchte');
  const stageBox = await page.locator('#arcade-stage').boundingBox();
  // Simulierte Zieh-Bewegung über das Spielfeld (Touch)
  await page.mouse.move(stageBox.x + 20, stageBox.y + stageBox.height - 20);
  await page.mouse.move(stageBox.x + stageBox.width - 20, stageBox.y + stageBox.height - 20, { steps: 5 });
  await page.waitForTimeout(1500);
  const scoreAfter = await page.locator('#arcade-score').textContent();
  console.log('Obstkorb Punktestand nach Bewegung:', scoreAfter);
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(150);

  // --- Balloon Pop: einen Ballon per Tap poppen ---
  await page.locator('.arcade-card').filter({ hasText: 'Balloon Pop' }).click();
  await page.waitForTimeout(1000);
  const balloon = page.locator('.bp-balloon').first();
  if (await balloon.count() > 0) {
    await balloon.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(300);
    const bpScore = await page.locator('#arcade-score').textContent();
    console.log('Balloon Pop Punktestand nach Pop-Versuch:', bpScore);
  } else {
    errors.push('Kein Ballon zum Poppen gefunden');
  }
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(150);

  // --- Star Catcher: einen Stern antippen ---
  await page.locator('.arcade-card').filter({ hasText: 'Star Catcher' }).click();
  await page.waitForTimeout(400);
  const star = page.locator('.sc-star').first();
  if (await star.count() > 0) {
    await star.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(300);
    console.log('Star Catcher: Klick auf Stern ausgeführt, Punkte:', await page.locator('#arcade-score').textContent());
  } else {
    errors.push('Kein Stern gefunden');
  }
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(150);

  // --- Stopp bei Grün: Stopp-Button einmal drücken ---
  await page.locator('.arcade-card').filter({ hasText: 'Stopp bei Grün' }).click();
  await page.waitForTimeout(500);
  await page.click('.sg-stopbtn');
  await page.waitForTimeout(300);
  console.log('Stopp bei Grün: Ergebnis nach einem Stopp:', await page.locator('#arcade-score').textContent());
  await page.click('#btn-arcade-quit');
  await page.waitForTimeout(150);

  await browser.close();
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'KEINE FEHLER, MOBILE-CHECKS OK');
  process.exit(errors.length ? 1 : 0);
})();
