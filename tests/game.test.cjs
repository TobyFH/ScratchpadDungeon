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

async function encounter(page, { hp = 1000, countdown = 20 } = {}) {
  await page.evaluate(
    ({ hp, countdown }) => {
      beginEncounter();
      state.enemy.hp = state.enemy.maxHp = hp;
      state.enemy.countdown = countdown;
      render();
    },
    { hp, countdown },
  );
}
async function mixedReels(page, hero = 0) {
  await page.evaluate((hero) => {
    state.party[hero].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "attack", tier: 2 }],
      [{ type: "heal", tier: 1 }],
    ];
  }, hero);
}
async function finish(page) {
  await page.waitForFunction(() => !busy, {}, { timeout: 30000 });
}
function clearFloorScript() {
  state.map = state.map.map((c, i) => ({
    ...c,
    wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
    seen: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
    event: null,
    feature: null,
  }));
  state.position = pos(1, 7);
  state.map[state.position].seen = true;
  render();
}

test("notebook renders detailed art, tiered symbols, and desktop/mobile layouts", async (t) => {
  const page = await game(t);
  assert.equal(await page.locator(".tile").count(), 99);
  assert.equal(await page.locator(".hero").count(), 1);
  assert.equal(await page.evaluate(() => state.party[0].job), "fighter");
  assert.equal(
    await page.evaluate(() => document.fonts.check("18px Notebook")),
    true,
  );
  assert.equal(await page.locator("#portrait-0 svg pattern").count(), 1);
  assert.equal(
    await page
      .locator('#machine-hero-0 [data-reel="2"] .tier-symbol svg')
      .count(),
    2,
  );
  await page.screenshot({
    path: path.join(root, "test-results/desktop.png"),
    fullPage: true,
  });
  for (let width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "no horizontal overflow at " + width,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(root, "test-results/mobile.png"),
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
});

test("hover reports unknown until a tile is revealed; erasing happens before movement and its event", async (t) => {
  const page = await game(t);
  await page.locator('[data-tile="79"]').hover();
  assert.equal(
    await page.locator("#hover-name").textContent(),
    "Unknown / pencil-covered tile",
  );
  // Capture the short eraser phase at the DOM mutation itself. Polling after
  // click() can miss a 200ms animation on a busy browser worker.
  await page.evaluate(() => {
    window.eraseSnapshot = null;
    const observer = new MutationObserver(() => {
      if (
        document.querySelector('[data-tile="79"]').classList.contains("erasing")
      ) {
        window.eraseSnapshot = {
          position: state.position,
          gold: state.gold,
          seen: state.map[79].seen,
        };
        observer.disconnect();
      }
    });
    observer.observe(document.querySelector("#map"), {
      childList: true,
      attributes: true,
      subtree: true,
    });
  });
  await page.locator('[data-tile="79"]').click();
  await page.waitForFunction(() => window.eraseSnapshot);
  assert.deepEqual(await page.evaluate(() => window.eraseSnapshot), {
    position: 78,
    gold: 0,
    seen: false,
  });
  await page.waitForSelector("#machine-treasure");
  assert.equal(await page.evaluate(() => state.position), 79);
  assert.equal(await page.evaluate(() => state.map[79].seen), true);
  await page.locator("#stage-card input").check();
  await finish(page);
  assert.ok((await page.evaluate(() => state.gold)) > 0);
  await page.locator('[data-tile="79"]').hover();
  assert.equal(
    await page.locator("#hover-name").textContent(),
    "Treasure / explored",
  );
});

test("unknown tiles cannot be intermediate path cells; revealed routes use the shortest path", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.evaluate(clearFloorScript);
  assert.equal(await page.evaluate(() => shortestPath(pos(3, 7))), null);
  assert.deepEqual(await page.evaluate(() => shortestPath(pos(2, 7))), [79]);
  await page.locator('[data-tile="81"]').click();
  assert.equal(await page.evaluate(() => state.position), 78);
  await page.evaluate(() => {
    for (let x = 1; x <= 8; x++) state.map[pos(x, 7)].seen = true;
    render();
  });
  assert.equal(await page.evaluate(() => shortestPath(pos(8, 7)).length), 7);
  await page.locator('[data-tile="85"]').click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.position), 85);
  assert.equal(await page.evaluate(() => state.steps), 7);
  assert.equal(
    await page.evaluate(() => state.map[pos(5, 6)].seen),
    false,
    "route did not reveal neighbouring rooms",
  );
});

