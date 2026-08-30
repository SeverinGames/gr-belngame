const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });

  await page.goto('http://localhost:8132/index.html');
  await page.click('#btn-play');
  await page.click('[data-difficulty="normal"]');
  await page.click('[data-saboteur="peaceful"]');
  await page.waitForTimeout(400);

  // Wir hängen uns über window in die worldGame-Instanz - dafür kurz main.js-intern loggen lassen
  const canvasBox = await page.locator('#world-canvas').boundingBox();
  console.log('Canvas Box:', canvasBox);

  for (let i = 0; i < 6; i++) {
    await page.keyboard.down('d');
    await page.waitForTimeout(400);
    await page.keyboard.up('d');
    const info = await page.evaluate(() => {
      const canvas = document.querySelector('#world-canvas');
      return { canvasWidth: canvas.width, canvasHeight: canvas.height, styleW: canvas.style.width, styleH: canvas.style.height };
    });
    console.log(`Step ${i}:`, JSON.stringify(info));
  }

  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const rooms = await page.textContent('#hud-rooms');
  console.log('Räume nach E-Druck rechts:', rooms);

  await browser.close();
})();
