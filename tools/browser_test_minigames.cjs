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

  await page.goto('http://localhost:8140/index.html');
  await page.waitForTimeout(300);
  await page.click('#btn-play');
  await page.click('[data-difficulty="normal"]');
  await page.click('[data-saboteur="peaceful"]');
  await page.waitForTimeout(400);

  async function walkToAllWallsAndInteract() {
    const directions = ['d', 'a', 'a', 's', 's', 'w', 'w'];
    for (const key of directions) {
      await page.keyboard.down(key);
      await page.waitForTimeout(2200);
      await page.keyboard.up(key);
      await page.keyboard.press('e');
      await page.waitForTimeout(250);
      const reactionVisible = await page.isVisible('#minigame-reaction:not(.hidden)');
      const hideVisible = await page.isVisible('#minigame-hide:not(.hidden)');
      if (reactionVisible || hideVisible) return { reactionVisible, hideVisible };
    }
    return { reactionVisible: false, hideVisible: false };
  }

  let foundReaction = false;
  let foundHide = false;

  // Bis zu 10 Räume durchprobieren, um beide Minispiel-Typen zu treffen
  for (let attempt = 0; attempt < 10 && !(foundReaction && foundHide); attempt++) {
    const roomsText = await page.textContent('#hud-rooms').catch(() => null);
    if (roomsText === null) break; // Run vorbei

    const { reactionVisible, hideVisible } = await walkToAllWallsAndInteract();

    if (reactionVisible && !foundReaction) {
      foundReaction = true;
      await check('Reaktionsspiel: Symbol erscheint und Tastendruck löst Ergebnis aus', async () => {
        await page.waitForTimeout(2600); // warten bis Symbol erscheint
        const symbolVisible = await page.isVisible('#reaction-symbol:not(.hidden)');
        if (!symbolVisible) throw new Error('Symbol wurde nicht sichtbar');
        const roomsBefore = await page.textContent('#hud-rooms');
        await page.keyboard.press(' ');
        await page.waitForTimeout(300);
        const overlayGone = !(await page.isVisible('#minigame-reaction:not(.hidden)'));
        if (!overlayGone) throw new Error('Overlay wurde nach Tastendruck nicht geschlossen');
        const roomsAfter = await page.textContent('#hud-rooms');
        if (roomsAfter === roomsBefore) throw new Error('Räume-Zähler hat sich nach Reaktionsspiel nicht erhöht');
      });
      // Ggf. Entscheidungsbildschirm wegklicken um weiterzumachen
      await page.waitForTimeout(800);
      const contBtn = await page.$('.btn--continue');
      if (contBtn) await contBtn.click();
      await page.waitForTimeout(300);
    } else if (hideVisible && !foundHide) {
      foundHide = true;
      await check('Versteckspiel: Timer läuft, Verstecken via E löst Ergebnis aus', async () => {
        const fillWidthBefore = await page.$eval('#hide-timer-fill', (el) => el.style.width);
        await page.waitForTimeout(500);
        const fillWidthAfter = await page.$eval('#hide-timer-fill', (el) => el.style.width);
        if (fillWidthBefore === fillWidthAfter) throw new Error('Timer-Balken bewegt sich nicht');
        const roomsBefore = await page.textContent('#hud-rooms');
        // Zu einem Versteck laufen und E drücken
        await page.keyboard.down('d');
        await page.waitForTimeout(1500);
        await page.keyboard.up('d');
        await page.keyboard.press('e');
        await page.waitForTimeout(300);
        const overlayGone = !(await page.isVisible('#minigame-hide:not(.hidden)'));
        if (!overlayGone) throw new Error('Versteck-Overlay wurde nicht geschlossen');
        const roomsAfter = await page.textContent('#hud-rooms');
        if (roomsAfter === roomsBefore) throw new Error('Räume-Zähler hat sich nach Versteckspiel nicht erhöht');
      });
      await page.waitForTimeout(800);
      const contBtn = await page.$('.btn--continue');
      if (contBtn) await contBtn.click();
      await page.waitForTimeout(300);
    }

    // Falls Run inzwischen zu Ende ist (Tod), abbrechen
    const ended = await page.isVisible('#screen-end');
    if (ended) break;
  }

  if (!foundReaction) console.log('HINWEIS: Reaktionsspiel wurde in 10 Räumen nicht zufällig gewürfelt (Zufall) - kein Fehler, nur Glückssache');
  if (!foundHide) console.log('HINWEIS: Versteckspiel wurde in 10 Räumen nicht zufällig gewürfelt (Zufall) - kein Fehler, nur Glückssache');

  if (errors.length > 0) {
    console.log('\n=== FEHLER ===');
    errors.forEach((e) => console.log(' - ' + e));
  }
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
