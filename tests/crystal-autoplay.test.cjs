const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const { chromium } = require("playwright");
let browser, server, url;
before(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"));
  server = http.createServer((_, r) => {
    r.setHeader("Content-Type", "text/html");
    r.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
});
async function game(t, seen = false) {
  const p = await browser.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.skip(true));
  await p.evaluate((seen) => {
    newRun("fighter");
    closeModal();
    closeSpotlight();
    setPace("skip");
    setPreference("shake", 0);
    characterLuck = () => 0.99999;
    setAutoplay(false);
    setAutoresolve(false);
    state.party[0].points = 0;
    state.map = Array.from({ length: W * H }, () => ({
      seen: true,
      wall: true,
      terrain: "stone",
      event: null,
      corpses: [],
      visited: false,
      lastNearCommand: state.moveCommands || 0,
    }));
    state.map[0].biome = "crystal";
    state.map[0].floorName = "Quartz test";
    state.position = pos(3, 4);
    window.quartz = pos(4, 4);
    window.beyondQuartz = pos(5, 4);
    Object.assign(state.map[state.position], {
      wall: false,
      terrain: "floor",
      visited: true,
    });
    Object.assign(state.map[quartz], { terrain: "crystal", seen });
    Object.assign(state.map[beyondQuartz], {
      wall: false,
      terrain: "floor",
      seen: false,
    });
    state.pursuerSpawned = true;
    state.lastMinorEventStep = 100000;
    render();
  }, seen);
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, [], "no browser errors");
  });
  return p;
}
test("uncovering quartz during autoplay resolves the decision and continues beyond the blocked passage", async (t) => {
  const p = await game(t);
  // Hold only the confirmation while inspecting the suspended movement driver.
  // Under browser load, the real reading delay can expire between two protocol
  // calls; that should not make a successful automatic choice fail this check.
  await p.evaluate(() => {
    window.quartzConfirmReady = automaticConfirmReady;
    automaticConfirmReady = (button, kind) =>
      button?.id === "crystal-smash" ? false : quartzConfirmReady(button, kind);
  });
  await p.locator("#autoplay").check();
  await p.locator("#crystal-smash").waitFor({ timeout: 15000 });
  assert.equal(
    await p.evaluate(() => busy && autoplayActing && !!travel),
    true,
    "the movement driver is waiting for the real decision",
  );
  await p.evaluate(() => {
    automaticConfirmReady = quartzConfirmReady;
  });
  await p.waitForFunction(
    () =>
      state.map[quartz].terrain === "brokenCrystal" &&
      state.position === beyondQuartz &&
      !busy,
    null,
    { timeout: 6000 },
  );
  const r = await p.evaluate(() => ({
    wall: state.map[quartz].wall,
    aura: crystalSources(quartz).includes(quartz),
    travel,
    resolver: !!stageResolver,
    fight: state.autoresolve,
  }));
  assert.equal(r.wall, false);
  assert.equal(r.aura, false);
  assert.equal(r.travel, null);
  assert.equal(r.resolver, false);
  assert.equal(r.fight, false);
});
test("enabling autoplay on an already-open crystal prompt smashes it and releases manual movement", async (t) => {
  const p = await game(t, true);
  await p.evaluate(() => {
    window.quartzMove = move(quartz);
  });
  await p.locator("#crystal-smash").waitFor();
  await p.locator("#autoplay").check();
  await p.waitForFunction(
    () => state.map[quartz].terrain === "brokenCrystal" && !busy,
    null,
    { timeout: 6000 },
  );
  await p.evaluate(() => quartzMove);
  await p.waitForFunction(() => state.position === beyondQuartz, null, {
    timeout: 6000,
  });
});
test("autofight alone leaves the crystal decision to the player", async (t) => {
  const p = await game(t, true);
  await p.evaluate(() => {
    setAutoresolve(true);
    window.quartzMove = move(quartz);
  });
  await p.locator("#crystal-smash").waitFor();
  await p.waitForTimeout(700);
  assert.equal(await p.evaluate(() => state.map[quartz].terrain), "crystal");
  await p.locator("#crystal-leave").click();
  await p.evaluate(() => quartzMove);
  assert.equal(await p.evaluate(() => state.map[quartz].wall), true);
});
test("options pause an automatic crystal decision, which resumes on returning to the map", async (t) => {
  const p = await game(t, true);
  const delay = await p.evaluate(() => {
    window.quartzMove = move(quartz);
    setAutoplay(true);
    const immediate = autoplayPrompt();
    document.querySelector("#options-tab").click();
    return { immediate, delay: automaticReadDelay("crystal-choice") };
  });
  assert.equal(
    delay.immediate,
    false,
    "normal automatic reading delay still applies",
  );
  await p.waitForTimeout(delay.delay + 150);
  assert.equal(
    await p.evaluate(
      () => state.map[quartz].terrain === "crystal" && utilityOpen,
    ),
    true,
  );
  await p.evaluate(() => closeUtilityPage());
  await p.waitForFunction(
    () => state.map[quartz].terrain === "brokenCrystal" && !busy,
    null,
    { timeout: 6000 },
  );
  await p.evaluate(() => quartzMove);
});
test("turning autoplay off preserves the crystal choice and manual Leave remains effective", async (t) => {
  const p = await game(t, true);
  await p.evaluate(() => {
    window.quartzMove = move(quartz);
    setAutoplay(true);
    autoplayPrompt();
    setAutoplay(false);
  });
  await p.waitForTimeout(700);
  assert.equal(await p.evaluate(() => state.map[quartz].terrain), "crystal");
  await p.locator("#crystal-leave").click();
  await p.evaluate(() => quartzMove);
  assert.equal(
    await p.evaluate(() => state.map[quartz].wall && !busy && !stageResolver),
    true,
  );
});