test("a hidden interior wall erases but the party does not walk into it", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.evaluate(clearFloorScript);
  await page.evaluate(() => {
    state.map[79].wall = true;
    render();
  });
  await page.locator('[data-tile="79"]').click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.position), 78);
  assert.equal(await page.evaluate(() => state.map[79].seen), true);
  assert.equal(await page.evaluate(() => state.steps), 0);
  assert.equal(await page.locator('[data-tile="79"]').isDisabled(), true);
});

test("beacons reveal exactly eight adjacent/diagonal cells without activating their events", async (t) => {
  const page = await game(t);
  await fast(page);
  const result = await page.evaluate(async () => {
    state.map.forEach((c) => {
      c.seen = false;
      c.event = null;
      c.feature = null;
    });
    state.position = pos(5, 4);
    state.map[state.position].seen = true;
    state.map[state.position].event = "beacon";
    state.map[pos(6, 5)].event = "enemy";
    render();
    await resolveTile(state.map[state.position]);
    return {
      revealed: state.map
        .map((c, i) => (c.seen ? i : -1))
        .filter((i) => i >= 0),
      expected: [state.position, ...neighbors(state.position, true)].sort(
        (a, b) => a - b,
      ),
      enemy: state.enemy,
      block: state.block,
    };
  });
  assert.deepEqual(result.revealed, result.expected);
  assert.equal(result.enemy, null);
  assert.equal(result.block, 0);
});

test("well healing is partial and revives the fallen; portraits visibly track injury", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    state.party[0].hp = 1;
    state.party[1].hp = 0;
    render();
  });
  const wounded = await page.locator("#portrait-0").innerHTML();
  await page.evaluate(async () => {
    await resolveTile({ event: "well" });
    render();
  });
  assert.deepEqual(
    await page.evaluate(() => state.party.map((h) => h.hp)),
    [13, 10],
  );
  assert.equal(await page.locator("#hero-1 .injury").textContent(), "wounded");
  await page.evaluate(() => {
    state.party[0].hp = 40;
    syncHero(0);
  });
  assert.notEqual(await page.locator("#portrait-0").innerHTML(), wounded);
  assert.equal(await page.locator("#hero-0 .injury").textContent(), "steady");
});

test("treasure reels can award gold and items; traps roll danger or a safe escape", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.evaluate(async () => {
    let random = Math.random;
    Math.random = () => 4.5 / 8;
    await treasureRoll();
    Math.random = random;
  });
  assert.equal(await page.evaluate(() => state.potions), 5);
  assert.ok((await page.evaluate(() => state.gold)) > 0);
  assert.match(await page.locator("#result-ribbon").textContent(), /tonic/);
  await page.evaluate(async () => {
    let random = Math.random;
    Math.random = () => 0;
    await trapRoll();
    Math.random = random;
  });
  assert.equal(await page.evaluate(() => state.party[0].hp), 40);
  assert.match(await page.locator("#result-ribbon").textContent(), /no damage/);
  await page.evaluate(async () => {
    let random = Math.random;
    Math.random = () => 0.55;
    await trapRoll();
    Math.random = random;
  });
  assert.equal(await page.evaluate(() => state.party[0].hp), 31);
  assert.match(await page.locator("#result-ribbon").textContent(), /9 HP/);
});

