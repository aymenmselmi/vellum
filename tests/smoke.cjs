const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const { startFixture, client, testAdmin } = await import('./helpers.js');
  const fixture = await startFixture();
  let browser;
  try {
    const secondMember = await client(fixture.base).register('Alex Morgan');
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium'), headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const click = selector => page.locator(`${selector}:visible`).click();
    const act = (name, id) => `[data-action="${name}"]${id ? `[data-id="${id}"]` : ''}`;
    const modalClosed = () => page.waitForFunction(() => !document.querySelector('#modal').open);
    async function confirm() { await click(act('confirm')); await modalClosed(); }
    async function login(admin = false) {
      const account = admin ? testAdmin : secondMember;
      await click(admin ? '#admin-link' : '#account-button');
      await page.fill('#auth-email', account.email);
      await page.fill('#auth-password', account.password);
      await click('#auth-form button[type="submit"]');
      await modalClosed();
    }
    async function logout() {
      await click('#account-button'); await click(act('logout')); await modalClosed();
    }

    await page.goto(fixture.base);
    await page.waitForSelector('.car-card');
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    assert.match(await page.title(), /L’art de s’évader/);
    assert.equal(await page.locator('.car-card').count(), 6);
    assert.match(await page.locator('.car-grid').innerText(), /Automatique/);
    assert.match(await page.locator('#result-count').innerText(), /6 véhicules à découvrir/);
    await click('[data-nav="about"]');
    await page.waitForSelector('#about-view:not([hidden])');
    assert.match(await page.locator('#about-view').innerText(), /De belles voitures/);
    await click('[data-nav="rentals"]');
    await page.waitForSelector('#rentals-view:not([hidden])');
    assert.match(await page.locator('#rentals-view').innerText(), /Connectez-vous pour consulter vos réservations/);
    await click('[data-nav="collection"]');
    await page.waitForSelector('#collection-view:not([hidden])');
    await click('[data-category="SUV"]');
    assert.equal(await page.locator('.car-card').count(), 1);
    await click('[data-category="all"]');
    await page.selectOption('#location-filter', 'Sousse');
    assert.equal(await page.locator('.car-card').count(), 1);
    await page.selectOption('#location-filter', '');
    await page.selectOption('#sort-cars', 'price-asc');
    assert.match(await page.locator('.car-card').first().innerText(), /MINI/);

    await click(act('book', 'car-bmw'));
    await click(act('auth-switch'));
    await page.fill('#auth-name', 'Test Traveller');
    await page.fill('#auth-email', 'traveller@example.test');
    await page.fill('#auth-password', 'GoodPassword123!');
    await click('#auth-form button[type="submit"]');
    await page.waitForSelector('#booking-form');
    assert.match(await page.locator('#booking-summary').innerText(), /780/);
    await click('#booking-form button[type="submit"]');
    await page.waitForSelector('.rental-card');
    assert.match(await page.locator('.rental-card').innerText(), /Confirmée/);
    await page.reload();
    await page.waitForSelector('.rental-card');
    assert.equal(await page.locator('#account-label').innerText(), 'Test');
    assert.equal(await page.evaluate(() => localStorage.getItem('vellum-rentals-v1')), null);

    await logout(); await login();
    await click(act('book', 'car-bmw'));
    await click('#booking-form button[type="submit"]');
    await page.waitForSelector('#form-error:not([hidden])');
    assert.match(await page.locator('#form-error').innerText(), /déjà réservé/);
    await click(act('close-modal'));
    // Availability filtering sees another member's booking without exposing their data.
    await click('#search-form button[type="submit"]');
    await page.waitForFunction(() => document.querySelectorAll('.car-card').length === 5);
    await logout();

    await login(true);
    await page.waitForSelector('.admin-tabs');
    await click(act('delete-car', 'car-bmw'));
    assert.match(await page.locator('#toast').innerText(), /réservations en cours/);
    await click(act('add-car'));
    await page.fill('#car-name', 'Test City Car');
    await page.fill('#car-price', '190');
    assert.match(await page.locator('#car-category').innerText(), /Berline/);
    await page.selectOption('#car-category', 'Sedan');
    assert.equal(await page.locator('#car-category').inputValue(), 'Sedan');
    assert.match(await page.locator('#car-transmission').innerText(), /Automatique/);
    await click('#car-form button[type="submit"]');
    await modalClosed();
    const carId = await page.locator('tr').filter({ hasText: 'Test City Car' }).locator('[data-action="delete-car"]').getAttribute('data-id');
    await click(act('edit-car', carId));
    await page.fill('#car-price', '210');
    await click('#car-form button[type="submit"]');
    await modalClosed();
    assert.match(await page.locator('tr').filter({ hasText: 'Test City Car' }).innerText(), /210/);
    await click(act('delete-car', carId)); await confirm();
    assert.equal(await page.locator('tr').filter({ hasText: 'Test City Car' }).count(), 0);

    await click('[data-tab="orders"]');
    await click(act('cancel-order')); await confirm();
    assert.match(await page.locator('#admin-table').innerText(), /Annulée/);
    await click('[data-tab="members"]');
    const memberId = await page.locator('tr').filter({ hasText: 'traveller@example.test' }).locator('[data-action="toggle-member"]').getAttribute('data-id');
    await click(act('toggle-member', memberId)); await confirm();
    assert.match(await page.locator('tr').filter({ hasText: 'traveller@example.test' }).innerText(), /Suspendu/);
    await logout();
    await click('#account-button');
    await page.fill('#auth-email', 'traveller@example.test');
    await page.fill('#auth-password', 'GoodPassword123!');
    await click('#auth-form button[type="submit"]');
    await page.waitForSelector('#form-error:not([hidden])');
    assert.match(await page.locator('#form-error').innerText(), /suspendu/);
    await click(act('close-modal'));
    await login(true);
    await click('[data-tab="members"]');
    await click(act('toggle-member', memberId)); await confirm();
    assert.match(await page.locator('tr').filter({ hasText: 'traveller@example.test' }).innerText(), /Actif/);
    await click(act('delete-member', memberId)); await confirm();
    assert.equal(await page.locator('tr').filter({ hasText: 'traveller@example.test' }).count(), 0);
    await logout();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${fixture.base}/#collection`);
    await page.waitForSelector('.car-card');
    await page.evaluate(async () => {
      await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode(); }));
    });
    await page.screenshot({ path: 'test-results/french-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page fits');
    await login();
    await click(act('book', 'car-mini'));
    await click('#booking-form button[type="submit"]');
    await page.waitForSelector('.rental-card');
    await click(act('cancel-order')); await confirm();
    assert.match(await page.locator('.rental-card').innerText(), /Annulée/);
    await page.goto(`${fixture.base}/#collection`);
    await page.waitForSelector('.car-card');
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `French collection fits at ${width}px`);
    }
    assert.deepEqual(errors, [], 'No browser errors');
    console.log('PASS: database-backed sign-up, sign-in, cookies, bookings, availability filters, overlap checks, admin controls, member management, cancellation, and mobile layout.');
  } finally {
    if (browser) await browser.close();
    await fixture.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
