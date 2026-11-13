const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
let browser, server, url, html;
const out = path.join(__dirname, "../test-results/main-menu");
before(async () => {
  html = await fs.readFile(path.join(__dirname, "../index.html"), "utf8");
  server = http.createServer((_, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  await fs.mkdir(out, { recursive: true });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function menu(t, options = {}) {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    ...options,
  });
  const errors = [],
    external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(url) && !/^(data:|file:)/.test(request.url()))
      external.push(request.url());
  });
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, [], "no browser errors");
    assert.deepEqual(external, [], "no external runtime assets");
  });
  await page.goto(url);
  await page.evaluate(() => CompanyIntro.skip(true));
  return page;
}
async function savedMenu(page, setup = () => {}) {
  await page.evaluate(() => {
    newRun("rogue");
    state.gold = 321;
    state.party[0].hp = 11;
  });
  await page.evaluate(setup);
  await page.evaluate(() => save());
  const raw = await page.evaluate(() => localStorage.getItem(SAVE_KEY));
  await page.reload();
  await page.evaluate(() => CompanyIntro.skip(true));
  return raw;
}

test("fresh title follows the intro, has no Continue, and creates no saved expedition", async (t) => {
  const page = await menu(t);
  assert.equal(await page.locator("#main-menu").isVisible(), true);
  assert.equal(await page.locator("#menu-continue").isVisible(), false);
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), null);
  assert.deepEqual(
    await page.evaluate(() => ({
      focus: document.activeElement.id,
      suspended: document.querySelector(".desk").inert,
      exploring: canExplore(),
      music: musicSelection().id,
    })),
    {
      focus: "menu-new-run",
      suspended: true,
      exploring: false,
      music: "title",
    },
  );
  await page.keyboard.press("e");
  assert.equal(
    await page.locator("#overlay").isVisible(),
    false,
    "game hotkeys stay behind title",
  );
});

test("title utility pages return focus to their buttons without creating a run", async (t) => {
  const page = await menu(t);
  for (const id of ["menu-options", "menu-guide", "menu-bestiary"]) {
    await page.locator("#" + id).click();
    assert.equal(await page.locator("#overlay").isVisible(), true);
    assert.equal(await page.evaluate(() => musicSelection().id), "title");
    await page
      .getByRole("button", { name: "Back to main menu", exact: true })
      .click();
    assert.equal(await page.evaluate(() => document.activeElement.id), id);
    assert.equal(
      await page.evaluate(() => localStorage.getItem(SAVE_KEY)),
      null,
    );
  }
});

test("saved run remains byte-for-byte unchanged while title settings persist separately", async (t) => {
  const page = await menu(t),
    raw = await savedMenu(page);
  assert.equal(await page.locator("#menu-continue").isVisible(), true);
  await page.locator("#menu-options").click();
  await page.locator("#option-speed").selectOption("3");
  await page.locator("#tab-display").click();
  await page.locator("#option-palette").selectOption("dark");
  await page.locator("#setting-shake").fill("80");
  await page.locator("#setting-shake").dispatchEvent("input");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), raw);
  await page.reload();
  await page.evaluate(() => CompanyIntro.skip(true));
  assert.deepEqual(
    await page.evaluate(() => [
      state.speed,
      state.palette,
      preferences().shake,
    ]),
    ["3", "dark", 0.8],
  );
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), raw);
  await page.locator("#menu-continue").click();
  assert.equal(await page.evaluate(() => MainMenu.visible), false);
  assert.deepEqual(
    await page.evaluate(() => [state.gold, state.party[0].hp]),
    [321, 11],
  );
  assert.equal(await page.evaluate(() => canExplore()), true);
});

test("autoplay, autofight and active exploration clocks wait for Continue", async (t) => {
  const page = await menu(t),
    raw = await savedMenu(page, () => {
      state.autoplay = state.autoresolve = true;
      state.exploreTime = 73;
      beginEncounter();
      finishOpeningRoll();
      closeSpotlight();
      render();
    });
  const before = await page.evaluate(() => ({
    hp: state.enemies.map((enemy) => enemy.hp),
    clocks: state.enemies.map((enemy) => enemy.countdown),
    serial: state.actionSerial,
    time: state.exploreTime,
  }));
  await page.evaluate(async () => {
    await autoplayTick();
    await autoresolveTick();
    scheduleStunRecovery();
  });
  await page.waitForTimeout(1100);
  assert.deepEqual(
    await page.evaluate(() => ({
      hp: state.enemies.map((enemy) => enemy.hp),
      clocks: state.enemies.map((enemy) => enemy.countdown),
      serial: state.actionSerial,
      time: state.exploreTime,
    })),
    before,
  );
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), raw);
  assert.equal(await page.locator("#spotlight").isVisible(), false);
});