test("rare wanderers recruit at most three heroes with class-specific machines", async (t) => {
  const page = await game(t);
  await fast(page);
  assert.equal(
    await page.evaluate(
      () => state.map.filter((c) => c.event === "recruit").length,
    ),
    1,
  );
  assert.equal(
    await page.evaluate(
      () => state.map.filter((c) => c.event === "beacon").length,
    ),
    1,
  );
  await page.evaluate(async () => {
    await resolveTile({ event: "recruit" });
    await resolveTile({ event: "recruit" });
    await resolveTile({ event: "recruit" });
    render();
  });
  assert.deepEqual(await page.evaluate(() => state.party.map((h) => h.job)), [
    "fighter",
    "healer",
    "rogue",
  ]);
  assert.equal(await page.evaluate(() => state.potions), 3);
  assert.equal(await page.locator(".hero").count(), 3);
  assert.ok(
    (await page.evaluate(
      () => state.party[1].reels[0].filter((s) => s.type === "heal").length,
    )) >
      (await page.evaluate(
        () => state.party[0].reels[0].filter((s) => s.type === "heal").length,
      )),
  );
  await encounter(page);
  await page.screenshot({
    path: path.join(root, "test-results/combat.png"),
    fullPage: true,
  });
});

test("normal combat rolls on-page, animates its handle, and clicking lands the same preselected result", async (t) => {
  const page = await game(t);
  await encounter(page);
  await mixedReels(page);
  await page.locator('[data-spin="0"]').click();
  await page.waitForFunction(() => currentRoll?.id === "hero-0");
  assert.equal(
    await page
      .locator("#machine-hero-0 .lever")
      .evaluate((el) => el.classList.contains("pulling")),
    true,
  );
  assert.equal(await page.locator("#spotlight").isVisible(), false);
  assert.equal(await page.locator(".tile:not(:disabled)").count(), 0);
  await page.locator("#machine-hero-0 .machine-face").click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.enemy.hp), 991);
  assert.equal(await page.evaluate(() => state.enemy.countdown), 19);
  assert.equal(await page.locator("#spotlight").isVisible(), false);
  assert.match(await page.locator("#result-ribbon").textContent(), /9 damage/);
  await fast(page);
  await page.locator('[data-spin="0"]').click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.enemy.hp), 982);
  assert.equal(
    await page.evaluate(() => state.enemy.countdown),
    18,
    "same hero may act twice",
  );
});

test("matching symbols open a second multiplier machine and apply its roll to the first", async (t) => {
  const page = await game(t);
  await encounter(page);
  await forcedReels(page, "attack");
  await page.locator('[data-spin="0"]').click();
  await page.waitForFunction(() => currentRoll?.id === "hero-0");
  await page.locator("#machine-hero-0 .machine-face").click();
  await page.waitForFunction(() => currentRoll?.id === "critical");
  assert.equal(await page.locator("#stage-title").textContent(), "Critical!");
  assert.equal(await page.locator("#machine-critical .slot-window").count(), 1);
  let multiplier = await page.evaluate(() => state.lastCritical.multiplier);
  assert.ok([2, 2.5, 3, 4].includes(multiplier));
  await page.locator("#machine-critical .machine-face").click();
  await finish(page);
  assert.equal(
    await page.evaluate(() => state.enemy.hp),
    1000 - Math.ceil(9 * multiplier),
  );
  assert.equal(await page.locator("#spotlight").isVisible(), false);
  assert.match(await page.locator("#result-ribbon").textContent(), /critical/);
});

test("critical machines slow down and close automatically; skip-all can interrupt a live roll", async (t) => {
  const page = await game(t);
  await encounter(page);
  await forcedReels(page, "attack");
  await page.locator('[data-spin="0"]').click();
  await page.waitForFunction(() => currentRoll?.id === "hero-0");
  await page.locator("#machine-hero-0 .machine-face").click();
  await page.waitForFunction(() => currentRoll?.id === "critical");
  await finish(page);
  assert.equal(await page.locator("#spotlight").isVisible(), false);
  await page.locator('[data-spin="0"]').click();
  await page.waitForFunction(() => !!currentRoll);
  await page.locator("#skip-animations").check();
  await finish(page);
  assert.equal(await page.locator("#spotlight").isVisible(), false);
  assert.equal(await page.evaluate(() => particles.length), 0);
  assert.equal(await page.evaluate(() => state.skip), true);
});

