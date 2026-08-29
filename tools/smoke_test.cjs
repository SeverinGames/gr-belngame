const { chromium } = require('playwright');
(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('http://localhost:8123/index.html', { timeout: 8000 });
  await page.waitForTimeout(500);
  await page.click('#btn-settings');
  await page.waitForTimeout(200);
  const musicVal = await page.inputValue('#vol-music');
  console.log('Settings-Screen Musik-Slider Wert:', musicVal);
  await browser.close();
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'KEINE JS-FEHLER');
  process.exit(errors.length ? 1 : 0);
})();