test("saved death acknowledgement starts only after Continue and receives keyboard focus", async (t) => {
  const page = await menu(t);
  await savedMenu(page, () => {
    state.party.push(makeHero("Mira", "mage"));
    damageHero(1, 999, "An arrow trap");
  });
  assert.equal(await page.locator("#death-confirm").count(), 0);
  await page.locator("#menu-continue").click();
  await page.waitForSelector("#death-confirm");
  assert.equal(
    await page.evaluate(() => !!document.activeElement.closest("#stage-card")),
    true,
  );
  await page.locator("#death-confirm").click();
  await page.waitForSelector("#burial-confirm");
  await page.locator("#burial-confirm").click();
  await page.waitForFunction(() => !busy);
  assert.equal(await page.evaluate(() => state.party.length), 1);
});

test("New Run can be cancelled without changing a save, then starts the chosen class", async (t) => {
  const page = await menu(t),
    raw = await savedMenu(page);
  await page.locator("#menu-new-run").click();
  await page.locator("#starter-back-menu").click();
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), raw);
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "menu-continue",
  );
  await page.locator("#menu-new-run").click();
  await page.locator('[data-start-job="mage"]').click();
  await page.waitForFunction(() => !MainMenu.visible);
  assert.equal(await page.evaluate(() => state.party[0].job), "mage");
  assert.equal(await page.evaluate(() => state.awaitingStarter), false);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem(SAVE_KEY)).party[0].job,
    ),
    "mage",
  );
});

test("finished, unchosen and corrupt runs do not offer Continue or get overwritten by browsing", async (t) => {
  for (const kind of ["finished", "unchosen", "corrupt"]) {
    const page = await menu(t);
    await page.evaluate((kind) => {
      newRun();
      state.over = kind === "finished";
      state.awaitingStarter = kind === "unchosen";
      save();
      if (kind === "corrupt") localStorage.setItem(SAVE_KEY, "{broken");
    }, kind);
    const raw = await page.evaluate(() => localStorage.getItem(SAVE_KEY));
    await page.reload();
    await page.evaluate(() => CompanyIntro.skip(true));
    assert.equal(await page.locator("#menu-continue").isVisible(), false, kind);
    await page.locator("#menu-guide").click();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => localStorage.getItem(SAVE_KEY)),
      raw,
      kind,
    );
  }
});

test("resetting progress at title keeps options and leaves no pretend run to continue", async (t) => {
  const page = await menu(t);
  await savedMenu(page);
  await page.evaluate(() => setPace("5"));
  await page.locator("#menu-options").click();
  await page.locator("#option-reset-save").click();
  await page.locator("#confirm-save-reset").click();
  assert.equal(await page.locator("#menu-continue").isVisible(), false);
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), null);
  assert.equal(await page.evaluate(() => readSettings().speed), "5");
  assert.equal(await page.evaluate(() => MainMenu.visible), true);
});

test("keyboard arrows and Enter open menu pages, hover feedback keeps button hitboxes fixed", async (t) => {
  const page = await menu(t);
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "menu-options",
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#overlay").isVisible(), true);
  await page.keyboard.press("Escape");
  await page.mouse.click(25, 400);
  const button = page.locator("#menu-new-run"),
    before = await button.boundingBox();
  await button.hover();
  await page.waitForTimeout(180);
  assert.deepEqual(await button.boundingBox(), before);
  assert.notEqual(
    await button
      .locator("span")
      .evaluate((node) => getComputedStyle(node).transform),
    "none",
  );
  assert.notEqual(
    await button.evaluate((node) => getComputedStyle(node).boxShadow),
    "none",
  );
});

