const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()); });

  await page.goto('http://localhost:8123/index.html');
  await page.click('#btn-play');
  await page.click('[data-difficulty="normal"]');
  await page.click('[data-saboteur="extreme"]');
  await page.waitForTimeout(300);

  for (let i = 0; i < 15; i++) {
    const state = await page.evaluate(() => {
      const visibleScreen = [...document.querySelectorAll('.screen')].find(s => !s.classList.contains('hidden'))?.id;
      const doors = document.querySelectorAll('.door').length;
      const outcome = document.querySelector('#outcome')?.textContent?.trim();
      const outcomeHidden = document.querySelector('#outcome')?.classList.contains('outcome--hidden');
      const decisionHidden = document.querySelector('#decision')?.classList.contains('hidden');
      const decisionButtons = [...document.querySelectorAll('#decision button')].map(b => b.textContent.trim());
      const hp = document.querySelector('#hud-hp-label')?.textContent;
      return { visibleScreen, doors, outcome, outcomeHidden, decisionHidden, decisionButtons, hp };
    });
    console.log(`Step ${i}:`, JSON.stringify(state));

    if (state.doors > 0) {
      await page.locator('.door').first().click();
    } else if (state.decisionButtons.length > 0) {
      await page.locator('#decision button').first().click();
    }
    await page.waitForTimeout(400);
  }

  await browser.close();
})();
