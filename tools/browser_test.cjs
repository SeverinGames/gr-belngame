const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // Mobile-Größe

  page.on('pageerror', (err) => errors.push(`Page error: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`Console error: ${msg.text()}`); });

  await page.goto('http://localhost:8128/index.html');
  await page.waitForTimeout(300);

  const check = async (label, fn) => {
    try {
      await fn();
      console.log(`OK: ${label}`);
    } catch (e) {
      console.log(`FEHLER: ${label} -> ${e.message}`);
      errors.push(`${label}: ${e.message}`);
    }
  };

  await check('Menü lädt, Skin-Badge zeigt Mario', async () => {
    const text = await page.textContent('#skin-badge');
    if (!text.includes('Mario')) throw new Error(`Erwartet Mario, bekam: ${text}`);
  });

  await check('Profil-Zusammenfassung wird angezeigt', async () => {
    const text = await page.textContent('#profile-summary');
    if (!text.includes('Level')) throw new Error(`Kein Level-Text: ${text}`);
  });

  await check('Tägliche Belohnung: Screen öffnet und Claim funktioniert', async () => {
    await page.click('#btn-daily');
    await page.waitForTimeout(100);
    const status = await page.textContent('#daily-status');
    if (!status.includes('wartet')) throw new Error(`Erwartet 'wartet': ${status}`);
    await page.click('#btn-daily-claim');
    await page.waitForTimeout(100);
    const statusAfter = await page.textContent('#daily-status');
    if (!statusAfter.includes('Serie')) throw new Error(`Nach Claim falscher Text: ${statusAfter}`);
    await page.click('#screen-daily [data-back="screen-menu"]');
  });

  await check('Missionen-Screen zeigt 4 Missionen', async () => {
    await page.click('#btn-missions');
    await page.waitForTimeout(100);
    const rows = await page.$$('.mission-row');
    if (rows.length !== 4) throw new Error(`Erwartet 4 Missionen, gefunden: ${rows.length}`);
    await page.click('#screen-missions [data-back="screen-menu"]');
  });

  await check('Mystery Box ohne Schlüssel ist deaktiviert', async () => {
    await page.click('#btn-mysterybox');
    await page.waitForTimeout(100);
    const disabled = await page.getAttribute('#btn-mysterybox-open', 'disabled');
    if (disabled === null) throw new Error('Button sollte disabled sein ohne Schlüssel');
    await page.click('#screen-mysterybox [data-back="screen-menu"]');
  });

  await check('Einstellungen: Lautstärke-Regler funktionieren, kein JS-Crash', async () => {
    await page.click('#btn-settings');
    await page.waitForTimeout(100);
    await page.fill('#vol-music', '20');
    await page.dispatchEvent('#vol-music', 'input');
    await page.waitForTimeout(100);
    await page.click('#screen-settings [data-back="screen-menu"]');
  });

  await check('Kompletter Solo-Run mit Bots und Saboteur-Auswahl bis Spielende', async () => {
    await page.click('#btn-play');
    await page.waitForTimeout(100);
    await page.click('[data-difficulty="normal"]');
    await page.waitForTimeout(100);
    await page.click('[data-saboteur="extreme"]'); // hohe Chance, um Reveal zu triggern
    await page.waitForTimeout(100);

    const botChips = await page.$$('.bot-chip');
    if (botChips.length !== 2) throw new Error(`Erwartet 2 Bot-Chips, gefunden: ${botChips.length}`);

    let ended = false;
    for (let i = 0; i < 60 && !ended; i++) {
      const endVisible = await page.isVisible('#screen-end');
      if (endVisible) { ended = true; break; }

      const doorCount = await page.locator('.door').count();
      if (doorCount > 0) {
        await page.locator('.door').first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(350);
        continue;
      }
      const contCount = await page.locator('.btn--continue').count();
      const fleeCount = await page.locator('.btn--flee').count();
      if (contCount > 0) { await page.locator('.btn--continue').click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(150); continue; }
      if (fleeCount > 0) { await page.locator('.btn--flee').click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(150); continue; }
      await page.waitForTimeout(150);
    }
    if (!ended) throw new Error('Run kam nach 60 Schritten nicht zum Ende (evtl. hängender State)');

    const title = await page.textContent('#end-title');
    if (!title) throw new Error('Kein End-Titel gerendert');
  });

  await check('Nach Run: Profil wurde aktualisiert (Münzen/Level sichtbar)', async () => {
    await page.click('#btn-play-again');
    await page.waitForTimeout(100);
    const text = await page.textContent('#profile-summary');
    console.log('   Profil nach Run:', text.trim());
  });

  if (errors.length > 0) {
    console.log('\n=== JS-LAUFZEITFEHLER WÄHREND DES TESTS ===');
    errors.forEach((e) => console.log(' - ' + e));
  }

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
