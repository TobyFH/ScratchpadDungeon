const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { existsSync } = require("node:fs");
const { readFile, mkdir } = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

let browser, server, baseURL;
const root = path.resolve(__dirname, "..");
before(async () => {
  const html = await readFile(path.join(root, "index.html"));
  server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  await mkdir(path.join(root, "test-results"), { recursive: true });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function game(t, viewport = { width: 1440, height: 1100 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Seed only randomness. Gameplay assertions still exercise the real game code.
  await page.addInitScript(() => {
    let seed = 107;
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  });
  await page.goto(baseURL);
  await page.evaluate(() => {
    localStorage.clear();
    newRun();
  });
  t.after(async () => {
    assert.deepEqual(errors, [], "no browser runtime errors");
    await context.close();
  });
  return page;
}
async function fast(page) {
  await page.locator("#skip-animations").check();
}
async function forcedReels(page, type, tier = 1, hero = 0) {
  await page.evaluate(
    ({ type, tier, hero }) => {
      state.party[hero].reels = [0, 1, 2].map(() =>
        Array.from({ length: 6 }, () => ({ type, tier })),
      );
    },
    { type, tier, hero },
  );
}

test("opens offline with one fighter and a responsive, keyboard-accessible notebook", async (t) => {
  const page = await game(t);
  assert.equal(await page.locator(".tile").count(), 99);
  assert.equal(await page.locator(".hero").count(), 1);
  assert.equal(await page.evaluate(() => state.party[0].job), "fighter");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: path.join(root, "test-results/desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Field guide", exact: true }).click();
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator("#modal button")
      .first()
      .evaluate((el) => document.activeElement === el),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#overlay").isVisible(), false);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: path.join(root, "test-results/mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
});

test("movement uses a shortest path and stops at discoveries; pencil erases visibly", async (t) => {
  const page = await game(t);
  await page.locator('[data-tile="83"]').click();
  await page.waitForFunction(() => !busy);
  assert.deepEqual(
    await page.evaluate(() => ({
      p: state.position,
      steps: state.steps,
      treasure: state.map[79].event,
      seen: state.map[79].seen,
    })),
    { p: 79, steps: 1, treasure: null, seen: true },
  );
  assert.ok(await page.evaluate(() => state.gold > 0));
  await fast(page);
  await page.evaluate(async () => {
    state.map.forEach((c) => {
      if (c.event !== "stairs") c.event = null;
    });
    state.position = pos(1, 7);
    state.steps = 0;
    state.expectedPath = shortestPath(pos(9, 1)).length;
    await move(pos(9, 1));
  });
  assert.equal(
    await page.evaluate(() => state.steps),
    await page.evaluate(() => state.expectedPath),
  );
  assert.equal(
    await page.locator("#modal-title").textContent(),
    "A stairway in the paper",
  );
});

test("treasure, traps, wells, beacons, rare recruits and the three-hero cap work", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.locator('[data-tile="79"]').click();
  assert.equal(await page.evaluate(() => state.party[0].points), 3);
  await page.locator('[data-tile="80"]').click();
  assert.equal(await page.evaluate(() => state.party[0].hp), 29);
  await page.locator('[data-tile="81"]').click();
  assert.equal(await page.evaluate(() => state.party[0].hp), 36);
  const seen = await page.evaluate(
    () => state.map.filter((c) => c.seen).length,
  );
  await page.locator('[data-tile="82"]').click();
  assert.ok(
    (await page.evaluate(() => state.map.filter((c) => c.seen).length)) > seen,
  );
  assert.equal(await page.evaluate(() => state.block), 4);
  await page.locator('[data-tile="83"]').click();
  assert.equal(await page.locator(".hero").count(), 2);
  await page.getByRole("button", { name: "Welcome, Mira" }).click();
  await page.evaluate(async () => {
    await resolveTile({ event: "recruit" });
    closeModal();
    await resolveTile({ event: "recruit" });
    render();
  });
  assert.equal(await page.locator(".hero").count(), 3);
  assert.equal(await page.evaluate(() => state.potions), 3);
});

test("any hero can repeatedly act; a triple match multiplies damage and can be skipped", async (t) => {
  const page = await game(t);
  await page.evaluate(() => {
    beginEncounter();
    state.enemy.hp = state.enemy.maxHp = 100;
    state.enemy.frequency = state.enemy.countdown = 10;
    render();
  });
  await forcedReels(page, "attack");
  await page.locator('[data-spin="0"]').click();
  await page.waitForSelector("#skip-critical");
  assert.equal(await page.locator(".critical strong").textContent(), "×2.5");
  await page.locator("#skip-critical").click();
  await page.waitForFunction(() => !busy);
  assert.equal(await page.locator("#overlay").isVisible(), false);
  assert.equal(await page.evaluate(() => state.enemy.hp), 77);
  await fast(page);
  await page.locator('[data-spin="0"]').click();
  assert.equal(await page.evaluate(() => state.enemy.hp), 54);
  assert.equal(await page.evaluate(() => state.enemy.countdown), 8);
});

test("pair matches, mixed symbols and tiers resolve to the right amounts", async (t) => {
  const page = await game(t);
  await fast(page);
  const result = await page.evaluate(async () => {
    beginEncounter();
    state.enemy.hp = state.enemy.maxHp = 100;
    state.enemy.countdown = 10;
    state.party[0].hp = 10;
    state.party[0].reels = [
      [{ type: "attack", tier: 2 }],
      [{ type: "attack", tier: 2 }],
      [{ type: "heal", tier: 3 }],
    ];
    await spin(0);
    return { hp: state.enemy.hp, heroHP: state.party[0].hp };
  });
  assert.deepEqual(result, { hp: 82, heroHP: 24 });
});

test("different tiers do not match; combat locks movement and rejects double actions", async (t) => {
  const page = await game(t);
  await page.evaluate(() => {
    beginEncounter();
    state.enemy.hp = state.enemy.maxHp = 100;
    state.enemy.countdown = 10;
    state.party[0].reels = [1, 2, 3].map((tier) => [{ type: "attack", tier }]);
    render();
  });
  assert.equal(await page.locator(".tile:not(:disabled)").count(), 0);
  const action = page.evaluate(async () => {
    const first = spin(0);
    await spin(0);
    await first;
  });
  await action;
  assert.equal(await page.evaluate(() => state.enemy.hp), 82);
  assert.equal(await page.evaluate(() => state.enemy.countdown), 9);
  assert.equal(
    await page.evaluate(() => state.logs.some((s) => s.includes("critical"))),
    false,
  );
});

test("critical popups dismiss automatically and animation skipping takes effect mid-spin", async (t) => {
  const page = await game(t);
  await page.evaluate(() => {
    beginEncounter();
    state.enemy.hp = state.enemy.maxHp = 100;
    state.enemy.countdown = 10;
    render();
  });
  await forcedReels(page, "attack");
  await page.locator('[data-spin="0"]').click();
  await page.waitForSelector("#skip-critical");
  await page.waitForFunction(() => !busy);
  assert.equal(await page.locator("#overlay").isVisible(), false);
  assert.equal(await page.evaluate(() => state.enemy.hp), 77);
  await page.locator('[data-spin="0"]').click();
  await page.locator("#skip-animations").check();
  await page.waitForFunction(() => !busy);
  assert.equal(await page.locator("#overlay").isVisible(), false);
  assert.equal(await page.evaluate(() => state.enemy.hp), 54);
});

test("team block persists after victory and is consumed across enemy multi-strikes", async (t) => {
  const page = await game(t);
  await fast(page);
  await forcedReels(page, "block");
  await page.evaluate(async () => {
    beginEncounter();
    state.enemy.countdown = 5;
    await spin(0);
    await victory(state.enemy);
    render();
  });
  assert.equal(await page.evaluate(() => state.block), 15);
  await page.evaluate(() => {
    beginEncounter();
    Object.assign(state.enemy, {
      hp: 1000,
      maxHp: 1000,
      countdown: 1,
      frequency: 2,
      strikes: 3,
      damage: 6,
    });
    render();
  });
  await forcedReels(page, "attack");
  const hp = await page.evaluate(() => state.party[0].hp);
  await page.locator('[data-spin="0"]').click();
  assert.equal(await page.evaluate(() => state.block), 0);
  assert.equal(await page.evaluate(() => state.party[0].hp), hp - 3);
  assert.equal(await page.evaluate(() => state.enemy.countdown), 2);
});

test("stun cancels an enemy turn, then counts down independently of the attack clock", async (t) => {
  const page = await game(t);
  await fast(page);
  await forcedReels(page, "stun");
  await page.evaluate(() => {
    beginEncounter();
    state.enemy.countdown = 1;
    render();
  });
  await page.locator('[data-spin="0"]').click();
  assert.equal(await page.evaluate(() => state.party[0].hp), 36);
  assert.equal(await page.evaluate(() => state.enemy.stun), 7);
  assert.ok(
    await page.evaluate(() =>
      state.logs.some((s) => s.includes("loses its attack to stun")),
    ),
  );
});

test("targeted healing and tonics revive only the selected hero; injuries are visible", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    state.party[0].hp = 10;
    state.party[1].hp = 0;
    beginEncounter();
    state.enemy.countdown = 10;
    render();
  });
  assert.equal(await page.locator("#hero-0 .injury").textContent(), "wounded");
  assert.equal(await page.locator("#hero-1 .injury").textContent(), "downed");
  await page.locator('[data-target="1"]').click();
  await forcedReels(page, "heal");
  await page.locator('[data-spin="0"]').click();
  assert.equal(await page.evaluate(() => state.party[1].hp), 23);
  assert.equal(await page.evaluate(() => state.party[0].hp), 10);
  await page.locator('[data-target="0"]').click();
  await page.locator("#potion").click();
  assert.equal(await page.evaluate(() => state.party[0].hp), 26);
  assert.equal(await page.evaluate(() => state.potions), 1);
  assert.equal(await page.locator("#hero-0 .injury").textContent(), "steady");
});