test("different tiers do not match; double actions are rejected while rolling", async (t) => {
  const page = await game(t);
  await fast(page);
  await encounter(page);
  await page.evaluate(() => {
    state.party[0].reels = [1, 2, 3].map((tier) => [{ type: "attack", tier }]);
  });
  await page.evaluate(async () => {
    let first = spin(0);
    await spin(0);
    await first;
  });
  assert.equal(await page.evaluate(() => state.enemy.hp), 982);
  assert.equal(await page.evaluate(() => state.enemy.countdown), 19);
  assert.equal(await page.evaluate(() => state.lastCritical), undefined);
});

test("persistent team block wears away across multiple independently rolled enemy strikes", async (t) => {
  const page = await game(t);
  await fast(page);
  await encounter(page);
  await forcedReels(page, "block");
  await page.locator('[data-spin="0"]').click();
  await finish(page);
  let stored = await page.evaluate(() => state.block);
  assert.ok(stored >= 12);
  await page.evaluate(async () => {
    await victory(state.enemy);
    render();
  });
  assert.equal(await page.evaluate(() => state.block), stored);
  await encounter(page, { countdown: 1 });
  await page.evaluate(() => {
    state.block = 15;
    state.enemy.frequency = 2;
    state.enemy.strikes = 3;
    state.enemy.damage = 3;
    state.enemy.reels = [1, 2, 3].map((tier) => [{ type: "attack", tier }]);
    state.party[0].reels = [1, 2, 3].map((tier) => [{ type: "attack", tier }]);
    render();
  });
  let hp = await page.evaluate(() => state.party[0].hp);
  await page.locator('[data-spin="0"]').click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.block), 0);
  assert.equal(await page.evaluate(() => state.party[0].hp), hp - 3);
  assert.equal(await page.evaluate(() => state.enemy.countdown), 2);
  assert.equal(
    await page.evaluate(
      () =>
        state.logs.filter((s) => s.includes("damage") && s.includes("→"))
          .length,
    ),
    3,
  );
});

test("enemy machines can heal, block, and stun; enemy scaling increases speed and multi-strikes", async (t) => {
  const page = await game(t);
  await fast(page);
  await encounter(page, { countdown: 1 });
  await mixedReels(page);
  await page.evaluate(() => {
    state.enemy.hp = 30;
    state.enemy.reels = [
      [{ type: "heal", tier: 1 }],
      [{ type: "block", tier: 2 }],
      [{ type: "stun", tier: 1 }],
    ];
  });
  await page.locator('[data-spin="0"]').click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.enemy.hp), 23);
  assert.equal(await page.evaluate(() => state.enemy.block), 4);
  assert.equal(await page.evaluate(() => state.party[0].stun), 1);
  let xp = await page.evaluate(() => state.party[0].xp);
  await page.locator('[data-spin="0"]').click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.party[0].stun), 0);
  assert.equal(
    await page.evaluate(() => state.party[0].xp),
    xp,
    "recovering consumes an action without awarding a spin",
  );
  const scaling = await page.evaluate(() => {
    let old = Math.random;
    Math.random = () => 0;
    state.depth = 1;
    beginEncounter();
    let a = { ...state.enemy };
    state.depth = 9;
    beginEncounter();
    let b = { ...state.enemy };
    Math.random = old;
    return {
      health: b.maxHp > a.maxHp,
      damage: b.damage > a.damage,
      frequency: b.frequency < a.frequency,
      strikes: b.strikes > a.strikes,
    };
  });
  assert.deepEqual(scaling, {
    health: true,
    damage: true,
    frequency: true,
    strikes: true,
  });
});

test("hero stun cancels an enemy turn; targeted healing and tonics revive only their chosen hero", async (t) => {
  const page = await game(t);
  await fast(page);
  await encounter(page, { countdown: 1 });
  await forcedReels(page, "stun");
  await page.locator('[data-spin="0"]').click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.party[0].hp), 40);
  assert.ok(
    await page.evaluate(() =>
      state.logs.some((s) => s.includes("loses its attack to stun")),
    ),
  );
  await page.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    state.party[0].hp = 10;
    state.party[1].hp = 0;
    state.enemy.countdown = 20;
    state.party[0].reels = [
      [{ type: "heal", tier: 1 }],
      [{ type: "heal", tier: 2 }],
      [{ type: "block", tier: 1 }],
    ];
    render();
  });
  await page.locator('[data-target="1"]').click();
  await page.locator('[data-spin="0"]').click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.party[1].hp), 9);
  assert.equal(await page.evaluate(() => state.party[0].hp), 10);
  await page.locator('[data-target="0"]').click();
  await page.locator("#potion").click();
  assert.equal(await page.evaluate(() => state.party[0].hp), 26);
  assert.equal(await page.evaluate(() => state.potions), 1);
});

