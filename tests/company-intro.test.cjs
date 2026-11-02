const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
let browser, server, url;
const root = path.resolve(__dirname, "..");
before(async () => {
  const html = await fs.readFile(path.join(root, "index.html"));
  server = http.createServer((q, r) => { r.setHeader("Content-Type", "text/html"); r.end(html); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
  await fs.mkdir(path.join(root, "test-results/company-intro"), { recursive: true });
});
after(async () => { await browser?.close(); await new Promise((r) => server.close(r)); });
async function pageFor(t, options = {}, setup) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, ...options });
  const errors = [], external = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => { if (!r.url().startsWith(url) && !/^(data:|file:)/.test(r.url())) external.push(r.url()); });
  if (setup) await p.addInitScript(setup);
  t.after(async () => { await p.close(); assert.deepEqual(errors, []); assert.deepEqual(external, []); });
  return p;
}

test("uploaded film really decodes and plays before run creation, then fades into the notebook", async (t) => {
  const p = await pageFor(t);
  await p.goto(url);
  await p.waitForFunction(() => document.querySelector("video").currentTime > 2);
  assert.deepEqual(await p.evaluate(() => ({
    uninitialized: !state, saved: localStorage.getItem(SAVE_KEY),
    inert: document.querySelector(".desk").inert, active: CompanyIntro.active,
    muted: document.querySelector("video").muted,
    size: [document.querySelector("video").videoWidth, document.querySelector("video").videoHeight],
  })), { uninitialized: true, saved: null, inert: true, active: true, muted: true, size: [1920, 1080] });
  await p.screenshot({ path: path.join(root, "test-results/company-intro/01-logo-1920.png") });
  await p.evaluate(() => CompanyIntro.ready);
  assert.equal(await p.locator("#company-intro").count(), 0);
  assert.equal(await p.evaluate(() => !!state.awaitingStarter && !document.querySelector(".desk").inert && !CompanyIntro.active), true);
  assert.equal(await p.evaluate(() => !!document.activeElement.closest("#modal")), true, "keyboard focus starts inside the class choice");
  await p.screenshot({ path: path.join(root, "test-results/company-intro/02-game-1920.png") });
});

test("skip button makes one black transition and creates only one run despite repeated input", async (t) => {
  const p = await pageFor(t);
  await p.goto(url);
  await p.evaluate(() => { window.boots = 0; const original = newRun; newRun = (...a) => { boots++; return original(...a); }; });
  await p.locator("#company-intro-skip").click();
  await p.keyboard.press("Enter");
  await p.evaluate(() => CompanyIntro.ready);
  assert.equal(await p.evaluate(() => boots), 1);
  assert.equal(await p.evaluate(() => state.awaitingStarter), true, "skip must not also select a class");
});

test("keyboard and controller can skip; gameplay shortcuts never leak through the curtain", async (t) => {
  for (const input of ["Escape", "Space", "Enter", "controller", "blocked-controller"]) {
    const p = await pageFor(t);
    await p.goto(url);
    await p.keyboard.press("e");
    assert.equal(await p.evaluate(() => !state && document.activeElement.id === "company-intro-skip"), true);
    if (input === "blocked-controller") {
      await p.evaluate(() => { navigator.getGamepads = () => { throw new DOMException("Gamepad policy denied", "SecurityError"); }; });
      await p.waitForTimeout(100);
      await p.keyboard.press("Escape");
    } else if (input === "controller") await p.evaluate(() => { navigator.getGamepads = () => [{ buttons: [{ pressed: true }] }]; });
    else await p.keyboard.press(input);
    await p.evaluate(() => CompanyIntro.ready);
    assert.equal(await p.evaluate(() => !!state.awaitingStarter), true);
  }
});

test("unsupported or rejected playback fails open instead of leaving a black screen", async (t) => {
  const p = await pageFor(t, {}, () => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("Playback blocked", "NotAllowedError"));
  });
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.ready);
  assert.equal(await p.evaluate(() => !!state && !CompanyIntro.active), true);
});

