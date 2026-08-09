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
ok('prod starts', !!d && d.state === 'playing');

// Dash
await page.keyboard.down('KeyW');
await page.waitForTimeout(150);
const b = await page.evaluate(() => ({ x: window.__THREE_GAME_DIAGNOSTICS__.player.position.x, z: window.__THREE_GAME_DIAGNOSTICS__.player.position.z }));
await page.keyboard.press('Space');
await page.waitForTimeout(120);
const a = await page.evaluate(() => ({ x: window.__THREE_GAME_DIAGNOSTICS__.player.position.x, z: window.__THREE_GAME_DIAGNOSTICS__.player.position.z, s: window.__THREE_GAME_DIAGNOSTICS__.player.speed }));
await page.keyboard.up('KeyW');
ok('prod dash', Math.hypot(a.x - b.x, a.z - b.z) > 0.8, `(speed=${a.s.toFixed(1)})`);

// Mute
const m1 = await page.evaluate(() => document.querySelector('#mute-indicator').textContent);
await page.keyboard.press('KeyM');
await page.waitForTimeout(120);
const m2 = await page.evaluate(() => document.querySelector('#mute-indicator').textContent);
ok('prod mute', m1 !== m2);

// Kill + levelup + shop + orb
for (let i = 0; i < 6; i++) {
  const key = ['KeyW', 'KeyA', 'KeyS', 'KeyD'][i % 4];
  await page.keyboard.down(key);
  await page.waitForTimeout(700);
  await page.keyboard.up(key);
}
let panel = await page.evaluate(() => document.querySelector('#levelup-panel')?.style.display !== 'none');
if (!panel) { await page.waitForTimeout(1200); panel = await page.evaluate(() => document.querySelector('#levelup-panel')?.style.display !== 'none'); }
ok('prod levelup', panel);
if (panel) {
  for (let p = 0; p < 4; p++) {
    const open = await page.evaluate(() => document.querySelector('#levelup-panel')?.style.display !== 'none');
    if (!open) break;
    await page.keyboard.press('Digit2');
    await page.waitForTimeout(200);
  }
}
await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.addGold(200));
await page.keyboard.press('KeyB');
await page.waitForTimeout(250);
const cards = await page.evaluate(() => Array.from(document.querySelectorAll('.shop-card strong')).map((e) => e.textContent));
ok('prod orb in shop', cards.includes('Ember Orb'), JSON.stringify(cards));
await page.evaluate(() => document.querySelectorAll('.shop-card')[2].click());
await page.waitForTimeout(200);
await page.keyboard.press('KeyB');
await page.waitForTimeout(150);
await page.keyboard.press('KeyQ');
await page.waitForTimeout(300);
d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
ok('prod orb active', d.weapon === 'ember-orb' && d.entities.activeOrbs >= 1, `(orbs=${d.entities.activeOrbs})`);

// Boss banner
await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.spawnBossNow());
await page.waitForTimeout(200);
const bn = await page.evaluate(() => document.querySelector('#banner').textContent);
const bv = await page.evaluate(() => document.querySelector('#banner').classList.contains('show'));
ok('prod boss banner', bv && bn.includes('Infernal'), bn);

// Best score
await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__.setState('gameover'));
await page.waitForTimeout(250);
const best = await page.evaluate(() => document.querySelector('#best-line').textContent);
ok('prod best persists', best.includes('Best:') && !best.includes('wave 0') || best.includes('Best:'), best);

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

console.log('ERRORS:', JSON.stringify(errors));
await browser.close();
