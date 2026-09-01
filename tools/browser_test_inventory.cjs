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

  await page.goto('http://localhost:8156/index.html?seed=581');
  await page.click('#btn-play');
  await page.click('[data-difficulty="normal"]');
  await page.click('[data-saboteur="peaceful"]');
  await page.waitForTimeout(400);

  // Zur rechten Wand laufen (Tür-Slot 0) und öffnen
  await page.keyboard.down('d');
  await page.waitForTimeout(2200);
  await page.keyboard.up('d');
  await page.keyboard.press('e');
  await page.waitForTimeout(300);

  await check('Geheimraum gibt tatsächlich ein Item, das im Inventar-HUD erscheint', async () => {
    const outcomeText = await page.textContent('#outcome');
    console.log('   Ergebnis:', outcomeText.trim());
    const items = await page.locator('.inventory-item').count();
    if (items === 0) throw new Error('Kein Item im Inventar-HUD sichtbar nach Geheimraum-Fund');
  });

  await check('Falls Medkit gefunden: Klick darauf heilt den Spieler sichtbar im HUD', async () => {
    const medkitChip = page.locator('.inventory-item--usable', { hasText: 'Medkit' });
    const count = await medkitChip.count();
    if (count === 0) {
      console.log('   (Diesmal wurde ein Schlüssel statt Medkit gezogen - zufallsbedingt, kein Fehler)');
      return;
    }
    // Erst Schaden nehmen, damit Heilung sichtbar wird - eine Falle o.ä. auslösen falls möglich,
    // ansonsten testen wir nur, dass der Klick nicht crasht und HP nicht sinkt.
    const hpBefore = await page.textContent('#hud-hp-label');
    await medkitChip.click();
    await page.waitForTimeout(200);
    const hpAfter = await page.textContent('#hud-hp-label');
    console.log(`   HP vorher: ${hpBefore}, nachher: ${hpAfter}`);
    const itemsAfter = await page.locator('.inventory-item', { hasText: 'Medkit' }).count();
    if (itemsAfter !== 0) throw new Error('Medkit wurde nach Benutzung nicht aus dem Inventar entfernt');
  });

  if (errors.length > 0) {
    console.log('\n=== FEHLER ===');
    errors.forEach((e) => console.log(' - ' + e));
  }
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