test("media errors and a permanently stalled player both reach the game", async (t) => {
  const error = await pageFor(t);
  await error.goto(url);
  await error.evaluate(() => document.querySelector("video").dispatchEvent(new Event("error")));
  await error.evaluate(() => CompanyIntro.ready);
  assert.equal(await error.locator("#company-intro").count(), 0);
  const stalled = await pageFor(t, {}, () => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
  await stalled.goto(url);
  await stalled.evaluate(() => CompanyIntro.ready);
  assert.equal(await stalled.evaluate(() => !!state && !CompanyIntro.active), true);
});

test("reduced motion bypasses the film without delaying game access", async (t) => {
  const p = await pageFor(t, { reducedMotion: "reduce" });
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.ready);
  assert.equal(await p.locator("#company-intro").count(), 0);
  assert.equal(await p.evaluate(() => state.speed), "skip");
});

test("backgrounding pauses the film without starting an expedition", async (t) => {
  const p = await pageFor(t);
  await p.goto(url);
  await p.waitForFunction(() => document.querySelector("video").currentTime > .2);
  const pausedAt = await p.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    return document.querySelector("video").currentTime;
  });
  await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => document.querySelector("video").paused && !state), true);
  assert.ok(Math.abs(await p.evaluate(() => document.querySelector("video").currentTime) - pausedAt) < .1);
  await p.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.waitForFunction((time) => document.querySelector("video").currentTime > time + .1, pausedAt);
  await p.evaluate(() => CompanyIntro.skip(true));
});

test("reload shows the intro again and preserves the saved expedition and preferences", async (t) => {
  const p = await pageFor(t);
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.skip(true));
  const before = await p.evaluate(() => {
    newRun("rogue"); setPace("3"); state.gold = 123; state.party[0].hp = 7; save();
    return { position: state.position, hero: state.party[0].id,
      map: state.map.map(({wall, seen, visited, event, feature, terrain, doodle}) => ({wall, seen, visited, event, feature, terrain, doodle})) };
  });
  await p.reload();
  assert.equal(await p.evaluate(() => !state && CompanyIntro.active), true);
  await p.evaluate(() => CompanyIntro.skip(true));
  assert.deepEqual(await p.evaluate(() => ({ position: state.position, hero: state.party[0].id,
    map: state.map.map(({wall, seen, visited, event, feature, terrain, doodle}) => ({wall, seen, visited, event, feature, terrain, doodle})) })), before);
  assert.deepEqual(await p.evaluate(() => [state.gold, state.party[0].hp, state.speed]), [123, 7, "3"]);
});

test("self-contained file playback fits Deck and phone without cropping and retains intro in HTML backup", async (t) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const p = await pageFor(t, { viewport });
    // The managed Chromium policy blocks file:// navigation. Load the exact
    // file bytes with networking disabled to exercise the offline distribution.
    await p.context().setOffline(true);
    await p.setContent(await fs.readFile(path.join(root, "index.html"), "utf8"));
    await p.waitForFunction(() => document.querySelector("video").currentTime > 1);
    assert.equal(await p.locator("video").evaluate((v) => getComputedStyle(v).objectFit), "contain");
    const b = await p.locator("#company-intro-skip").boundingBox();
    assert.ok(b.x >= 0 && b.x + b.width <= viewport.width && b.y + b.height <= viewport.height && b.height >= 44);
    await p.screenshot({ path: path.join(root, `test-results/company-intro/03-logo-${viewport.width}.png`) });
    await p.evaluate(() => CompanyIntro.skip(true));
    assert.equal(await p.evaluate(() => HTML_BACKUP.includes('data:video/mp4;base64,') && HTML_BACKUP.includes('class="company-intro-active"') && !HTML_BACKUP.includes('id="book" inert')), true);
  }
});
