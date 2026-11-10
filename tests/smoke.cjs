const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const click = selector => page.locator(`${selector}:visible`).click();
  const act = (name,id) => `[data-action="${name}"]${id?`[data-id="${id}"]`:''}`;
  async function login(admin = false) {
    await click(admin ? '#admin-link' : '#account-button');
    await click(act('demo-login'));
    await click('#auth-form button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector('#modal').open);
  }
  async function logout() {
    await click('#account-button'); await click(act('logout'));
  }
  try {
    await page.goto('http://127.0.0.1:8080');
    await page.waitForSelector('.car-card');
    assert.equal(await page.locator('.car-card').count(), 6);
    await click('[data-category="SUV"]');
    assert.equal(await page.locator('.car-card').count(), 1);
    await click('[data-category="all"]');
    await page.selectOption('#location-filter','Sousse');
    assert.equal(await page.locator('.car-card').count(), 1);
    await page.selectOption('#location-filter','');
    await page.selectOption('#sort-cars','price-asc');
    assert.match(await page.locator('.car-card').first().innerText(),/MINI/);

    // Booking from signed out resumes after sign-up.
    await click(act('book','car-bmw'));
    await click(act('auth-switch'));
    await page.fill('#auth-name','Test Traveller');
    await page.fill('#auth-email','traveller@example.test');
    await page.fill('#auth-password','GoodPassword123!');
    await click('#auth-form button[type="submit"]');
    await page.waitForSelector('#booking-form');
    assert.match(await page.locator('#booking-summary').innerText(),/780/);
    await click('#booking-form button[type="submit"]');
    await page.waitForSelector('.rental-card');
    assert.equal(await page.locator('.rental-card').count(),1);
    assert.match(await page.locator('.rental-card').innerText(),/Confirmed/);
    await page.reload();
    await page.waitForSelector('.rental-card');
    assert.equal(await page.locator('#account-label').innerText(),'Test');

    // A second member cannot reserve overlapping dates.
    await logout(); await login();
    await click(act('book','car-bmw'));
    await click('#booking-form button[type="submit"]');
    await page.waitForSelector('#form-error:not([hidden])');
    assert.match(await page.locator('#form-error').innerText(),/already reserved/);
    await click(act('close-modal'));
    await logout();

    await login(true);
    await page.waitForSelector('.admin-tabs');
    // A car with an active booking cannot be removed.
    await click(act('delete-car','car-bmw'));
    assert.match(await page.locator('#toast').innerText(),/active reservations/);
    await click(act('add-car'));
    await page.fill('#car-name','Test City Car');
    await page.fill('#car-price','190');
    await click('#car-form button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('#admin-table').textContent.includes('Test City Car'));
    const carId=await page.locator('tr').filter({hasText:'Test City Car'}).locator('[data-action="delete-car"]').getAttribute('data-id');
    await click(act('edit-car',carId));
    await page.fill('#car-price','210');
    await click('#car-form button[type="submit"]');
    assert.match(await page.locator('tr').filter({hasText:'Test City Car'}).innerText(),/210/);
    await click(act('delete-car',carId)); await click(act('confirm'));
    assert.equal(await page.locator('tr').filter({hasText:'Test City Car'}).count(),0);

    await click('[data-tab="orders"]');
    await click(act('cancel-order')); await click(act('confirm'));
    assert.match(await page.locator('#admin-table').innerText(),/cancelled/);
    await click('[data-tab="members"]');
    const memberId=await page.locator('tr').filter({hasText:'traveller@example.test'}).locator('[data-action="toggle-member"]').getAttribute('data-id');
    await click(act('toggle-member',memberId)); await click(act('confirm'));
    assert.match(await page.locator('tr').filter({hasText:'traveller@example.test'}).innerText(),/Suspended/);
    await logout();
    await click('#account-button');
    await page.fill('#auth-email','traveller@example.test');
    await page.fill('#auth-password','GoodPassword123!');
    await click('#auth-form button[type="submit"]');
    await page.waitForSelector('#form-error:not([hidden])');
    assert.match(await page.locator('#form-error').innerText(),/suspended/);
    await click(act('close-modal'));
    await login(true);
    await click('[data-tab="members"]');
    await click(act('toggle-member',memberId)); await click(act('confirm'));
    assert.match(await page.locator('tr').filter({hasText:'traveller@example.test'}).innerText(),/Active/);
    await click(act('delete-member',memberId)); await click(act('confirm'));
    assert.equal(await page.locator('tr').filter({hasText:'traveller@example.test'}).count(),0);
    await logout();

    // Mobile layout and loaded local imagery.
    await page.setViewportSize({width:390,height:844});
    await page.goto('http://127.0.0.1:8080/#collection');
    await page.waitForSelector('.car-card');
    await page.screenshot({path:'preview-mobile.png',fullPage:true});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),'Mobile page must not overflow horizontally');
    assert.ok(await page.evaluate(() => [...document.images].every(image => image.complete && image.naturalWidth > 0)),'Images must load');
    await login();
    await click(act('book','car-mini'));
    await click('#booking-form button[type="submit"]');
    await page.waitForSelector('.rental-card');
    await click(act('cancel-order')); await click(act('confirm'));
    assert.match(await page.locator('.rental-card').innerText(),/Cancelled/);
    assert.deepEqual(errors,[],'No browser errors');
    console.log('PASS: filters, sign-up/sign-in, booking totals, persistence, overlap protection, member cancellation, car add/edit/delete, admin cancellation, member suspension/reactivation/deletion, mobile layout, and images.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exit(1);});