test("victory grants EXP, maximum health, and personal editing points", async (t) => {
  const page = await game(t);
  await fast(page);
  await forcedReels(page, "attack", 3);
  await page.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    state.party[0].xp = 10;
    state.party[1].xp = 10;
    beginEncounter();
    state.enemy.hp = 1;
    render();
  });
  await page.locator('[data-spin="0"]').click();
  assert.equal(await page.evaluate(() => state.enemy), null);
  assert.deepEqual(
    await page.evaluate(() => state.party.map((h) => h.level)),
    [2, 2],
  );
  assert.equal(await page.evaluate(() => state.party[0].maxHp), 42);
  const before = await page.evaluate(() => state.party[0].points);
  await page.locator('[data-edit="0"]').click();
  assert.equal(await page.locator('[data-upgrade="0,0,0"]').isDisabled(), true);
  await page.locator('[data-cycle="0,0,0"]').click();
  assert.equal(
    await page.evaluate(() => state.party[0].reels[0][0].type),
    "heal",
  );
  assert.equal(await page.evaluate(() => state.party[0].points), before - 1);
  assert.equal(await page.evaluate(() => state.party[1].points), 5);
});

test("reel upgrades cost personal points and stop at tier three", async (t) => {
  const page = await game(t);
  await page.locator('[data-edit="0"]').click();
  await page.locator('[data-upgrade="0,0,0"]').click();
  await page.locator('[data-upgrade="0,0,0"]').click();
  assert.equal(await page.evaluate(() => state.party[0].reels[0][0].tier), 3);
  assert.equal(await page.evaluate(() => state.party[0].points), 0);
  assert.equal(await page.locator('[data-upgrade="0,0,0"]').isDisabled(), true);
  assert.equal(await page.locator('[data-cycle="0,0,0"]').isDisabled(), true);
});

