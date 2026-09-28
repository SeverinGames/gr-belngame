const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('403')) errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:8123/index.html');
  await page.click('#btn-play');
  await page.waitForTimeout(150);
  await page.locator('.arcade-card').filter({ hasText: 'Schatzpfade' }).click();
  await page.waitForTimeout(150);
  await page.click('[data-arcade-difficulty="easy"]'); // mehr Leben, mehr Zeit zum Zielen
  await page.waitForTimeout(200);

  // Bis zu 40 Versuche: nach jeder Peek-Phase die naheliegend erste Kiste
  // klicken (wir merken uns die Positionen NICHT bewusst - es geht hier nur
  // darum, dass der komplette Rundenzyklus mehrfach fehlerfrei durchläuft
  // und irgendwann #arcade-result erscheint, nicht darum jede Runde zu gewinnen).
  for (let i = 0; i < 40; i++) {
    const resultVisible = await page.locator('#arcade-result:not(.hidden)').count();
    if (resultVisible > 0) break;
    const chests = page.locator('.tp-chest');
    const n = await chests.count();
    if (n > 0) {
      await page.waitForTimeout(1600); // Peek-Phase abwarten
      const box = await chests.first().boundingBox().catch(() => null);
      if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
    }
    await page.waitForTimeout(700);
  }

  await page.waitForTimeout(300);
  const resultVisible = await page.locator('#arcade-result').isVisible();
  console.log('Schatzpfade Ergebnis-Screen erreicht:', resultVisible);
  if (!resultVisible) errors.push('Schatzpfade erreicht auch nach vielen Runden keinen Ergebnis-Screen');
  const tierText = await page.locator('#arcade-result .arcade-result__tier').textContent().catch(() => '');
  console.log('Belohnungsstufe:', tierText);

  await browser.close();
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'SCHATZPFADE RUNDENZYKLUS OK');
  process.exit(errors.length ? 1 : 0);
})();
