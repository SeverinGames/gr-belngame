const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const check = async (label, fn) => {
    try { await fn(); console.log(`OK: ${label}`); }
    catch (e) { console.log(`FEHLER: ${label} -> ${e.message}`); errors.push(`${label}: ${e.message}`); }
  };

  await page.goto('http://localhost:8162/index.html');
  await page.waitForTimeout(300);

  await check('Spind öffnet sich, Mario ist als einziger freigeschaltet sichtbar', async () => {
    await page.click('#btn-locker');
    await page.waitForTimeout(200);
    const cards = await page.locator('.locker-skin-card').count();
    if (cards !== 9) throw new Error(`Erwartet 9 Skin-Karten (8 Skins + Mario), gefunden: ${cards}`);
    const unlocked = await page.locator('.locker-skin-card:not(.locker-skin-card--locked)').count();
    if (unlocked !== 1) throw new Error(`Erwartet 1 freigeschaltete Karte (Mario), gefunden: ${unlocked}`);
  });

  await check('Charaktervorschau im Canvas ist sichtbar und animiert sich (nicht statisch)', async () => {
    const canvas = page.locator('#locker-canvas');
    const box = await canvas.boundingBox();
    if (!box || box.width < 20) throw new Error('Canvas nicht sichtbar');
    const shot1 = await page.screenshot({ clip: box });
    await page.waitForTimeout(1500);
    const shot2 = await page.screenshot({ clip: box });
    if (shot1.equals(shot2)) throw new Error('Vorschau-Canvas zeigt kein Animationsbild (identische Screenshots)');
  });

  await check('Ausrüsten-Klick speichert Auswahl und zeigt sie im Hauptmenü-Badge', async () => {
    await page.click('#btn-locker-equip');
    await page.waitForTimeout(200);
    await page.click('[data-back="screen-menu"]');
    await page.waitForTimeout(200);
    const badgeText = await page.textContent('#skin-badge');
    if (!badgeText.includes('Mario')) throw new Error(`Badge zeigt nicht Mario: ${badgeText}`);
  });

  if (errors.length > 0) {
    console.log('\n=== FEHLER ===');
    errors.forEach((e) => console.log(' - ' + e));
  }
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
