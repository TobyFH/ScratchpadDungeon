const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
let browser, server, url;
const out = path.resolve(__dirname, '../test-results/rogue-backstab');
before(async () => {
  fs.mkdirSync(out, { recursive: true });
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'));
  server = http.createServer((_, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function game(t, width = 1920, height = 1080, count = 1, palette = 'default') {
  const p = await browser.newPage({ viewport: { width, height } }), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.skip(true));
  await p.evaluate(async ({ count, palette }) => {
    newRun('rogue'); setPace('skip');
    closeModal(); closeSpotlight(); scheduleStunRecovery = () => {};
    beginEncounter(false, { count }); finishOpeningRoll(); closeSpotlight();
    state.enemies.forEach(e => { e.hp = e.maxHp = 1000; e.countdown = 99; e.passive = null; });
    state.palette = palette; setPreference('shake', 0); setPreference('skipCriticals', true);
    render(); await document.fonts.ready; fitNotebook();
    setPace('1'); sceneFast = false;
  }, { count, palette });
  t.after(async () => { await p.close(); assert.deepEqual(errors, []); });
  return p;
}
async function launch(p, enemy = 0) {
  await p.evaluate(enemy => {
    window.beforeBackstab = { hp: state.enemies.map(e => e.hp), heroHP: state.party[0].hp, rolls: state.party[0].rolls };
    window.backstabTask = classSignatureFX(state.party[0], state.enemies[enemy], 'rogue');
  }, enemy);
}
async function hold(p, progress) {
  await p.waitForFunction(progress => {
    const value = Number(document.querySelector('.class-sketch-rogue')?.dataset.progress);
    if (!Number.isFinite(value) || value < progress) return false;
    utilityOpen = true;
    return true;
  }, progress);
}

test('Flurry shadows the actual portrait behind the selected enemy, slashes three times and returns without changing combat or RNG', async t => {
  const p = await game(t, 1920, 1080, 2);
  await p.evaluate(() => {
    window.rngCalls = 0; window.realRandom = Math.random;
    Math.random = () => { window.rngCalls++; return .5; };
    window.originalPortraitBounds = JSON.stringify(entityArt(state.party[0]).getBoundingClientRect().toJSON());
    window.impactCalls = 0; window.originalBurst = burst;
    burst = (node, kind, count) => { if (node === enemyArtEl(state.enemies[1]) && count === 14) window.impactCalls++; return originalBurst(node, kind, count); };
  });
  await launch(p, 1); await hold(p, .37);
  await p.screenshot({ path: path.join(out, 'dual-behind-1920.png') });
  await p.evaluate(() => { utilityOpen = false; }); await hold(p, .53);
  const middle = await p.evaluate(() => {
    const overlay = document.querySelector('.class-sketch-rogue');
    return {
      target: overlay.dataset.target, expected: state.enemies[1].id,
      phase: overlay.dataset.phase, actor: !!overlay.querySelector('.rogue-actor use'),
      cuts: overlay.querySelectorAll('.rogue-cut').length,
      occlusion: !!overlay.querySelector('mask .rogue-occluder svg'),
      away: entityArt(state.party[0]).classList.contains('rogue-away'),
      hidden: getComputedStyle(entityArt(state.party[0]).querySelector(':scope > svg')).opacity,
      bounds: JSON.stringify(entityArt(state.party[0]).getBoundingClientRect().toJSON()) === originalPortraitBounds,
      pointer: getComputedStyle(overlay).pointerEvents,
    };
  });
  assert.equal(middle.target, middle.expected); assert.equal(middle.phase, 'slash');
  assert.equal(middle.cuts, 3); assert.ok(middle.actor && middle.occlusion && middle.away && middle.bounds);
  assert.equal(middle.hidden, '0'); assert.equal(middle.pointer, 'none');
  await p.screenshot({ path: path.join(out, 'dual-backstab-1920.png') });
  await p.evaluate(() => { utilityOpen = false; });
  await hold(p, .88);
  await p.screenshot({ path: path.join(out, 'dual-return-1920.png') });
  await p.evaluate(() => { utilityOpen = false; });
  await p.evaluate(() => window.backstabTask);
  const end = await p.evaluate(() => {
    Math.random = realRandom;
    return { rng: rngCalls, impacts: impactCalls, overlays: document.querySelectorAll('.class-sketch-rogue').length,
      hidden: document.querySelectorAll('.rogue-away').length,
      unchanged: JSON.stringify(beforeBackstab) === JSON.stringify({ hp: state.enemies.map(e => e.hp), heroHP: state.party[0].hp, rolls: state.party[0].rolls }) };
  });
  assert.deepEqual(end, { rng: 0, impacts: 3, overlays: 0, hidden: 0, unchanged: true });
});

test('utility suspension freezes the backstab and hides it above an open utility page', async t => {
  const p = await game(t); await launch(p); await hold(p, .34);
  const before = await p.locator('.class-sketch-rogue').getAttribute('data-progress');
  await p.evaluate(() => { utilityOpen = false; openUtilityPage('options'); });
  await p.waitForTimeout(150);
  assert.equal(await p.locator('.class-sketch-rogue').getAttribute('data-progress'), before);
  assert.equal(await p.locator('.class-sketch-rogue').evaluate(el => getComputedStyle(el).visibility), 'hidden');
  await p.evaluate(() => closeUtilityPage());
  await p.evaluate(() => window.backstabTask);
  assert.equal(await p.locator('.rogue-away').count(), 0);
});

test('a real Flurry roll invokes one backstab, ordinary Rogue rolls do not, and damage still comes from the combat pipeline', async t => {
  const p = await game(t);
  const result = await p.evaluate(async () => {
    setPace('skip'); characterLuck = () => .99999; Math.random = () => 0;
    const h = state.party[0]; h.specialism = 'defence'; h.trait = null;
    state.enemy.hp = state.enemy.maxHp = 1000; state.enemy.countdown = 99;
    setEnemyBlock(0); state.block = 0;
    h.reels = [ [{ type: 'attack', tier: 1 }], [{ type: 'class', tier: 1, job: 'rogue' }], [{ type: 'attack', tier: 2 }] ];
    let signatures = 0; const real = classSignatureFX;
    classSignatureFX = (...args) => { signatures++; return real(...args); };
    render(); await spin(0);
    const first = { signatures, hp: state.enemy.hp, hits: state.lastPlayerRoll.hits.map(hit => hit.power), kind: state.lastClassSketch.kind };
    h.reels[1] = [{ type: 'attack', tier: 1 }]; render(); await spin(0);
    return { first, signatures, remaining: document.querySelectorAll('.class-sketch-rogue, .rogue-away').length };
  });
  assert.equal(result.first.signatures, 1); assert.equal(result.signatures, 1);
  assert.equal(result.first.kind, 'rogue'); assert.ok(result.first.hp < 1000);
  assert.ok(result.first.hits.length >= 4, JSON.stringify(result));
  assert.equal(result.remaining, 0);
});

test('Skip, reduced motion and zero portrait motion keep impact feedback without a travelling portrait', async t => {
  const p = await game(t);
  for (const mode of ['skip', 'reduced', 'motion']) {
    await p.emulateMedia({ reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
    const result = await p.evaluate(async mode => {
      setPace(mode === 'skip' ? 'skip' : '1'); sceneFast = false;
      setPreference('portraitMotion', mode === 'motion' ? 0 : 1);
      let particles = 0; const realBurst = burst;
      burst = (node, kind, count) => { particles += count; };
      try { await classSignatureFX(state.party[0], state.enemy); }
      finally { burst = realBurst; }
      return { particles, overlays: document.querySelectorAll('.class-sketch-rogue').length, away: document.querySelectorAll('.rogue-away').length };
    }, mode);
    assert.deepEqual(result, { particles: 85, overlays: 0, away: 0 });
  }
});

test('fast-forward, restarting, resizing and removal of the target always restore the portrait', async t => {
  const p = await game(t);
  for (const cancel of ['fast', 'resize', 'target', 'restart']) {
    if (cancel !== 'fast') await p.evaluate(() => { newRun('rogue'); setPace('skip'); closeModal(); closeSpotlight(); beginEncounter(false, { count: 1 }); finishOpeningRoll(); closeSpotlight(); render(); setPace('1'); sceneFast = false; });
    await launch(p); await hold(p, .34);
    await p.evaluate(() => { utilityOpen = false; });
    if (cancel === 'resize') await p.setViewportSize({ width: 1600, height: 1000 });
    else await p.evaluate(cancel => {
      if (cancel === 'fast') sceneFast = true;
      else if (cancel === 'target') enemyArtEl(state.enemy).remove();
      else newRun('rogue');
    }, cancel);
    await p.evaluate(() => { utilityOpen = false; });
    await p.evaluate(() => window.backstabTask);
    assert.equal(await p.locator('.class-sketch-rogue, .rogue-away').count(), 0, cancel);
  }
});

for (const [width, height, palette] of [[1280, 800, 'default'], [1280, 800, 'dark'], [390, 844, 'default'], [320, 844, 'warm']]) {
  test(`backstab fits and returns cleanly at ${width}×${height} (${palette})`, async t => {
    const p = await game(t, width, height, 1, palette);
    if (width < 600) await p.locator('#enemy-art').scrollIntoViewIfNeeded();
    await launch(p); await hold(p, .52);
    const bounds = await p.locator('.rogue-actor').evaluate(el => {
      const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: innerWidth, h: innerHeight };
    });
    assert.ok(bounds.left >= -2 && bounds.right <= bounds.w + 2, JSON.stringify(bounds));
    assert.ok(bounds.top >= -2 && bounds.bottom <= bounds.h + 2, JSON.stringify(bounds));
    await p.screenshot({ path: path.join(out, `backstab-${width}-${palette}.png`) });
    await p.evaluate(() => { utilityOpen = false; }); await p.evaluate(() => window.backstabTask);
    assert.equal(await p.locator('.class-sketch-rogue, .rogue-away').count(), 0);
  });
}
