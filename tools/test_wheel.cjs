const { chromium } = require('playwright');

(async () => {
  const errors = [];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('403')) errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:8123/index.html');
  await page.waitForTimeout(300);

  const badgeBefore = await page.locator('#btn-wheel').evaluate((el) => el.classList.contains('btn--ready'));
  console.log('Glücksrad-Badge vor erstem Besuch:', badgeBefore);
  if (!badgeBefore) errors.push('Glücksrad zeigt keinen "bereit"-Hinweis, obwohl ein Dreh verfügbar sein sollte');

  await page.click('#btn-wheel');
  await page.waitForTimeout(200);
  const wheelSlices = await page.locator('.wheel__label').count();
  console.log('Anzahl Radfelder:', wheelSlices);
  if (wheelSlices !== 16) errors.push('Erwartet 16 Radfelder, gefunden ' + wheelSlices);

  const coinsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('nwo_profile_v1') || '{"coins":0}').coins);
  await page.click('#btn-wheel-spin');
  await page.waitForTimeout(500);
  const spinDisabled = await page.locator('#btn-wheel-spin').isDisabled();
  console.log('Dreh-Button während der Drehung deaktiviert:', spinDisabled);
  if (!spinDisabled) errors.push('Der Dreh-Button lässt sich während einer laufenden Drehung erneut klicken');

  await page.waitForTimeout(4800);
  const resultVisible = await page.locator('#wheel-result').isVisible();
  const resultText = await page.locator('#wheel-result').textContent();
  console.log('Glücksrad-Ergebnis:', resultVisible, '|', resultText);
  if (!resultVisible) errors.push('Nach der Drehung erscheint kein Ergebnis-Text');

  // Zweiter Dreh am selben Tag sollte (ohne Bonus-Drehs) nicht mehr möglich sein
  const secondSpinDisabled = await page.locator('#btn-wheel-spin').isDisabled();
  console.log('Dreh-Button nach dem einen Tagesdreh gesperrt (kein Bonus vorhanden):', secondSpinDisabled);

  await browser.close();
  console.log(errors.length ? 'FEHLER:\n' + errors.join('\n') : 'GLÜCKSRAD OK');
  process.exit(errors.length ? 1 : 0);
})();