test("leveling increases max HP and personal points; weak/strong reel editing has different costs", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    addXP(state.party[0], 12);
    render();
  });
  assert.equal(await page.evaluate(() => state.party[0].level), 2);
  assert.equal(await page.evaluate(() => state.party[0].maxHp), 46);
  assert.equal(await page.evaluate(() => state.party[0].points), 7);
  await page.locator('[data-edit="0"]').click();
  await page.locator('[data-cycle="0,0,0"]').click();
  assert.equal(
    await page.evaluate(() => state.party[0].reels[0][0].type),
    "heal",
  );
  assert.equal(await page.evaluate(() => state.party[0].points), 6);
  await page.locator('[data-upgrade="0,0,0"]').click();
  assert.equal(await page.evaluate(() => state.party[0].points), 3);
  assert.equal(await page.evaluate(() => state.party[0].reels[0][0].tier), 2);
  assert.equal(await page.locator('[data-upgrade="0,0,0"]').isDisabled(), true);
  await page.locator('[data-weaken="0,0,0"]').click();
  assert.equal(await page.evaluate(() => state.party[0].points), 2);
  assert.equal(await page.evaluate(() => state.party[0].reels[0][0].tier), 1);
  assert.equal(await page.evaluate(() => state.party[1].points), 3);
});

test("discovering stairs prompts a choice and keeps a usable exit button anywhere on the floor", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.evaluate(clearFloorScript);
  await page.evaluate(() => {
    state.map[79].event = "stairs";
    state.map[79].feature = "stairs";
    render();
  });
  await page.locator('[data-tile="79"]').click();
  await finish(page);
  assert.equal(
    await page.locator("#modal-title").textContent(),
    "A stairway in the paper",
  );
  assert.equal(await page.evaluate(() => state.depth), 1);
  assert.equal(await page.evaluate(() => state.over), false);
  await page
    .getByRole("button", { name: "Keep exploring", exact: true })
    .click();
  await page.locator('[data-tile="78"]').click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.position), 78);
  await page.locator("#exit-found").click();
  assert.equal(await page.locator("#descend").isEnabled(), true);
  await page.locator("#descend").click();
  assert.equal(await page.evaluate(() => state.depth), 2);
  assert.equal(await page.locator("#exit-found").isVisible(), false);
});

test("beacon-discovered stairs unlock exit without moving to the exit cell", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.evaluate(async () => {
    state.position = pos(5, 4);
    state.map[state.position].wall = false;
    state.map[state.position].seen = true;
    state.map[pos(6, 5)].wall = false;
    state.map[pos(6, 5)].event = "stairs";
    state.map[pos(6, 5)].seen = false;
    render();
    await resolveTile({ event: "beacon" });
    render();
  });
  assert.equal(await page.evaluate(() => state.exitFound), true);
  assert.equal(await page.evaluate(() => state.position), 49);
  await page.locator("#exit-found").click();
  assert.equal(
    await page.locator("#modal-title").textContent(),
    "A stairway in the paper",
  );
});

test("generated floors remain connected and floor three requires its keeper before descending", async (t) => {
  const page = await game(t);
  await fast(page);
  assert.equal(
    await page.evaluate(() => {
      for (let depth = 1; depth <= 80; depth++) {
        let map = generateFloor(depth),
          seen = new Set([pos(1, 7)]),
          q = [pos(1, 7)];
        for (let n of q)
          for (let j of neighbors(n))
            if (!map[j].wall && !seen.has(j)) {
              seen.add(j);
              q.push(j);
            }
        if (map.some((c, i) => !c.wall && !seen.has(i))) return false;
        if (map.filter((c) => c.event === "stairs").length !== 1) return false;
      }
      return true;
    }),
    true,
  );
  await page.evaluate(() => {
    state.depth = 3;
    state.map = generateFloor(3);
    state.exitFound = true;
    stairs();
  });
  assert.equal(await page.locator("#descend").isDisabled(), true);
  await page
    .getByRole("button", { name: "Keep exploring", exact: true })
    .click();
  assert.equal(await page.evaluate(() => state.depth), 3);
});

