const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
let browser, server, url;
before(async () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"));
  server = http.createServer((_, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function game(t, width = 1920, height = 1080) {
  const page = await browser.newPage({ viewport: { width, height } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(async () => {
    newRun("fighter");
    window.actualScheduleStunRecovery = scheduleStunRecovery;
    scheduleStunRecovery = () => {};
    setPace("skip");
    setPreference("shake", 0);
    setPreference("skipCriticals", true);
    characterLuck = () => 0.99999;
    await document.fonts.ready;
  });
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
  });
  return page;
}

async function fight(p, jobs = ["fighter"]) {
  await p.evaluate((jobs) => {
    closeModal();
    closeSpotlight();
    state.party = jobs.map((job) => makeHero(job, job));
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    Object.assign(state.enemy, {
      hp: 1000,
      maxHp: 1000,
      countdown: 99,
      passive: null,
    });
    setEnemyBlock(0);
    state.block = 0;
    render();
  }, jobs);
}
async function flat(p, theme = "cave") {
  await p.evaluate((theme) => {
    closeModal();
    closeSpotlight();
    state.enemy = null;
    state.enemies = [];
    busy = false;
    travel = null;
    state.position = pos(1, 7);
    state.map = Array.from({ length: W * H }, (_, i) => ({
      wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
      seen: true,
      visited: false,
      event: null,
      feature: null,
      terrain:
        i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1)
          ? "stone"
          : "floor",
      doodle: 0,
      corpses: [],
    }));
    state.map[pos(9, 1)].event = "stairs";
    state.map[pos(9, 1)].feature = "stairs";
    state.map[0].biome = theme;
    state.map[0].floorName = BIOMES[theme].names[0];
    state.pursuerSpawned = true;
    minorTravelEvent = async () => false;
    travelCharacterMoment = () => false;
    render();
  }, theme);
}
async function terrain(p) {
  await p.evaluate(() => {
    state.map[pos(3, 3)] = {
      wall: true,
      terrain: "river",
      seen: true,
      visited: false,
      event: null,
      feature: null,
      corpses: [],
    };
    state.map[pos(4, 3)] = {
      wall: true,
      terrain: "lava",
      seen: true,
      visited: false,
      event: null,
      feature: null,
      corpses: [],
    };
    state.map[pos(5, 3)] = {
      wall: false,
      terrain: "bridge",
      seen: true,
      visited: false,
      event: null,
      feature: null,
      corpses: [],
    };
    state.map[pos(6, 3)] = {
      wall: true,
      terrain: "river",
      seen: false,
      visited: false,
      event: null,
      feature: null,
      corpses: [],
    };
    render();
  });
}

test("river flow and lava bubbles animate only visible terrain, keep borders/decks fixed and alter no world data", async (t) => {
  const p = await game(t);
  await terrain(p);
  const r = await p.evaluate(() => {
    const before = JSON.stringify(state.map),
      randomBefore = Math.random;
    let calls = 0;
    Math.random = () => {
      calls++;
      return 0.5;
    };
    setPreference("tileMotion", true);
    const river = $(`[data-tile="${pos(3, 3)}"]`),
      lava = $(`[data-tile="${pos(4, 3)}"]`),
      bridge = $(`[data-tile="${pos(5, 3)}"]`),
      fog = $(`[data-tile="${pos(6, 3)}"]`);
    const result = {
      river: getComputedStyle(river.querySelector("svg path")).animationName,
      lava: getComputedStyle(lava, "::after").animationName,
      border: getComputedStyle(lava.querySelector(".terrain-boundary"))
        .animationName,
      water: getComputedStyle(bridge.querySelector(".bridge-water path"))
        .animationName,
      deck: getComputedStyle(bridge.querySelector(".bridge-deck"))
        .animationName,
      fog: getComputedStyle(fog, "::after").animationName,
    };
    setPreference("tileMotion", false);
    result.offRiver = getComputedStyle(
      river.querySelector("svg path"),
    ).animationName;
    result.offLava = getComputedStyle(lava, "::after").content;
    result.calls = calls;
    result.unchanged = before === JSON.stringify(state.map);
    Math.random = randomBefore;
    return result;
  });
  assert.match(r.river, /terrain-river/);
  assert.match(r.lava, /terrain-lava/);
  assert.match(r.water, /terrain-river/);
  assert.equal(r.border, "none");
  assert.equal(r.deck, "none");
  assert.doesNotMatch(r.fog, /terrain-/);
  assert.equal(r.offRiver, "none");
  assert.equal(r.offLava, "none");
  assert.equal(r.calls, 0);
  assert.equal(r.unchanged, true);
});

test("Animated terrain is a real saved display option, independent of portrait movement", async (t) => {
  const p = await game(t);
  await terrain(p);
  await p.evaluate(() => optionsPage("display"));
  await p.locator('[data-setting="tileMotion"]').uncheck();
  assert.equal(await p.evaluate(() => state.preferences.tileMotion), false);
  assert.equal(
    await p.evaluate(() =>
      document.body.classList.contains("tile-motion-enabled"),
    ),
    false,
  );
  await p.evaluate(() => {
    closeModal();
    newRun("fighter");
  });
  assert.equal(await p.evaluate(() => state.preferences.tileMotion), false);
  await p.reload();
  assert.equal(await p.evaluate(() => state.preferences.tileMotion), false);
  await p.evaluate(() => {
    setPreference("tileMotion", true);
    setPreference("portraitMotion", 0);
  });
  assert.equal(
    await p.evaluate(() =>
      document.body.classList.contains("tile-motion-enabled"),
    ),
    true,
  );
});

test("reduced motion suppresses terrain loops without changing passability or disabling the preference", async (t) => {
  const p = await game(t);
  await terrain(p);
  await p.emulateMedia({ reducedMotion: "reduce" });
  const r = await p.evaluate(() => {
    const lava = $(`[data-tile="${pos(4, 3)}"]`),
      river = $(`[data-tile="${pos(3, 3)}"]`);
    return {
      lava: getComputedStyle(lava, "::after").content,
      river: getComputedStyle(river.querySelector("svg path")).animationName,
      pref: state.preferences.tileMotion,
      blocked: state.map[pos(4, 3)].wall && state.map[pos(3, 3)].wall,
      bridge: !state.map[pos(5, 3)].wall,
    };
  });
  assert.equal(r.lava, "none");
  assert.equal(r.river, "none");
  assert.equal(r.pref, true);
  assert.equal(r.blocked, true);
  assert.equal(r.bridge, true);
});
