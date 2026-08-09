import { chromium } from '@playwright/test';

const BASE = process.env.QA_BASE || 'https://emberfield.netlify.app';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGE: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});
const ok = (label, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'} | ${label} ${extra}`);

await page.goto(BASE);
await page.waitForTimeout(1500);
let d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
ok('prod game starts', !!d && d.state === 'playing');
ok('prod canvas renders', d && d.canvas.width > 0);

// Move + kills
for (let i = 0; i < 6; i++) {
  const key = ['KeyW', 'KeyA', 'KeyS', 'KeyD'][i % 4];
  await page.keyboard.down(key);
  await page.waitForTimeout(800);
  await page.keyboard.up(key);
}
d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
ok('prod kills happen', d.kills > 0, `(kills=${d.kills})`);

// Level-up panel
let panel = await page.evaluate(() => document.querySelector('#levelup-panel')?.style.display !== 'none');
if (!panel) { await page.waitForTimeout(2000); panel = await page.evaluate(() => document.querySelector('#levelup-panel')?.style.display !== 'none'); }
ok('prod levelup panel', panel);
if (panel) {
  for (let p = 0; p < 4; p++) {
    const open = await page.evaluate(() => document.querySelector('#levelup-panel')?.style.display !== 'none');
    if (!open) break;
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(250);
  }
}

// Shop on prod
await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.addGold(120));
await page.keyboard.press('KeyB');
await page.waitForTimeout(300);
const shop = await page.evaluate(() => document.querySelector('#shop-panel')?.style.display !== 'none');
ok('prod shop opens', shop);
if (shop) {
  const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.shop-card strong')).map((e) => e.textContent));
  ok('prod shop offers', cards.length === 2, JSON.stringify(cards));
  await page.keyboard.press('KeyB');
  await page.waitForTimeout(200);
}

// Boss on prod
await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.spawnBossNow());
await page.waitForTimeout(400);
const bossBar = await page.evaluate(() => document.querySelector('#boss-bar')?.style.display !== 'none');
const bossDiag = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
ok('prod boss spawns', bossBar && bossDiag.entities.bossActive);

// Mobile
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const mErr = [];
mobile.on('pageerror', (e) => mErr.push(e.message));
await mobile.goto(BASE);
await mobile.waitForTimeout(1000);
const touch = await mobile.evaluate(() => getComputedStyle(document.querySelector('#touch-controls')).display !== 'none');
const mDiag = await mobile.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
ok('prod mobile touch', touch);
ok('prod mobile renders', mDiag && mDiag.canvas.width > 0);
ok('prod mobile no errors', mErr.length === 0, JSON.stringify(mErr));
await mobile.close();

// Screenshot
await page.evaluate(() => {
  window.__THREE_GAME_TEST_HOOKS__.setPausedForScreenshot(true);
  window.__THREE_GAME_TEST_HOOKS__.setReducedMotion(true);
  window.__THREE_GAME_TEST_HOOKS__.hideDebugUi(true);
});
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/emberfield_prod.png' });

console.log('ERRORS:', JSON.stringify(errors));
await browser.close();