test("all generated floors are connected, include stairs, and require the depth-three keeper", async (t) => {
  const page = await game(t);
  await fast(page);
  assert.equal(
    await page.evaluate(() => {
      for (let d = 1; d <= 80; d++) {
        state.map = generateFloor(d);
        state.position = pos(1, 7);
        for (let i = 0; i < state.map.length; i++)
          if (!state.map[i].wall && !shortestPath(i)) return false;
        if (state.map.filter((c) => c.event === "stairs").length !== 1)
          return false;
      }
      return true;
    }),
    true,
  );
  await page.evaluate(() => {
    state.depth = 3;
    state.map = generateFloor(3);
    state.position = pos(9, 1);
    stairs();
  });
  assert.equal(await page.locator("#descend").isDisabled(), true);
  await page
    .getByRole("button", { name: "Keep exploring", exact: true })
    .click();
  assert.equal(await page.evaluate(() => state.depth), 3);
  await page.evaluate(async () => {
    beginEncounter(true);
    state.enemy.hp = 0;
    await victory(state.enemy);
    render();
  });
  await page.getByRole("button", { name: "Keep it safe" }).click();
  await page.evaluate(() => stairs());
  assert.equal(await page.locator("#descend").isDisabled(), false);
  await page.locator("#retire").click();
  assert.equal(
    await page.locator("#modal-title").textContent(),
    "Something green, again.",
  );
  assert.equal(await page.evaluate(() => state.over), true);
});