test("title and buttons fit desktop, Deck, phone and short windows without scrolling", async (t) => {
  const page = await menu(t);
  await savedMenu(page);
  await page.evaluate(() => document.fonts.ready);
  for (const [width, height] of [
    [1920, 1080],
    [1671, 941],
    [1280, 800],
    [390, 844],
    [320, 700],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const boxes = await page
      .locator("#main-menu h1, #main-menu button:not([hidden]), .title-cave")
      .evaluateAll((nodes) =>
        nodes.map((node) => {
          const b = node.getBoundingClientRect();
          return {
            tag: node.tagName,
            text: node.textContent.trim(),
            x: b.x,
            y: b.y,
            right: b.right,
            bottom: b.bottom,
            height: b.height,
          };
        }),
      );
    for (const box of boxes) {
      assert.ok(
        box.x >= 0 &&
          box.y >= 0 &&
          box.right <= width + 1 &&
          box.bottom <= height + 1,
        `${width}×${height}: ${JSON.stringify(box)}`,
      );
      if (box.tag === "BUTTON") assert.ok(box.height >= 44);
    }
    await page.screenshot({
      path: path.join(out, `menu-${width}x${height}.jpg`),
      quality: 85,
    });
  }
});

test("camp upgrades stay accessible from New Run and rehearsal Back can return to title", async (t) => {
  const page = await menu(t);
  await page.locator("#menu-new-run").click();
  await page.locator("#camp-open").click();
  assert.equal(
    await page.locator("#modal-title").innerText(),
    "By the campfire",
  );
  await page.locator("#camp-return").click();
  await page.evaluate(() => setPreference("navigationMode", true));
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#overlay").isVisible(), false);
  assert.equal(await page.evaluate(() => MainMenu.visible), true);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator("#main-menu .controller-focus").count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem(SAVE_KEY)), null);
});

test("affordable saved reel plans wait for Continue before spending points", async (t) => {
  const page = await menu(t);
  await savedMenu(page, () => {
    const h = state.party[0];
    h.points = 0;
    requestFaceChange(h, 0, 0, "tier", 3);
    h.points = quoteFaceTier(h, 0, 0, 3).cost;
    // Model an award saved during an in-flight action, before its edit boundary.
    busy = true;
    save();
  });
  const before = await page.evaluate(() => ({
    points: state.party[0].points,
    plans: state.party[0].reelQueue.length,
    tier: state.party[0].reels[0][0].tier,
  }));
  assert.equal(before.plans, 1);
  await page.locator("#menu-options").click();
  await page.locator("#option-speed").selectOption("2");
  await page.keyboard.press("Escape");
  assert.deepEqual(
    await page.evaluate(() => ({
      points: state.party[0].points,
      plans: state.party[0].reelQueue.length,
      tier: state.party[0].reels[0][0].tier,
    })),
    before,
  );
  await page.locator("#menu-continue").click();
  assert.equal(await page.evaluate(() => state.party[0].reels[0][0].tier), 3);
  assert.equal(await page.evaluate(() => state.party[0].reelQueue.length), 0);
});

test("reduced motion retains hover contrast while disabling movement; backup includes menu offline", async (t) => {
  const page = await menu(t, { reducedMotion: "reduce" });
  await page.locator("#menu-new-run").hover();
  assert.equal(
    await page
      .locator("#menu-new-run span")
      .evaluate((node) => getComputedStyle(node).transform),
    "none",
  );
  assert.notEqual(
    await page
      .locator("#menu-new-run")
      .evaluate((node) => getComputedStyle(node).boxShadow),
    "none",
  );
  const backup = await page.evaluate(() => HTML_BACKUP);
  const offlineContext = await browser.newContext({ reducedMotion: "reduce" });
  await offlineContext.setOffline(true);
  const offline = await offlineContext.newPage(),
    errors = [],
    requests = [];
  offline.on("pageerror", (error) => errors.push(error.message));
  offline.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  t.after(() => offlineContext.close());
  await offline.setContent(backup);
  await offline.evaluate(() => CompanyIntro.skip(true));
  assert.equal(await offline.locator("#main-menu").isVisible(), true);
  await offline.locator("#menu-new-run").click();
  await offline.locator('[data-start-job="fighter"]').click();
  assert.equal(await offline.locator(".tile").count(), 99);
  assert.equal(await offline.evaluate(() => MainMenu.visible), false);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
});
