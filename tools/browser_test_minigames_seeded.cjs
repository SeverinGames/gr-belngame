const { chromium } = require('playwright');

async function findDoorIndex(page, roomTypeCheck) {
  // Wir wissen aus dem Seed, dass Tür 0 (erste generierte) meist der Treffer ist,
  // aber zur Sicherheit laufen wir direkt zur rechten Wand (Slot 0).
  await page.keyboard.down('d');
  await page.waitForTimeout(2200);
  await page.keyboard.up('d');
  await page.keyboard.press('e');
  await page.waitForTimeout(250);
}

(async () => {
  const errors = [];
  const browser = await chromium.launch();

  const check = async (label, fn) => {
    try { await fn(); console.log(`OK: ${label}`); }
    catch (e) { console.log(`FEHLER: ${label} -> ${e.message}`); errors.push(`${label}: ${e.message}`); }
  };

  // --- Reaktionsspiel (Seed 5) ---
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push('[reaction] ' + e.message));
    await page.goto('http://localhost:8146/index.html?seed=16');
    await page.click('#btn-play');
    await page.click('[data-difficulty="normal"]');
    await page.click('[data-saboteur="peaceful"]');
    await page.waitForTimeout(400);
    await findDoorIndex(page);

    await check('Reaktionsspiel: Overlay erscheint nach Tür-Interaktion', async () => {
      const visible = await page.isVisible('#minigame-reaction:not(.hidden)');
      if (!visible) throw new Error('Reaktions-Overlay nicht sichtbar - falscher Seed/Tür?');
    });

    await check('Reaktionsspiel: Symbol erscheint, Tastendruck beendet Minispiel und erhöht Räume-Zähler', async () => {
      const roomsBefore = await page.textContent('#hud-rooms');
      await page.waitForTimeout(2600);
      const symbolVisible = await page.isVisible('#reaction-symbol:not(.hidden)');
      if (!symbolVisible) throw new Error('Symbol nicht erschienen');
      await page.keyboard.press(' ');
      await page.waitForTimeout(300);
      const overlayGone = !(await page.isVisible('#minigame-reaction:not(.hidden)'));
      if (!overlayGone) throw new Error('Overlay nicht geschlossen');
      const roomsAfter = await page.textContent('#hud-rooms');
      if (roomsAfter === roomsBefore) throw new Error(`Räume-Zähler unverändert (${roomsBefore} -> ${roomsAfter})`);
      const outcomeText = await page.textContent('#outcome');
      console.log('   Ergebnis-Text:', outcomeText.trim());
    });

    await page.close();
  }

  // --- Versteckspiel (Seed 6) ---
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push('[hide] ' + e.message));
    await page.goto('http://localhost:8146/index.html?seed=1');
    await page.click('#btn-play');
    await page.click('[data-difficulty="normal"]');
    await page.click('[data-saboteur="peaceful"]');
    await page.waitForTimeout(400);
    await findDoorIndex(page);

    await check('Versteckspiel: Overlay + Timer erscheinen nach Tür-Interaktion', async () => {
      const visible = await page.isVisible('#minigame-hide:not(.hidden)');
      if (!visible) throw new Error('Versteck-Overlay nicht sichtbar - falscher Seed/Tür?');
    });

    await check('Versteckspiel: Timer läuft sichtbar herunter', async () => {
      const w1 = await page.$eval('#hide-timer-fill', (el) => el.style.width);
      await page.waitForTimeout(600);
      const w2 = await page.$eval('#hide-timer-fill', (el) => el.style.width);
      if (w1 === w2) throw new Error(`Timer-Balken bewegt sich nicht (${w1} vs ${w2})`);
    });

    await check('Versteckspiel: Verstecken via E beendet Minispiel und erhöht Räume-Zähler', async () => {
      const roomsBefore = await page.textContent('#hud-rooms');
      await page.keyboard.down('d');
      await page.waitForTimeout(1200);
      await page.keyboard.up('d');
      await page.keyboard.press('e');
      await page.waitForTimeout(300);
      const overlayGone = !(await page.isVisible('#minigame-hide:not(.hidden)'));
      if (!overlayGone) throw new Error('Versteck-Overlay nicht geschlossen');
      const roomsAfter = await page.textContent('#hud-rooms');
      if (roomsAfter === roomsBefore) throw new Error(`Räume-Zähler unverändert (${roomsBefore} -> ${roomsAfter})`);
      const outcomeText = await page.textContent('#outcome');
      console.log('   Ergebnis-Text:', outcomeText.trim());
    });

    await page.close();
  }

  if (errors.length > 0) {
    console.log('\n=== FEHLER ===');
    errors.forEach((e) => console.log(' - ' + e));
  }
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