test("a whole expedition can be played through tiles, combats and stairs", async (t) => {
  const page = await game(t);
  await fast(page);
  // A fixed attack loadout removes luck from this navigation/encounter integration test.
  // No movement, event, enemy, reward, stair, or victory logic is replaced.
  await page.evaluate(() => {
    state.party[0].maxHp = state.party[0].hp = 1000;
  });
  await forcedReels(page, "attack", 3);
  let actions = 0;
  while (actions++ < 160) {
    if (await page.evaluate(() => !!state.enemy)) {
      await page.locator('[data-spin="0"]').click();
    } else if (await page.locator("#overlay").isVisible()) {
      const kind = await page.evaluate(() => modalKind);
      if (kind === "stairs") {
        if (await page.locator("#descend").isDisabled()) {
          await page
            .getByRole("button", { name: "Keep exploring", exact: true })
            .click();
          await page.evaluate(() => move(pos(9, 2)));
        } else if (await page.evaluate(() => state.relic)) {
          await page.locator("#retire").click();
          break;
        } else await page.locator("#descend").click();
      } else await page.locator("[data-close]").last().click();
    } else await page.evaluate(() => move(pos(9, 1)));
  }
  assert.ok(actions < 160, "campaign terminates");
  assert.equal(await page.evaluate(() => state.relic && state.over), true);
});

test("a party wipe ends the expedition and new-run confirmation resets it", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.evaluate(async () => {
    state.party[0].hp = 1;
    beginEncounter();
    Object.assign(state.enemy, {
      hp: 1000,
      maxHp: 1000,
      countdown: 1,
      damage: 50,
    });
    state.party[0].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "attack", tier: 2 }],
      [{ type: "attack", tier: 3 }],
    ];
    await spin(0);
  });
  assert.equal(
    await page.locator("#modal-title").textContent(),
    "The light goes out.",
  );
  assert.equal(await page.evaluate(() => state.over), true);
  await page
    .getByRole("button", { name: "Begin a new expedition", exact: true })
    .click();
  assert.equal(await page.evaluate(() => state.over), false);
  assert.equal(await page.evaluate(() => state.party[0].hp), 36);
  await page.getByRole("button", { name: "New run", exact: true }).click();
  await page
    .getByRole("button", { name: "Keep this story", exact: true })
    .click();
  assert.equal(await page.locator("#overlay").isVisible(), false);
});

test("autosave restores exact progress on reload", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.locator('[data-tile="79"]').click();
  const snapshot = await page.evaluate(() => JSON.stringify(state));
  await page.reload();
  assert.equal(await page.evaluate(() => JSON.stringify(state)), snapshot);
  assert.equal(await page.locator("#skip-animations").isChecked(), true);
});

test("downloaded HTML is complete and starts offline without network requests", async (t) => {
  const page = await game(t);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "Scratchpad-Dungeon.html");
  const backup = path.join(root, "test-results/Scratchpad-Dungeon.html");
  await download.saveAs(backup);
  assert.ok((await readFile(backup, "utf8")).includes("function spin("));
  const requests = [],
    errors = [];
  const offlinePage = await page.context().newPage();
  offlinePage.on("pageerror", (e) => errors.push(e.message));
  offlinePage.on("request", (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  // Managed Chromium in cloud tasks blocks file:// navigation. Execute the
  // downloaded bytes with networking disabled instead of overriding that policy.
  await page.context().setOffline(true);
  await offlinePage.setContent(await readFile(backup, "utf8"));
  assert.deepEqual(errors, []);
  assert.equal(await offlinePage.locator(".tile").count(), 99);
  assert.equal(await offlinePage.locator(".hero").count(), 1);
  assert.deepEqual(requests, []);
  await offlinePage
    .getByRole("button", { name: "Field guide", exact: true })
    .click();
  assert.equal(
    await offlinePage.locator("#modal-title").textContent(),
    "A field guide for the brave",
  );
});
