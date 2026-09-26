const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // Vorab ein paar Mystery-Box-Schlüssel setzen, damit wir die Box-Animation testen können.
  await page.addInitScript(() => {
    localStorage.setItem('nwo_profile_v1', JSON.stringify({ keys: 3 }));
  });

  await page.goto('http://localhost:8123/index.html', { timeout: 8000 });
  await page.waitForTimeout(300);

  // --- 1) Alle 8 Minispiele: öffnen, kurz laufen lassen, wieder verlassen ---
  await page.click('#btn-arcade');
  await page.waitForTimeout(150);
  const cardCount = await page.locator('.arcade-card').count();
  console.log('Anzahl Minispiel-Karten:', cardCount);
  if (cardCount !== 8) errors.push(`Erwartet 8 Minispiel-Karten, gefunden ${cardCount}`);

  for (let i = 0; i < cardCount; i++) {
    const cards = page.locator('.arcade-card');
    const name = await cards.nth(i).locator('.arcade-card__name').textContent();
    await cards.nth(i).click();
    await page.waitForTimeout(400);
    const stageVisible = await page.locator('#screen-arcade-play').isVisible();
    if (!stageVisible) errors.push(`Spiel "${name}" hat #screen-arcade-play nicht angezeigt`);
    // kurz "spielen": irgendein klickbares Element im Stage-Bereich antippen, falls vorhanden
    const clickable = page.locator('#arcade-stage button, #arcade-stage .bp-balloon, #arcade-stage .sc-star, #arcade-stage .mm-card');
    const n = await clickable.count();
    if (n > 0) { try { await clickable.first().click({ timeout: 500 }); } catch { /* ignorieren, kann verschwunden sein */ } }
    await page.waitForTimeout(300);
    await page.click('#btn-arcade-quit');
    await page.waitForTimeout(150);
    const backHome = await page.locator('#screen-arcade').isVisible();
    if (!backHome) errors.push(`Nach Quit von "${name}" nicht zurück auf #screen-arcade`);
  }
  console.log('Alle 8 Minispiele: öffnen + verlassen ohne Absturz OK');

  // --- 2) Color Trick komplett durchspielen (richtige Antworten) und Ergebnis prüfen ---
  await page.locator('.arcade-card').filter({ hasText: 'Color Trick' }).click();
  await page.waitForTimeout(300);
  for (let round = 0; round < 14; round++) {
    const wordText = await page.locator('.ct-word').textContent().catch(() => null);
    if (!wordText) break; // Runde vorbei / Spiel beendet
    const options = page.locator('.ct-option');
    const optCount = await options.count();
    let clicked = false;
    for (let j = 0; j < optCount; j++) {
      const t = await options.nth(j).textContent();
      if (t.trim() === wordText.trim()) { await options.nth(j).click(); clicked = true; break; }
    }
    if (!clicked) break;
    await page.waitForTimeout(320);
  }
  await page.waitForTimeout(300);
  const resultVisible = await page.locator('#arcade-result').isVisible();
  console.log('Color-Trick Ergebnis-Screen sichtbar:', resultVisible);
  if (!resultVisible) errors.push('Color Trick zeigt nach 12 Runden keinen Ergebnis-Screen');
  const tierText = await page.locator('.arcade-result__tier').textContent().catch(() => null);
  console.log('Color-Trick Belohnungsstufe:', tierText);
  await page.click('#btn-arcade-home');
  await page.waitForTimeout(200);

  // Highscore-Chip sollte jetzt auf der Karte auftauchen
  const bestChip = await page.locator('.arcade-card').filter({ hasText: 'Color Trick' }).locator('.arcade-card__best').count();
  console.log('Highscore-Chip nach erster Runde vorhanden:', bestChip > 0);
  if (bestChip === 0) errors.push('Kein Highscore-Chip nach abgeschlossener Color-Trick-Runde');

  // --- 3) Mystery Box: Öffnen, Skip, Reveal, Continue ---
  await page.click('[data-back="screen-menu"]'); // vom Arcade-Screen zurück ins Menü (erstes passende Element)
  await page.waitForTimeout(150);
  await page.click('#btn-mysterybox');
  await page.waitForTimeout(150);
  await page.click('#btn-mysterybox-open');
  await page.waitForTimeout(200);
  const overlayVisible = await page.locator('#mysterybox-animation').isVisible();
  console.log('Mystery-Box-Overlay sichtbar:', overlayVisible);
  if (!overlayVisible) errors.push('Mystery-Box-Overlay wurde nicht angezeigt');
  // "Überspringen" wird erst nach kurzer Zeit aktiv - warten und dann klicken
  await page.waitForTimeout(1200);
  const skipVisible = await page.locator('#mb-skip').isVisible();
  if (skipVisible) await page.click('#mb-skip');
  await page.waitForTimeout(400);
  const revealVisible = await page.locator('#mb-reveal').isVisible();
  console.log('Mystery-Box Reveal sichtbar:', revealVisible);
  if (!revealVisible) errors.push('Mystery-Box Reveal wurde nicht angezeigt');
  const revealName = await page.locator('#mb-reveal-name').textContent();
  console.log('Gezogener Skin:', revealName);
  await page.click('#mb-continue');
  await page.waitForTimeout(300);
  const overlayGoneAfter = await page.locator('#mysterybox-animation').isVisible();
  if (overlayGoneAfter) errors.push('Mystery-Box-Overlay wurde nach "Weiter" nicht ausgeblendet');

  await browser.close();
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'KEINE JS-FEHLER, ALLE CHECKS OK');
  process.exit(errors.length ? 1 : 0);
})();