test("an expedition plays through revealed-path travel, encounters, the Sunseed, and voluntary return", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.evaluate(() => {
    state.party[0].maxHp = state.party[0].hp = 1000;
  });
  await forcedReels(page, "attack", 3);
  let actions = 0;
  while (actions++ < 260) {
    let status = await page.evaluate(() => ({
      enemy: !!state.enemy,
      exit: state.exitFound,
      depth: state.depth,
      relic: state.relic,
      modal: modalKind,
      over: state.over,
    }));
    if (status.over) break;
    if (status.enemy) {
      await page.locator('[data-spin="0"]').click();
      await finish(page);
    } else if (status.modal === "stairs") {
      if (status.relic) {
        await page.locator("#retire").click();
        break;
      } else if (status.depth < 3) await page.locator("#descend").click();
      else
        await page
          .getByRole("button", { name: "Keep exploring", exact: true })
          .click();
    } else if (status.exit && status.depth < 3) {
      await page.locator("#exit-found").click();
    } else if (status.exit && status.relic) {
      await page.locator("#exit-found").click();
    } else {
      await page.evaluate(async () => {
        let goal =
            state.depth === 3 && state.exitFound && !state.relic
              ? pos(9, 2)
              : pos(9, 1),
          route = shortestPath(goal, true);
        if (!route?.length) throw Error("Campaign has no route");
        await move(route[0]);
      });
      await finish(page);
    }
  }
  assert.ok(actions < 260, "campaign terminates");
  assert.equal(await page.evaluate(() => state.relic && state.over), true);
  assert.equal(
    await page.locator("#modal-title").textContent(),
    "Something green, again.",
  );
});

test("party wipe ends the run; restarting restores a single fighter and fresh machines", async (t) => {
  const page = await game(t);
  await fast(page);
  await encounter(page, { countdown: 1 });
  await page.evaluate(() => {
    state.party[0].hp = 1;
    state.enemy.damage = 50;
    state.party[0].reels = [1, 2, 3].map((tier) => [{ type: "attack", tier }]);
    state.enemy.reels = [1, 2, 3].map((tier) => [{ type: "attack", tier }]);
    render();
  });
  await page.locator('[data-spin="0"]').click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.over), true);
  assert.equal(
    await page.locator("#modal-title").textContent(),
    "The light goes out.",
  );
  await page
    .getByRole("button", { name: "Begin a new expedition", exact: true })
    .click();
  assert.equal(await page.evaluate(() => state.over), false);
  assert.equal(await page.evaluate(() => state.party.length), 1);
  assert.equal(await page.evaluate(() => state.party[0].hp), 40);
});

test("items heal, consume resources, generate persistent block, and damage the enemy", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.locator("#ward").click();
  assert.equal(await page.evaluate(() => state.block), 8);
  assert.equal(await page.evaluate(() => state.wards), 0);
  await encounter(page);
  await page.locator("#bomb").click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.enemy.hp), 987);
  assert.equal(await page.evaluate(() => state.bombs), 0);
  assert.equal(await page.evaluate(() => state.block), 8);
});

test("autosave restores exact progress and migrates the previous notebook version", async (t) => {
  const page = await game(t);
  await fast(page);
  await page.locator('[data-tile="79"]').click();
  await finish(page);
  let snapshot = await page.evaluate(() => JSON.stringify(state));
  await page.reload();
  assert.equal(await page.evaluate(() => JSON.stringify(state)), snapshot);
  await page.evaluate(() => {
    let old = { ...state, version: 1 };
    delete old.exitFound;
    delete old.bombs;
    delete old.wards;
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem("scratchpad-dungeon-v1", JSON.stringify(old));
  });
  await page.reload();
  assert.equal(await page.evaluate(() => state.version), 2);
  assert.equal(await page.evaluate(() => state.party.length), 1);
  assert.equal(await page.evaluate(() => state.bombs), 0);
});

test("the HTML backup embeds all art and the font and plays with networking disabled", async (t) => {
  const page = await game(t);
  let next = page.waitForEvent("download");
  await page.locator("#download").click();
  let download = await next;
  assert.equal(download.suggestedFilename(), "Scratchpad-Dungeon.html");
  let backup = path.join(root, "test-results/Scratchpad-Dungeon.html");
  await download.saveAs(backup);
  let html = await readFile(backup, "utf8");
  assert.ok(html.includes("data:font/ttf;base64,"));
  assert.ok(html.includes("function spin("));
  assert.ok(html.includes("SIL OPEN FONT LICENSE"));
  const offline = await page.context().newPage(),
    requests = [],
    errors = [];
  offline.on("pageerror", (e) => errors.push(e.message));
  offline.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await page.context().setOffline(true);
  await offline.setContent(html);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  assert.equal(await offline.locator(".tile").count(), 99);
  await offline.locator("#skip-animations").check();
  await offline.locator('[data-tile="79"]').click();
  await finish(offline);
  assert.ok((await offline.evaluate(() => state.gold)) > 0);
  await offline
    .getByRole("button", { name: "Field guide", exact: true })
    .click();
  assert.equal(
    await offline.locator("#modal-title").textContent(),
    "A field guide for the brave",
  );
});

test("enemy encounter bursts into view then flies to its position on the right page", async (t) => {
  const page = await game(t);
  await page.evaluate(() => {
    state.map[79].event = "enemy";
    state.map[79].feature = "enemy";
    render();
  });
  await page.locator('[data-tile="79"]').click();
  await page.waitForSelector("#entrance-art");
  assert.equal(
    await page.locator("#stage-title").textContent(),
    "An unwelcome scribble",
  );
  assert.equal(
    await page.evaluate(() => particles.some((p) => p.kind === "scary")),
    true,
  );
  await page.waitForSelector(".encounter-ghost");
  await finish(page);
  assert.equal(await page.locator("#spotlight").isVisible(), false);
  assert.equal(await page.locator("#enemy-art").isVisible(), true);
  assert.equal(await page.locator(".tile:not(:disabled)").count(), 0);
});

test("trap warning and drawn trap animate before the trap machine appears", async (t) => {
  const page = await game(t);
  await page.evaluate(() => {
    state.map[79].event = "trap";
    state.map[79].feature = "trap";
    render();
  });
  await page.locator('[data-tile="79"]').click();
  await page.waitForSelector("#trap-machine");
  assert.equal(
    await page.locator("#stage-title").textContent(),
    "A hidden trap",
  );
  assert.equal(await page.locator(".trap-art svg").count(), 1);
  assert.equal(await page.locator("#machine-trap").count(), 0);
  await page.locator("#stage-card [data-fast]").click();
  await finish(page);
  assert.match(
    await page.locator("#result-ribbon").textContent(),
    /HP|no damage/,
  );
});

test("enemy attack reels roll on the page and fast-forward into targeted damage", async (t) => {
  const page = await game(t);
  await encounter(page, { countdown: 1 });
  await page.evaluate(() => {
    state.party[0].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "heal", tier: 1 }],
      [{ type: "block", tier: 1 }],
    ];
    state.enemy.damage = 4;
    state.enemy.reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "attack", tier: 2 }],
      [{ type: "miss", tier: 1 }],
    ];
  });
  await page.locator('[data-spin="0"]').click();
  await page.waitForFunction(() => currentRoll?.id === "hero-0");
  await page.locator("#machine-hero-0 .machine-face").click();
  await page.waitForFunction(() => currentRoll?.id === "enemy");
  assert.equal(await page.locator("#spotlight").isVisible(), false);
  await page.locator("#machine-enemy .machine-face").click();
  await finish(page);
  assert.equal(await page.evaluate(() => state.party[0].hp), 38);
  assert.equal(await page.evaluate(() => state.block), 0);
  assert.equal(await page.evaluate(() => state.lastEnemyRoll.target), 0);
  assert.match(
    await page.locator("#result-ribbon").textContent(),
    /2 damage to Alden/,
  );
});
