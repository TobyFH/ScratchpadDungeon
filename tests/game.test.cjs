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

async function game(t, { auto = false, width = 1440 } = {}) {
  const context = await browser.newContext({
      viewport: { width, height: 1100 },
      acceptDownloads: true,
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    let seed = 107;
    window.addEventListener("DOMContentLoaded", () => {
      temperamentEffects = (h, base) => base;
      heroDamagePower = (h, n) => n;
      heroHealingPower = n => n;
      characterLuck = () => 0.999999;
      scheduleStunRecovery = () => {};
      // These regressions isolate established base rules. Tactics has dedicated
      // real-rule tests for opening bonuses and random vulnerability.
      setupBattleOpening = () => {
        state.opening = null;
      };
      maybeVulnerable = () => false;
      tryBreakStun = (entity) => {
        entity.stun = 0;
        entity.stunGrace = 1;
        return true;
      };
    });
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  });
  await page.goto(baseURL);
  await page.evaluate(() => {
    localStorage.clear();
    // These mechanical regressions isolate base values from temperament, which
    // has dedicated real-build tests in combat-builds.test.cjs.
    temperamentEffects = (h, base) => base;
    heroDamagePower = (h,n) => n;
    heroHealingPower = n => n;
    // These regressions isolate established base rules. Tactics has dedicated
    // real-rule tests for opening bonuses and random vulnerability.
    setupBattleOpening = () => {
      state.opening = null;
    };
    maybeVulnerable = () => false;
    tryBreakStun = (entity) => {
      entity.stun = 0;
      entity.stunGrace = 1;
      return true;
    };
    newRun();
    setPreference("combatEffects", "beams");
  });
  if (auto) await autoEvents(page);
  t.after(async () => {
    assert.deepEqual(errors, [], "no browser errors");
    await context.close();
  });
  return page;
}
async function autoEvents(page) {
  await page.evaluate(() => {
    window.autoEventObserver = new MutationObserver(() => {
      let button = (window.campaignPortals ? document.querySelector("#tunnel-use:not(:disabled)") : null) || document.querySelector(
        "#stage-confirm:not(:disabled),#recruit-accept:not(:disabled),#recruit-decline:not(:disabled),#well-use:not(:disabled),#tunnel-leave:not(:disabled),#ruin-examine:not(:disabled),#death-confirm:not(:disabled),#burial-confirm:not(:disabled),#revive-use:not(:disabled),#item-leave:not(:disabled)",
      );
      if (button && !document.querySelector("#spotlight").hidden)
        button.click();
      if (!document.querySelector("#overlay").hidden && modalKind === "shop")
        document.querySelector("#modal [data-close]")?.click();
    });
    window.autoEventObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "hidden"],
    });
  });
}
async function fast(page) {
  await page.locator("#animation-speed").selectOption("skip");
}
async function finish(page) {
  await page.waitForFunction(() => !busy, null, { timeout: 30000 });
}
async function encounter(page, { hp = 1000, countdown = 20 } = {}) {
  await page.evaluate(
    ({ hp, countdown }) => {
      beginEncounter(false, { count: 1 });
      state.enemy.hp = state.enemy.maxHp = hp;
      state.enemy.countdown = countdown;
      setEnemyBlock(0);
      render();
    },
    { hp, countdown },
  );
}
async function faces(
  page,
  types = [
    ["attack", 1],
    ["attack", 2],
    ["heal", 1],
  ],
  hero = 0,
) {
  await page.evaluate(
    ({ types, hero }) => {
      state.party[hero].reels = types.map(([type, tier]) => [{ type, tier }]);
    },
    { types, hero },
  );
}
function blankFloor() {
  state.lastMinorEventStep = state.steps + 10000;
  state.pursuerSpawned = true;
  state.map = state.map.map((c, i) => ({
    ...c,
    wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
    seen: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
    event: null,
    feature: null,
    room: null,
    fogged: false,
    fogSince: Date.now(),
  }));
  state.position = pos(1, 7);
  state.map[state.position].seen = true;
  // Saved fixture floors obey the same mandatory-stair invariant as generation.
  Object.assign(state.map[pos(9, 1)], {
    wall: false,
    terrain: "floor",
    event: "stairs",
    feature: "stairs",
  });
  render();
}
async function startEval(page, source) {
  await page.evaluate((source) => {
    window.testAction = eval(source);
  }, source);
}

test("starts with one tank, no items, the trap key, and an always-available pace selector", async (t) => {
  let p = await game(t);
  assert.deepEqual(
    await p.evaluate(() => ({
      party: state.party.length,
      potions: state.potions,
      bombs: state.bombs,
      wards: state.wards,
      block: state.block,
    })),
    { party: 1, potions: 0, bombs: 0, wards: 0, block: 0 },
  );
  assert.equal(await p.locator("#animation-speed option").count(), 5);
  assert.match(await p.locator("#legend").textContent(), /Trap/);
  assert.ok(
    (await p.evaluate(
      () => state.map.filter((c) => c.event === "trap").length,
    )) >= 2,
  );
  assert.equal(
    await p.evaluate(() => document.fonts.check("18px Notebook")),
    true,
  );
  assert.doesNotMatch(await p.locator("body").textContent(), /Sunseed/);
  await p.screenshot({
    path: path.join(root, "test-results/desktop.png"),
    fullPage: true,
  });
});

test("notebook and three-hero machines fit desktop, tablet, and small phones", async (t) => {
  let p = await game(t);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    beginEncounter();
    render();
  });
  for (let width of [1536, 1024, 768, 390, 320]) {
    await p.setViewportSize({ width, height: 900 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      "no overflow at " + width,
    );
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({
    path: path.join(root, "test-results/mobile.png"),
    fullPage: true,
  });
});

test("treasure waits for explicit confirmation even in Skip and Escape does not dismiss it", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    Object.assign(state.map[79], {
      wall: false,
      event: "treasure",
      terrain: "floor",
    });
    Math.random = () => 0.5;
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.evaluate(() => busy), true);
  await p.waitForTimeout(1400);
  assert.equal(await p.locator("#spotlight").isVisible(), true);
  await p.keyboard.press("Escape");
  assert.equal(await p.locator("#spotlight").isVisible(), true);
  assert.equal(
    await p.locator("#stage-card input,#stage-card select").count(),
    0,
  );
  await p.locator("#animation-speed").selectOption("2");
  assert.equal(await p.evaluate(() => skip), false);
  await p.locator("#stage-confirm").click();
  await finish(p);
  assert.equal(await p.locator("#spotlight").isVisible(), false);
  assert.ok((await p.evaluate(() => state.gold)) > 0);
});

test("enemy entrance requires confirmation before shrinking into the right page", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.map[79].event = "enemy";
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#stage-confirm");
  assert.equal(
    await p.locator("#stage-title").textContent(),
    await p.evaluate(() => state.enemy.name),
  );
  await p.waitForTimeout(1200);
  assert.equal(await p.locator("#entrance-art").isVisible(), true);
  assert.equal(await p.evaluate(() => busy), true);
  await p.locator("#animation-speed").selectOption("2");
  // Observe the transfer when it is inserted, rather than polling for a
  // transient animation that may finish between browser round trips under load.
  await p.evaluate(() => {
    window.entranceTransfers = 0;
    window.entranceTransferObserver = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node.nodeType === 1 && node.matches(".encounter-ghost"))
            window.entranceTransfers++;
    });
    window.entranceTransferObserver.observe(document.body, { childList: true });
  });
  await p.locator("#stage-confirm").click();
  await finish(p);
  assert.equal(
    await p.evaluate(() => {
      window.entranceTransferObserver.disconnect();
      return window.entranceTransfers;
    }),
    1,
  );
  assert.equal(await p.locator("#enemy-art").isVisible(), true);
});

test("a matching pair does not crit; three identical symbols roll an automatic, lingering multiplier", async (t) => {
  let p = await game(t);
  await fast(p);
  await encounter(p);
  await faces(p, [
    ["attack", 1],
    ["attack", 1],
    ["heal", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.lastCritical), undefined);
  assert.equal(await p.evaluate(() => state.enemy.hp), 998);
  await faces(p, [
    ["attack", 1],
    ["attack", 1],
    ["attack", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await p.waitForSelector(".critical-locked #critical-result strong");
  let info = await p.evaluate(() => ({
    hp: state.enemy.hp,
    m: state.lastCritical.multiplier,
  }));
  assert.equal(await p.locator("#stage-confirm").count(), 0);
  await p.waitForTimeout(250);
  assert.equal(await p.locator("#spotlight").isVisible(), true);
  await finish(p);
  assert.equal(await p.locator("#spotlight").isVisible(), false);
  assert.equal(
    await p.evaluate(() => state.enemy.hp),
    info.hp - Math.ceil(3 * info.m),
  );
});

test("pace supports 1×, 2×, 3×, 5×, and Skip; Skip retains particles and impact shakes", async (t) => {
  let p = await game(t);
  for (let speed of ["2", "3", "5", "skip", "1"]) {
    await p.locator("#animation-speed").selectOption(speed);
    assert.equal(await p.evaluate(() => state.speed), speed);
  }
  await fast(p);
  let fx = await p.evaluate(() => {
    shakeElement(document.querySelector("#machine-hero-0"), 3);
    burst(document.querySelector("#machine-hero-0"), "paper", 12);
    return {
      shakes: [...liveAnimations].filter((a) => a.juice).length,
      particles: particles.length,
    };
  });
  assert.ok(fx.shakes > 0);
  assert.ok(fx.particles >= 12);
  assert.equal(
    await p
      .locator("body")
      .evaluate((el) => el.classList.contains("skip-cinematics")),
    true,
  );
});

test("slot handles have stationary, generous hitboxes while their artwork swings", async (t) => {
  let p = await game(t);
  await encounter(p);
  await faces(p);
  let lever = p.locator('[data-spin="0"]'),
    before = await lever.boundingBox();
  assert.ok(before.width >= 44);
  await lever.click();
  await p.waitForFunction(() => currentRoll?.id === "hero-0");
  let during = await lever.boundingBox();
  assert.ok(Math.abs(before.x - during.x) < 1);
  assert.ok(Math.abs(before.y - during.y) < 1);
  await lever.click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.enemy.hp), 997);
  assert.equal(await p.evaluate(() => state.enemy.countdown), 19);
});

test("unknown hover, erasing before stepping, and revealed-only shortest routes preserve fog", async (t) => {
  let p = await game(t, { auto: true });
  await p.evaluate(blankFloor);
  await p.locator('[data-tile="79"]').hover();
  assert.match(await p.locator("#hover-name").textContent(), /Unknown/);
  await p.evaluate(() => {
    window.eraseSnapshot = null;
    let observer = new MutationObserver(() => {
      if (
        document.querySelector('[data-tile="79"]').classList.contains("erasing")
      ) {
        window.eraseSnapshot = {
          position: state.position,
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
  await p.locator('[data-tile="79"]').click();
  await finish(p);
  assert.deepEqual(await p.evaluate(() => window.eraseSnapshot), {
    position: 78,
    seen: false,
  });
  assert.equal(await p.evaluate(() => shortestPath(pos(4, 7))), null);
  await fast(p);
  await p.evaluate(() => {
    for (let x = 1; x <= 8; x++) state.map[pos(x, 7)].seen = true;
    render();
  });
  let length = await p.evaluate(() => shortestPath(pos(8, 7)).length);
  await p.locator('[data-tile="85"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.steps), length + 1);
  assert.equal(await p.evaluate(() => state.map[pos(5, 6)].seen), false);
});

test("beacon reveals neighbours with optional outer-ring light and does not activate their events", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  let r = await p.evaluate(async () => {
    state.map.forEach((c) => {
      c.seen = false;
      c.event = null;
      c.feature = null;
      c.room = null;
    });
    state.position = pos(5, 4);
    state.map[state.position].seen = true;
    state.map.forEach((c) => {
      c.wall = false;
      c.terrain = "floor";
    });
    state.map[pos(6, 5)].event = "enemy";
    render();
    await resolveTile({ event: "beacon" });
    return {
      seen: state.map.map((c, i) => (c.seen ? i : -1)).filter((i) => i >= 0),
      expected: [state.position, ...neighbors(state.position, true)].sort(
        (a, b) => a - b,
      ),
      enemy: state.enemy,
    };
  });
  assert.ok(r.expected.every((i) => r.seen.includes(i)));
  assert.ok(r.seen.length >= 9 && r.seen.length <= 14);
  assert.equal(r.enemy, null);
});

test("well can be declined and revisited; the rolled heal affects only living heroes", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    state.party[0].hp = 1;
    state.party[1].hp = 1;
    state.map[79].event = "well";
    state.map[79].feature = "well";
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#well-decline");
  await p.locator("#well-decline").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.map[79].event), "well");
  assert.equal(
    await p.locator('[data-tile="79"]').getAttribute("data-state"),
    "active",
  );
  assert.equal(
    await p
      .locator('[data-tile="79"]')
      .evaluate((e) => e.classList.contains("active-well")),
    true,
  );
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#well-use");
  await p.evaluate(() => {
    window.savedRandom = Math.random;
    let values = [0, 0.6, 0.95];
    Math.random = () => values.shift() ?? 0.95;
  });
  await p.locator("#well-use").click();
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.evaluate(() => state.lastWellRoll.bonus), 3);
  await p.evaluate(() => {
    window.healingGlyphsCreated = 0;
    new MutationObserver((rows) =>
      rows.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (n.matches?.(".healing-glyph")) window.healingGlyphsCreated++;
        }),
      ),
    ).observe(document.body, { childList: true, subtree: true });
  });
  await p.locator("#stage-confirm").click();
  await p.waitForFunction(() => window.healingGlyphsCreated >= 8);
  assert.deepEqual(
    await p.evaluate(() => state.party.map((h) => h.hp)),
    [12, 9],
  );
  await finish(p);
  await p.evaluate(() => (Math.random = window.savedRandom));
  assert.equal(
    await p.locator('[data-tile="79"]').getAttribute("data-state"),
    "used",
  );
  assert.equal(await p.evaluate(() => state.map[79].event), null);
});

test("floor-one enemies attack every three actions and scale gradually to faster clocks", async (t) => {
  let p = await game(t);
  let scaling = await p.evaluate(() => {
    let old = Math.random;
    Math.random = () => 0.5;
    state.depth = 1;
    beginEncounter();
    let a = enemyBalance(1, {species:"skull"});
    state.depth = 9;
    beginEncounter();
    let b = enemyBalance(9, {species:"skull"});
    Math.random = old;
    return {
      start: a.frequency,
      hp: a.maxHp,
      dmg: a.damage,
      speed: b.frequency < a.frequency,
      strikes: b.strikes >= a.strikes && b.strikes <= 2,
      health: b.maxHp > a.maxHp,
    };
  });
  assert.equal(scaling.start, 3);
  assert.equal(
    scaling.hp,
    14,
    "the selected skeletal warrior has its species health multiplier",
  );
  assert.equal(scaling.dmg, 3);
  assert.ok(scaling.speed && scaling.strikes && scaling.health);
});

test("equal faces retain thematic class powers without hidden author weights", async (t) => {
  let p = await game(t);
  let odds = await p.evaluate(() =>
    Object.fromEntries(
      ["fighter", "healer", "rogue"].map((job) => {
        let r = makeHero("Test", job, null, [], {
            specialism: job === "rogue" ? "offence" : "defence",
          }).reels[0],
          sum = r.reduce((n, s) => n + s.weight, 0);
        return [
          job,
          Object.fromEntries(
            ["attack", "heal", "block", "stun"].map((type) => [
              type,
              r
                .filter((s) => s.type === type)
                .reduce((n, s) => n + s.weight, 0) / sum,
            ]),
          ),
        ];
      }),
    ),
  );
  assert.equal(odds.fighter.heal, 1 / 6);
  assert.equal(odds.healer.heal, 2 / 6);
  assert.ok(odds.healer.attack < 0.08);
  assert.equal(odds.rogue.heal, 0);
  assert.equal(odds.rogue.attack, 2 / 6);
});

test("shared block absorbs multi-strikes, animates protection, and clears after victory and before the next fight", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await encounter(p);
  let protectedHit = await p.evaluate(() => {
    state.block = 8;
    let hp = state.party[0].hp;
    damageHero(0, 6, "Test strike");
    return {
      hp: state.party[0].hp,
      expected: hp,
      block: state.block,
      fx: [...liveAnimations].some(
        (a) => a.juice && a.effect.target.id === "block",
      ),
      shield: particles.some((p) => p.kind === "shield"),
    };
  });
  assert.equal(protectedHit.hp, protectedHit.expected);
  assert.equal(protectedHit.block, 2);
  assert.ok(protectedHit.fx && protectedHit.shield);
  await p.evaluate(async () => {
    await victory(state.enemy);
    render();
  });
  assert.equal(await p.evaluate(() => state.block), 0);
  await p.evaluate(() => {
    state.block = 30;
    beginEncounter();
    render();
  });
  assert.equal(await p.evaluate(() => state.block), 0);
  assert.match(await p.locator("#block").textContent(), /TEAM BLOCK/);
});

test("EXP is unchanged by repeated spins and granted only for a successful battle", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await encounter(p);
  await faces(p);
  await p.evaluate(async () => {
    await spin(0);
    await spin(0);
  });
  assert.equal(await p.evaluate(() => state.party[0].xp), 0);
  await p.evaluate(() => {
    state.enemy.hp = 1;
  });
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.battlesWon), 1);
  assert.equal(await p.evaluate(() => state.party[0].xp), 9);
  assert.equal(await p.evaluate(() => state.lastLoot.source), "battle");
});

test("loot is mostly gold, rare items and rarer artefacts; coin particles scale with the reward", async (t) => {
  let p = await game(t);
  await fast(p);
  let chances = await p.evaluate(() => {
    let r = lootFaces(),
      sum = r.reduce((n, s) => n + s.weight, 0);
    return {
      items:
        r.filter((s) => ITEM_DEFS[s.type]).reduce((n, s) => n + s.weight, 0) /
        sum,
      artefact: r.find((s) => s.type === "artefact").weight / sum,
    };
  });
  assert.ok(chances.items < 0.025);
  assert.ok(chances.artefact > 0.021 && chances.artefact < 0.023);
  await startEval(
    p,
    "(async()=>{let old=Math.random;Math.random=()=>0;try{await treasureRoll()}finally{Math.random=old}})()",
  );
  await p.waitForSelector("#stage-confirm");
  let counts = await p.evaluate(() => ({
    gold: state.lastLoot.gold,
    coins: particles.filter((p) => p.kind === "coin").length,
  }));
  assert.ok(counts.coins >= Math.max(55, counts.gold));
  let budget = await p.evaluate(() => coinRain?.remaining);
  await p.waitForTimeout(180);
  assert.ok((await p.evaluate(() => coinRain?.remaining ?? 0)) < budget);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.testAction);
});

test("rare adventurers preview class, art and dialogue; decline, accept, and the cap all work", async (t) => {
  let p = await game(t);
  await fast(p);
  await startEval(p, "recruitEncounter()");
  await p.waitForSelector("#recruit-accept");
  assert.match(
    await p.locator("#stage-card").textContent(),
    /Mage|Rogue|Tank|Berserker|Ranger/,
  );
  assert.equal(await p.locator("#stage-card .stage-art svg").count(), 1);
  assert.ok((await p.locator(".encounter-quote").textContent()).length > 10);
  await p.evaluate(() => {
    window.legacyRefusalRandom = Math.random;
    Math.random = () => 0.9;
  });
  await p.locator("#recruit-decline").click();
  await p.evaluate(() => {
    Math.random = window.legacyRefusalRandom;
  });
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.party.length), 1);
  await startEval(p, "recruitEncounter()");
  await p.locator("#recruit-accept").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.party.length), 2);
  await startEval(p, "recruitEncounter()");
  await p.locator("#recruit-accept").click();
  await p.evaluate(() => window.testAction);
  await startEval(p, "recruitEncounter()");
  await p.waitForSelector("#recruit-decline");
  assert.equal(await p.locator("#recruit-accept").count(), 1);
  await p.evaluate(() => {
    window.legacyRefusalRandom = Math.random;
    Math.random = () => 0.9;
  });
  await p.locator("#recruit-decline").click();
  await p.evaluate(() => {
    Math.random = window.legacyRefusalRandom;
  });
  assert.equal(await p.evaluate(() => state.party.length), 3);
});

test("shops retain their modest 40% floor chance and early solo adventurers have a slightly increased chance", async (t) => {
  let p = await game(t);
  let rates = await p.evaluate(() => {
    let shops = 0,
      recruits = 0;
    for (let i = 0; i < 1000; i++) {
      let m = generateFloor(1);
      shops += m.some((c) => c.event === "shop");
      recruits += m.some((c) => c.event === "recruit");
    }
    return { shops: shops / 1000, recruits: recruits / 1000 };
  });
  assert.ok(rates.shops > 0.35 && rates.shops < 0.45, JSON.stringify(rates));
  assert.ok(
    rates.recruits > 0.37 && rates.recruits < 0.51,
    JSON.stringify(rates),
  );
});

test("shop purchases deduct gold, enforce stock and funds, heal the team, and reveal stairs", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.gold = 1000;
    state.party.push(makeHero("Mira", "healer"));
    state.party[0].hp = 1;
    state.party[1].hp = 1;
    render();
  });
  await startEval(
    p,
    "shopEncounter({shop:{potion:1,bomb:1,ward:1,heal:1,reveal:1}})",
  );
  await p.waitForSelector('[data-buy="potion"]');
  let cost = await p.evaluate(() => shopPrices().potion);
  await p.locator('[data-buy="potion"]').click();
  assert.equal(await p.evaluate(() => state.gold), 1000 - cost);
  assert.equal(await p.evaluate(() => state.potions), 1);
  assert.equal(await p.locator('[data-buy="potion"]').isDisabled(), true);
  await p.locator('[data-buy="heal"]').click();
  assert.deepEqual(
    await p.evaluate(() => state.party.map((h) => h.hp)),
    [50, 28],
  );
  await p.locator('[data-buy="reveal"]').click();
  assert.equal(await p.evaluate(() => state.exitFound), true);
  assert.equal(
    await p.evaluate(() => state.map.find((c) => c.event === "stairs").seen),
    true,
  );
  let gold = await p.evaluate(() => state.gold);
  await p.evaluate(() => {
    state.gold = 0;
    drawShop();
  });
  assert.equal(await p.locator('[data-buy="bomb"]').isDisabled(), true);
  await p.locator("#modal [data-close]").first().click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => shopCell), null);
  assert.ok(gold >= 0);
});

test("artefacts can roll from battle spoils, occupy one slot, and scale with floor depth", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(async () => {
    let old = Math.random;
    let draws = 0;
    Math.random = () => (draws++ < 3 ? 0.999 : 0);
    try {
      await treasureRoll("battle");
    } finally {
      Math.random = old;
    }
    render();
  });
  assert.equal(await p.evaluate(() => state.artefacts.length), 3);
  assert.equal(
    await p.evaluate(() => state.equippedArtefact),
    await p.evaluate(() => state.artefacts[0].id),
  );
  assert.equal(await p.locator("#artefact-slot").count(), 1);
  let powers = await p.evaluate(() => {
    let old = Math.random;
    Math.random = () => 0;
    let a = makeArtefact(1),
      b = makeArtefact(9);
    Math.random = old;
    return [a.power, b.power];
  });
  assert.ok(powers[1] > powers[0]);
  await p.locator("#artefact-slot").click();
  let second = await p.evaluate(() => state.artefacts[1].id);
  await p.locator('#modal [data-equip="' + second + '"]').click();
  assert.equal(await p.evaluate(() => state.equippedArtefact), second);
});

test("only equipped artefact affects rolls; guard artefacts generate fresh battle block", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.artefacts = [
      { id: "a", key: "attack", power: 5, depth: 1, name: "Fang" },
      { id: "b", key: "heal", power: 7, depth: 2, name: "Tear" },
      { id: "c", key: "guard", power: 9, depth: 3, name: "Seal" },
    ];
    state.equippedArtefact = "a";
    render();
  });
  await encounter(p);
  await faces(p);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.enemy.hp), 992);
  assert.equal(await p.evaluate(() => passive("heal")), 0);
  await p.evaluate(() => {
    equipArtefact("c");
    state.block = 80;
    beginEncounter();
    render();
  });
  assert.equal(await p.evaluate(() => state.block), 9);
});

test("speech remains class appropriate but respects a cooldown and is much less frequent", async (t) => {
  let p = await game(t);
  await p.evaluate(() => {
    let old = fxRandom;
    fxRandom = () => 0;
    idleChatter();
    fxRandom = old;
  });
  assert.equal(await p.locator(".speech-bubble").count(), 1);
  await encounter(p);
  assert.equal(await p.evaluate(() => idleChatter()), false);
  await p.evaluate(() => {
    let old = fxRandom;
    fxRandom = () => 0;
    sayEnemy("attack");
    fxRandom = old;
  });
  assert.ok(
    (await p.locator('.speech-bubble[data-speaker="enemy-art"]').textContent())
      .length > 1,
  );
  let text = await p
    .locator('.speech-bubble[data-speaker="enemy-art"]')
    .textContent();
  await p.evaluate(() => {
    let old = fxRandom;
    fxRandom = () => 0;
    sayEnemy("hurt");
    fxRandom = old;
  });
  assert.equal(
    await p.locator('.speech-bubble[data-speaker="enemy-art"]').textContent(),
    text,
  );
  assert.equal(
    await p.evaluate(() => Date.now() - state.enemy.lastQuipAt < 16000),
    true,
  );
});

test("boulder stays clipped inside its drawing area and trap results wait for a button", async (t) => {
  let p = await game(t);
  await fast(p);
  await startEval(
    p,
    "(async()=>{let old=Math.random;Math.random=()=>.9;try{await trapRoll()}finally{Math.random=old}})()",
  );
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.locator(".trap-art.boulder").count(), 1);
  assert.equal(
    await p
      .locator(".trap-art")
      .evaluate((el) => getComputedStyle(el).overflow),
    "hidden",
  );
  await p.waitForTimeout(1100);
  assert.equal(await p.locator("#spotlight").isVisible(), true);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.block), 0);
});

test("stairs permit optional descent only after their guardian; final guardian death wins immediately", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(() => {
    state.exitFound = true;
    state.exitReached = true;
    state.floorBossDefeated = true;
    render();
    stairs();
  });
  assert.equal(await p.locator("#retire").count(), 0);
  await p.getByRole("button", { name: "Keep exploring", exact: true }).click();
  assert.equal(await p.evaluate(() => state.depth), 1);
  await p.locator("#exit-found").click();
  await p.locator("#descend").click();
  assert.equal(await p.evaluate(() => state.depth), 2);
  await p.evaluate(() => {
    state.depth = 10;
    state.floorBossDefeated = false;
    state.map = generateFloor(10);
    state.exitFound = true;
    state.exitReached = true;
    render();
    stairs();
  });
  assert.equal(await p.locator("#descend").isDisabled(), true);
  await p.getByRole("button", { name: "Keep exploring", exact: true }).click();
  await p.evaluate(async () => {
    beginEncounter(true);
    state.enemy.hp = 0;
    await victory(state.enemy);
    render();
  });
  assert.equal(await p.evaluate(() => state.floorBossDefeated), true);
  assert.equal(await p.evaluate(() => state.won && state.over), true);
  assert.equal(
    await p.locator("#modal-title").textContent(),
    "YOU WROTE THE ENDING!",
  );
});

test("generated maps remain connected, with no mid-dungeon quest guardian", async (t) => {
  let p = await game(t);
  assert.equal(
    await p.evaluate(() => {
      for (let d = 1; d <= 80; d++) {
        let m = generateFloor(Math.min(d, 10)),
          s = new Set([pos(1, 7)]),
          q = [pos(1, 7)];
        for (let n of q)
          for (let j of [...neighbors(n), ...(m[n].event === "tunnel" && m[m[n].tunnelTo]?.event === "tunnel" && m[m[n].tunnelTo].tunnelTo === n ? [m[n].tunnelTo] : [])])
            if (!m[j].wall && !s.has(j)) {
              s.add(j);
              q.push(j);
            }
        if (m.some((c, i) => !c.wall && !s.has(i))) return false;
      }
      return true;
    }),
    true,
  );
  assert.equal(
    await p.evaluate(() =>
      generateFloor(3).some((c) => c.event === "guardian"),
    ),
    false,
  );
  assert.equal(
    await p.evaluate(
      () => generateFloor(10).filter((c) => c.event === "guardian").length,
    ),
    0,
  );
});

test("targeted healing and battle items affect survivors without awarding spin XP", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await encounter(p, { countdown: 20 });
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    state.party[0].hp = 10;
    state.party[1].hp = 1;
    state.potions = 1;
    state.wards = 1;
    state.bombs = 1;
    render();
  });
  await p.locator('#targets [data-target="1"]').click();
  await faces(p, [
    ["heal", 1],
    ["heal", 2],
    ["block", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[1].hp), 7);
  assert.equal(await p.evaluate(() => state.party[0].hp), 10);
  assert.equal(await p.evaluate(() => state.party[0].xp), 0);
  await p.locator("#ward").click();
  assert.equal(await p.evaluate(() => state.wards), 0);
  assert.equal(await p.evaluate(() => state.block), 7);
  await p.locator("#bomb").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.bombs), 0);
});

test("victory levels grant HP and personal editing points; weighted editing preserves odds and cost", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await encounter(p);
  await p.evaluate(() => {
    state.party[0].xp = 10;
    state.enemy.hp = 1;
  });
  await faces(p);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[0].level), 2);
  assert.equal(await p.evaluate(() => state.party[0].maxHp), 56);
  assert.equal((await p.evaluate(() => state.party[0].points)) >= 8, true);
  await p.locator('.edit-button[data-edit="0"]').click();
  let points = await p.evaluate(() => state.party[0].points);
  await p.locator('[data-upgrade="0,0,0"]').click();
  assert.equal(await p.evaluate(() => state.party[0].points), points - 5);
  assert.equal(await p.evaluate(() => state.party[0].reels[0][0].tier), 2);
});

test("full ten-floor expedition can progress through fog, loot confirmations, battles and final descent", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(() => {
    state.party[0].hp = state.party[0].maxHp = 10000;
    // This integration checks floor transitions, not combat tuning. A fixed
    // test artefact prevents the new low base damage stalling on late healing.
    state.artefacts=[{id:"campaign",key:"attack",power:300,name:"Test power"}];
    state.equippedArtefact="campaign";
    window.campaignPortals = true;
  });
  await faces(p, [
    ["attack", 3],
    ["attack", 2],
    ["attack", 1],
  ]);
  let actions = 0;
  while (actions++ < 650) {
    let s = await p.evaluate(() => ({
      enemy: !!state.enemy,
      exit: state.exitFound,
      reached: state.exitReached,
      depth: state.depth,
      boss: state.floorBossDefeated,
      modal: modalKind,
      over: state.over,
    }));
    if (s.over) break;
    if (s.enemy) {
      await p.evaluate(() => spin(0));
    } else if (s.modal === "stairs") {
      if (await p.locator("#descend").isEnabled())
        await p.locator("#descend").click();
      else
        await p
          .getByRole("button", { name: "Keep exploring", exact: true })
          .click();
    } else if (s.exit && s.reached && (s.depth < 10 || s.boss)) {
      await p.locator("#exit-found").click();
    } else
      await p.evaluate(async () => {
        let goal = state.map.findIndex((c) => c.event === "stairs"),
          route = shortestPath(goal, true);
        if (!route?.length) throw Error("No campaign route");
        await move(route[0]);
      });
  }
  assert.ok(
    actions < 650,
    JSON.stringify(
      await p.evaluate(() => ({
        depth: state.depth,
        position: state.position,
        enemy: state.enemy && {
          hp: state.enemy.hp,
          block: state.enemy.block,
          name: state.enemy.name,
        },
        stun: state.party[0].stun,
      })),
    ),
  );
  assert.equal(await p.evaluate(() => state.depth), 10);
  assert.equal(await p.evaluate(() => state.won), true);
});

test("save restores speed and artefacts and migrates the earlier Sunseed-era notebook safely", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await p.locator('[data-tile="79"]').click();
  await finish(p);
  const snapshot = await p.evaluate(() => ({
    depth: state.depth,
    position: state.position,
    gold: state.gold,
    speed: state.speed,
    party: JSON.stringify(state.party),
    bag: JSON.stringify(state.bag),
    artefacts: JSON.stringify(state.artefacts),
  }));
  await p.reload();
  assert.deepEqual(
    await p.evaluate(() => ({
      depth: state.depth,
      position: state.position,
      gold: state.gold,
      speed: state.speed,
      party: JSON.stringify(state.party),
      bag: JSON.stringify(state.bag),
      artefacts: JSON.stringify(state.artefacts),
    })),
    snapshot,
  );
  await p.evaluate(() => {
    let old = {
      ...state,
      version: 2,
      skip: true,
      relic: true,
      logs: ["The Sunseed is home."],
    };
    delete old.speed;
    delete old.artefacts;
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem("scratchpad-dungeon-v2", JSON.stringify(old));
  });
  await p.reload();
  assert.equal(await p.evaluate(() => state.version), 22);
  assert.equal(await p.evaluate(() => state.speed), "skip");
  assert.equal(await p.evaluate(() => state.relic), undefined);
  assert.doesNotMatch(await p.locator("body").textContent(), /Sunseed/);
});

test("downloaded HTML remains self-contained and playable offline with mandatory confirmations", async (t) => {
  let p = await game(t);
  let next = p.waitForEvent("download");
  await p.evaluate(() => optionsPage("play"));
  await p.locator("#option-download").click();
  let d = await next,
    backup = path.join(root, "test-results/Scratchpad-Dungeon.html");
  await d.saveAs(backup);
  let html = await readFile(backup, "utf8");
  assert.ok(html.includes("data:font/ttf;base64,"));
  assert.ok(html.includes("SIL OPEN FONT LICENSE"));
  let offline = await p.context().newPage(),
    requests = [],
    errors = [];
  offline.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  offline.on("pageerror", (e) => errors.push(e.message));
  await p.context().setOffline(true);
  await offline.setContent(html);
  await offline.locator('[data-start-job="fighter"]').click();
  assert.equal(await offline.locator(".tile").count(), 99);
  await fast(offline);
  await offline.evaluate(() => {
    Object.assign(state.map[79], {
      wall: false,
      event: "treasure",
      terrain: "floor",
    });
    Math.random = () => 0.5;
    render();
  });
  await offline.locator('[data-tile="79"]').click();
  await offline.waitForSelector("#stage-confirm");
  await offline.locator("#stage-confirm").click();
  await finish(offline);
  assert.ok((await offline.evaluate(() => state.gold)) > 0);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
});

test("a solo stunned hero misses one turn without rolling and advances the enemy countdown", async (t) => {
  let p = await game(t);
  await fast(p);
  await encounter(p, { countdown: 3 });
  await faces(p);
  await p.evaluate(() => {
    state.party[0].stun = 1;
    render();
  });
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[0].stun), 0);
  assert.equal(await p.evaluate(() => state.enemy.countdown), 2);
  assert.equal(await p.evaluate(() => state.party[0].stats.spins), 0);
  assert.equal(await p.evaluate(() => state.party[0].stats.turnsMissed), 1);
  assert.equal(await p.evaluate(() => state.enemy.hp), 1000);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.enemy.countdown), 1);
  assert.equal(await p.evaluate(() => state.enemy.hp), 997);
});

test("retargeting a long walk changes direction without shaking empty rooms", async (t) => {
  let p = await game(t);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.map.forEach((c) => {
      if (!c.wall) c.seen = true;
    });
    window.emptyRoomShakes = 0;
    let original = shakeBook;
    shakeBook = (...args) => {
      window.emptyRoomShakes++;
      original(...args);
    };
    render();
  });
  await p.locator('[data-tile="86"]').click();
  await p.waitForFunction(() => !!travel);
  assert.equal(await p.locator('[data-tile="67"]').isEnabled(), true);
  await p.locator('[data-tile="67"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.position), 67);
  assert.equal(await p.evaluate(() => state.map[86].visited), false);
  assert.equal(await p.evaluate(() => window.emptyRoomShakes), 0);
});

test("routing takes a visible safe detour around active battles and enters them only if necessary", async (t) => {
  let p = await game(t);
  await p.evaluate(blankFloor);
  let paths = await p.evaluate(() => {
    for (let x = 1; x <= 4; x++) {
      state.map[pos(x, 7)].seen = true;
      state.map[pos(x, 6)].seen = true;
    }
    state.map[pos(2, 7)].event = "enemy";
    state.map[pos(2, 7)].feature = "enemy";
    render();
    let safe = shortestPath(pos(4, 7)),
      direct = shortestPath(pos(2, 7));
    for (let x = 1; x <= 4; x++) state.map[pos(x, 6)].seen = false;
    let forced = shortestPath(pos(4, 7));
    return { safe, direct, forced };
  });
  assert.equal(paths.safe.includes(79), false);
  assert.equal(paths.safe.length, 5);
  assert.deepEqual(paths.direct, [79]);
  assert.equal(paths.forced.includes(79), true);
  assert.equal(
    await p.locator('[data-tile="79"]').getAttribute("data-state"),
    "active",
  );
  assert.equal(
    await p
      .locator('[data-tile="79"]')
      .evaluate((el) => el.classList.contains("active-battle")),
    true,
  );
});

test("movement scales at half the animation-speed increase; instant uses fastest walking and distance adds only a modest bonus", async (t) => {
  let p = await game(t);
  const rates = [];
  for (let speed of ["1", "2", "3", "5", "skip"]) {
    await p.locator("#animation-speed").selectOption(speed);
    rates.push(await p.evaluate(() => moveRate()));
  }
  assert.deepEqual(rates, [1, 1.5, 2, 3, 3]);
  assert.equal(await p.evaluate(() => distanceBoost(1)), 1);
  assert.ok((await p.evaluate(() => distanceBoost(12))) > 1);
  assert.ok((await p.evaluate(() => distanceBoost(99))) <= 1.24);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.map[79].seen = true;
    render();
  });
  // Sample the live step in the same browser task: instant walking lasts
  // only 60ms, so a separate automation round trip can observe its end.
  const step = await p.evaluate(() => {
    window.testAction = move(79);
    return {
      walking: document
        .querySelector("#map-player")
        .classList.contains("walking"),
      duration: getComputedStyle(document.querySelector("#map-player"))
        .transitionDuration,
    };
  });
  assert.equal(step.walking, true);
  assert.ok(parseFloat(step.duration) > 0);
  await finish(p);
});

test("every class has empty faces, the rogue has low HP and poison, and starting as rogue is available", async (t) => {
  let p = await game(t);
  let classes = await p.evaluate(() =>
    ["fighter", "healer", "rogue"].map((job) => {
      let h = makeHero("Test", job);
      return {
        job,
        hp: h.maxHp,
        blank: h.reels[0].some((s) => s.type === "blank"),
        attack: h.reels[0]
          .filter((s) => s.type === "attack")
          .reduce((n, s) => n + s.weight, 0),
        poison: h.reels[0].filter((f) => f.type === "poison").length,
        block: h.reels[0]
          .filter((s) => s.type === "block")
          .reduce((n, s) => n + s.weight, 0),
      };
    }),
  );
  assert.ok(classes.every((c) => c.blank));
  assert.equal(classes[2].hp, 26);
  assert.ok(classes[2].block < classes[0].block);
  assert.ok(classes[2].attack > 0);
  assert.ok(classes[2].poison > 0);
  await p.getByRole("button", { name: "New run", exact: true }).click();
  await p.locator('[data-start-job="rogue"]').click();
  assert.equal(await p.evaluate(() => state.party[0].job), "rogue");
  assert.equal(await p.evaluate(() => state.party[0].hp), 26);
});

test("empty reels have no effect or critical and still count as a real action; shields have readable tier power", async (t) => {
  let p = await game(t);
  await fast(p);
  await encounter(p);
  await faces(p, [
    ["blank", 1],
    ["blank", 1],
    ["blank", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.enemy.hp), 1000);
  assert.equal(await p.evaluate(() => state.enemy.countdown), 19);
  assert.equal(await p.evaluate(() => state.lastCritical), undefined);
  assert.match(await p.locator("#result-ribbon").textContent(), /Empty reels/);
  assert.equal(
    await p.evaluate(
      () =>
        calculate([
          { type: "block", tier: 1 },
          { type: "block", tier: 2 },
          { type: "blank", tier: 1 },
        ]).block,
    ),
    6,
  );
});

test("weak stuns are stopped by any positive armour and stronger shield checks consume more block", async (t) => {
  let p = await game(t);
  await encounter(p);
  let r = await p.evaluate(() => {
    state.block = 1;
    stunHero(0, 1);
    let small = { block: state.block, stun: state.party[0].stun };
    state.block = 20;
    stunHero(0, 2);
    let large = { block: state.block, stun: state.party[0].stun };
    state.block = 0;
    stunHero(0, 2);
    let unprotected = state.party[0].stun;
    setEnemyBlock(2);
    stunEnemy(1);
    let enemyProtected = { block: state.enemy.block, stun: state.enemy.stun };
    stunEnemy(1);
    return {
      small,
      large,
      unprotected,
      enemyProtected,
      enemyStun: state.enemy.stun,
    };
  });
  assert.deepEqual(r.small, { block: 0, stun: 0 });
  assert.deepEqual(r.large, { block: 8, stun: 0 });
  assert.equal(r.unprotected, 1);
  assert.deepEqual(r.enemyProtected, { block: 0, stun: 0 });
  assert.equal(r.enemyStun, 1);
});

test("permanent death cannot be healed or leveled away, then death and burial screens preserve a detailed memorial", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    let h = makeHero("Mira", "healer", {
      depth: 2,
      tile: 45,
      description: "Found beside an old well",
    });
    h.hp = 1;
    h.joinedAt = Date.now() - 125000;
    h.joinedSteps = 3;
    h.stats.damageDealt = 27;
    h.stats.healingDone = 19;
    h.stats.battles = 2;
    state.steps = 23;
    state.party.push(h);
    state.potions = 1;
    render();
    damageHero(1, 20, "Skeletal warrior (×3 critical)");
    window.deadId = h.id;
    window.deadHeal = healHero(1, 999);
    addXP(h, 999);
    state.target = 1;
    usePotion();
  });
  assert.equal(await p.evaluate(() => window.deadHeal), 0);
  assert.equal(await p.evaluate(() => state.party[1].hp), 0);
  assert.equal(await p.evaluate(() => state.party[1].xp), 0);
  assert.equal(await p.evaluate(() => state.potions), 1);
  await startEval(p, "processDeaths()");
  await p.waitForSelector("#death-confirm");
  assert.match(await p.locator("#stage-card").textContent(), /dead. Forever/);
  await p.locator("#death-confirm").click();
  await p.waitForSelector("#burial-confirm");
  const text = await p.locator(".memorial-stats").textContent();
  assert.match(text, /Skeletal warrior/);
  assert.match(text, /Found beside an old well/);
  assert.match(text, /20 steps/);
  assert.match(text, /27/);
  assert.match(text, /19/);
  await p.screenshot({ path: path.join(root, "test-results/burial.png") });
  await p.locator("#burial-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.party.length), 1);
  assert.equal(await p.evaluate(() => state.graveyard.length), 1);
  assert.equal(await p.evaluate(() => state.graveyard[0].buried), true);
  await p.locator("#memorial").click();
  assert.match(await p.locator("#modal").textContent(), /Mira/);
});

test("enemy multi-strikes pause for death and burial, then retarget a surviving hero", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    state.party[1].hp = 1;
    state.party[0].reels = [0, 1, 2].map(() => [{ type: "blank", tier: 1 }]);
    beginEncounter();
    Object.assign(state.enemy, {
      countdown: 1,
      frequency: 2,
      strikes: 2,
      damage: 9,
    });
    state.enemy.reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "block", tier: 1 }],
      [{ type: "blank", tier: 1 }],
    ];
    render();
  });
  await startEval(
    p,
    "(async()=>{let old=Math.random;Math.random=()=>.999;try{await spin(0)}finally{Math.random=old}})()",
  );
  await p.waitForSelector("#death-confirm");
  assert.equal(await p.evaluate(() => busy), true);
  assert.equal(await p.evaluate(() => state.party[0].hp), 50);
  assert.equal(await p.evaluate(() => state.party[1].dead), true);
  await p.locator("#death-confirm").click();
  await p.waitForSelector("#burial-confirm");
  await p.locator("#burial-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.party.length), 1);
  assert.equal(await p.evaluate(() => state.party[0].hp), 44);
  assert.equal(
    await p.evaluate(() => state.lastEnemyRoll.heroId),
    await p.evaluate(() => state.party[0].id),
  );
  assert.equal(await p.evaluate(() => state.enemy.countdown), 2);
  assert.equal(await p.evaluate(() => state.graveyard[0].buried), true);
  assert.equal(await p.evaluate(() => state.graveyard[0].stats.damageTaken), 1);
});

test("a fatal hit is saved immediately and reload resumes acknowledgement without resurrecting the companion", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    damageHero(1, 100, "An arrow trap");
  });
  await p.reload();
  await p.waitForSelector("#death-confirm");
  assert.equal(await p.evaluate(() => state.party[1].hp), 0);
  assert.equal(await p.evaluate(() => state.party[1].dead), true);
  await p.locator("#death-confirm").click();
  await p.waitForSelector("#burial-confirm");
  await p.locator("#burial-confirm").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party.length), 1);
  assert.equal(await p.evaluate(() => state.graveyard.length), 1);
  await p.reload();
  assert.equal(await p.evaluate(() => state.party.length), 1);
  assert.equal(await p.evaluate(() => state.graveyard.length), 1);
});

test("the final companion gets a death acknowledgement without a burial, then the run ends", async (t) => {
  let p = await game(t);
  await fast(p);
  await startEval(
    p,
    "(async()=>{damageHero(0,100,'A rolling boulder');await processDeaths();checkDefeat();render()})()",
  );
  await p.waitForSelector("#death-confirm");
  assert.equal(await p.locator("#burial-confirm").count(), 0);
  await p.locator("#death-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.over), true);
  assert.equal(await p.evaluate(() => state.graveyard[0].buried), false);
  assert.equal(
    await p.locator("#modal-title").textContent(),
    "The light goes out.",
  );
  assert.equal(await p.evaluate(() => healHero(0, 100)), 0);
});

test("treasure critical stays inside its original event, transforms its reward value and pours large coins", async (t) => {
  let p = await game(t);
  await fast(p);
  await startEval(
    p,
    "(async()=>{let old=Math.random;Math.random=()=>0;try{await treasureRoll()}finally{Math.random=old}})()",
  );
  await p.waitForSelector(".critical-locked #critical-result strong");
  assert.equal(await p.locator("#stage-title").textContent(), "Treasure!");
  assert.deepEqual(
    await p
      .locator(".critical-payoff")
      .evaluate((n) => [+n.dataset.before, +n.dataset.after]),
    [18, 36],
  );
  assert.equal(await p.locator("#critical-math").count(), 0);
  // Layout dimensions stay fixed while intentional scale/shake effects can
  // temporarily alter the painted bounding box.
  const size = () =>
    p.locator("#stage-card").evaluate((el) => ({
      width: el.offsetWidth,
      height: el.offsetHeight,
    }));
  const rect = await size();
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.locator("#stage-title").textContent(), "Treasure!");
  assert.deepEqual(await size(), rect);
  assert.equal(await p.evaluate(() => state.lastLoot.baseGold), 18);
  assert.equal(await p.evaluate(() => state.lastLoot.gold), 36);
  assert.ok(
    (await p.evaluate(
      () => particles.filter((x) => x.kind === "coin").length,
    )) >= 55,
  );
  assert.ok(
    await p.evaluate(() =>
      particles.filter((x) => x.kind === "coin").some((x) => x.size >= 10),
    ),
  );
  let before = await p.evaluate(() => coinRain?.remaining);
  await p.waitForTimeout(150);
  assert.ok((await p.evaluate(() => coinRain?.remaining ?? 0)) < before);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.testAction);
});

test("fountain triple heals crit within the same popup at instant speed and show complete potential heal math", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party[0].hp = 1;
    state.map[79].event = "well";
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#well-use");
  await p.evaluate(() => {
    window.previousRandom = Math.random;
    Math.random = () => 0;
  });
  await p.locator("#well-use").click();
  await p.waitForSelector(".critical-locked #critical-result strong");
  assert.equal(
    await p.locator("#stage-title").textContent(),
    "The water wheel turns",
  );
  assert.deepEqual(
    await p
      .locator(".critical-payoff")
      .evaluate((n) => [+n.dataset.before, +n.dataset.after]),
    [11, 14],
  );
  await p.waitForSelector("#stage-confirm");
  assert.equal(
    await p.locator("#stage-title").textContent(),
    "The water wheel turns",
  );
  assert.equal(await p.evaluate(() => state.lastWellRoll.multiplier), 1.25);
  await p.locator("#stage-confirm").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[0].hp), 15);
  await p.evaluate(() => (Math.random = window.previousRandom));
});

test("three safe trap faces keep confirmation without a pointless critical", async (t) => {
  let p = await game(t);
  await fast(p);
  await startEval(
    p,
    "(async()=>{let old=Math.random;Math.random=()=>0;try{await trapRoll()}finally{Math.random=old}})()",
  );
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.locator("#critical-result").count(), 0);
  assert.equal(await p.locator("#stage-title").textContent(), "A hidden trap");
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.locator("#stage-title").textContent(), "A hidden trap");
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.party[0].hp), 50);
});

test("a lethal critical is visibly dealt before the victory popup opens", async (t) => {
  let p = await game(t);
  await fast(p);
  await encounter(p, { hp: 4 });
  await faces(p, [
    ["attack", 1],
    ["attack", 1],
    ["attack", 1],
  ]);
  await p.evaluate(() => {
    window.lethalBeams = 0;
    new MutationObserver((rows) =>
      rows.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (n.matches?.(".fx-beam.lethal")) window.lethalBeams++;
        }),
      ),
    ).observe(document.body, { childList: true });
  });
  await p.locator('[data-spin="0"]').click();
  await p.waitForSelector(".critical-locked #critical-result strong");
  assert.equal(await p.evaluate(() => state.enemy.hp), 4);
  await p.waitForFunction(() => state.enemy?.hp === 0);
  assert.equal(await p.evaluate(() => window.lethalBeams), 1);
  assert.equal(
    await p.evaluate(() =>
      [
        ...document.querySelectorAll('.combat-number[data-summed="true"]'),
      ].reduce((n, e) => n + Number(e.dataset.value), 0),
    ),
    4,
  );
  assert.equal(await p.locator("#spotlight").isVisible(), false);
  assert.equal(await p.locator("#enemy-art").isVisible(), true);
  await p.waitForSelector("#treasure-result");
  assert.ok(
    (await p.evaluate(() => Date.now() - state.lastLethalHitAt)) >= 600,
  );
  await p.waitForSelector("#stage-confirm");
  await p.locator("#stage-confirm").click();
  await finish(p);
});

test("party changes, battle text and critical content keep reserved layout dimensions", async (t) => {
  let p = await game(t);
  const selectors = [
    "#map-wrap",
    ".battle-stage",
    "#party",
    "#targets",
    "#result-ribbon",
    ".journal",
    ".inventory",
  ];
  const before = await p.evaluate(
    (selectors) =>
      Object.fromEntries(
        selectors.map((s) => {
          let r = document.querySelector(s).getBoundingClientRect();
          return [s, { x: r.x, y: r.y, width: r.width, height: r.height }];
        }),
      ),
    selectors,
  );
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    beginEncounter();
    state.lastResult =
      "A very long battle result with damage, healing, armour, and status text. ".repeat(
        8,
      );
    state.logs = Array(15).fill(
      "An extremely eventful page of handwritten notes.",
    );
    render();
  });
  const after = await p.evaluate(
    (selectors) =>
      Object.fromEntries(
        selectors.map((s) => {
          let r = document.querySelector(s).getBoundingClientRect();
          return [s, { x: r.x, y: r.y, width: r.width, height: r.height }];
        }),
      ),
    selectors,
  );
  assert.deepEqual(after, before);
});

test("all 1000 generated floors have a path to the stairs; the safety carve repairs a blocked corridor", async (t) => {
  let p = await game(t);
  let valid = await p.evaluate(() => {
    for (let n = 0; n < 1000; n++) {
      let m = generateFloor((n % 10) + 1),
        stairs = m.findIndex((c) => c.event === "stairs"),
        seen = new Set([pos(1, 7)]),
        q = [pos(1, 7)];
      for (let i of q)
        for (let j of [...neighbors(i), ...(m[i].event === "tunnel" && m[m[i].tunnelTo]?.event === "tunnel" && m[m[i].tunnelTo].tunnelTo === i ? [m[i].tunnelTo] : [])])
          if (!m[j].wall && !seen.has(j)) {
            seen.add(j);
            q.push(j);
          }
      if (!seen.has(stairs)) return false;
    }
    let broken = generateFloor(1);
    broken.forEach((c) => (c.wall = true));
    ensureStairsPath(broken);
    let seen = new Set([pos(1, 7)]),
      q = [pos(1, 7)];
    for (let i of q)
      for (let j of neighbors(i))
        if (!broken[j].wall && !seen.has(j)) {
          seen.add(j);
          q.push(j);
        }
    return seen.has(broken.findIndex((c) => c.event === "stairs"));
  });
  assert.equal(valid, true);
  assert.ok(
    Math.abs((await p.evaluate(() => recruitChance(1))) - 0.47) < 0.00001,
  );
  assert.ok(
    Math.abs((await p.evaluate(() => recruitChance(2))) - 0.355) < 0.00001,
  );
  assert.ok(
    Math.abs((await p.evaluate(() => recruitChance(3))) - 0.355) < 0.00001,
  );
});

test("the complete notebook fits 1080p and other desktop resolutions without overlaps or page scrolling", async (t) => {
  let p = await game(t);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    beginEncounter();
    markSeen(state.map.findIndex((c) => c.event === "stairs"));
    render();
  });
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [1536, 864],
    [2560, 1440],
  ]) {
    await p.setViewportSize({ width, height });
    await p.evaluate(() => {
      fitNotebook();
      positionPlayer(false);
    });
    const metrics = await p.evaluate(() => {
      let box = (sel) => document.querySelector(sel).getBoundingClientRect();
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewport: [innerWidth, innerHeight],
        partyEnd: box("#hero-2 .hero-controls").bottom,
        targetTop: box("#targets").top,
        enemyEnd: box("#machine-enemy").bottom,
        resultTop: box("#result-ribbon").top,
        bookBottom: box("#book").bottom,
        handleWidth: box('[data-spin="0"]').width,
      };
    });
    assert.ok(metrics.width <= width, JSON.stringify(metrics));
    assert.ok(metrics.height <= height + 1, JSON.stringify(metrics));
    assert.ok(metrics.partyEnd < metrics.targetTop, JSON.stringify(metrics));
    assert.ok(metrics.enemyEnd < metrics.resultTop, JSON.stringify(metrics));
    assert.ok(metrics.handleWidth >= 44, JSON.stringify(metrics));
    if (width === 1920)
      await p.screenshot({
        path: path.join(root, "test-results/desktop-1080.png"),
        fullPage: true,
      });
  }
});

test("starting blanks are actual editable reel faces with an icon; inscription removes them permanently", async (t) => {
  let p = await game(t);
  await p.evaluate(() => {state.party[0].specialism="defence";});
  const before = await p.evaluate(() =>
    state.party[0].reels.map((r) => r.map((s) => ({ ...s }))),
  );
  assert.ok(
    before.every((r) => r.filter((s) => s.type === "blank").length === 1),
  );
  assert.equal(await p.locator("#machine-hero-0 .blank-face svg").count(), 1);
  await p.evaluate(() => {
    state.party[0].points = 6;
    render();
  });
  await p.locator('.edit-button[data-edit="0"]').click();
  for (let r = 0; r < 3; r++) {
    let f = before[r].findIndex((s) => s.type === "blank");
    await p.locator(`[data-editor-reel="${r}"]`).click();
    await p.locator(`[data-editor-face="${f}"]`).click();
    await p.locator("#blank-choose").click();
    await p.locator("#face-destination").selectOption("block");
    assert.match(await p.locator("#face-swap").textContent(), /Inscribe Team block.*Spend 2 points/);
    await p.locator("#face-swap").click();
  }
  await p.locator("#modal [data-close]").first().click();
  assert.equal(await p.evaluate(() => state.party[0].points), 0);
  assert.equal(await p.locator("#machine-hero-0 .blank-face").count(), 0);
  const after = await p.evaluate(() => state.party[0].reels);
  for (let r = 0; r < 3; r++) {
    assert.equal(after[r].length, r === 1 ? 7 : 6);
    assert.equal(
      after[r].some((s) => s.type === "blank"),
      false,
    );
    assert.deepEqual(
      after[r].map((s) => s.weight),
      before[r].map((s) => s.weight),
    );
  }
  assert.equal(
    await p.evaluate(() =>
      Array.from({ length: 1000 }, () =>
        weightedPick(state.party[0].reels[0]),
      ).some((s) => s.type === "blank"),
    ),
    false,
  );
  await p.reload();
  assert.equal(
    await p.evaluate(() =>
      state.party[0].reels.some((r) => r.some((s) => s.type === "blank")),
    ),
    false,
  );
});

test("fatal enemy and hero damage immediately draws collapsed corpses and leaves remains on the floor", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await encounter(p, { hp: 1 });
  await p.evaluate(() => {
    state.map[state.position].event = null;
    state.map[state.position].feature = "enemy";
    damageEnemy(30, "Alden");
  });
  assert.equal(await p.locator("#enemy-art .corpse-art").count(), 1);
  assert.equal(await p.locator(".tile.has-corpse .corpse-art").count(), 1);
  await p.evaluate(async () => {
    await victory(state.enemy);
    render();
    save();
  });
  await p.evaluate(async () => {
    state.party.push(makeHero("Mira", "healer"));
    render();
    damageHero(1, 100, "A rolling boulder");
    window.hadCorpse = !!document.querySelector("#portrait-1 .corpse-art");
    await processDeaths();
    save();
  });
  assert.equal(await p.evaluate(() => window.hadCorpse), true);
  assert.equal(
    await p.evaluate(() => state.map[state.position].corpses.length),
    2,
  );
  await p.reload();
  assert.equal(
    await p.evaluate(() => state.map[state.position].corpses.length),
    2,
  );
  assert.equal(
    await p.locator('.tile.has-corpse .corpse-art[data-corpse="mage"]').count(),
    1,
  );
});

test("fully blocked damage puts a persistent shield overlay over the specific hero or enemy", async (t) => {
  let p = await game(t);
  await encounter(p);
  await p.evaluate(() => {
    state.block = 5;
    damageHero(0, 5, "A claw");
    setEnemyBlock(7);
    damageEnemy(7, "Alden");
    render(); // Impact feedback survives the on-page UI refresh.
  });
  assert.equal(
    await p.locator('.shielded-overlay[data-target="portrait-0"] svg').count(),
    1,
  );
  assert.equal(
    await p.locator('.shielded-overlay[data-target="enemy-art"] svg').count(),
    1,
  );
  assert.equal(await p.evaluate(() => state.party[0].hp), 50);
  assert.equal(await p.evaluate(() => state.enemy.hp), 1000);
  await p.screenshot({ path: path.join(root, "test-results/shielded.png") });
  await p.evaluate(() => {
    document.querySelectorAll(".shielded-overlay").forEach((n) => n.remove());
    state.block = 1;
    damageHero(0, 5, "A claw");
  });
  assert.equal(await p.locator(".shielded-overlay").count(), 0);
  assert.equal(await p.evaluate(() => state.party[0].hp), 46);
});

test("rivers and stone are blocked, bridges are traversable, and marked stairs stay highlighted", async (t) => {
  const p = await game(t);
  const positions = await p.evaluate(() => {
    do {
      state.map = generateFloor(1);
    } while (
      !state.map.some((c) => c.terrain === "river") ||
      !state.map.some((c) => c.terrain === "bridge")
    );
    const river = state.map.findIndex((c) => c.terrain === "river"),
      bridge = state.map.findIndex((c) => c.terrain === "bridge"),
      stairs = state.map.findIndex((c) => c.event === "stairs");
    state.map[river].seen = true;
    state.map[bridge].seen = true;
    markSeen(stairs);
    render();
    return { river, bridge, stairs };
  });
  assert.equal(
    await p.locator(`[data-tile="${positions.river}"]`).isDisabled(),
    true,
  );
  assert.equal(
    await p.locator(`[data-tile="${positions.bridge}"]`).isEnabled(),
    true,
  );
  assert.equal(
    await p
      .locator(`[data-tile="${positions.bridge}"].bridge-tile svg`)
      .count(),
    1,
  );
  assert.equal(
    await p.locator(`[data-tile="${positions.stairs}"].active-stairs`).count(),
    1,
  );
  assert.equal(await p.locator("#exit-found").isVisible(), true);
  assert.equal(await p.locator("#exit-found").isDisabled(), true);
  assert.equal(await p.evaluate(() => state.exitPromptPending), false);
});

test("a fountain critical retains uncapped offered healing for every hero while showing a single payoff", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    state.party.forEach((h) => (h.hp = h.maxHp - 1));
    state.map[79].event = "well";
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#well-use");
  await p.evaluate(() => {
    window.oldRandom = Math.random;
    Math.random = () => 0;
    window.originalCard = document.querySelector("#stage-card");
    window.originalReels = document.querySelector("#machine-fountain");
  });
  await p.locator("#well-use").click();
  await p.waitForSelector(".critical-locked .critical-payoff");
  assert.equal(
    await p.evaluate(
      () => document.querySelector("#stage-card") === window.originalCard,
    ),
    true,
  );
  assert.equal(await p.locator("#stage-card.critical").count(), 0);
  const math = await p.evaluate(() =>
    state.lastCritical.baseEffects.map((d) => [
      d.value,
      Math.ceil(d.value * state.lastCritical.multiplier),
    ]),
  );
  assert.deepEqual(math, [
    [11, 14],
    [8, 10],
    [7, 9],
  ]);
  await panelFits(
    p,
    "#stage-card",
    ".stage-content",
    ".scene-layout",
    "#stage-title",
  );
  await p.screenshot({
    path: path.join(root, "test-results/fountain-mobile.png"),
  });
  await p.waitForSelector("#stage-confirm");
  assert.deepEqual(
    await p
      .locator(".well-heal-total")
      .evaluateAll((nodes) =>
        nodes.map((n) => [+n.dataset.before, +n.dataset.after]),
      ),
    math,
  );
  await p.locator("#stage-confirm").click();
  await finish(p);
  assert.deepEqual(
    await p.evaluate(() => state.party.map((h) => h.stats.healingReceived)),
    [1, 1, 1],
  );
  assert.deepEqual(
    await p.evaluate(() => state.lastWellRoll.planned.map((h) => h.value)),
    [14, 10, 9],
  );
  await p.evaluate(() => (Math.random = window.oldRandom));
});

test("resolving a quiet room can hint at an adjacent enemy or treasure while leaving its event hidden and active", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.map.forEach((c) => {
      c.terrain = c.wall ? "stone" : "floor";
      c.hint = null;
      c.hintChecked = false;
    });
    state.map[68].event = "enemy";
    window.oldRandom = Math.random;
    Math.random = () => 0;
  });
  await p.locator('[data-tile="79"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.lastHint.tile), 68);
  assert.equal(await p.evaluate(() => state.map[68].seen), false);
  assert.equal(await p.evaluate(() => state.map[68].event), "enemy");
  assert.equal(await p.evaluate(() => state.enemy), null);
  assert.equal(
    await p.locator('[data-tile="68"].fog .tile-whisper').count(),
    1,
  );
  assert.match(
    await p.locator('[data-tile="68"]').getAttribute("aria-label"),
    /scratching sound/,
  );
  await p.evaluate(() => {
    state.map[79].hintChecked = false;
    state.map[68].hint = null;
    state.map[68].event = "treasure";
    maybeDiscoveryHint(79);
    save();
    Math.random = window.oldRandom;
  });
  assert.equal(await p.evaluate(() => state.map[68].hint.kind), "glimmer");
  await p.reload();
  assert.equal(
    await p.locator('[data-tile="68"].fog .tile-whisper').count(),
    1,
  );
  assert.equal(await p.evaluate(() => state.map[68].seen), false);
});

test("a valid hidden destination overrides a long walk while keeping intermediate fog covered", async (t) => {
  let p = await game(t);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    for (let x = 1; x <= 9; x++) state.map[pos(x, 7)].seen = true;
    render();
  });
  await p.locator('[data-tile="86"]').click();
  await p.waitForFunction(() => !!travel);
  assert.equal(await p.locator('[data-tile="67"].fog').isEnabled(), true);
  await p.locator('[data-tile="67"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.position), 67);
  assert.equal(
    await p.evaluate(() => state.map[67].seen && state.map[67].visited),
    true,
  );
  assert.equal(await p.evaluate(() => state.map[86].visited), false);
  assert.equal(await p.evaluate(() => state.map[56].seen), false);
});

test("retargeting to another hidden tile during erasure cancels the original encounter before entry", async (t) => {
  let p = await game(t);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.map[79].event = "enemy";
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector('[data-tile="79"].erasing');
  const replacement = p.locator('[data-tile="67"].fog');
  assert.equal(await replacement.isEnabled(), true);
  // Send a real pointer click during erasure. Playwright's usual stability
  // wait can outlast this short animation and enter the original fight first.
  await replacement.click({ force: true });
  await finish(p);
  assert.equal(await p.evaluate(() => state.position), 67);
  assert.equal(await p.evaluate(() => state.map[79].seen), true);
  assert.equal(await p.evaluate(() => state.map[79].visited), false);
  assert.equal(await p.evaluate(() => state.map[79].event), "enemy");
  assert.equal(await p.evaluate(() => state.enemy), null);
  assert.equal(await p.locator('[data-tile="79"].active-battle').count(), 1);
});

test("1000 distinct random floors have distant reachable stairs, optional connected rivers and rare double streams", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    let locations = new Set(),
      layouts = new Set(),
      firstRooms = new Set(),
      riverFloors = 0,
      doubleRivers = 0,
      ruins = 0,
      strongholds = 0;
    for (let n = 0; n < 1000; n++) {
      const map = generateFloor((n % 10) + 1, 1, 0),
        stair = map.findIndex((c) => c.event === "stairs"),
        dist = mapDistances(map),
        ids = new Set(map.filter((c) => c.riverId).map((c) => c.riverId));
      if (
        !dist.has(stair) ||
        dist.get(stair) < 8 ||
        map.some((c, i) => !c.wall && !dist.has(i))
      )
        return { invalid: n };
      for (const id of ids) {
        const water = map
            .map((c, i) => (c.riverId === id ? i : -1))
            .filter((i) => i >= 0),
          wet = new Set([water[0]]),
          queue = [water[0]];
        for (const i of queue)
          for (const j of neighbors(i))
            if (water.includes(j) && !wet.has(j)) {
              wet.add(j);
              queue.push(j);
            }
        if (wet.size !== water.length || water.length < 7)
          return { invalidRiver: n };
      }
      riverFloors += ids.size > 0;
      doubleRivers += ids.size > 1;
      locations.add(stair);
      layouts.add(map.map((c) => c.event || c.terrain).join(","));
      firstRooms.add(map[79].event || map[79].terrain);
      ruins += map.some((c) => c.event === "ruin");
      const boss = map.findIndex((c) => c.event === "stronghold");
      if (boss >= 0) {
        strongholds++;
        if (
          !dist.has(boss) ||
          neighbors(boss, true).filter((i) => map[i].wall).length < 6
        )
          return { badStronghold: n };
      }
    }
    return {
      locations: locations.size,
      layouts: layouts.size,
      firstRooms: firstRooms.size,
      riverFloors,
      doubleRivers,
      ruins,
      strongholds,
    };
  });
  assert.equal(r.invalid, undefined, JSON.stringify(r));
  assert.equal(r.invalidRiver, undefined, JSON.stringify(r));
  assert.equal(r.badStronghold, undefined, JSON.stringify(r));
  assert.equal(r.layouts, 1000);
  assert.ok(r.locations >= 12);
  assert.ok(r.firstRooms >= 8);
  assert.ok(r.riverFloors > 360 && r.riverFloors < 470, JSON.stringify(r));
  assert.ok(r.doubleRivers > 0 && r.doubleRivers < 30, JSON.stringify(r));
  assert.ok(r.ruins > 220 && r.ruins < 420, JSON.stringify(r));
  assert.ok(r.strongholds > 0 && r.strongholds < 60, JSON.stringify(r));
});

test("route repair uses a bridge when a connected river separates spawn from the stairs", async (t) => {
  const p = await game(t);
  assert.equal(
    await p.evaluate(() => {
      const map = generateFloor(1);
      map.forEach((c, i) =>
        Object.assign(c, {
          wall: i % W === 0 || i % W === 10 || i < W || i >= W * 8,
          terrain: "floor",
          event: null,
          feature: null,
        }),
      );
      for (let y = 1; y <= 7; y++)
        Object.assign(map[pos(5, y)], { wall: true, terrain: "river" });
      map[pos(9, 1)].event = "stairs";
      ensureStairsPath(map);
      return (
        mapDistances(map).has(pos(9, 1)) &&
        map.some((c) => c.terrain === "bridge" && !c.wall) &&
        map.filter((c) => ["river", "bridge"].includes(c.terrain)).length === 7
      );
    }),
    true,
  );
});

test("a shop map animates discovery without prompting descent; selecting the stair destination prompts again", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.gold = 1000;
  });
  await startEval(p, "shopEncounter({shop:{reveal:1}})");
  await p.locator('[data-buy="reveal"]').click();
  assert.equal(await p.evaluate(() => state.exitFound), true);
  assert.equal(await p.evaluate(() => state.exitReached), false);
  assert.equal(await p.evaluate(() => state.exitPromptPending), false);
  assert.equal(
    await p.locator("#modal-title").textContent(),
    "The stairway is marked!",
  );
  assert.equal(await p.locator("#exit-found").isDisabled(), true);
  assert.ok(await p.evaluate(() => liveAnimations.size > 0));
  await p.locator("#modal [data-close]").first().click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => modalKind), "");
  const stairs = await p.evaluate(() => {
    state.floorBossDefeated = true;
    state.lastMinorEventStep = state.steps + 10000;
    const stair = state.map.findIndex((c) => c.event === "stairs");
    state.map.forEach((c, i) => {
      if (i !== stair) c.event = null;
      c.seen = true;
    });
    render();
    return stair;
  });
  await p.locator(`[data-tile="${stairs}"]`).click();
  await p.waitForSelector("#descend");
  assert.equal(await p.evaluate(() => state.exitReached), true);
  assert.equal(await p.evaluate(() => state.depth), 1);
  await p.getByRole("button", { name: "Keep exploring", exact: true }).click();
  await p.evaluate(async () => {
    const next = neighbors(state.position).find((i) => !state.map[i].wall);
    const original = state.position;
    await move(next);
    await move(original);
  });
  assert.equal(await p.evaluate(() => modalKind), "stairs");
  await p.getByRole("button", { name: "Keep exploring", exact: true }).click();
  assert.equal(await p.locator("#exit-found").isEnabled(), true);
});

test("visible active traps receive the same safe-detour treatment as battles", async (t) => {
  const p = await game(t);
  await p.evaluate(blankFloor);
  const r = await p.evaluate(() => {
    for (let x = 1; x <= 4; x++) {
      state.map[pos(x, 7)].seen = true;
      state.map[pos(x, 6)].seen = true;
    }
    state.map[79].event = "trap";
    const safe = shortestPath(pos(4, 7));
    for (let x = 1; x <= 4; x++) state.map[pos(x, 6)].seen = false;
    return {
      safe,
      forced: shortestPath(pos(4, 7)),
      explicit: shortestPath(79),
    };
  });
  assert.equal(r.safe.includes(79), false);
  assert.equal(r.forced.includes(79), true);
  assert.deepEqual(r.explicit, [79]);
});

test("old visited rooms silently age and can generate a wandering fight on reentry", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.steps = 20;
    state.position = pos(5, 7);
    for (let x = 2; x <= 5; x++) {
      state.map[pos(x, 7)].seen = true;
      state.map[pos(x, 7)].visited = true;
      state.map[pos(x, 7)].lastVisitedStep = 20;
    }
    Object.assign(state.map[79], {
      visited: true,
      seen: true,
      lastVisitedStep: 0,
      fogged: true,
      lastNearCommand: (state.moveCommands || 0) - AMBUSH_COMMAND_AGE - 1,
      event: null,
    });
    render();
    window.oldRandom = Math.random;
    Math.random = () => 0;
  });
  assert.equal(await p.locator('[data-tile="79"].stale-fog').count(), 0);
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.evaluate(() => battleEnemies().length), 1);
  assert.equal(await p.evaluate(() => state.map[79].event), null);
  assert.equal(
    await p.evaluate(() => state.logs.some((l) => l.includes("Ambush!"))),
    true,
  );
  await p.locator("#stage-confirm").click();
  await finish(p);
  assert.equal(await p.evaluate(() => isStale(state.map[79])), false);
  await p.evaluate(() => (Math.random = window.oldRandom));
});

test("an unactivated well in old fog resolves its own event and never rolls a wandering ambush", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.steps = 20;
    Object.assign(state.map[79], {
      visited: true,
      seen: true,
      lastVisitedStep: 0,
      fogged: true,
      lastNearCommand: (state.moveCommands || 0) - AMBUSH_COMMAND_AGE - 1,
      event: "well",
      feature: "well",
    });
    render();
    window.oldRandom = Math.random;
    Math.random = () => 0;
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#well-use");
  assert.equal(await p.evaluate(() => state.enemy), null);
  await p.locator("#well-decline").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.map[79].event), "well");
  await p.evaluate(() => (Math.random = window.oldRandom));
});

test("paired encounters use portrait targeting; tier III damage and critical attacks hit both enemies", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.depth = 6;
    state.party.push(makeHero("Mira", "healer"));
    state.party[1].hp = 10;
    beginEncounter(false, { count: 2 });
    state.enemies.forEach((e) =>
      Object.assign(e, { hp: 100, maxHp: 100, countdown: 20, block: 0 }),
    );
    render();
  });
  await p.locator("#enemy-art-2").click();
  await p.locator('#targets [data-target="1"]').click();
  assert.equal(await p.evaluate(() => state.enemy === state.enemies[1]), true);
  assert.equal(await p.evaluate(() => state.target), 1);
  await faces(p, [
    ["attack", 1],
    ["attack", 2],
    ["blank", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.deepEqual(
    await p.evaluate(() => state.enemies.map((e) => e.hp)),
    [100, 97],
  );
  await faces(p, [
    ["attack", 3],
    ["heal", 1],
    ["blank", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.deepEqual(
    await p.evaluate(() => state.enemies.map((e) => e.hp)),
    [97, 94],
  );
  assert.equal(await p.evaluate(() => state.party[1].hp), 12);
  assert.equal(await p.evaluate(() => state.lastPlayerRoll.area), true);
  await faces(p, [
    ["attack", 1],
    ["attack", 1],
    ["attack", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  const m = await p.evaluate(() => state.lastPlayerRoll.multiplier);
  assert.ok(m >= 1.5);
  assert.deepEqual(await p.evaluate(() => state.enemies.map((e) => e.hp)), [
    97 - Math.ceil(3 * m),
    94 - Math.ceil(3 * m),
  ]);
  await p.evaluate(() => save());
  const selected = await p.evaluate(() => state.enemy.id);
  await p.reload();
  assert.equal(await p.evaluate(() => state.enemies.length), 2);
  assert.equal(await p.evaluate(() => state.enemy.id), selected);
  assert.equal(
    await p.evaluate(() => state.enemies.includes(state.enemy)),
    true,
  );
});

test("each enemy has its own countdown and a solo lost stun turn advances both clocks", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    beginEncounter(false, { count: 2 });
    state.enemies.forEach((e, k) =>
      Object.assign(e, {
        countdown: k + 1,
        frequency: k + 3,
        strikes: 1,
        damage: 9,
        reels: [
          [{ type: "attack", tier: 1 }],
          [{ type: "blank", tier: 1 }],
          [{ type: "blank", tier: 1 }],
        ],
      }),
    );
    render();
  });
  await faces(p, [
    ["blank", 1],
    ["blank", 1],
    ["blank", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[0].hp), 44);
  assert.deepEqual(
    await p.evaluate(() => state.enemies.map((e) => e.countdown)),
    [3, 1],
  );
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[0].hp), 38);
  assert.deepEqual(
    await p.evaluate(() => state.enemies.map((e) => e.countdown)),
    [2, 4],
  );
  await p.evaluate(() => {
    state.party[0].stun = 1;
    render();
  });
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.deepEqual(
    await p.evaluate(() => state.enemies.map((e) => e.countdown)),
    [1, 3],
  );
});

test("killing one of two enemies gives no victory reward; defeating both awards encounter EXP once", async (t) => {
  const p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(() => {
    state.depth = 6;
    beginEncounter(false, { count: 2 });
    state.enemies.forEach((e, k) =>
      Object.assign(e, { hp: k ? 100 : 1, maxHp: 100, countdown: 20 }),
    );
    render();
  });
  await faces(p, [
    ["attack", 1],
    ["attack", 2],
    ["blank", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[0].xp), 0);
  assert.equal(await p.evaluate(() => state.battlesWon), 0);
  assert.equal(await p.evaluate(() => livingEnemies().length), 1);
  assert.equal(await p.locator("#enemy-art .corpse-art").count(), 1);
  await p.evaluate(() => {
    state.enemy.hp = 1;
  });
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.battlesWon), 1);
  assert.equal(await p.evaluate(() => state.party[0].stats.xpEarned), 34);
  assert.equal(await p.evaluate(() => state.party[0].stats.kills), 2);
  assert.equal(await p.evaluate(() => state.enemy), null);
});

test("deep floors use new horror art and a rare stronghold boss guarantees an artefact and rich loot", async (t) => {
  const p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(() => {
    state.depth = 8;
    beginEncounter(false, { count: 1 });
    render();
  });
  assert.equal(await p.locator("#enemy-art .horror-art").count(), 1);
  await p.evaluate(() => {
    beginEncounter(false, { elite: true });
    // Isolate the stronghold reward here; second-form behaviour has its own test.
    if (state.enemy.passive) state.enemy.passive.used = true;
    state.enemy.hp = 1;
    setEnemyBlock(0);
    render();
  });
  assert.equal(await p.evaluate(() => state.enemy.elite), true);
  assert.ok((await p.evaluate(() => state.enemy.maxHp)) >= 100);
  assert.ok((await p.evaluate(() => state.enemy.frequency)) <= 2);
  await faces(p, [
    ["attack", 1],
    ["attack", 2],
    ["blank", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.lastLoot.source), "stronghold");
  assert.ok(
    await p.evaluate(() =>
      state.lastLoot.found.every(
        (id) => state.artefacts.find((a) => a.id === id).depth === state.depth,
      ),
    ),
  );
  assert.ok((await p.evaluate(() => state.lastLoot.found.length)) >= 1);
  assert.ok((await p.evaluate(() => state.lastLoot.baseGold)) >= 30);
  assert.equal(await p.evaluate(() => state.floorBossDefeated), false);
});

test("ruins can be ignored, revisited, then roll a real balance of loot and damage", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.depth = 3;
    state.map[79].event = "ruin";
    state.map[79].feature = "ruin";
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#ruin-leave");
  await p.locator("#ruin-leave").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.map[79].event), "ruin");
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#ruin-examine");
  await p.evaluate(() => {
    window.oldRandom = Math.random;
    let k = 0;
    Math.random = () => [0, 0.6, 0.95][k++ % 3];
  });
  await p.locator("#ruin-examine").click();
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.evaluate(() => state.party[0].hp), 50);
  assert.deepEqual(
    await p.evaluate(() => ({
      gold: state.lastRuinRoll.gold,
      damage: state.lastRuinRoll.damage,
    })),
    { gold: 12, damage: 2 },
  );
  await p.locator("#stage-confirm").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.gold), 12);
  assert.equal(await p.evaluate(() => state.party[0].hp), 48);
  assert.equal(await p.evaluate(() => state.map[79].event), null);
  await p.evaluate(() => (Math.random = window.oldRandom));
});

test("ruin triple matches keep their critical inside the original ruin panel", async (t) => {
  const p = await game(t);
  await fast(p);
  await startEval(p, "ruinEncounter(state.map[state.position])");
  await p.waitForSelector("#ruin-examine");
  await p.evaluate(() => {
    window.oldRandom = Math.random;
    Math.random = () => 0;
  });
  await p.locator("#ruin-examine").click();
  await p.waitForSelector(".critical-locked #critical-result strong");
  assert.equal(
    await p.locator("#stage-title").textContent(),
    "The ruin’s mechanism",
  );
  assert.equal(await p.locator("#event-critical #critical-math").count(), 0);
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.evaluate(() => state.lastRuinRoll.gold), 48);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.testAction);
  await p.evaluate(() => (Math.random = window.oldRandom));
});

async function panelFits(page, selector, holder, flow, title) {
  await page.waitForTimeout(120);
  const metrics = await page.evaluate(
    ({ selector, holder, flow, title }) => {
      const box = (s) => document.querySelector(s).getBoundingClientRect(),
        p = box(selector),
        h = box(holder),
        f = box(flow),
        t = box(title),
        range = document.createRange();
      range.selectNodeContents(document.querySelector(title));
      const text = range.getBoundingClientRect();
      return {
        panel: [p.top, p.bottom],
        viewport: innerHeight,
        contained:
          f.top >= h.top - 3 &&
          f.bottom <= h.bottom + 3 &&
          f.left >= h.left - 3 &&
          f.right <= h.right + 3,
        title:
          text.top >= t.top - 3 &&
          text.bottom <= t.bottom + 3 &&
          text.left >= t.left - 3 &&
          text.right <= t.right + 3,
        scroll: [...document.querySelectorAll("*")]
          .filter(
            (el) =>
              el.getClientRects().length &&
              ["auto", "scroll"].includes(getComputedStyle(el).overflowY) &&
              el.scrollHeight > el.clientHeight + 1,
          )
          .map((el) => el.id || el.className),
      };
    },
    { selector, holder, flow, title },
  );
  assert.equal(metrics.contained, true, JSON.stringify(metrics));
  assert.equal(metrics.title, true, JSON.stringify(metrics));
  assert.ok(
    metrics.panel[0] >= 0 && metrics.panel[1] <= metrics.viewport,
    JSON.stringify(metrics),
  );
  assert.ok(
    metrics.scroll.every((id) => id === "log" || id === "fallen-roster"),
    JSON.stringify(metrics),
  );
}

test("long adventurer titles and all nineteen editor faces fit without clipping or scrolling on desktop and mobile", async (t) => {
  const p = await game(t);
  await fast(p);
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
    [390, 844],
  ]) {
    await p.setViewportSize({ width, height });
    await startEval(p, "recruitEncounter()");
    await p.waitForSelector("#recruit-decline");
    await panelFits(
      p,
      "#stage-card",
      ".stage-content",
      ".scene-layout",
      "#stage-title",
    );
    await p.evaluate(() => {
      window.beforeRefusalRandom = Math.random;
      Math.random = () => 0.9;
    });
    await p.evaluate(() => {
      window.legacyRefusalRandom = Math.random;
      Math.random = () => 0.9;
    });
    await p.locator("#recruit-decline").click();
    await p.evaluate(() => {
      Math.random = window.legacyRefusalRandom;
    });
    await p.evaluate(async () => {
      await window.testAction;
      Math.random = window.beforeRefusalRandom;
    });
    await p.evaluate(() => editor(0));
    assert.equal(await p.locator(".workshop-faces button").count(), 6);
    await panelFits(p, "#modal", ".modal-body", ".modal-flow", "#modal-title");
    await p.locator("#modal [data-close]").first().click();
  }
});

test("only the field log scrolls; health bars and capitalised class names communicate injury", async (t) => {
  const p = await game(t, { width: 1920 });
  await p.setViewportSize({ width: 1920, height: 1080 });
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    state.logs = Array.from(
      { length: 60 },
      (_, i) => "An expedition note " + i,
    );
    render();
  });
  assert.deepEqual(await p.locator(".hero-name small").allTextContents(), [
    "Tank · Lv.1",
    "Mage · Lv.1",
    "Rogue · Lv.1",
  ]);
  assert.equal(await p.locator("#combat-title").textContent(), "Your Party");
  for (const [hp, tone] of [
    [44, "green"],
    [22, "yellow"],
    [15, "red"],
    [5, "critical"],
  ]) {
    await p.evaluate((hp) => {
      state.party[0].hp = hp;
      syncHero(0);
    }, hp);
    assert.equal(await p.locator(`#hero-0 .hp-bar.${tone}`).count(), 1);
  }
  assert.notEqual(
    await p
      .locator("#hero-0 .hp-bar")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  const scroll = await p.evaluate(() =>
    [...document.querySelectorAll("*")]
      .filter(
        (el) =>
          el.getClientRects().length &&
          ["auto", "scroll"].includes(getComputedStyle(el).overflowY) &&
          el.scrollHeight > el.clientHeight + 1,
      )
      .map((el) => el.id || el.className),
  );
  assert.deepEqual(scroll, ["log"]);
});

test("pace and palette survive a new run and reload; the full UI can be reached by keyboard", async (t) => {
  const p = await game(t);
  await p.locator("#animation-speed").selectOption("5");
  await p.locator("#palette").selectOption("warm");
  await p.evaluate(() => newRun("rogue"));
  assert.equal(await p.evaluate(() => state.speed), "5");
  assert.equal(await p.evaluate(() => state.palette), "warm");
  await p.reload();
  assert.equal(await p.locator("#animation-speed").inputValue(), "5");
  assert.equal(await p.locator("#palette").inputValue(), "warm");
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    beginEncounter(false, { count: 2 });
    state.enemies.forEach((e) => (e.countdown = 20));
    render();
    document.activeElement.blur();
  });
  await p.keyboard.press("Shift+2");
  assert.equal(await p.evaluate(() => state.target), 1);
  await p.keyboard.press("]");
  assert.equal(await p.evaluate(() => state.enemy === state.enemies[1]), true);
  await p.keyboard.press("t");
  assert.equal(await p.evaluate(() => state.speed), "skip");
  await p.keyboard.press("c");
  assert.equal(await p.evaluate(() => state.palette), "default");
  await faces(
    p,
    [
      ["attack", 1],
      ["heal", 1],
      ["blank", 1],
    ],
    1,
  );
  await p.keyboard.press("2");
  await finish(p);
  assert.equal(await p.evaluate(() => state.lastPlayerRoll.actor), 1);
  await p.keyboard.press("f");
  await p.waitForSelector("#modal-title");
  await panelFits(p, "#modal", ".modal-body", ".modal-flow", "#modal-title");
  await p.keyboard.press("Escape");
  await p.keyboard.press("m");
  assert.equal(await p.evaluate(() => document.activeElement.id), "log");
  assert.match(await p.locator("#keyboard-bar").textContent(), /Mouse: click/);
  assert.match(await p.locator("#keyboard-bar").textContent(), /Tab/);
});

test("early full enemy criticals remain survivable while damage grows faster on deeper floors", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const curve = [];
    for (let depth = 1; depth <= 10; depth++) {
      const normal = enemyBalance(depth),
        elite = enemyBalance(depth, { elite: true }),
        pair = enemyBalance(depth, { pair: true });
      const raw = calculate(
        [0, 1, 2].map(() => ({ type: "attack", tier: 2 })),
      ).attack;
      curve.push({
        depth,
        ...normal,
        maxCrit: Math.ceil(
          enemyHitPower({ attack: raw, magic: 0 }, normal) * 1.5,
        ),
        eliteCrit: Math.ceil(
          enemyHitPower({ attack: raw, magic: 0 }, elite) * 1.5,
        ),
        pairDamage: pair.damage,
      });
    }
    return {
      curve,
      minHP: Math.min(
        ...["fighter", "healer", "rogue"].map((j) => makeHero("Test", j).maxHp),
      ),
      trapMax: Math.ceil(6 * trapPower(1)) * 4,
    };
  });
  assert.ok(r.curve[0].maxCrit < r.minHP / 2);
  assert.ok(r.curve[3].maxCrit < r.minHP);
  assert.ok(r.curve[3].eliteCrit < r.minHP + 6);
  assert.ok(r.trapMax < r.minHP);
  for (let i = 1; i < r.curve.length; i++) {
    assert.ok(r.curve[i].damage - r.curve[i - 1].damage <= (i <= 3 ? 2 : 1));
    assert.ok(r.curve[i].maxHp - r.curve[i - 1].maxHp <= 13);
    assert.ok(r.curve[i].pairDamage <= r.curve[i].damage);
  }
  assert.ok(r.curve[9].maxCrit > r.curve[0].maxCrit * 2);
  assert.equal(r.curve[9].damage, 12);
  await fast(p);
  await p.evaluate(() => {
    beginEncounter();
    state.enemy.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 2 }]);
    state.enemy.countdown = 1;
    state.party[0].reels = [0, 1, 2].map(() => [{ type: "blank", tier: 1 }]);
    Math.random = () => 0.999;
    render();
  });
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[0].hp), 47);
  assert.equal(await p.evaluate(() => state.lastEnemyRoll.damage), 3);
});

test("tier IV attacks can be bought, saved and used as area damage with clear per-target numbers", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    const h = state.party[0];
    h.points = 20;
    h.reels[0][0] = { type: "attack", tier: 3, weight: 9 };
    editor(0);
  });
  await p.locator('[data-upgrade="0,0,0"]').click();
  assert.equal(await p.evaluate(() => state.party[0].points), 6);
  assert.equal(await p.locator(".workshop-preview .tier-4 svg").count(), 4);
  await p.locator("#modal [data-close]").first().click();
  await p.reload();
  assert.equal(await p.evaluate(() => state.party[0].reels[0][0].tier), 4);
  await p.evaluate(() => {
    state.depth = 5;
    beginEncounter(false, { count: 2 });
    state.enemies.forEach((e) =>
      Object.assign(e, { hp: 100, maxHp: 100, countdown: 20, block: 0 }),
    );
    render();
  });
  await faces(p, [
    ["attack", 4],
    ["attack", 1],
    ["heal", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.deepEqual(
    await p.evaluate(() => state.enemies.map((e) => e.hp)),
    [95, 95],
  );
  assert.equal(await p.evaluate(() => state.lastPlayerRoll.actualDamage), 10);
  assert.match(await p.locator("#result-ribbon").textContent(), /−10/);
  assert.ok((await p.locator('.combat-number[data-value="5"]').count()) >= 2);
});

test("known optional wells, shops and ruins do not interrupt travel but a selected well still offers a choice", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    for (let x = 1; x <= 8; x++) state.map[pos(x, 7)].seen = true;
    ["well", "shop", "ruin"].forEach((event, k) =>
      Object.assign(state.map[pos(k + 2, 7)], { event, feature: event }),
    );
    render();
  });
  await p.locator('[data-tile="85"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.position), 85);
  assert.equal(await p.locator("#spotlight").isVisible(), false);
  assert.equal(await p.locator("#overlay").isVisible(), false);
  assert.deepEqual(
    await p.evaluate(() => [79, 80, 81].map((i) => state.map[i].event)),
    ["well", "shop", "ruin"],
  );
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#well-decline");
  await p.locator("#well-decline").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.map[79].event), "well");
});

test("recruit pity increases after missed floors, resets on meeting even if declined, and recruits inherit half-spent level points", async (t) => {
  const p = await game(t);
  await fast(p);
  const rates = await p.evaluate(() => [
    recruitChance(1, 0),
    recruitChance(2, 0),
    recruitChance(1, 3),
    recruitChance(2, 3),
  ]);
  assert.ok(rates[0] > rates[1] && rates[2] > rates[0] && rates[3] > rates[1]);
  await p.evaluate(() => {
    state.exitFound = state.exitReached = true;
    state.floorBossDefeated = true;
    stairs();
  });
  await p.locator("#descend").click();
  assert.equal(await p.evaluate(() => state.recruitPity), 1);
  await startEval(p, "recruitEncounter()");
  await p.waitForSelector("#recruit-decline");
  await p.evaluate(() => {
    window.legacyRefusalRandom = Math.random;
    Math.random = () => 0.9;
  });
  await p.locator("#recruit-decline").click();
  await p.evaluate(() => {
    Math.random = window.legacyRefusalRandom;
  });
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.recruitPity), 0);
  assert.equal(await p.evaluate(() => state.recruitFoundThisFloor), true);
  await p.evaluate(() => {
    state.party[0].level = 5;
    state.party.push(makeHero("Mira", "healer"));
    state.party[1].level = 3;
    state.exitFound = state.exitReached = true;
    state.floorBossDefeated = true;
    stairs();
  });
  await p.locator("#descend").click();
  assert.equal(await p.evaluate(() => state.recruitPity), 0);
  await startEval(p, "recruitEncounter()");
  await p.waitForSelector("#recruit-accept");
  assert.match(await p.locator(".stage-result").textContent(), /level 4/);
  await p.locator("#recruit-accept").click();
  await p.evaluate(() => window.testAction);
  const recruited = await p.evaluate(() => {
    const h=state.party[2];
    return {level:h.level,spent:h.inheritedUpgradeSpent,points:h.points,hp:h.hp,maxHp:h.maxHp,base:CLASS_BALANCE[h.job].hp};
  });
  assert.equal(recruited.level,4);
  assert.equal(recruited.hp,recruited.base+18);
  assert.equal(recruited.hp,recruited.maxHp);
  assert.ok(recruited.spent>0 && recruited.spent<=6);
  assert.equal(recruited.points,15-recruited.spent);
  assert.equal(
    await p.evaluate(() =>
      ["fighter", "healer", "rogue", "jester"].every((job) =>
        Array.from({ length: 12 }, (_, i) => i + 1).every((level) => {
          state.party[0].level = level;
          state.party = state.party.slice(0, 1);
          const h = prepareRecruit(makeHero("Test", job));
          return (
            h.level === level &&
            h.inheritedUpgradeSpent <= (level - 1) * 2 &&
            h.points === 3 + (level - 1) * 4 - h.inheritedUpgradeSpent
          );
        }),
      ),
    ),
    true,
  );
});

test("a very rare treasure mimic introduces a chest with teeth and awards loot only after victory", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    Object.assign(state.map[79], {
      event: "treasure",
      wall: false,
      terrain: "floor",
    });
    Math.random = () => 0;
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#stage-confirm");
  assert.equal(
    await p.locator("#stage-title").textContent(),
    "The hungry chest",
  );
  assert.equal(await p.evaluate(() => state.enemy.mimic), true);
  assert.equal(await p.evaluate(() => state.gold), 0);
  await p.locator("#stage-confirm").click();
  await finish(p);
  await autoEvents(p);
  await p.evaluate(() => {state.enemy.hp=1; setEnemyBlock(0); state.enemy.passive=null;});
  await faces(p, [
    ["attack", 4],
    ["attack", 4],
    ["attack", 4],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.battlesWon), 1);
  assert.equal(await p.evaluate(() => state.lastLoot.source), "battle");
  assert.ok((await p.evaluate(() => state.gold)) > 0);
});

test("Revive Stone is held without an equipment slot, revives at 75%, consumes once and persists across reload", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.artefacts = [
      { id: "stone", name: "Revive Stone", key: "revive", power: 1, depth: 1 },
      { id: "fang", name: "Fang", key: "attack", power: 2, depth: 1 },
    ];
    state.equippedArtefact = "fang";
    damageHero(0, 999, "The hungry chest");
  });
  await p.reload();
  await p.waitForSelector("#revive-use");
  assert.match(await p.locator("#stage-card").textContent(), /38 \/ 50 HP/);
  await p.locator("#revive-use").click();
  await finish(p);
  assert.deepEqual(
    await p.evaluate(() => ({
      hp: state.party[0].hp,
      dead: state.party[0].dead,
      death: !!state.party[0].death,
      graveyard: state.graveyard.length,
      pending: state.pendingDeaths.length,
      stone: state.artefacts.some((a) => a.key === "revive"),
      equipped: state.equippedArtefact,
      corpse: state.map[state.position].corpses.length,
    })),
    {
      hp: 38,
      dead: false,
      death: false,
      graveyard: 0,
      pending: 0,
      stone: false,
      equipped: "fang",
      corpse: 0,
    },
  );
  await p.reload();
  assert.equal(await p.evaluate(() => state.party[0].hp), 38);
  await startEval(
    p,
    "(async()=>{damageHero(0,999,'A second fall');await processDeaths();checkDefeat();render()})()",
  );
  await p.waitForSelector("#death-confirm");
  assert.equal(await p.locator("#revive-use").count(), 0);
  await p.locator("#death-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.over), true);
});

test("declining a Revive Stone keeps it and respects permanent death and the survivor's burial", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    state.artefacts = [
      { id: "stone", name: "Revive Stone", key: "revive", power: 1, depth: 1 },
    ];
    render();
  });
  await startEval(
    p,
    "(async()=>{damageHero(1,999,'The hollow cantor');await processDeaths()})()",
  );
  await p.waitForSelector("#revive-decline");
  await p.locator("#revive-decline").click();
  await p.waitForSelector("#death-confirm");
  await p.locator("#death-confirm").click();
  await p.waitForSelector("#burial-confirm");
  await p.locator("#burial-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.party.length), 1);
  assert.equal(await p.evaluate(() => state.artefacts[0].key), "revive");
  assert.equal(await p.evaluate(() => state.graveyard[0].name), "Mira");
});

test("final death opens a scrollable complete memorial roster instead of a burial, on desktop and mobile", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    for (let i = 0; i < 5; i++) {
      const h = makeHero("Fallen " + i, "rogue");
      state.party.push(h);
      damageHero(state.party.length - 1, 999, "Lost in the archive");
      state.graveyard.push(h.death);
      state.pendingDeaths = [];
      state.party.pop();
    }
    state.party[0].stats.kills = 8;
    state.party[0].stats.damageDealt = 123;
    render();
  });
  await startEval(
    p,
    "(async()=>{damageHero(0,999,'The last torch');await processDeaths();checkDefeat();render()})()",
  );
  await p.waitForSelector("#death-confirm");
  await p.locator("#death-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.locator("#burial-confirm").count(), 0);
  assert.equal(await p.locator(".fallen-entry").count(), 6);
  assert.match(
    await p.locator(".run-summary").textContent(),
    /123 damage dealt/,
  );
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 390, height: 844 },
  ]) {
    await p.setViewportSize(viewport);
    await p.waitForTimeout(150);
    const r = await p.locator(".fallen-roster").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      const b = el.getBoundingClientRect();
      return {
        scroll: el.scrollTop,
        overflow: getComputedStyle(el).overflowY,
        bottom: b.bottom,
        top: b.top,
        height: innerHeight,
      };
    });
    assert.equal(r.overflow, "auto");
    assert.ok(r.scroll > 200);
    assert.ok(r.top > 0 && r.bottom < r.height);
    assert.equal(await p.locator(".fallen-entry:last-child").isVisible(), true);
    assert.match(
      await p.locator(".fallen-entry:last-child").textContent(),
      /The last torch/,
    );
    await p.screenshot({
      path: path.join(root, `test-results/final-roster-${viewport.width}.png`),
    });
  }
});

test("command-aged ambush readiness preserves drawings, excludes unseen and impassable tiles, and refreshes nearby un-fogged tiles", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  const r = await p.evaluate(() => {
    const now = 100;
    state.moveCommands = now;
    exploreWasAllowed = false;
    state.map.forEach((c) =>
      Object.assign(c, {
        seen: true,
        visited: false,
        fogged: false,
        lastNearCommand: now - AMBUSH_COMMAND_AGE - 1,
        event: null,
        feature: null,
      }),
    );
    state.position = pos(1, 7);
    Object.assign(state.map[pos(7, 2)], { wall: true, terrain: "river" });
    Object.assign(state.map[pos(8, 2)], { wall: true, terrain: "stone" });
    state.map[pos(9, 3)].seen = false;
    refreshStaleMap(now);
    render();
    return {
      distant: pos(8, 3),
      near: isStale(state.map[pos(2, 6)]),
      far: isStale(state.map[pos(8, 3)]),
      unseen: isStale(state.map[pos(9, 3)]),
      river: isStale(state.map[pos(7, 2)]),
      wall: isStale(state.map[pos(8, 2)]),
      clock: state.map[pos(2, 6)].lastNearCommand,
      now: state.moveCommands,
    };
  });
  assert.deepEqual(
    {
      near: r.near,
      far: r.far,
      unseen: r.unseen,
      river: r.river,
      wall: r.wall,
      clock: r.clock,
    },
    {
      near: false,
      far: true,
      unseen: false,
      river: false,
      wall: false,
      clock: r.now,
    },
  );
  assert.equal(
    await p.locator(`[data-tile="${r.distant}"].stale-fog`).count(),
    0,
  );
  await p.screenshot({ path: path.join(root, "test-results/fog-drawing.png") });
});

test("relic odds average roughly four to five finds in ten fully explored floors; beacon hints fade between useful messages", async (t) => {
  const p = await game(t);
  const result = await p.evaluate(() => {
    let found = 0;
    for (let run = 0; run < 1000; run++)
      for (let floor = 0; floor < 10; floor++)
        for (let loot = 0; loot < 7; loot++)
          for (let reel = 0; reel < 3; reel++)
            found += weightedPick(lootFaces()).type === "artefact";
    return found / 1000;
  });
  assert.ok(result > 4.1 && result < 5.1, String(result));
  const before = await p.locator("#field-note").textContent();
  await p.evaluate(() => cycleMarginHint());
  assert.notEqual(await p.locator("#field-note").textContent(), before);
  assert.equal(await p.locator("#field-note > svg").count(), 1);
});

test("older saved fights migrate to the gentler curve without losing wounds or edited reels", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.depth = 4;
    beginEncounter(false, { count: 1 });
    state.enemy.maxHp = 74;
    state.enemy.hp = 37;
    state.enemy.damage = 10;
    state.enemy.strikes = 3;
    state.enemy.frequency = 1;
    state.party[0].reels[0][0] = { type: "attack", tier: 3, weight: 9 };
    const old = { ...state, version: 6 };
    localStorage.setItem("scratchpad-dungeon-v6", JSON.stringify(old));
    localStorage.removeItem(SAVE_KEY);
  });
  await p.reload();
  assert.deepEqual(
    await p.evaluate(() => ({
      version: state.version,
      hp: state.enemy.hp,
      max: state.enemy.maxHp,
      damage: state.enemy.damage,
      strikes: state.enemy.strikes,
      frequency: state.enemy.frequency,
      face: state.party[0].reels[0][0].tier,
    })),
    {
      version: 22,
      hp: 14,
      max: 28,
      damage: 6,
      strikes: 1,
      frequency: 2,
      face: 3,
    },
  );
});

test("long travel crosses stairs and fog without opening the stairs menu; selecting stairs always opens it", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    for (let x = 1; x <= 8; x++)
      Object.assign(state.map[pos(x, 7)], {
        seen: true,
        fogged: x > 1,
        event: null,
      });
    Object.assign(state.map[80], {
      event: "stairs",
      feature: "stairs",
      bossDefeated: true,
    });
    state.floorBossDefeated = true;
    Object.assign(state.map[81 - W], { seen: true, fogged: true });
    Math.random = () => 0.999;
    render();
  });
  await p.locator('[data-tile="85"]').click();
  await finish(p);
  assert.deepEqual(
    await p.evaluate(() => ({
      position: state.position,
      modal: modalKind,
      reached: state.exitReached,
      walkingFog: [79, 80, 81, 82, 83, 84, 85].some((i) => state.map[i].fogged),
      neighbourFog: state.map[81 - W].fogged,
    })),
    {
      position: 85,
      modal: "",
      reached: true,
      walkingFog: false,
      neighbourFog: true,
    },
  );
  await p.locator('[data-tile="80"]').click();
  await p.waitForSelector("#descend");
  await p.getByRole("button", { name: "Keep exploring", exact: true }).click();
  await p.locator('[data-tile="85"]').click();
  await finish(p);
  await p.locator('[data-tile="78"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.position), 78);
  assert.equal(await p.locator("#overlay").isVisible(), false);
  await p.locator('[data-tile="80"]').click();
  await p.waitForSelector("#descend");
});

test("ambush readiness uses commands since proximity, resets before spawning, persists after spawning and survives reload", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  const r = await p.evaluate(() => {
    const now = 100,
      index = pos(5, 4),
      c = state.map[index];
    state.moveCommands = now;
    exploreWasAllowed = false;
    const advance = (clock) => {
      state.moveCommands = clock;
      exploreWasAllowed = false;
      refreshStaleMap();
    };
    Object.assign(c, {
      seen: true,
      visited: false,
      lastNearCommand: now - AMBUSH_COMMAND_AGE / 2,
      fogged: false,
    });
    state.position = pos(1, 7);
    advance(now);
    const initial = c.fogged;
    state.position = pos(4, 4);
    advance(now + 1);
    const refreshed = c.lastNearCommand;
    state.position = pos(1, 7);
    advance(refreshed + AMBUSH_COMMAND_AGE - 1);
    const before = c.fogged;
    advance(refreshed + AMBUSH_COMMAND_AGE);
    const spawned = c.fogged;
    state.position = pos(4, 4);
    advance(refreshed + AMBUSH_COMMAND_AGE + 100);
    const nearby = c.fogged;
    render();
    save();
    return { initial, refreshed, before, spawned, nearby, index };
  });
  assert.equal(r.initial, false);
  assert.equal(r.before, false);
  assert.equal(r.spawned, true);
  assert.equal(r.nearby, true);
  await p.reload();
  assert.equal(
    await p.evaluate((index) => state.map[index].fogged, r.index),
    true,
  );
  await p.evaluate(() => (Math.random = () => 0.999));
  await p.locator(`[data-tile="${r.index}"]`).click();
  await finish(p);
  assert.equal(
    await p.evaluate((index) => state.map[index].fogged, r.index),
    false,
  );
});

test("hidden ambushes have smoke and a banner; winning clears adjacent fog without revealing or activating anything", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    [79, 80, 81, 69, 91].forEach((i) =>
      Object.assign(state.map[i], { seen: true, fogged: true }),
    );
    state.map[81].event = "treasure";
    state.map[69].seen = false;
    state.map[69].event = "enemy";
    Math.random = () => 0;
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#stage-confirm");
  assert.equal(
    await p.locator("#stage-title").textContent(),
    await p.evaluate(() => state.enemy.name),
  );
  assert.match(
    await p.locator(".encounter-alert > span").textContent(),
    /SURPRISE|AMBUSH/,
  );
  assert.equal(
    await p.evaluate(() => particles.some((p) => p.kind === "smoke")),
    true,
  );
  await p.locator("#stage-confirm").click();
  await finish(p);
  await p.evaluate(() => {
    state.enemy.hp = 1;
    setEnemyBlock(0);
    state.enemy.passive=null;
    render();
  });
  await faces(p, [
    ["attack", 1],
    ["attack", 2],
    ["blank", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await p.waitForFunction(() => state.lastFogClear?.length > 0);
  assert.equal(
    await p.evaluate(() => particles.some((p) => p.kind === "smoke")),
    true,
  );
  assert.deepEqual(
    await p.evaluate(() => ({
      fog: state.map[80].fogged,
      seen: state.map[69].seen,
      event: state.map[81].event,
    })),
    { fog: false, seen: false, event: "treasure" },
  );
  await p.waitForSelector("#stage-confirm");
  await p.locator("#stage-confirm").click();
  await finish(p);
  await p.evaluate(() => {
    Math.random = () => 0;
    state.map[80].event = null;
    render();
  });
  await p.locator('[data-tile="80"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.enemy), null);
});

test("cave rooms reveal connected contents together without triggering treasure or wells; distribution averages one room", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.map[67].seen = true;
    [57, 58, 68, 69].forEach((i) => (state.map[i].room = 9));
    state.map[57].event = "treasure";
    state.map[58].event = "well";
    render();
  });
  await p.locator('[data-tile="68"]').click();
  await finish(p);
  assert.deepEqual(
    await p.evaluate(() => ({
      seen: [57, 58, 68, 69].every((i) => state.map[i].seen),
      gold: state.gold,
      enemy: state.enemy,
      treasure: state.map[57].event,
      well: state.map[58].event,
      outside: state.map[70].seen,
    })),
    {
      seen: true,
      gold: 0,
      enemy: null,
      treasure: "treasure",
      well: "well",
      outside: false,
    },
  );
  const distribution = await p.evaluate(() => {
    const counts = [0, 0, 0, 0];
    for (let n = 0; n < 1000; n++) {
      const map = generateFloor((n % 10) + 1),
        ids = [...new Set(map.filter((c) => c.room).map((c) => c.room))];
      if (ids.length > 3) return { invalid: true };
      counts[ids.length]++;
      for (const id of ids) {
        const cells = map
            .map((c, i) => (c.room === id ? i : -1))
            .filter((i) => i >= 0),
          seen = new Set([cells[0]]),
          q = [cells[0]];
        for (const i of q)
          for (const j of neighbors(i))
            if (cells.includes(j) && !seen.has(j)) {
              seen.add(j);
              q.push(j);
            }
        if (
          seen.size !== cells.length ||
          cells.some(
            (i) =>
              map[i].wall ||
              ["enemy", "guardian", "stronghold", "trap"].includes(
                map[i].event,
              ),
          )
        )
          return { invalid: true };
      }
    }
    return {
      counts,
      mean: counts.reduce((sum, n, i) => sum + n * i, 0) / 1000,
    };
  });
  assert.equal(distribution.invalid, undefined);
  assert.ok(distribution.counts[0] > 200);
  assert.ok(distribution.counts[3] > 10);
  assert.ok(
    distribution.mean > 0.85 && distribution.mean < 1.15,
    JSON.stringify(distribution),
  );
});

test("player token stays centred on its actual tile through desktop zoom, resizing, reload and mobile", async (t) => {
  const p = await game(t);
  await fast(p);
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 2560, height: 1440 },
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await p.setViewportSize(viewport);
    await p.waitForTimeout(100);
    const r = await p.evaluate(() => {
      const tile = document
          .querySelector('[data-tile="' + state.position + '"]')
          .getBoundingClientRect(),
        player = document.querySelector("#map-player").getBoundingClientRect();
      return {
        dx: Math.abs(
          tile.left + tile.width / 2 - player.left - player.width / 2,
        ),
        dy: Math.abs(
          tile.top + tile.height / 2 - player.top - player.height / 2,
        ),
      };
    });
    assert.ok(r.dx < 1 && r.dy < 1, JSON.stringify({ viewport, ...r }));
  }
  await p.reload();
  await p.waitForTimeout(120);
  assert.ok(
    await p.evaluate(() => {
      const a = document
          .querySelector('[data-tile="' + state.position + '"]')
          .getBoundingClientRect(),
        b = document.querySelector("#map-player").getBoundingClientRect();
      return Math.abs(a.top - b.top) < 1;
    }),
  );
});

test("each class starts with a single class seal on its middle reel; a seal completes a matching pair and executes its own ability", async (t) => {
  const p = await game(t);
  await fast(p);
  for (const job of ["fighter", "healer", "rogue", "mage"]) {
    await p.evaluate((job) => {
      state.party = [makeHero("Caster", job), makeHero("Ally", "fighter")];
      state.party.forEach((h) => (h.hp = 5));
      state.target = 1;
      beginEncounter(false, { count: job === "mage" ? 2 : 1 });
      state.enemies.forEach((e) =>
        Object.assign(e, { hp: 1000, maxHp: 1000, countdown: 100, block: 0 }),
      );
      const type =
        job === "healer" ? "heal" : job === "mage" ? "magic" : "attack";
      state.party[0].reels = [
        [{ type, tier: 1 }],
        [{ type: "class", tier: 1, job }],
        [{ type, tier: 1 }],
      ];
      Math.random = () => 0;
      render();
    }, job);
    await p.locator('[data-spin="0"]').click();
    await finish(p);
    assert.equal(await p.evaluate(() => state.lastPlayerRoll.multiplier), {fighter:1.5,healer:1.75,rogue:2,mage:1.75}[job]);
    if (job === "fighter") {
      assert.equal(await p.evaluate(() => state.party[0].rage), 0);
      assert.equal(await p.evaluate(() => state.block), 0);
      assert.equal(
        await p.evaluate(() => state.lastPlayerRoll.actualDamage),
        6,
      );
      assert.equal(await p.locator("#hero-0.raging").count(), 0);
    }
    if (job === "healer") {
      assert.equal(await p.evaluate(() => state.block), 0);
      assert.deepEqual(
        await p.evaluate(() => state.party.map((h) => h.hp)),
        [12, 19],
      );
    }
    if (job === "rogue") {
      assert.equal(await p.evaluate(() => state.lastFlurry.symbols.length), 3);
      assert.equal(
        await p.evaluate(() => state.lastPlayerRoll.actualDamage),
        10,
      );
    }
    if (job === "mage") {
      assert.deepEqual(
        await p.evaluate(() => state.enemies.map((e) => e.hp)),
        [989, 989],
      );
    }
  }
  assert.equal(
    await p.evaluate(() =>
      ["fighter", "healer", "rogue", "mage"].every((job) =>
        makeHero("Test", job).reels.every(
          (r, k) =>
            r.filter((s) => s.type === "class").length === (k === 1 ? 1 : 0),
        ),
      ),
    ),
    true,
  );
  assert.equal(
    await p.evaluate(() =>
      matchCount([
        { type: "class", tier: 1 },
        { type: "blank", tier: 1 },
        { type: "blank", tier: 1 },
      ]),
    ),
    1,
  );
  assert.equal(
    await p.evaluate(() =>
      matchCount([
        { type: "class", tier: 1 },
        { type: "attack", tier: 1 },
        { type: "attack", tier: 2 },
      ]),
    ),
    1,
  );
});

test("poison ticks for one armour-piercing damage per action, expires, and can win a battle with proper credit", async (t) => {
  const p = await game(t, { auto: true });
  await fast(p);
  await encounter(p);
  await p.evaluate(() => {
    applyPoison(state.enemy, 2, state.party[0]);
    applyPoison(state.party[0], 2, state.enemy);
    state.block = 50;
    render();
  });
  await faces(p, [
    ["blank", 1],
    ["blank", 1],
    ["blank", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.deepEqual(
    await p.evaluate(() => ({
      hp: state.party[0].hp,
      enemy: state.enemy.hp,
      block: state.block,
      turns: state.enemy.poison.turns,
    })),
    { hp: 49, enemy: 999, block: 30, turns: 2 },
  );
  assert.equal(await p.locator("#portrait-0 .poison-badge").count(), 1);
  for (let n = 0; n < 2; n++) {
    await p.locator('[data-spin="0"]').click();
    await finish(p);
  }
  assert.equal(await p.evaluate(() => state.party[0].poison), null);
  assert.equal(await p.evaluate(() => state.enemy.poison), null);
  await p.evaluate(() => {
    state.enemy.hp = 1;
    applyPoison(state.enemy, 1, state.party[0]);
    render();
  });
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.battlesWon), 1);
  assert.equal(await p.evaluate(() => state.party[0].stats.kills), 1);
  assert.equal(await p.evaluate(() => state.party[0].xp), 9);
});

test("ally stimulant targets an ally, boosts damage and defence with visible fire, persist in saves and clear after combat", async (t) => {
  const p = await game(t, { auto: true });
  await fast(p);
  await encounter(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Ally", "fighter"));
    state.target = 1;
    render();
  });
  await faces(p, [
    ["magic", 1],
    ["rally", 2],
    ["blank", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.locator("#hero-1.powered-up .buff-badge").count(), 1);
  assert.equal(await p.evaluate(() => state.party[1].stimulant.turns), 2);
  await faces(
    p,
    [
      ["attack", 1],
      ["attack", 2],
      ["blank", 1],
    ],
    1,
  );
  await p.locator('[data-spin="1"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.lastPlayerRoll.actualDamage), 4);
  assert.equal(await p.evaluate(() => damageHero(1, 5, "A jab")), 4);
  await p.evaluate(() => save());
  await p.reload();
  assert.equal(await p.locator("#hero-1.powered-up").count(), 1);
  await autoEvents(p);
  await p.evaluate(() => {
    state.enemy.hp = 1;
    state.party[0].rage = 2;
    applyPoison(state.party[1], 3, state.enemy);
    render();
  });
  await p.locator('[data-spin="1"]').click();
  await finish(p);
  assert.equal(
    await p.evaluate(() =>
      state.party.every((h) => !h.poison && !h.stimulant && !h.rage),
    ),
    true,
  );
});

test("critical result button remains enabled and skips the hold; event criticals still require the event confirmation", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    // Test manual release, not the short reward timer racing Playwright's
    // animation-stability wait. Keep the real resolver and release path.
    const hold = criticalHold;
    criticalHold = () => hold(10000);
  });
  await encounter(p);
  await faces(p, [
    ["attack", 1],
    ["attack", 1],
    ["attack", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await p.waitForFunction(() => !!criticalHoldResolver);
  assert.equal(await p.locator("#stage-skip").isEnabled(), true);
  assert.match(await p.locator("#stage-skip").textContent(), /Strike now/);
  await p.evaluate(() => {
    // The timer resolves independently. Only the actual skip path calls this
    // resolver, so verify release directly rather than timing all impact FX.
    const release = criticalHoldResolver;
    window.testCriticalSkipped = false;
    criticalHoldResolver = () => {
      window.testCriticalSkipped = true;
      release();
    };
  });
  await p.locator("#stage-skip").click();
  assert.equal(await p.evaluate(() => window.testCriticalSkipped), true);
  assert.equal(await p.evaluate(() => criticalHoldResolver === null), true);
  await finish(p);
  await p.evaluate(() => {
    state.enemy = null;
    state.enemies = [];
    Math.random = () => 0;
    render();
  });
  await startEval(p, "treasureRoll()");
  await p.waitForFunction(() => !!criticalHoldResolver);
  assert.match(await p.locator("#stage-skip").textContent(), /Take the result/);
  await p.locator("#stage-skip").click();
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.locator("#spotlight").isVisible(), true);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.testAction);
});

test("ink bombs roll damage and poison, show an inline critical when matched and leave enemy clocks unchanged", async (t) => {
  const p = await game(t);
  await fast(p);
  await encounter(p);
  await p.evaluate(() => {
    state.bombs = 2;
    let draws = 0;
    Math.random = () => [0, 0.6, 0.999][draws++ % 3];
    render();
  });
  await startEval(p, "useBomb()");
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.evaluate(() => state.enemy.hp), 1000);
  assert.deepEqual(
    await p.evaluate(() => state.lastItemRoll.symbols.map((s) => s.type)),
    ["attack", "poison", "blank"],
  );
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.enemy.hp), 999);
  assert.equal(await p.evaluate(() => state.enemy.poison.turns), 2);
  assert.equal(await p.evaluate(() => state.enemy.countdown), 20);
  await p.evaluate(() => (Math.random = () => 0));
  await startEval(p, "useBomb()");
  await p.waitForSelector("#event-critical.critical-locked .critical-payoff");
  assert.equal(await p.locator("#stage-title").textContent(), "Ink bomb!");
  await p.waitForSelector("#stage-confirm");
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.bombs), 0);
});

test("bag stacks matching items but limits types to three; overflow can replace a whole stack and survives reload", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.bag = {
      potion: 2,
      bomb: 3,
      antidote: 5,
    };
    state.pendingItems = [{ type: "potion", count: 3 }];
    render();
  });
  await p.evaluate(() => processPendingItems());
  assert.equal(await p.evaluate(() => state.potions), 5);
  await p.evaluate(() => {
    state.pendingItems = [{ type: "ration", count: 2 }];
    save();
  });
  await p.reload();
  await p.waitForSelector("#item-leave");
  assert.equal(await p.locator(".bag-card").count(), 3);
  await p.locator('[data-stage-choice="swap:antidote"]').click();
  await finish(p);
  assert.deepEqual(
    await p.evaluate(() => ({
      types: Object.keys(state.bag).length,
      antidote: state.bag.antidote || 0,
      ration: state.bag.ration,
      pending: state.pendingItems.length,
    })),
    { types: 3, antidote: 0, ration: 2, pending: 0 },
  );
  await p.reload();
  assert.equal(await p.evaluate(() => state.bag.ration), 2);
  assert.equal(await p.evaluate(() => Object.keys(ITEM_DEFS).length), 48);
});

test("full bag lets the player use a new item immediately, use an existing last item to free a pocket, or decline the find", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.bag = {
      potion: 1,
      bomb: 1,
      ward: 1,
    };
    state.party[0].hp = 1;
    render();
    state.pendingItems = [{ type: "ration", count: 1 }];
  });
  await startEval(p, "processPendingItems()");
  await p.waitForSelector("#item-use-found");
  await p.locator("#item-use-found").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.party[0].hp), 16);
  assert.equal(await p.evaluate(() => state.bag.ration || 0), 0);
  assert.equal(await p.evaluate(() => Object.keys(state.bag).length), 3);
  await p.evaluate(() => (state.pendingItems = [{ type: "ration", count: 1 }]));
  await startEval(p, "processPendingItems()");
  await p.waitForSelector('[data-stage-choice="use:potion"]');
  await p.locator('[data-stage-choice="use:potion"]').click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.bag.potion || 0), 0);
  assert.equal(await p.evaluate(() => state.bag.ration), 1);
  await p.evaluate(() => (state.pendingItems = [{ type: "chalk", count: 2 }]));
  await startEval(p, "processPendingItems()");
  await p.waitForSelector("#item-leave");
  await p.locator("#item-leave").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.bag.chalk || 0), 0);
});

test("ten new consumables have usable effects and respect targets and combat restrictions", async (t) => {
  const p = await game(t);
  await fast(p);
  await encounter(p);
  const result = await p.evaluate(async () => {
    const h = state.party[0];
    state.party.push(makeHero("Mira", "healer"));
    render();
    const give = async (type) => {
      state.bag[type] = 1;
      renderInventory();
      return useItem(type);
    };
    h.hp = 10;
    await give("bandage");
    const bandage = h.hp;
    h.hp = state.party[1].hp = 1;
    await give("salve");
    const salve = state.party.map((h) => h.hp);
    applyPoison(h, 3, state.enemy);
    await give("antidote");
    const cured = !h.poison;
    await give("ember");
    const buff = h.stimulant.power;
    await give("oil");
    const rage = h.rage;
    await give("frost");
    const stunned = state.enemy.stun;
    await give("venom");
    const poison = state.enemy.poison.turns;
    const before = state.enemy.hp;
    await give("firebomb");
    const fire = before - state.enemy.hp;
    h.hp = 1;
    await give("ration");
    const ration = h.hp;
    state.bag.chalk = 1;
    const prevented = !(await useItem("chalk")) && state.bag.chalk === 1;
    state.enemy = null;
    state.enemies = [];
    clearBattleStatuses();
    await useItem("chalk");
    return {
      bandage,
      salve,
      cured,
      buff,
      rage,
      stunned,
      poison,
      fire,
      ration,
      prevented,
      chalk: state.bag.chalk || 0,
      revealed: neighbors(state.position, true).every((i) => state.map[i].seen),
    };
  });
  assert.deepEqual(result, {
    bandage: 18,
    salve: [7, 7],
    cured: true,
    buff: 2,
    rage: 2,
    stunned: 1,
    poison: 3,
    fire: 10,
    ration: 16,
    prevented: true,
    chalk: 0,
    revealed: true,
  });
});

test("satchel and full-bag choices fit three types on desktop and mobile without internal scrolling", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.bag = {
      potion: 12,
      bomb: 2,
      ward: 3,
    };
    state.party.push(makeHero("Mira", "healer"), makeHero("Ivo", "mage"));
    beginEncounter(false, { count: 2 });
    render();
  });
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await p.setViewportSize(viewport);
    await p.waitForTimeout(150);
    assert.equal(await p.locator(".inventory-items button").count(), 3);
    const fits = await p.evaluate(() => {
      const panel = document
        .querySelector(".inventory")
        .getBoundingClientRect();
      return [...document.querySelectorAll(".inventory-items button")].every(
        (b) => {
          const r = b.getBoundingClientRect();
          return (
            r.bottom <= panel.bottom + 2 &&
            r.left >= panel.left &&
            r.right <= panel.right
          );
        },
      );
    });
    assert.equal(fits, true, JSON.stringify(viewport));
    await p.evaluate(() => {
      state.pendingItems = [{ type: "ration", count: 1 }];
    });
    await startEval(p, "processPendingItems()");
    await p.waitForSelector("#item-leave");
    await panelFits(
      p,
      "#stage-card",
      ".stage-content",
      ".scene-layout",
      "#stage-title",
    );
    await p.screenshot({
      path: path.join(root, `test-results/bag-overflow-${viewport.width}.png`),
    });
    await p.locator("#item-leave").click();
    await p.evaluate(() => window.testAction);
  }
});

test("older saves gain one middle class seal and migrate consumables into the three-type bag", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const old = JSON.parse(JSON.stringify(state));
    old.version = 7;
    delete old.bag;
    delete old.pendingItems;
    old.potions = 2;
    old.bombs = 3;
    old.wards = 4;
    old.party[0].reels.forEach((r) => {
      const i = r.findIndex((s) => s.type === "class");
      if (i >= 0) r.splice(i, 1);
    });
    localStorage.setItem("scratchpad-dungeon-v7", JSON.stringify(old));
    localStorage.removeItem(SAVE_KEY);
  });
  await p.reload();
  assert.deepEqual(await p.evaluate(() => state.bag), {
    potion: 2,
    bomb: 3,
    ward: 4,
  });
  assert.equal(
    await p.evaluate(() =>
      state.party[0].reels.every(
        (r, k) =>
          r.filter((s) => s.type === "class").length === (k === 1 ? 1 : 0),
      ),
    ),
    true,
  );
  await p.evaluate(() => save());
  await p.reload();
  assert.equal(await p.evaluate(() => state.party[0].reels[0].length), 6);
});

test("new item loot stays in its original event until claimed, then offers a full-bag swap with the correct quantity", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.bag = { potion: 1, bomb: 1, antidote: 1 };
    const faces = lootFaces(),
      index = faces.findIndex((f) => f.type === "bandage"),
      sum = faces.reduce((n, f) => n + f.weight, 0),
      draw =
        (faces.slice(0, index).reduce((n, f) => n + f.weight, 0) +
          faces[index].weight / 2) /
        sum;
    Math.random = () => draw;
    render();
  });
  await startEval(p, "treasureRoll()");
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.locator("#stage-title").textContent(), "Treasure!");
  assert.equal(await p.evaluate(() => state.bag.bandage || 0), 0);
  await p.locator("#stage-confirm").click();
  await p.waitForSelector("#item-leave");
  const quantity = await p.evaluate(() => state.pendingItems[0].count);
  assert.equal(quantity, 12);
  await p.locator('[data-stage-choice="swap:antidote"]').click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.bag.bandage), 12);
  assert.equal(await p.evaluate(() => Object.keys(state.bag).length), 3);
});

test("shop purchases can resolve a full bag by using the new tonic, then return to the same shop", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.bag = { bomb: 1, ward: 1, antidote: 1 };
    state.gold = 100;
    state.party[0].hp = 1;
    render();
  });
  await startEval(p, "shopEncounter({shop:{potion:1}})");
  await p.locator('[data-buy="potion"]').click();
  await p.waitForSelector("#shop-cancel");
  assert.equal(await p.evaluate(() => state.gold), 100);
  await p.locator("#stage-confirm").click();
  await p.waitForSelector("#item-use-found");
  await p.locator("#item-use-found").click();
  await p.waitForSelector('#modal [data-buy="potion"]:disabled');
  assert.equal(await p.evaluate(() => state.party[0].hp), 17);
  assert.equal(await p.evaluate(() => state.gold), 8);
  assert.equal(await p.evaluate(() => state.potions), 0);
  assert.equal(await p.evaluate(() => Object.keys(state.bag).length), 3);
  assert.equal(await p.evaluate(() => modalKind), "shop");
  await p.locator("#modal [data-close]").last().click();
  await p.evaluate(() => window.testAction);
});

test("critical impacts use a distinct beam colour and a burst of successive hits even at Skip speed", async (t) => {
  const p = await game(t);
  await fast(p);
  await encounter(p);
  await faces(p, [
    ["attack", 1],
    ["attack", 1],
    ["attack", 1],
  ]);
  await p.evaluate(() => {
    window.criticalBeamColour=null;
    new MutationObserver(rows=>rows.forEach(row=>row.addedNodes.forEach(n=>{
      if(n.matches?.(".fx-beam.critical-hit")) window.criticalBeamColour=getComputedStyle(n).backgroundColor;
    }))).observe(document.body,{childList:true});
  });
  await p.locator('[data-spin="0"]').click();
  await p.waitForFunction(() => !!criticalHoldResolver);
  await p.evaluate(() => $("#stage-skip").click());
  await p.waitForSelector(".critical-impact");
  await p.waitForTimeout(100);
  assert.ok((await p.locator(".critical-impact").count()) >= 2);
  const color = await p.evaluate(() => window.criticalBeamColour);
  assert.equal(color, "rgb(188, 88, 202)");
  assert.ok(
    (await p.evaluate(
      () =>
        particles.filter((p) => p.kind === "damage" || p.kind === "paper")
          .length,
    )) > 45,
  );
  await finish(p);
});

test("mixed blade and magic criticals show correct rounded components and tier IV mage upgrades persist", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party = [makeHero("Ivo", "mage", null, [], { specialism: "offence" })];
    state.party[0].points = 20;
    state.party[0].reels[0][0].tier = 3;
    render();
    editor(0);
  });
  await p.locator('[data-upgrade="0,0,0"]').click();
  assert.equal(await p.evaluate(() => state.party[0].points), 11);
  await p.locator("#modal [data-close]").first().click();
  await p.reload();
  assert.equal(await p.evaluate(() => state.party[0].reels[0][0].tier), 4);
  assert.equal(
    await p.evaluate(() => state.party[0].reels[0][0].type),
    "magic",
  );
  await encounter(p);
  await p.evaluate(() => {
    const h = state.party[0];
    h.level = 2;
    h.rage = 1;
    h.reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "class", tier: 1, job: "mage" }],
      [{ type: "attack", tier: 1 }],
    ];
    Math.random = () => 0.3;
    render();
  });
  await p.locator('[data-spin="0"]').click();
  await p.waitForFunction(() => !!criticalHoldResolver);
  assert.deepEqual(
    await p.evaluate(() =>
      state.lastCritical.baseEffects.map((d) => [
        d.value,
        Math.ceil(d.value * state.lastCritical.multiplier),
      ]),
    ),
    [
      [3, 6],
      [5, 10],
    ],
  );
  await p.evaluate(() => $("#stage-skip").click());
  await finish(p);
  assert.equal(await p.evaluate(() => state.lastPlayerRoll.actualDamage), 16);
  assert.match(
    await p.locator("#result-ribbon").textContent(),
    /6 physical \+ 10 spell/,
  );
});

test("first opening offers four base classes, opens the cover, and fresh runs turn a page", async (t) => {
  const p = await game(t);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForSelector('[data-start-job="mage"]');
  assert.equal(await p.locator(".starter-grid button").count(), 6);
  assert.equal(
    await p.locator("#modal-title").textContent(),
    "Who opens the notebook?",
  );
  await p.locator('[data-start-job="mage"]').click();
  assert.equal(await p.evaluate(() => state.party[0].job), "mage");
  assert.equal(await p.locator(".turning-page").count(), 1);
  await p.locator("#new-game").click();
  await p.locator("#starter-specialism").selectOption("defence");
  await p.locator('[data-start-job="mage"]').click();
  assert.equal(await p.evaluate(() => state.party[0].job), "mage");
  assert.equal(await p.evaluate(() => state.party[0].specialism), "defence");
});

test("options tabs are functional and autoresolve, palette and pace persist across fresh pages", async (t) => {
  const p = await game(t);
  await p.locator("#options-tab").click();
  await p.locator("#option-speed").selectOption("3");
  await p.locator("#tab-display").click();
  await p.locator("#option-palette").selectOption("warm");
  await p.locator("#tab-play").click();
  await p.locator("#option-auto").check();
  await p.locator("#modal [data-close]").last().click();
  assert.equal(await p.locator("#autoresolve").isChecked(), true);
  await p.evaluate(() => newRun("rogue"));
  await p.reload();
  assert.deepEqual(
    await p.evaluate(() => [state.speed, state.palette, state.autoresolve]),
    ["3", "warm", true],
  );
  await p.locator("#guide-tab").click();
  assert.match(
    await p.locator("#modal").textContent(),
    /Old passages|equipment|Autoresolve/,
  );
  assert.equal(
    (await p.locator(".save-line").innerText()).trim(),
    "",
    "the notebook footer has no decorative filler text",
  );
  assert.equal(await p.locator("#save-status").isVisible(), false);
});

test("waiting in combat, popups and the map cannot age ambushes without another command", async (t) => {
  const p = await game(t);
  await p.evaluate(blankFloor);
  const r = await p.evaluate(() => {
    const c = state.map[pos(6, 4)];
    Object.assign(c, {
      seen: true,
      wall: false,
      lastNearCommand: 0,
      fogged: false,
    });
    state.moveCommands = AMBUSH_COMMAND_AGE - 1;
    exploreWasAllowed = true;
    exploreTickAt = 1000;
    beginEncounter();
    refreshStaleMap(2000);
    const combat = state.moveCommands;
    state.enemy = null;
    state.enemies = [];
    showSpotlight("A find", "Wait", "<div>Still deciding</div>", "treasure");
    refreshStaleMap(3000);
    const popup = state.moveCommands;
    closeSpotlight();
    openModal("Options", "<p>Choosing</p>", "options");
    refreshStaleMap(4000);
    const menu = state.moveCommands;
    closeModal();
    refreshStaleMap(5000);
    refreshStaleMap(5300);
    registerMoveCommand();
    render();
    return {
      combat,
      popup,
      menu,
      end: state.moveCommands,
      aged: c.fogged,
      visual: !!document.querySelector(".stale-fog"),
    };
  });
  assert.equal(r.combat, 11);
  assert.equal(r.popup, r.combat);
  assert.equal(r.menu, r.combat);
  assert.equal(r.end, 12);
  assert.equal(r.aged, true);
  assert.equal(r.visual, false);
});

test("every stair has a scaling elite boss and entering an undefeated stair starts its battle", async (t) => {
  const p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(blankFloor);
  const data = await p.evaluate(() => {
    const result = [];
    for (let d = 1; d <= 10; d++) {
      state.depth = d;
      state.map = generateFloor(d);
      beginEncounter(true, { stairBoss: true });
      const e = state.enemy;
      result.push({
        hp: e.hp,
        name: e.name,
        elite: e.elite,
        boss: e.boss,
        stairs: state.map.filter((c) => c.event === "stairs").length,
        guardian: state.map.some((c) => c.event === "guardian"),
      });
    }
    state.enemy = null;
    state.enemies = [];
    newRun();
    return result;
  });
  assert.equal(new Set(data.map((x) => x.name)).size, 10);
  assert.ok(
    data.every((x) => x.elite && x.boss && x.stairs === 1 && !x.guardian),
  );
  assert.ok(data.every((x, i) => i === 0 || x.hp > data[i - 1].hp));
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.map[79].event = "stairs";
    state.map[79].feature = "stairs";
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await finish(p);
  assert.equal(
    await p.evaluate(() => state.enemy.boss && state.enemy.elite),
    true,
  );
  assert.equal(await p.evaluate(() => state.exitReached), true);
  assert.equal(await p.locator("#overlay").isVisible(), false);
});

test("final guardian death celebrates a complete living, fallen and retired roster without another stair prompt", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(async () => {
    state.depth = 10;
    const dead = makeHero("Remembered", "rogue");
    state.party.push(dead);
    recordDeath(dead, "The ninth guardian");
    state.graveyard.push(dead.death);
    state.pendingDeaths = [];
    state.party.pop();
    const retired = makeHero("Resting", "healer");
    state.retired.push({
      ...retired,
      retiredAt: Date.now(),
      stepsWithParty: 8,
    });
    beginEncounter(true, { stairBoss: true });
    state.enemy.hp = 0;
    await victory(state.enemy);
  });
  assert.equal(await p.evaluate(() => state.over && state.won), true);
  assert.match(
    await p.locator("#modal-title").textContent(),
    /WROTE THE ENDING/,
  );
  assert.equal(await p.locator(".fallen-entry").count(), 3);
  const text = await p.locator(".fallen-roster").textContent();
  for (const value of [
    "SURVIVOR",
    "FALLEN",
    "RETIRED",
    "Remembered",
    "Resting",
    "Criticals",
    "Equipment",
    "Reels",
    "Levels gained",
  ])
    assert.ok(text.includes(value), value);
  assert.ok(await p.evaluate(() => particles.length > 50));
  assert.equal(
    await p.locator(".fallen-roster .final-floor-record").count(),
    1,
    "final-floor details share the existing scrollable records so they do not shrink the whole phone UI",
  );
  await p.setViewportSize({ width: 390, height: 844 });
  await panelFits(p, "#modal", ".modal-body", ".modal-flow", "#modal-title");
});

test("pursuer moves only with footsteps, prefers revealed paths, hides in covered tiles and fights on contact", async (t) => {
  const p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(blankFloor);
  const r = await p.evaluate(async () => {
    state.depth = 4;
    state.map.forEach((c) => {
      if (!c.wall) c.seen = true;
    });
    state.pursuerSpawned = true;
    state.pursuer = { position: pos(8, 7), beat: 0 };
    render();
    const first = state.pursuer.position;
    await advancePursuer();
    const still = state.pursuer.position;
    await advancePursuer();
    const next = state.pursuer.position;
    state.map[next].seen = false;
    renderPursuer();
    const hidden = !document.querySelector(".pursuer-token");
    state.map[next].seen = true;
    renderPursuer();
    return {
      first,
      still,
      next,
      hidden,
      route: pursuerRoute(pos(8, 7), pos(1, 7)).length,
    };
  });
  assert.notEqual(r.first, r.still);
  assert.notEqual(r.still, r.next);
  assert.notEqual(r.first, r.next);
  assert.equal(r.hidden, true);
  assert.equal(r.route, 7);
  await p.evaluate(async () => {
    state.pursuer.position = state.position;
    await advancePursuer();
    render();
  });
  assert.equal(await p.evaluate(() => state.enemy.pursuer), true);
  assert.equal(await p.evaluate(() => state.pursuer), null);
});

test("class-bound and generic equipment pieces work, can be dragged onto heroes, replaced safely and saved", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    state.bag = { ironSignet: 1, bulwarkBadge: 1, serpentPin: 1 };
    render();
  });
  await p
    .locator('[data-drag-item="ironSignet"]')
    .dragTo(p.locator("#portrait-0"));
  await p.waitForFunction(() => state.party[0].equipment === "ironSignet");
  assert.equal(await p.evaluate(() => state.bag.ironSignet || 0), 0);
  assert.equal(
    await p.evaluate(() => equipmentBonus(state.party[0], "attack")),
    2,
  );
  assert.equal(await p.evaluate(() => equipCharacter("serpentPin", 0)), false);
  await p.evaluate(() => equipCharacter("bulwarkBadge", 0));
  assert.equal(await p.evaluate(() => state.bag.ironSignet), 1);
  await p.reload();
  assert.equal(
    await p.evaluate(() => state.party[0].equipment),
    "bulwarkBadge",
  );
  const effects = await p.evaluate(async () => {
    const out = [];
    for (const [type, gear] of Object.entries(EQUIPMENT_DEFS)) {
      const h = makeHero("Bearer", gear.job || "fighter");
      h.equipment = type;
      h.stats.spins = 12;
      const roll = await planHeroRoll(h, [
        { type: gear.job === "mage" ? "magic" : "attack", tier: 1 },
        { type: "heal", tier: 1 },
        { type: "blank", tier: 1 },
      ]);
      out.push({
        type,
        damage: roll.attack + roll.magic,
        heal: roll.heal,
        teamHeal: roll.teamHeal,
        block: roll.block,
        poison: roll.poison,
        stun: roll.stun,
        stim: roll.rally,
        guard: equipmentBonus(h, "guard"),
        defence: defenceBonus(h),
      });
    }
    return out;
  });
  assert.equal(effects.length, 13);
  assert.equal(effects.find((x) => x.type === "trailBow").damage, 5); // Prepared shot: physical + healing.
  assert.equal(effects.find((x) => x.type === "trailCloak").defence, 1);
  assert.ok(effects.find((x) => x.type === "ironSignet").damage >= 3);
  assert.equal(effects.find((x) => x.type === "bulwarkBadge").guard, 3);
  assert.equal(effects.find((x) => x.type === "glassRosary").heal, 5); // Spellweave: spell + healing.
  assert.equal(effects.find((x) => x.type === "mercyBell").teamHeal, 1);
  assert.equal(effects.find((x) => x.type === "silentBoots").stun, 1);
  assert.equal(effects.find((x) => x.type === "serpentPin").poison, 1);
  assert.ok(effects.find((x) => x.type === "starLens").damage >= 3);
  assert.equal(effects.find((x) => x.type === "stormQuill").stim, 2);
});

test("fourth adventurer offers replacement and keeps the retired hero in the expedition records", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    render();
  });
  await startEval(p, "recruitEncounter()");
  await p.locator("#recruit-accept").click();
  await p.waitForSelector('[data-stage-choice="replace:1"]');
  await p.locator('[data-stage-choice="replace:1"]').click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.party.length), 3);
  assert.equal(await p.evaluate(() => state.retired[0].name), "Mira");
  assert.equal(await p.evaluate(() => state.graveyard.length), 0);
  assert.match(
    await p.evaluate(() => runSummaryMarkup(true)),
    /Mira.*RETIRED/s,
  );
});

test("autoresolve chooses healing then damage without input, uses emergency items sparingly and stops when disabled", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    state.party[0].hp = 13;
    state.party[0].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "block", tier: 1 }],
      [{ type: "blank", tier: 1 }],
    ];
    state.party[1].reels = [
      [{ type: "heal", tier: 1 }],
      [{ type: "heal", tier: 2 }],
      [{ type: "blank", tier: 1 }],
    ];
    state.party[2].reels = [
      [{ type: "attack", tier: 2 }],
      [{ type: "attack", tier: 1 }],
      [{ type: "blank", tier: 1 }],
    ];
    beginEncounter(false, { count: 1 });
    Object.assign(state.enemy, {
      hp: 18,
      maxHp: 18,
      countdown: 100,
      block: 0,
      stimulant: null,
    });
    render();
    setAutoresolve(true);
  });
  await p.waitForSelector("#stage-confirm", { timeout: 20000 });
  assert.equal(await p.evaluate(() => state.enemy), null);
  assert.ok(
    await p.evaluate(
      () => state.party[1].stats.spins > 0 && state.party[2].stats.spins > 0,
    ),
  );
  assert.equal(await p.locator("#spotlight").isVisible(), true);
  await p.locator("#stage-confirm").click();
  await finish(p);
  await p.evaluate(() => {
    beginEncounter(false, { count: 1 });
    state.enemy.hp = 10000;
    state.party[0].hp = 1;
    state.bag = { potion: 3 };
    state.lastAutoItemAction = -100;
    render();
  });
  await p.waitForFunction(() => state.bag.potion === 2);
  await p.locator("#autoresolve").uncheck();
  await finish(p);
  const count = await p.evaluate(() =>
    state.party.reduce((n, h) => n + h.stats.spins, 0),
  );
  await p.waitForTimeout(650);
  assert.equal(
    await p.evaluate(() => state.party.reduce((n, h) => n + h.stats.spins, 0)),
    count,
  );
  assert.equal(await p.evaluate(() => state.bag.potion), 2);
});

test("beacon rays stop at stone, pass over rivers and sometimes light one to five extra outer tiles", async (t) => {
  const p = await game(t);
  await p.evaluate(blankFloor);
  const r = await p.evaluate(() => {
    state.position = pos(5, 4);
    state.map[pos(6, 4)].wall = true;
    state.map[pos(6, 4)].terrain = "stone";
    const blocked = lineOfSight(state.position, pos(7, 4));
    state.map[pos(6, 4)].terrain = "river";
    const water = lineOfSight(state.position, pos(7, 4));
    Math.random = () => 0;
    const tiles = beaconTiles(state.position);
    return {
      blocked,
      water,
      extras: tiles.filter((i) => tileDistance(i) > 1).length,
    };
  });
  assert.equal(r.blocked, false);
  assert.equal(r.water, true);
  assert.equal(r.extras, 1);
});

test("five new enemy types stay in their floor pairs; elites retain their species and double battles increase with depth", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const names = [
        "Candle gnawer",
        "Blind bellkeeper",
        "Thorn widow",
        "Gutter oracle",
        "The page eater",
      ],
      bands = [],
      doubleRates = [];
    let rare = 0,
      total = 0;
    for (let depth = 1; depth <= 10; depth++) {
      state.depth = depth;
      let pairs = 0;
      const found = new Set();
      for (let n = 0; n < 160; n++) {
        beginEncounter();
        if (state.enemies.length === 2) pairs++;
        for (const e of state.enemies) {
          if (names.includes(e.name)) found.add(e.name);
          if (e.elite) rare++;
          total++;
        }
      }
      bands.push([...found]);
      doubleRates.push(pairs / 160);
    }
    return { bands, doubleRates, eliteRate: rare / total };
  });
  for (let d = 0; d < 10; d++)
    assert.deepEqual(r.bands[d], [
      [
        "Candle gnawer",
        "Blind bellkeeper",
        "Thorn widow",
        "Gutter oracle",
        "The page eater",
      ][Math.floor(d / 2)],
    ]);
  assert.ok(r.doubleRates[3] > r.doubleRates[0] + 0.08);
  assert.ok(r.doubleRates[9] > r.doubleRates[0] + 0.1);
  assert.ok(r.doubleRates[9] < 0.35);
  assert.ok(r.eliteRate > 0.03 && r.eliteRate < 0.1);
});

test("rogue flurries and critical bonus damage produce distinct sequential hits and numbers", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party = [makeHero("Wren", "rogue")];
    beginEncounter(false, { count: 1 });
    Object.assign(state.enemy, {
      hp: 1000,
      maxHp: 1000,
      countdown: 99,
      block: 0,
    });
    state.enemy.stimulant = null;
    state.enemy.rage = 0;
    state.party[0].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "class", tier: 1, job: "rogue" }],
      [{ type: "attack", tier: 1 }],
    ];
    Math.random = () => 0;
    render();
  });
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  const hits = await p.evaluate(() => state.lastPlayerRoll.hits);
  assert.equal(hits.length, 5);
  assert.equal(
    hits.reduce((n, h) => n + h.actual, 0),
    10,
  );
  assert.ok(hits.every((h, i) => i === 0 || h.at - hits[i - 1].at >= 75));
  assert.ok(
    await p.evaluate(
      () => document.querySelectorAll(".combat-number").length >= 3,
    ),
  );
});

test("version-eight saves preserve edited faces while moving the class seal to the middle and queuing surplus bag types", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const old = JSON.parse(JSON.stringify(state));
    old.version = 8;
    old.party[0].reels.forEach((r, k) => {
      if (k !== 1)
        r.push({ type: "class", tier: 1, weight: 3, job: "fighter" });
      r[0] = { type: "poison", tier: 3, weight: 17 };
    });
    old.bag = { potion: 1, bomb: 1, ward: 1, chalk: 1, venom: 1, ration: 1 };
    localStorage.setItem(SAVE_KEY, JSON.stringify(old));
  });
  await p.reload();
  await p.waitForSelector("#item-leave");
  assert.deepEqual(
    await p.evaluate(() =>
      state.party[0].reels.map(
        (r) => r.filter((f) => f.type === "class").length,
      ),
    ),
    [0, 1, 0],
  );
  assert.ok(
    await p.evaluate(() =>
      state.party[0].reels.every((r) =>
        r.some((f) => f.type === "poison" && f.tier === 3 && f.weight === 1),
      ),
    ),
  );
  assert.equal(await p.evaluate(() => Object.keys(state.bag).length), 3);
  assert.equal(await p.evaluate(() => state.pendingItems.length), 3);
});

test("rare travel rockfalls roll a check, safe triples never hurt and body discoveries remain optional", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.depth = 9;
    state.steps = 20;
    state.lastMinorEventStep = -100;
    let draws = [0, 0.8];
    Math.random = () => (draws.length ? draws.shift() : 0);
    window.testAction = minorTravelEvent(state.map[state.position]);
  });
  await p.waitForSelector("#stage-confirm");
  assert.match(await p.locator("#stage-title").textContent(), /ROCKFALL/);
  assert.match(
    await p.locator("#rockfall-result").textContent(),
    /miss the party/,
  );
  const hp = await p.evaluate(() => state.party[0].hp);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.party[0].hp), hp);
  await p.evaluate(() => {
    state.steps += 20;
    Math.random = () => 0;
    window.testAction = minorTravelEvent(state.map[state.position]);
  });
  await p.waitForSelector("#body-leave");
  await p.locator("#body-leave").click();
  await p.evaluate(() => window.testAction);
  assert.equal(await p.evaluate(() => state.gold), 0);
  assert.equal(
    await p.evaluate(() => state.map[state.position].corpses.at(-1).kind),
    "fighter",
  );
});

test("outer reels cannot acquire class seals and blank inscription uses the class affinity price", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.points = 50;
    h.reels[0][0] = { type: "stun", tier: 1, weight: 9 };
    editFace("0,0,0", "swap", "blank");
    const outer = h.reels[0][0].type;
    closeModal();
    const f = h.reels[2].findIndex((s) => s.type === "blank"),
      before = h.points;
    editFace("0,2," + f, "upgrade");
    const spent = before - h.points;
    return {
      outer,
      spent,
      seals: h.reels.map((r) => r.filter((f) => f.type === "class").length),
    };
  });
  assert.equal(r.outer, "blank");
  assert.equal(r.spent, 2);
  assert.deepEqual(r.seals, [0, 1, 0]);
});

test("idle callouts wait for another companion and floor turns fade obsolete hints", async (t) => {
  const p = await game(t);
  await fast(p);
  const r = await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    render();
    sayHero(0, "idle");
    sayHero(1, "idle");
    const bubbles = document.querySelectorAll(".speech-bubble").length;
    const hint = document.createElement("div");
    hint.className = "discovery-whisper";
    document.body.append(hint);
    state.exitFound = state.exitReached = state.floorBossDefeated = true;
    stairs();
    return { bubbles };
  });
  assert.equal(r.bubbles, 1);
  await p.locator("#descend").click();
  await p.waitForTimeout(200);
  assert.equal(await p.locator(".discovery-whisper").count(), 0);
});

test("a flurry's own critical lands three base blades then a separate bonus against every enemy", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party = [makeHero("Wren", "rogue")];
    beginEncounter(false, { count: 2 });
    state.enemies.forEach((e) =>
      Object.assign(e, { hp: 1000, maxHp: 1000, countdown: 100, block: 0 }),
    );
    state.party[0].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "class", tier: 1, job: "rogue" }],
      [{ type: "attack", tier: 2 }],
    ];
    Math.random = () => 0;
    render();
  });
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  const r = await p.evaluate(() => ({
    roll: state.lastPlayerRoll,
    hp: state.enemies.map((e) => e.hp),
    crit: state.party[0].stats.criticals,
  }));
  assert.equal(r.roll.multiplier, 1);
  assert.equal(r.roll.flurryMultiplier, 2);
  assert.equal(r.roll.area, true);
  assert.deepEqual(r.hp, [991, 991]);
  assert.equal(r.crit, 1);
  assert.deepEqual(
    r.roll.hits
      .filter((h) => h.enemyId === r.roll.targets[0])
      .map((h) => h.power),
    [3, 1, 1, 1, 3],
  );
});

test("reloading before the starting class choice keeps the choice pending", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    localStorage.clear();
  });
  await p.reload();
  await p.waitForSelector('[data-start-job="rogue"]');
  await p.reload();
  assert.equal(await p.locator(".starter-grid button").count(), 6);
  await p.locator('[data-start-job="rogue"]').click();
  await p.reload();
  assert.equal(await p.evaluate(() => state.party[0].job), "rogue");
  assert.equal(await p.locator("#overlay").isVisible(), false);
});

test("an unresolved discovery interrupted by a pursuer remains usable on the current tile", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.map[state.position].event = "treasure";
    state.map[state.position].feature = "treasure";
    Math.random = () => 0.5;
    render();
  });
  await p.locator('[data-tile="78"]').click();
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.locator("#stage-title").textContent(), "Treasure!");
  await p.locator("#stage-confirm").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.map[state.position].event), null);
  assert.ok(await p.evaluate(() => state.gold > 0));
});

test("a pursuer-interrupted staircase can challenge its guardian from the current tile", async (t) => {
  const p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.map[78].event = "stairs";
    state.map[78].feature = "stairs";
    state.exitFound = true;
    state.exitReached = false;
    render();
  });
  await p.locator('[data-tile="78"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.enemy?.boss), true);
  assert.equal(await p.evaluate(() => state.exitReached), true);
});

test("victory coins burst and keep pouring from the visible summary, rather than an old hidden event", async (t) => {
  const p = await game(t);
  await fast(p);
  const r = await p.evaluate(() => {
    particles = [];
    // A victory is a tenth-floor event; its coins now represent the deposit.
    state.depth = 10;
    state.floorBossDefeated = true;
    finishVictory();
    const coins = particles.filter((p) => p.kind === "coin");
    return {
      count: coins.length,
      inside: coins.every(
        (p) => p.x > 100 && p.x < innerWidth - 100 && p.y > 80,
      ),
      rain: !!coinRain,
    };
  });
  assert.ok(r.count > 200);
  assert.equal(r.inside, true);
  assert.equal(r.rain, true);
  await p.waitForTimeout(130);
  assert.equal(await p.evaluate(() => !!coinRain), true);
});

test("deep enemy reels improve with depth and the final guardian actually rolls three top-tier strikes", async (t) => {
  const p = await game(t);
  await fast(p);
  const powers = await p.evaluate(() =>
    [1, 5, 9].map((depth) =>
      enemyReels("skull", depth)[0]
        .filter((f) => f.type === "attack")
        .map((f) => f.tier),
    ),
  );
  assert.ok(Math.min(...powers[1]) > Math.min(...powers[0]));
  assert.equal(Math.max(...powers[2]), 4);
  const boss = await p.evaluate(() => {
    state.depth = 10;
    beginEncounter(true, { stairBoss: true });
    render();
    return {
      damage: state.enemy.damage,
      strikes: state.enemy.strikes,
      frequency: state.enemy.frequency,
      expectedClock: Math.max(1, floorBalance(10).bossFrequency - (state.enemy.affix === "Frenzied" ? 1 : 0)),
      faces: state.enemy.reels.flat(),
      preview: state.enemy.last,
    };
  });
  assert.deepEqual([boss.damage, boss.strikes], [14, 3]);
  assert.equal(boss.frequency,boss.expectedClock);
  assert.ok(
    boss.faces.every(
      (f) => f.tier === (["attack", "magic"].includes(f.type) ? 4 : 3),
    ),
  );
  assert.ok(
    boss.preview.every(
      (f) => f.tier === (["attack", "magic"].includes(f.type) ? 4 : 3),
    ),
    "the ready-state machine shows the upgraded faces before its first roll",
  );
  const strikes = await p.evaluate(async () => {
    state.party[0].hp = state.party[0].maxHp = 1000;
    state.enemy.reels = [
      [{ type: "attack", tier: 4 }],
      [{ type: "magic", tier: 4 }],
      [{ type: "block", tier: 3 }],
    ];
    const original = runMachine;
    let rolls = 0;
    runMachine = (...args) => {
      if (args[0] === "enemy") rolls++;
      return original(...args);
    };
    try {
      await enemyTurn(state.enemy);
    } finally {
      runMachine = original;
    }
    return { rolls, damage: 1000 - state.party[0].hp };
  });
  assert.deepEqual(strikes, { rolls: 3, damage: 36 });
});

test("version-nine fights adopt the stronger enemy curve without changing hero wounds or edited reels", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.depth = 10;
    beginEncounter(true);
    state.version = 9;
    state.party[0].hp = 17;
    state.party[0].maxHp = 48;
    state.party[0].reels[0][0].tier = 4;
    state.enemy.hp = 123;
    state.enemy.damage = state.enemy.strikes = 1;
    state.enemy.countdown = 1;
    state.enemy.reels = enemyReels(state.enemy.art);
    delete state.autoplay;
    save();
  });
  await p.reload();
  assert.deepEqual(
    await p.evaluate(() => ({
      version: state.version,
      autoplay: state.autoplay,
      heroHp: state.party[0].hp,
      face: state.party[0].reels[0][0].tier,
      enemyHp: state.enemy.hp,
      damage: state.enemy.damage,
      strikes: state.enemy.strikes,
      clock: state.enemy.countdown,
      tiers: state.enemy.reels
        .flat()
        .filter((f) => ["attack", "magic"].includes(f.type))
        .map((f) => f.tier),
    })),
    {
      version: 22,
      autoplay: false,
      heroHp: 19,
      face: 4,
      enemyHp: 123,
      damage: 14,
      strikes: 3,
      clock: 1,
      tiers: [4, 4, 4, 4, 4, 4, 4, 4, 4],
    },
  );
});

test("autoplay chooses only reachable frontiers, pauses in player menus and stops a long walk when disabled", async (t) => {
  const p = await game(t);
  await p.evaluate(blankFloor);
  assert.equal(
    await p.evaluate(() => {
      const goal = autoplayGoal(),
        route = shortestPath(goal);
      state.map[goal].wall = true;
      state.map[goal].event = "stairs";
      return (
        goal === autoplayGoal() &&
        !state.map[goal].seen &&
        route.slice(0, -1).every((i) => state.map[i].seen)
      );
    }),
    true,
    "hidden terrain and event metadata cannot guide autoplay",
  );
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.map.forEach((c) => (c.seen = true));
    const stair = state.map[pos(9, 7)];
    stair.event = "stairs";
    stair.bossDefeated = true;
    state.floorBossDefeated = true;
    state.exitFound = true;
    help();
    setAutoplay(true);
  });
  await p.waitForTimeout(550);
  assert.equal(
    await p.evaluate(() => state.steps),
    0,
    "an open guide pauses exploration",
  );
  await p.evaluate(() => closeModal());
  await p.waitForFunction(() => state.steps >= 1);
  await p.evaluate(() => help());
  await finish(p);
  const paused = await p.evaluate(() => state.steps);
  assert.ok(
    paused < 8,
    "opening the guide interrupts an autonomous route after its current step",
  );
  await p.waitForTimeout(450);
  assert.equal(await p.evaluate(() => state.steps), paused);
  await p.evaluate(() => closeModal());
  await p.waitForFunction((steps) => state.steps > steps, paused);
  await p.locator("#autoplay").uncheck();
  await finish(p);
  const stopped = await p.evaluate(() => state.steps);
  assert.ok(
    stopped < 8,
    "disabling autoplay ends the route before the staircase",
  );
  await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => state.steps), stopped);
  assert.equal(await p.evaluate(() => state.autoresolve), false);
});

test("autoplay without Autofight waits at an encounter instead of spinning a hero", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  await p.evaluate(() => {
    state.map.forEach((c) => (c.seen = true));
    state.map[pos(2, 7)].event = "enemy";
    state.map[pos(3, 7)].event = "stairs";
    state.exitFound = true;
    setAutoplay(true);
  });
  await p.waitForSelector("#stage-confirm");
  await p.waitForTimeout(650);
  assert.equal(await p.evaluate(() => state.party[0].stats.spins), 0);
  assert.equal(await p.locator("#spotlight").isVisible(), true);
  await p.locator("#autoplay").uncheck();
});

test("Autoplay and Autofight handle discoveries, recruit, descend and win without test-driven button clicks", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    // A short two-floor fixture exercises actual rolls, movement, guardian
    // fights and rewards. Boost hero power to test the workflow independently
    // of luck; no test observer clicks buttons or drives the autoplay loop.
    const original = generateFloor;
    generateFloor = (depth) => {
      const map = original(depth);
      state.pursuerSpawned = true;
      state.lastMinorEventStep = state.steps + 10000;
      map.forEach((c, i) =>
        Object.assign(c, {
          wall: Math.floor(i / W) !== 7 || i % W < 1 || i % W > 9,
          seen:
            Math.floor(i / W) !== 7 ||
            i % W < 1 ||
            i % W > 9 ||
            i === pos(1, 7),
          event: null,
          feature: null,
          room: null,
          terrain: "floor",
          activated: false,
        }),
      );
      for (const [x, type] of depth === 9
        ? [
            [2, "treasure"],
            [3, "trap"],
            [4, "recruit"],
            [5, "well"],
            [6, "shop"],
            [8, "enemy"],
          ]
        : [])
        map[pos(x, 7)].event = map[pos(x, 7)].feature = type;
      map[pos(9, 7)].event = map[pos(9, 7)].feature = "stairs";
      map[pos(9, 7)].bossDefeated = false;
      return map;
    };
    state.depth = 9;
    state.map = generateFloor(9);
    state.position = pos(1, 7);
    state.party[0].hp = 19900;
    state.party[0].maxHp = 20000;
    state.party[0].reels = [
      [{ type: "attack", tier: 4 }],
      [{ type: "magic", tier: 4 }],
      [{ type: "block", tier: 1 }],
    ];
    state.artefacts = [
      {
        id: "workflow-power",
        key: "attack",
        power: 1000,
        name: "Test power",
        depth: 9,
      },
    ];
    state.equippedArtefact = "workflow-power";
    window.autoplayScenes = [];
    new MutationObserver(() => {
      if (!document.querySelector("#spotlight").hidden)
        window.autoplayScenes.push(
          document.querySelector("#spotlight").dataset.kind,
        );
    }).observe(document.querySelector("#spotlight"), { attributes: true });
    render();
  });
  await p.locator("#autoresolve").check();
  await p.locator("#autoplay").check();
  await p.waitForFunction(() => state.over, null, { timeout: 90000 });
  assert.equal(await p.evaluate(() => state.won), true);
  assert.equal(await p.evaluate(() => state.depth), 10);
  assert.ok(
    await p.evaluate(
      () =>
        state.party.length + state.graveyard.length + state.retired.length > 1,
    ),
    "the recruited adventurer remains in the living or fallen expedition roster",
  );
  const scenes = await p.evaluate(() => [...new Set(window.autoplayScenes)]);
  for (const type of ["treasure", "trap", "recruit", "well", "enemy-intro"])
    assert.ok(
      scenes.includes(type),
      `${type} resolved without manual input: ${scenes}`,
    );
  assert.match(
    await p.locator("#modal-title").textContent(),
    /YOU WROTE THE ENDING!/,
  );
});

test("autoplay settings persist through fresh runs and reloads without bypassing starting-class selection", async (t) => {
  const p = await game(t);
  await p.locator("#options-tab").click();
  await p.locator("#option-autoplay").check();
  assert.equal(await p.locator("#autoplay").isChecked(), true);
  await p.evaluate(() => {
    newRun("rogue");
    state.awaitingStarter = true;
    save();
  });
  await p.reload();
  assert.equal(await p.locator("#autoplay").isChecked(), true);
  assert.equal(await p.evaluate(() => state.autoplay), true);
  await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => state.steps), 0);
  assert.equal(await p.locator("[data-start-job]").count(), 3);
  await p.locator("#autoplay").uncheck();
  await p.reload();
  assert.equal(await p.evaluate(() => state.autoplay), false);
});

test("autoplay resolves a full satchel, class equipment, revives and permanent deaths, then leaves the final summary open", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    busy = true;
    state.bag = { potion: 1, bomb: 1, ward: 1 };
    state.party.push(makeHero("Second tank", "fighter"));
    state.pendingItems = [
      { type: "ironSignet", count: 3 },
      { type: "bulwarkBadge", count: 1 },
    ];
    setAutoplay(true);
  });
  await p.evaluate(() => processPendingItems());
  assert.equal(await p.evaluate(() => state.party[0].equipment), "ironSignet");
  assert.equal(
    await p.evaluate(() => state.party[1].equipment),
    "ironSignet",
    "the empty matching slot is chosen instead of replacing the first hero's gear",
  );
  assert.equal(await p.evaluate(() => state.pendingItems.length), 0);
  await p.evaluate(() => {
    state.party = state.party.slice(0, 1);
    state.party.push(makeHero("Mira", "healer"));
    state.artefacts.push({
      id: "auto-revive",
      key: "revive",
      name: "Revive Stone",
      power: 1,
    });
    render();
    damageHero(1, 999, "A test ambush");
  });
  await p.evaluate(() => processDeaths());
  assert.equal(await p.evaluate(() => state.party[1].hp), 21);
  assert.equal(
    await p.evaluate(() => state.artefacts.some((a) => a.key === "revive")),
    false,
  );
  await p.evaluate(async () => {
    damageHero(1, 999, "Another ambush");
    await processDeaths();
  });
  assert.equal(await p.evaluate(() => state.party.length), 1);
  assert.equal(await p.evaluate(() => state.graveyard.length), 1);
  await p.evaluate(async () => {
    damageHero(0, 999, "The last ambush");
    await processDeaths();
    checkDefeat();
  });
  assert.equal(await p.evaluate(() => state.over && !state.won), true);
  assert.equal(await p.evaluate(() => modalKind), "defeat");
  await p.waitForTimeout(400);
  assert.equal(await p.locator("#overlay").isVisible(), true);
});

test("decision rules price off-role upgrades and conversions consistently and preserve class seals", async (t) => {
  const p = await game(t);
  const data = await p.evaluate(() => {
    const fighter = state.party[0],
      healer = makeHero("Mira", "healer"),
      mage = makeHero("Orin", "mage");
    const face = { type: "heal", tier: 1 };
    const prices = [
      faceUpgradeCost(face, fighter),
      faceUpgradeCost(face, healer),
      faceUpgradeCost(face, mage),
      faceUpgradeCost({ type: "attack", tier: 1 }, mage),
    ];
    fighter.points = 50;
    fighter.reels[0] = [
      { type: "heal", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    fighter.last[0] = { type: "heal", tier: 1 };
    const before = fighter.points;
    editFace("0,0,0", "upgrade");
    const label = document.querySelector('[data-upgrade="0,0,0"]').textContent;
    closeModal();
    const cost = faceEditCost(fighter, 0, 1, "cycle");
    applyFaceEdit(fighter, 0, 1, "cycle");
    return {
      prices,
      spent: before - fighter.points,
      tier: fighter.reels[0][0].tier,
      label,
      changeCost: cost,
      newType: fighter.reels[0][1].type,
      seals: fighter.reels.map(
        (r) => r.filter((f) => f.type === "class").length,
      ),
    };
  });
  assert.deepEqual(data.prices, [6, 3, 3, 6]);
  assert.equal(data.spent, 11);
  assert.equal(data.tier, 2);
  assert.ok(data.label.includes("12 pts"));
  assert.equal(data.changeCost, 5);
  assert.deepEqual(data.seals, [0, 1, 0]);
});

test("decision rules spend real personal points on useful edits and equip only better matching gear", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    state.map.forEach((c) => {
      c.seen = true;
      c.event = null;
    });
    const h = state.party[0];
    h.points = 28;
    const before = autoUpgradeValue(h),
      points = h.points;
    const changed = autoUpgradeHero(h),
      after = autoUpgradeValue(h);
    state.party.push(makeHero("Mira", "healer"));
    state.bag = { ironSignet: 1, glassRosary: 1 };
    render();
    await autoMaintainParty();
    await autoMaintainParty();
    return {
      changed,
      before,
      after,
      spent: points - h.points,
      gear: state.party.map((h) => h.equipment),
      duplicate: autoGearTarget("ironSignet"),
      wrong: autoGearValue("starLens", h),
      seals: h.reels.map((r) => r.filter((f) => f.type === "class").length),
      bag: Object.keys(state.bag),
    };
  });
  assert.ok(
    r.changed > 0 && r.spent > 0 && r.spent <= 28 && r.after > r.before,
  );
  assert.deepEqual(r.gear, ["ironSignet", "glassRosary"]);
  assert.equal(r.duplicate, -1);
  assert.equal(r.wrong, 0);
  assert.deepEqual(r.seals, [0, 1, 0]);
  assert.deepEqual(r.bag, []);
});

test("decision rules pursue visible treasure, save an efficient well and return when wounded", async (t) => {
  const p = await game(t);
  await p.evaluate(blankFloor);
  const r = await p.evaluate(() => {
    state.map.forEach((c) => {
      if (!c.wall) c.seen = true;
    });
    const treasure = pos(3, 7),
      well = pos(2, 7),
      stairs = pos(9, 7);
    state.map[treasure].event = "treasure";
    state.map[well].event = "well";
    state.map[stairs].event = "stairs";
    const h = state.party[0];
    h.hp = h.maxHp - 1;
    const healthy = autoplayGoal(),
      declined = !autoNeedsWell();
    state.map[treasure].event = null;
    h.hp = 10;
    const wounded = autoplayGoal();
    state.bag = { potion: 1 };
    const savePotion = autoItemPlan();
    return { healthy, wounded, treasure, well, declined, savePotion };
  });
  assert.equal(r.healthy, r.treasure);
  assert.equal(r.wounded, r.well);
  assert.equal(r.declined, true);
  // At critical HP supplies may be used before risking the walk to a well.
  assert.equal(r.savePotion.type, "potion");
});

test("decision rules choose healing, damage and shielding from actual wheels instead of always reusing one class", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const damage = state.party[0],
      heal = makeHero("Mira", "healer"),
      shield = makeHero("Wren", "rogue");
    state.party = [damage, heal, shield];
    beginEncounter();
    const set = (h, type, tier) => {
      h.reels = [0, 1, 2].map(() => [{ type, tier }]);
    };
    set(damage, "attack", 1);
    set(heal, "heal", 2);
    set(shield, "block", 3);
    state.enemy.hp = state.enemy.maxHp = 200;
    state.enemy.countdown = 3;
    state.enemy.damage = 10;
    const pick = () =>
      state.party
        .slice()
        .sort((a, b) => autoCombatScore(b) - autoCombatScore(a))[0].name;
    const attack = pick();
    damage.hp = 7;
    const healing = pick();
    damage.hp = damage.maxHp;
    state.enemy.countdown = 1;
    const protection = pick();
    state.block = 100;
    const protectedPick = pick();
    heal.stun = 1;
    damage.hp = 7;
    const noStunned = pick() !== heal.name;
    return {
      attack,
      healing,
      protection,
      protectedPick,
      noStunned,
      names: state.party.map((h) => h.name),
    };
  });
  assert.equal(r.attack, r.names[0]);
  assert.equal(r.healing, r.names[1]);
  assert.equal(r.protection, r.names[2]);
  assert.equal(r.protectedPick, r.names[0]);
  assert.equal(r.noStunned, true);
});

test("decision rules use targeted emergency healing, antidotes, buffs and offensive supplies without wasting a tonic", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    beginEncounter();
    state.enemy.hp = 200;
    state.enemy.countdown = 1;
    const h = state.party[1];
    state.bag = { potion: 1 };
    h.hp--;
    const conserve = autoItemPlan();
    h.hp = 4;
    const emergency = autoItemPlan();
    h.hp = h.maxHp;
    h.poison = { turns: 5, damage: 2 };
    state.bag = { antidote: 1 };
    const poison = autoItemPlan();
    h.poison = null;
    state.bag = { oil: 1 };
    const buff = autoItemPlan();
    state.bag = { venom_3: 1 };
    const venom = autoItemPlan();
    state.enemy.poison = { turns: 5, damage: 2 };
    const duplicate = autoItemPlan();
    return { conserve, emergency, poison, buff, venom, duplicate };
  });
  assert.equal(r.conserve, null);
  assert.equal(r.emergency.target, 1);
  assert.equal(r.poison.target, 1);
  assert.equal(r.buff.type, "oil");
  assert.equal(r.venom.type, "venom_3");
  assert.equal(r.duplicate, null);
});

test("fixed supply variants keep their acquired power across floors and deeper loot and shops offer better IDs", async (t) => {
  const p = await game(t);
  await fast(p);
  await encounter(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      e = state.enemy;
    e.passive = null;
    const hits = [];
    for (const depth of [1, 10]) {
      state.depth = depth;
      const before = e.hp;
      state.bag = { firebomb: 1 };
      await useItem("firebomb");
      hits.push(before - e.hp);
    }
    const better = lootItemForDepth("firebomb", 7),
      before = e.hp;
    state.bag = { [better]: 1 };
    await useItem(better);
    const power = before - e.hp;
    state.enemy = null;
    state.enemies = [];
    state.depth = 7;
    const types = lootFaces()
      .filter((f) => ITEM_DEFS[f.type])
      .map((f) => f.type);
    state.bag = { potion_2: 1 };
    h.hp = 1;
    await useItem("potion_2");
    return {
      hits,
      power,
      better,
      hp: h.hp,
      base: ITEM_DEFS.firebomb.damage,
      types,
      quality: ITEM_DEFS[better].quality,
    };
  });
  assert.deepEqual(r.hits, [10, 10]);
  assert.equal(r.power, 23);
  assert.equal(r.better, "firebomb_3");
  assert.equal(r.hp, 25);
  assert.equal(r.quality, 3);
  assert.ok(r.types.includes("potion_3"));
  assert.ok(!r.types.includes("potion"));
});

test("enemy identities have thematic wheels and health differences without losing final guardian top-tier multi-strikes", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const faces = (art) =>
      enemyReels(art, 5)
        .flat()
        .map((f) => f.type);
    return {
      slime: enemyBalance(2, { species: "slime" }).maxHp,
      ghost: enemyBalance(2, { species: "ghost" }).maxHp,
      ghostFaces: faces("ghost"),
      widow: faces("widow"),
      slimeFaces: faces("slime"),
      demon: faces("demon"),
      boss: enemyBalance(10, { boss: true }),
      final: enemyReels("lich", 10, { boss: true }).flat(),
    };
  });
  assert.ok(r.slime > r.ghost * 1.5);
  assert.ok(!r.ghostFaces.includes("attack"));
  assert.ok(
    r.widow.filter((t) => t === "poison").length >
      r.widow.filter((t) => t === "attack").length,
  );
  assert.ok(r.slimeFaces.includes("heal") && r.slimeFaces.includes("block"));
  assert.ok(r.demon.includes("stimulant"));
  assert.equal(r.boss.strikes, 3);
  assert.ok(
    r.final.every(
      (f) => f.tier === (["attack", "magic"].includes(f.type) ? 4 : 3),
    ),
  );
});

test("enemy passives heal once, resist hits, split once and summon only into a free second slot", async (t) => {
  const p = await game(t);
  await fast(p);
  await encounter(p);
  const r = await p.evaluate(() => {
    const e = state.enemy;
    state.depth = 8;
    e.hp = e.maxHp = 100;
    e.block = 0;
    e.passive = { key: "secondWind", used: false, turns: 0 };
    damageEnemy(75, "Test", e);
    const healed = e.hp;
    damageEnemy(25, "Test", e);
    const onlyOnce = e.hp;
    e.hp = 100;
    e.passive = { key: "carapace" };
    const armour = damageEnemy(10, "Test", e);
    e.hp = e.maxHp = 100;
    e.passive = { key: "split", used: false };
    damageEnemy(1000, "Test", e);
    const fragment = { hp: e.hp, small: e.fragment, name: e.name };
    damageEnemy(1000, "Test", e);
    const dead = e.hp;
    e.hp = e.maxHp = 100;
    e.fragment = false;
    e.passive = { key: "summoner", turns: 0 };
    tickEnemyPassive(e);
    tickEnemyPassive(e);
    const early = state.enemies.length;
    tickEnemyPassive(e);
    const called = state.enemies[1];
    for (let i = 0; i < 6; i++) tickEnemyPassive(e);
    const cap = state.enemies.length;
    called.hp = 0;
    tickEnemyPassive(e);
    const reused = state.enemies.length;
    return {
      healed,
      onlyOnce,
      armour,
      fragment,
      dead,
      early,
      cap,
      reused,
      called: !!called.summoned,
      alive: livingEnemies().length,
    };
  });
  assert.equal(r.healed, 50);
  assert.equal(r.onlyOnce, 25);
  assert.equal(r.armour, 8);
  assert.equal(r.fragment.hp, 35);
  assert.equal(r.fragment.small, true);
  assert.equal(r.dead, 0);
  assert.equal(r.early, 1);
  assert.equal(r.called, true);
  assert.equal(r.cap, 2);
  assert.equal(r.reused, 2);
  assert.equal(r.alive, 2);
});

test("combat cleanup clears stun, grace, poison and buffs including their portrait badges", async (t) => {
  const p = await game(t);
  await encounter(p);
  const r = await p.evaluate(() => {
    const all = [state.party[0], state.enemy];
    for (const h of all) {
      h.stun = 2;
      h.stunGrace = 1;
      h.poison = { turns: 4, damage: 1 };
      h.rage = 3;
      h.stimulant = { turns: 3, power: 2 };
    }
    render();
    clearBattleStatuses();
    return {
      clear: all.every(
        (h) => !h.stun && !h.stunGrace && !h.poison && !h.rage && !h.stimulant,
      ),
      badges: document.querySelectorAll(".poison-badge,.buff-badge,.rage-badge")
        .length,
      text: document.querySelector("#hero-0 .injury").textContent,
    };
  });
  assert.equal(r.clear, true);
  assert.equal(r.badges, 0);
  assert.notEqual(r.text, "stunned");
});

test("the pursuer advances for every actual tile of a long movement", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(async () => {
    newRun();
    setPace("skip");
    state.depth = 4;
    state.map.forEach((c, i) => {
      const x = i % W,
        y = Math.floor(i / W);
      c.wall = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      c.seen = true;
      c.event = null;
      c.feature = null;
      c.room = null;
      c.fogged = false;
    });
    minorTravelEvent = async () => false;
    state.pursuerSpawned = true;
    state.pursuer = { position: pos(9, 1), beat: 0 };
    render();
    await move(pos(5, 7));
  });
  assert.equal(await p.evaluate(() => state.steps), 4);
  assert.equal(await p.evaluate(() => state.pursuer.beat), 4);
  assert.equal(
    await p.evaluate(
      () =>
        Math.abs((state.pursuer.position % W) - 9) +
        Math.abs(Math.floor(state.pursuer.position / W) - 1),
    ),
    4,
  );
});

test("floor clear fanfare waits for confirmation and records this floor's statistics only once", async (t) => {
  const p = await game(t);
  await fast(p);
  await startEval(
    p,
    `state.steps=12;state.battlesWon=3;state.gold=42;state.party[0].stats.damageDealt=70;state.party[0].stats.xpEarned=18;celebrateFloorClear()`,
  );
  await p.waitForSelector("#stage-confirm");
  assert.ok(
    (await p.locator("#stage-title").textContent()).includes("FLOOR 1 CLEARED"),
  );
  assert.ok((await p.locator(".floor-summary").textContent()).includes("70"));
  await p.waitForTimeout(400);
  assert.equal(await p.locator("#spotlight").isVisible(), true);
  assert.ok(await p.evaluate(() => particles.length > 0));
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => testAction);
  assert.equal(await p.evaluate(() => state.floorClears.length), 1);
  assert.equal(await p.evaluate(() => recordFloorClear().xp), 18);
  assert.equal(await p.evaluate(() => state.floorClears.length), 1);
});

test("Autofight confirms its own ink bomb roll even when exploration autoplay is off", async (t) => {
  const p = await game(t);
  await fast(p);
  await encounter(p, { hp: 300, countdown: 1 });
  await p.evaluate(() => {
    state.bag = { bomb: 1 };
    state.autoplay = false;
    state.autoresolve = true;
    state.lastAutoItemAction = -10;
    state.party[0].hp = state.party[0].maxHp = 1000;
  });
  await p.waitForFunction(() => state.lastItemRoll?.type === "bomb", null, {
    timeout: 15000,
  });
  await p.waitForFunction(() => document.querySelector("#spotlight").hidden);
  await p.evaluate(() => setAutoresolve(false));
  await finish(p);
  assert.equal(await p.evaluate(() => state.bag.bomb || 0), 0);
  assert.equal(await p.evaluate(() => state.party[0].stats.itemsUsed), 1);
});

test("autoplay shops for needed healing and a map, claims better full-bag supplies and can replace a duplicate role", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    busy = true;
    state.party[0].hp = 7;
    state.gold = 1000;
    setAutoplay(true);
    window.shopping = shopEncounter({ shop: { heal: 1, reveal: 1 } });
  });
  await p.evaluate(() => shopping);
  assert.equal(await p.evaluate(() => state.party[0].hp), 50);
  assert.equal(await p.evaluate(() => state.gold), 744);
  assert.equal(await p.evaluate(() => state.exitFound), true);
  await p.evaluate(async () => {
    state.bag = { potion: 1, ward: 1, antidote: 1 };
    state.pendingItems = [{ type: "potion_3", count: 1 }];
    await processPendingItems();
  });
  assert.equal(await p.evaluate(() => state.bag.potion_3), 1);
  assert.equal(await p.evaluate(() => Object.keys(state.bag).length), 3);
  const replacement = await p.evaluate(() => {
    state.party = [
      makeHero("A", "fighter", null, [], { specialism: "offence" }),
      makeHero("B", "fighter", null, [], { specialism: "offence" }),
      makeHero("C", "fighter", null, [], { specialism: "offence" }),
    ];
    recruitOffer = makeHero("Mira", "healer");
    const wanted = autoReplacement();
    recruitOffer = makeHero("D", "fighter", null, [], {
      specialism: "offence",
    });
    const declined = autoReplacement();
    recruitOffer = null;
    return { wanted, declined };
  });
  assert.ok(replacement.wanted >= 0);
  assert.equal(replacement.declined, -1);
  await p.evaluate(() => {
    setAutoplay(false);
    busy = false;
  });
});

test("summoned allies keep combat active and do not lose a defeated guardian's floor-clear reward", async (t) => {
  const p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(() => {
    state.depth = 5;
    state.floorStart = floorSnapshot();
    beginEncounter(true, { stairBoss: true });
    const boss = state.enemy;
    boss.hp = 1;
    boss.block = 0;
    boss.passive = { key: "summoner", turns: 2 };
    tickEnemyPassive(boss);
    const ally = state.enemies[1];
    ally.hp = 1;
    ally.block = 0;
    ally.countdown = 20;
    boss.countdown = 20;
    state.party[0].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "block", tier: 1 }],
      [{ type: "blank", tier: 1 }],
    ];
    render();
  });
  await p.evaluate(() => spin(0));
  assert.equal(await p.evaluate(() => !!state.enemy), true);
  assert.equal(await p.evaluate(() => state.floorBossDefeated), false);
  await p.evaluate(() => spin(0));
  assert.equal(await p.evaluate(() => state.enemy), null);
  assert.equal(await p.evaluate(() => state.floorBossDefeated), true);
  assert.equal(await p.evaluate(() => state.floorClears[0].depth), 5);
});

test("preferences pages provide functioning volume, light, shake and critical controls with persistent preview selections", async (t) => {
  const p = await game(t);
  await p.locator("#options-tab").click();
  await p.locator("#setting-skipCriticals").check();
  await p.locator("#tab-display").click();
  await p.locator("#setting-ambientEffects").uncheck();
  await p.locator("#setting-brightness").fill("80");
  await p.locator("#setting-shake").fill("0");
  assert.equal(await p.locator("#value-brightness").textContent(), "80%");
  assert.equal(
    await p.evaluate(
      () => getComputedStyle(document.querySelector(".ambient-light")).display,
    ),
    "none",
  );
  assert.equal(
    await p.evaluate(
      () =>
        getComputedStyle(document.querySelector("#screen-lighting"))
          .backdropFilter,
    ),
    "brightness(0.8)",
  );
  const shakes = await p.evaluate(() => {
    const el = document.querySelector("#modal");
    el.getAnimations().forEach((a) => a.cancel());
    shakeElement(el, 10);
    return el.getAnimations().length;
  });
  assert.equal(shakes, 0);
  await p.locator("#tab-audio").click();
  for (const [key, n] of [
    ["masterVolume", 45],
    ["sfxVolume", 25],
    ["musicVolume", 10],
    ["ambienceVolume", 5],
  ])
    await p.locator("#setting-" + key).fill(String(n));
  await p.locator("#setting-muted").check();
  await p.locator("#tab-future").click();
  await p.locator("#setting-language").selectOption("fr");
  await p.locator("#setting-resolution").selectOption("1280x800");
  await p.locator("#setting-displayMode").selectOption("borderless");
  assert.match(
    await p.locator(".settings-note").textContent(),
    /not active yet/,
  );
  assert.equal(await p.locator("#modal-title").textContent(), "Options");
  const settings = await p.evaluate(() => ({ ...state.preferences }));
  await p.evaluate(() => {
    closeModal();
    newRun("mage");
  });
  await p.reload();
  assert.deepEqual(await p.evaluate(() => state.preferences), settings);
  const safe = await p.evaluate(() =>
    normalisePreferences({
      brightness: 9,
      shake: -3,
      masterVolume: NaN,
      language: "bad",
      muted: "false",
    }),
  );
  assert.equal(safe.brightness, 1.5);
  assert.equal(safe.shake, 0);
  assert.equal(safe.masterVolume, 0.7);
  assert.equal(safe.language, "en");
  assert.equal(safe.muted, false);
  await p.evaluate(() => {
    optionsPage("display");
    setAutoresolve(true);
    setAutoplay(true);
  });
  await p.locator("#option-reset").click();
  assert.deepEqual(
    await p.evaluate(() => state.preferences),
    await p.evaluate(() => ({ ...DEFAULT_PREFERENCES })),
  );
  assert.equal(
    await p.evaluate(() => state.autoplay || state.autoresolve),
    false,
  );
  assert.equal(await p.evaluate(() => state.speed), "1");
});

test("critical visuals can be skipped without changing the rolled multiplier, calculations or RNG", async (t) => {
  const p = await game(t);
  await fast(p);
  const r = await p.evaluate(async () => {
    const symbols = [0, 1, 2].map(() => ({ type: "heal", tier: 4 }));
    let calls = 0;
    const random = Math.random;
    Math.random = () => {
      calls++;
      return 0.8;
    };
    setPreference("skipCriticals", true);
    const hiddenBefore = document.querySelector("#spotlight").hidden;
    const value = await rollCritical("Mira", symbols, false, {
      details: [{ label: "Healing", icon: "heal", value: 24 }],
    });
    const combat = {
      hidden: document.querySelector("#spotlight").hidden,
      record: structuredClone(state.lastCritical),
    };
    showSpotlight("Treasure", "A chest", criticalSpace(), "treasure");
    const inline = await rollCritical(
      "Treasure",
      [0, 1, 2].map(() => ({ type: "coin", tier: 1 })),
      false,
      {
        context: "treasure",
        details: [{ label: "Gold", icon: "coin", value: 12 }],
      },
    );
    const active = document.querySelectorAll(".active-critical").length;
    const kept = document.querySelector("#spotlight").dataset.kind;
    closeSpotlight();
    Math.random = random;
    return { value, inline, hiddenBefore, combat, active, kept, calls };
  });
  assert.equal(r.value, 4);
  assert.equal(r.inline, 4);
  assert.equal(r.calls, 2);
  assert.equal(r.hiddenBefore, true);
  assert.equal(r.combat.hidden, true);
  assert.equal(r.combat.record.finalEffects[0].value, 96);
  assert.equal(r.active, 0);
  assert.equal(r.kept, "treasure");
});

test("audio synthesises bounded offline cues after a gesture and honours independent volumes and mute", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    setPreference("musicVolume", 0);
    setPreference("ambienceVolume", 0);
  });
  await p.locator("#options-tab").click();
  await p.locator("#tab-audio").click();
  await p.locator("#sound-preview").click();
  await p.waitForFunction(() => GameSound.context?.state === "running");
  const r = await p.evaluate(() => {
    let randomCalls = 0;
    const random = Math.random;
    Math.random = () => {
      randomCalls++;
      return 0.5;
    };
    const before = GameSound.stats.played;
    for (const key of Object.keys(SOUND_CUES)) GameSound.play(key);
    for (let n = 0; n < 50; n++) {
      GameSound.play("hit");
      GameSound.play("lock");
    }
    Math.random = random;
    setPreference("muted", true);
    const muted = GameSound.play("victory");
    return {
      before,
      played: GameSound.stats.played,
      peak: GameSound.stats.peakVoices,
      active: GameSound.activeVoices,
      randomCalls,
      muted,
    };
  });
  assert.ok(r.played > r.before);
  assert.ok(r.peak <= 20 && r.active <= 20);
  assert.equal(r.randomCalls, 0);
  assert.equal(r.muted, false);
  await p.waitForTimeout(1100);
  assert.equal(await p.evaluate(() => GameSound.activeVoices), 0);
  await p.evaluate(() => {
    setPreference("masterVolume", 0.4);
    setPreference("sfxVolume", 0.2);
    setPreference("muted", false);
    // Keep this bus active: Chromium may defer idle AudioParam evaluation.
    GameSound.play("heal");
  });
  await p.waitForTimeout(200);
  const gain = await p.evaluate(() => GameSound.gains);
  assert.ok(Math.abs(gain.master - 0.4) < 0.01);
  assert.ok(Math.abs(gain.sfx - 0.2) < 0.01);
});

test("all seven slot powers can upgrade to tier IV and reload with class prices and four visible symbols", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.points = 500;
    h.reels[0] = [
      "attack",
      "magic",
      "heal",
      "block",
      "stun",
      "poison",
      "stimulant",
    ].map((type) => ({ type, tier: 3, weight: 2 }));
    const costs = h.reels[0].map((f, i) => faceUpgradeCost(f, h));
    h.reels[0].forEach((f, i) => applyFaceEdit(h, 0, i, "upgrade"));
    renderParty();
    editor(0);
    save();
    return {
      costs,
      tiers: h.reels[0].map((f) => f.tier),
      icons: [...document.querySelectorAll(".workshop-faces .tier-4")].map(
        (el) => el.querySelectorAll("svg").length,
      ),
      power: calculate([
        { type: "heal", tier: 4 },
        { type: "block", tier: 4 },
        { type: "stun", tier: 4 },
      ]),
    };
  });
  assert.ok(r.costs.every((n) => n >= 7));
  assert.deepEqual(r.tiers, [4, 4, 4, 4, 4, 4, 4]);
  assert.deepEqual(r.icons, [4, 4, 4, 4, 4, 4, 4]);
  assert.equal(r.power.heal, 8);
  assert.equal(r.power.block, 8);
  assert.equal(r.power.stun, 4);
  await p.reload();
  assert.deepEqual(
    await p.evaluate(() => state.party[0].reels[0].map((f) => f.tier)),
    r.tiers,
  );
});

test("dead healthbars stop flashing and enemy machine captions follow real states without a redundant footer", async (t) => {
  const p = await game(t);
  await encounter(p);
  const r = await p.evaluate(() => {
    const e = state.enemy,
      labels = [];
    const read = () =>
      document.querySelector("#enemy .machine-title").textContent;
    labels.push(read());
    setEnemyPhase(e, "Attacking · 1/2");
    labels.push(read());
    e.stun = 1;
    syncEnemy(e);
    labels.push(read());
    e.hp = 0;
    syncEnemy(e);
    labels.push(read());
    const deadBar = healthMarkup(e);
    state.party[0].hp = 0;
    renderParty();
    return {
      labels,
      deadBar,
      animation: getComputedStyle(document.querySelector("#hero-0 .hp-bar i"))
        .animationName,
      footer: document.querySelector("#enemy .machine-footnote").textContent,
    };
  });
  assert.match(r.labels[0], /Waiting/);
  assert.match(r.labels[1], /Attacking/);
  assert.match(r.labels[2], /Stunned/);
  assert.match(r.labels[3], /Defeated/);
  assert.match(r.deadBar, /dead/);
  assert.doesNotMatch(r.deadBar, /critical/);
  assert.equal(r.animation, "none");
  assert.equal(r.footer, "");
});

test("fifteen event-earned traits replace automatically, show one explained badge and persist", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    const h = state.party[0],
      before = document.querySelector("#spotlight").hidden;
    h.battleMemo = {
      alone: true,
      minFraction: 0.7,
      criticalHits: 0,
      stuns: 0,
      poisonKills: 0,
      stats: { ...h.stats },
    };
    const heroic = evaluateTraitEvent(h, "victory", { hard: true });
    const first = h.trait.id;
    state.steps += 8;
    evaluateTraitEvent(h, "trap", { damage: 8 });
    const negative = h.trait.id;
    state.steps += 8;
    evaluateTraitEvent(h, "well", { healed: 20 });
    const healed = h.trait.id;
    state.steps += 8;
    evaluateTraitEvent(h, "beacon");
    evaluateTraitEvent(h, "beacon");
    const studied = h.trait.id;
    render();
    save();
    Math.random = originalRandom;
    return {
      count: Object.keys(HERO_TRAITS).length,
      kinds: new Set(Object.values(HERO_TRAITS).map((t) => t.kind)).size,
      heroic,
      first,
      negative,
      healed,
      studied,
      badges: document.querySelectorAll("#portrait-0 .trait-badge").length,
      title: document.querySelector("#portrait-0 .trait-badge").title,
      closed: before && document.querySelector("#spotlight").hidden,
    };
  });
  assert.equal(r.count, 15);
  assert.equal(r.kinds, 3);
  assert.equal(r.heroic, true);
  assert.equal(r.first, "heroic");
  assert.equal(r.negative, "scorched");
  assert.equal(r.healed, "invigorated");
  assert.equal(r.studied, "bookish");
  assert.equal(r.badges, 1);
  assert.match(r.title, /Bookish.*EXP.*beacons/);
  assert.equal(r.closed, true);
  await p.reload();
  assert.equal(await p.evaluate(() => state.party[0].trait.id), "bookish");
});

test("trait modifiers affect attacks, defence, healing, poison, opening block and fractional EXP without stacking", async (t) => {
  const p = await game(t);
  await fast(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    const assign = (id) => {
      h.trait = { id, reason: "Test", step: -10, battles: 0 };
    };
    const roll = [
      { type: "attack", tier: 1 },
      { type: "heal", tier: 1 },
      { type: "block", tier: 1 },
    ];
    assign("heroic");
    const attack = (await planHeroRoll(h, roll)).attack;
    assign("cowardly");
    const coward = await planHeroRoll(h, roll);
    assign("hardy");
    beginEncounter();
    state.block = 0;
    const hp = h.hp;
    damageHero(0, 5, "Test");
    const resisted = hp - h.hp;
    assign("scarred");
    const heal = healHero(0, 4);
    assign("venomous");
    applyPoison(state.enemy, 1, h);
    const poison = state.enemy.poison.turns;
    state.enemy = null;
    state.enemies = [];
    assign("stoic");
    beginEncounter();
    const guard = state.block;
    assign("bookish");
    h.xp = 0;
    h.level = 10;
    h.traitXpRemainder = 0;
    const level = h.level;
    for (let n = 0; n < 20; n++) addXP(h, 1);
    return {
      attack,
      cowardAttack: coward.attack,
      cowardBlock: coward.block,
      resisted,
      heal,
      poison,
      guard,
      xp: h.xp,
      levelUnchanged: h.level === level,
    };
  });
  assert.equal(r.attack, 2);
  assert.equal(r.cowardAttack, 1);
  assert.equal(r.cowardBlock, 5); // Counterstroke adds 2 before the trait.
  assert.equal(r.resisted, 4);
  assert.equal(r.heal, 3);
  assert.equal(r.poison, 3);
  assert.equal(r.guard, 1);
  assert.equal(r.xp, 21);
  assert.equal(r.levelUnchanged, true);
});

test("survival trait rules distinguish critical scars, ambush fear, stun, endurance and helpful battle roles", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    const h = state.party[0],
      results = {};
    const run = (name, memo, delta, data = {}) => {
      h.trait = null;
      h.hp = h.maxHp;
      h.stats = emptyStats();
      h.battleMemo = {
        alone: false,
        minFraction: 0.8,
        criticalHits: 0,
        stuns: 0,
        poisonKills: 0,
        stats: { ...h.stats },
        ...memo,
      };
      Object.assign(h.stats, delta);
      evaluateTraitEvent(h, "victory", data);
      results[name] = h.trait?.id;
    };
    run("scarred", { minFraction: 0.08, criticalHits: 2 }, { damageTaken: 40 });
    run("haunted", { minFraction: 0.3 }, { damageTaken: 20 }, { ambush: true });
    h.stun = 1;
    run("cowardly", { minFraction: 0.15 }, { damageTaken: 25 });
    h.stun = 0;
    run("hardy", { minFraction: 0.18 }, { damageTaken: 25 });
    run("venomous", { poisonKills: 1 }, { damageDealt: 5 });
    run("focused", { stuns: 3 }, {});
    run("merciful", {}, { healingDone: 18 });
    run("stoic", {}, { damageBlocked: 15 });
    run("stubborn", {}, { damageTaken: 20, damageBlocked: 8 });
    run("reckless", { minFraction: 0.35 }, { spins: 6, damageDealt: 45 });
    h.trait = null;
    evaluateTraitEvent(h, "trap", { damage: 0 });
    results.wary = h.trait?.id;
    Math.random = originalRandom;
    return results;
  });
  for (const [expected, actual] of Object.entries(r))
    assert.equal(actual, expected);
});

test("all options pages and worn equipment labels fit at desktop, Deck and phone sizes", async (t) => {
  const p = await game(t);
  for (const width of [1920, 1280, 390, 320]) {
    await p.setViewportSize({ width, height: width === 1920 ? 1080 : 844 });
    for (const tab of ["play", "audio", "display", "future"]) {
      await p.evaluate((tab) => optionsPage(tab), tab);
      await panelFits(
        p,
        "#modal",
        ".modal-body",
        ".modal-flow",
        "#modal-title",
      );
    }
    await p.evaluate(() => closeModal());
    const labels = await p.evaluate(async () => {
      const out = [];
      for (const [id, gear] of Object.entries(EQUIPMENT_DEFS)) {
        state.party = [makeHero("Bearer", gear.job || "fighter")];
        state.party[0].equipment = id;
        renderParty();
        requestFitUI();
        await document.fonts.ready;
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const el = document.querySelector(".equipment-slot span"),
          button = document.querySelector(".equipment-slot");
        const range = document.createRange();
        range.selectNodeContents(el);
        const text = range.getBoundingClientRect(),
          box = button.getBoundingClientRect();
        out.push({
          id,
          fit:
            text.top >= box.top - 1 &&
            text.bottom <= box.bottom + 1 &&
            text.left >= box.left - 1 &&
            text.right <= box.right + 1,
        });
      }
      return out;
    });
    assert.ok(
      labels.every((x) => x.fit),
      JSON.stringify({ width, labels }),
    );
  }
});

test("skipping critical presentation still applies full critical damage and a guardian victory can earn Heroic without a trait popup", async (t) => {
  const p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(() => {
    setPreference("skipCriticals", true);
    beginEncounter();
    state.enemy.hp = state.enemy.maxHp = 1000;
    setEnemyBlock(0);
    state.enemy.countdown = 20;
    state.party[0].reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1 }]);
    Math.random = () => 0.999;
    render();
  });
  await p.evaluate(() => spin(0));
  assert.equal(await p.evaluate(() => state.lastPlayerRoll.actualDamage), 7);
  assert.equal(await p.evaluate(() => state.lastCritical.multiplier), 2.25);
  assert.equal(await p.locator("#spotlight").isVisible(), false);
  await p.evaluate(() => {
    beginEncounter(true, { stairBoss: true });
    state.enemy.hp = 1;
    setEnemyBlock(0);
    state.enemy.countdown = 20;
    state.party[0].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "heal", tier: 1 }],
      [{ type: "blank", tier: 1 }],
    ];
    Math.random = () => 0;
    render();
  });
  await p.evaluate(() => spin(0));
  assert.equal(await p.evaluate(() => state.party[0].trait.id), "heroic");
  assert.equal(await p.evaluate(() => state.floorBossDefeated), true);
  assert.equal(await p.locator("#portrait-0 .trait-badge").count(), 1);
  assert.equal(await p.locator("#spotlight").isVisible(), false);
});

test("floor banking transfers each percentage once, survives reload/new runs, and recovers interrupted run saves", async (t) => {
  const p = await game(t);
  const transfers = await p.evaluate(() => {
    const out = [];
    for (const percent of [25, 50, 75, 100]) {
      state.depth = percent / 25;
      state.floorBossDefeated = true;
      state.gold = 103;
      recordFloorClear();
      const amount = bankGold(percent);
      out.push({ amount, carried: state.gold, again: bankGold(percent) });
    }
    return out;
  });
  assert.deepEqual(transfers, [
    { amount: 25, carried: 78, again: false },
    { amount: 51, carried: 52, again: false },
    { amount: 77, carried: 26, again: false },
    { amount: 103, carried: 0, again: false },
  ]);
  await p.reload();
  assert.equal(await p.evaluate(() => campProfile().gold), 256);
  await p.evaluate(() => newRun());
  assert.equal(await p.evaluate(() => campProfile().gold), 256);
  assert.equal(await p.evaluate(() => state.gold), 0);
  await p.evaluate(() => {
    state.floorBossDefeated = true;
    state.gold = 80;
    recordFloorClear();
    const before = localStorage.getItem(SAVE_KEY);
    bankGold(50);
    // Simulate losing the expedition write after the camp commit.
    localStorage.setItem(SAVE_KEY, before);
  });
  await p.reload();
  assert.deepEqual(
    await p.evaluate(() => ({
      gold: state.gold,
      bank: campProfile().gold,
      again: bankGold(50),
    })),
    { gold: 40, bank: 296, again: false },
  );
  await p.evaluate(() => save());
  await p.reload();
  assert.equal(await p.evaluate(() => state.gold), 40);
});

test("banking rejects invalid/unearned transfers and storage failures without taking gold", async (t) => {
  const p = await game(t);
  assert.equal(
    await p.evaluate(() => {
      state.gold = 100;
      return bankGold(25);
    }),
    false,
  );
  const r = await p.evaluate(() => {
    state.floorBossDefeated = true;
    recordFloorClear();
    const invalid = [0, 10, 101, NaN, Infinity, "25"].map(bankGold);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === PROFILE_KEY) throw Error("Storage is full");
      return original.call(this, key, value);
    };
    let failed;
    try {
      failed = bankGold(25);
    } finally {
      Storage.prototype.setItem = original;
    }
    return { invalid, failed, gold: state.gold, pool: campProfile().gold };
  });
  assert.deepEqual(r, {
    invalid: [false, false, false, false, false, false],
    failed: false,
    gold: 100,
    pool: 0,
  });
});

test("camp purchases persist and class invitations remain separate from tiered training", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const profile = emptyProfile();
    profile.gold = 5000;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    chooseStartingClass(true);
  });
  await p.locator("#camp-open").click();
  assert.deepEqual(
    await p.evaluate(() =>
      [
        "missing",
        "toString",
        "__proto__",
        "rangerFocus",
        "rangerHeart",
        "rangerStart",
      ].map(purchaseUnlock),
    ),
    [false, false, false, false, false, false],
  );
  await p.locator('[data-camp-buy="ranger"]').click();
  assert.equal(await p.evaluate(() => purchaseUnlock("ranger")), false);
  assert.equal(await p.locator('[data-camp-buy="rangerFocus"]').count(), 0);
  await p.evaluate(() => {
    campPage("training");
    purchaseUnlock("purse1");
    purchaseUnlock("purse2");
    purchaseUnlock("purse3");
  });
  assert.equal(await p.evaluate(() => state.gold), 0);
  await p.locator("#camp-return").click();
  assert.equal(await p.locator('[data-start-job="ranger"]').count(), 1);
  await p.locator('[data-start-job="fighter"]').click();
  assert.deepEqual(
    await p.evaluate(() => ({
      gold: state.gold,
      ranger: ruleEnabled("ranger"),
      pool: campProfile().gold,
    })),
    { gold: 150, ranger: true, pool: 1500 },
  );
  await p.reload();
  assert.equal(await p.evaluate(() => campProfile().gold), 1500);
});

test("Ranger has exactly one middle seal, saves Execute patience for a later hit and clears it after battle", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.party = [makeHero("Rowan", "ranger")];
    beginEncounter(false, { count: 1 });
    render();
  });
  assert.deepEqual(
    await p.evaluate(() =>
      state.party[0].reels.map(
        (r) => r.filter((f) => f.type === "class").length,
      ),
    ),
    [0, 1, 0],
  );
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      blank = { type: "blank", tier: 1 },
      attack = { type: "attack", tier: 1 };
    const first = await planHeroRoll(h, [
      blank,
      { type: "class", tier: 1, job: "ranger" },
      blank,
    ]);
    advanceRangerPatience(h, false, true);
    const charge = h.charge;
    const second = await planHeroRoll(h, [attack, blank, blank]);
    const consumed = h.charge;
    await planHeroRoll(h, [
      blank,
      { type: "class", tier: 1, job: "ranger" },
      blank,
    ]);
    clearBattleStatuses();
    return {
      charge,
      damage: second.attack,
      consumed,
      after: h.charge,
      attack: first.attack,
    };
  });
  assert.deepEqual(r, {
    charge: 3,
    damage: 3,
    consumed: 0,
    after: 0,
    attack: 0,
  });
  assert.ok(
    (await p.locator("#portrait-0").innerHTML()).includes("hero-illustration"),
  );
});

test("double-encounter odds rise steeply through floor four then flatten below one in four", async (t) => {
  const p = await game(t);
  const odds = await p.evaluate(() =>
    Array.from({ length: 10 }, (_, i) => doubleBattleChance(i + 1)),
  );
  assert.deepEqual(odds.slice(0, 4), [0.02, 0.07, 0.13, 0.18]);
  assert.ok(odds[9] <= 0.25);
  assert.ok(odds[3] - odds[0] > odds[9] - odds[3]);
  const counts = await p.evaluate(() => {
    const original = Math.random,
      result = [];
    try {
      for (const depth of [1, 4, 10]) {
        state.depth = depth;
        Math.random = () => 0.1;
        beginEncounter();
        result.push(state.enemies.length);
      }
    } finally {
      Math.random = original;
    }
    return result;
  });
  assert.deepEqual(counts, [1, 2, 2]);
});

test("enemy damage has a tight tier range and enemy criticals are milder than player criticals", async (t) => {
  const p = await game(t);
  await fast(p);
  const r = await p.evaluate(async () => {
    setPreference("skipCriticals", true);
    const original = Math.random;
    Math.random = () => 0.999;
    try {
      const symbols = [0, 1, 2].map(() => ({ type: "attack", tier: 4 }));
      return {
        enemy: await rollCritical("Enemy", symbols, true),
        hero: await rollCritical("Hero", symbols, false),
        range: [1, 2, 3, 4].map((tier) =>
          enemyHitPower(
            calculate([0, 1, 2].map(() => ({ type: "attack", tier }))),
            { damage: 10 },
          ),
        ),
      };
    } finally {
      Math.random = original;
    }
  });
  assert.equal(r.enemy, 1.5);
  assert.equal(r.hero, 4);
  assert.ok(Math.max(...r.range) <= 10);
  assert.ok(Math.min(...r.range) >= 7);
});

test("underlevelled autoplay explores and seeks recovery before a guardian, but eventually commits", async (t) => {
  const p = await game(t);
  await p.evaluate(blankFloor);
  const r = await p.evaluate(() => {
    const stairs = pos(2, 7),
      frontier = pos(1, 6),
      well = pos(1, 5);
    state.map[stairs].seen = true;
    state.map[stairs].event = "stairs";
    state.map[frontier].seen = false;
    const explore = autoplayGoal();
    state.map[well].seen = true;
    state.map[well].event = "well";
    state.map[frontier].seen = true;
    state.party[0].hp = 15;
    const recover = autoplayGoal();
    state.party[0].hp = state.party[0].maxHp;
    state.map.forEach((c) => {
      c.seen = true;
    });
    state.map[well].event = null;
    const finish = autoplayGoal();
    return { explore, recover, finish, stairs, well };
  });
  assert.notEqual(r.explore, r.stairs);
  assert.equal(r.recover, r.well);
  assert.equal(r.finish, r.stairs);
});

test("status badges explain exact effects on hover and idle combat widgets are subdued", async (t) => {
  const p = await game(t);
  assert.match(
    await p.locator("#round").getAttribute("class"),
    /inactive-combat/,
  );
  assert.equal(await p.evaluate(() => state.round), 1);
  await p.evaluate(() => {
    beginEncounter(false, { count: 1 });
    const h = state.party[0];
    h.poison = { damage: 2, turns: 3 };
    h.rage = 3;
    h.stun = 1;
    render();
  });
  const badge = p.locator("#portrait-0 .poison-badge");
  assert.match(await badge.getAttribute("title"), /2 damage.*3 more/);
  await badge.hover({ force: true });
  assert.equal(await p.locator("#status-tooltip").isVisible(), true);
  assert.match(await p.locator("#status-tooltip").textContent(), /2 damage/);
  await p.evaluate(() => {
    state.enemy = null;
    state.enemies = [];
    state.block = 9;
    state.round = 7;
    render();
  });
  assert.equal(await p.evaluate(() => state.block), 0);
  assert.match(await p.locator("#round").textContent(), /—/);
  assert.equal(
    await p.locator("#round").evaluate((el) => getComputedStyle(el).opacity),
    "0.48",
  );
});

test("camp and banking sheets fit desktop and phone, and inspection controls do not blink during travel", async (t) => {
  const p = await game(t);
  const opacities = await p.evaluate(() => {
    state.bag = { potion: 1 };
    render();
    const read = () =>
      ["#artefact-slot", "#manage-bag"].map(
        (s) => getComputedStyle(document.querySelector(s)).opacity,
      );
    const before = read();
    busy = true;
    render();
    const during = read();
    busy = false;
    render();
    return { before, during };
  });
  assert.deepEqual(opacities.before, opacities.during);
  for (const width of [1920, 1280, 390, 320]) {
    await p.setViewportSize({ width, height: width === 1920 ? 1080 : 844 });
    await p.evaluate(() => {
      campInitial = true;
      campPage();
    });
    await panelFits(p, "#modal", ".modal-body", ".modal-flow", "#modal-title");
    await p.evaluate(() => {
      closeModal();
      state.floorBossDefeated = true;
      state.gold = 100;
      window.floorTest = celebrateFloorClear();
    });
    await p.waitForSelector("#stage-confirm");
    await panelFits(
      p,
      "#stage-card",
      ".stage-content",
      ".scene-layout",
      "#stage-title",
    );
    await p.locator("#stage-confirm").click();
    await p.evaluate(() => window.floorTest);
  }
});

test("camp modifiers change real generation, recruits, gear, starting health and enemy rules", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const original = Math.random;
    const rules = [
      "ranger",
      "hearty",
      "springs",
      "golden",
      "lanterns",
      "markets",
      "company",
      "iron",
      "crowded",
      "sharp",
      "hunted",
    ];
    state.runRules = rules;
    const ranger = makeHero("Rowan", "ranger"),
      fighter = makeHero("Alden", "fighter"),
      hard = enemyBalance(4);
    Math.random = () => 0.5;
    const map = generateFloor(1, 1, 0, rules),
      dry = generateFloor(1, 1, 0, ["drought"]);
    Math.random = original;
    const count = (map, event) => map.filter((c) => c.event === event).length;
    return {
      ranger: ranger.maxHp,
      fighter: fighter.maxHp,
      hard,
      normal: (() => {
        state.runRules = [];
        return enemyBalance(4);
      })(),
      events: ["well", "treasure", "beacon", "shop"].map((e) => count(map, e)),
      dry: count(dry, "well"),
      locked: availableLootTypes().includes("trailBow"),
      unlocked: (() => {
        state.runRules = ["ranger"];
        return availableLootTypes().includes("trailBow");
      })(),
    };
  });
  assert.equal(r.ranger, 34);
  assert.equal(r.fighter, 54);
  assert.equal(r.hard.maxHp, Math.ceil(r.normal.maxHp * 1.2));
  assert.equal(r.hard.damage, Math.ceil(r.normal.damage * 1.1) + 1);
  assert.deepEqual(r.events, [3, 4, 2, 1]);
  assert.equal(r.dry, 1);
  assert.equal(r.locked, false);
  assert.equal(r.unlocked, true);
});

test("final victory automatically banks all carried gold and its reward without closing records", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.depth = 10;
    state.gold = 100;
    state.floorBossDefeated = true;
    const celebrate = goldCelebration;
    goldCelebration = (amount, ...args) => {
      window.winningGold = amount;
      return celebrate(amount, ...args);
    };
    finishVictory();
    goldCelebration = celebrate;
  });
  assert.equal(await p.evaluate(() => window.winningGold), 400);
  assert.equal(await p.evaluate(() => state.gold), 0);
  assert.equal(await p.evaluate(() => campProfile().gold), 400);
  assert.equal(await p.locator("[data-bank]").count(), 0);
  assert.match(
    await p.locator(".victory-banking").textContent(),
    /400 gold sent/,
  );
  assert.equal(await p.locator("#overlay").isVisible(), true);
  assert.equal(await p.locator(".fallen-roster").count(), 1);
  await p.evaluate(() => finishVictory());
  assert.equal(await p.evaluate(() => campProfile().gold), 400);
  await p.reload();
  assert.equal(await p.evaluate(() => campProfile().gold), 400);
});

test("room descriptions follow the current terrain and the pursuer arrives with small smoke FX", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const cell = state.map[state.position];
    cell.terrain = "bridge";
    render();
    const bridge = document.querySelector("#field-note").textContent;
    cell.terrain = "floor";
    cell.feature = "well";
    cell.event = null;
    render();
    const well = document.querySelector("#field-note").textContent;
    state.map.forEach((c) => {
      if (!c.wall) {
        c.seen = true;
        c.event = null;
      }
    });
    state.depth = 3;
    state.pursuer = null;
    state.pursuerSpawned = false;
    particles = [];
    await advancePursuer();
    return {
      bridge,
      well,
      spawn: !!state.pursuer,
      smoke: particles.some((p) => p.kind === "smoke"),
      step: SOUND_CUES.step.gain,
      critical: SOUND_CUES.critical.gain,
      encounter: !!SOUND_CUES.encounter,
    };
  });
  assert.match(r.bridge, /boards/);
  assert.match(r.well, /basin/);
  assert.equal(r.spawn, true);
  assert.equal(r.smoke, true);
  assert.ok(r.step < 0.02);
  assert.ok(r.critical > 0.15);
  assert.equal(r.encounter, true);
});

test("a single guardian frame aligns with the party base and never reaches healing controls", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.depth = 4;
    beginEncounter(true, { stairBoss: true });
    render();
  });
  for (const width of [1920, 1280]) {
    await p.setViewportSize({ width, height: width === 1920 ? 1080 : 800 });
    await p.waitForTimeout(100);
    const bounds = await p.evaluate(() => {
      const box = (s) => document.querySelector(s).getBoundingClientRect();
      return {
        party: box(".party-side").bottom,
        enemy: box(".enemy-box").bottom,
        target: box("#targets").top,
      };
    });
    assert.ok(
      Math.abs(bounds.party - bounds.enemy) < 1,
      JSON.stringify(bounds),
    );
    assert.ok(bounds.enemy <= bounds.target + 1);
  }
});

test("the camp can be navigated with keyboard tabs and cannot dismiss an initial class choice", async (t) => {
  const p = await game(t);
  await p.evaluate(() => chooseStartingClass(true));
  await p.locator("#camp-open").focus();
  await p.keyboard.press("Enter");
  await p.keyboard.press("Escape");
  assert.equal(await p.locator("#overlay").isVisible(), true);
  await p.locator('[data-camp-tab="classes"]').focus();
  await p.keyboard.press("ArrowRight");
  assert.equal(
    await p.evaluate(() => document.activeElement.dataset.campTab),
    "training",
  );
  await p.keyboard.press("End");
  assert.equal(
    await p.evaluate(() => document.activeElement.dataset.campTab),
    "oddities",
  );
  await p.locator("#camp-return").focus();
  await p.keyboard.press("Enter");
  assert.equal(await p.evaluate(() => modalKind), "starter");
  assert.equal(await p.evaluate(() => state.awaitingStarter), true);
});

test("autoplay drinks a selected moderately needed well instead of declining and selecting it again", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  const tile = await p.evaluate(() => {
    const i = pos(2, 7);
    Object.assign(state.map[i], { seen: true, event: "well", feature: "well" });
    state.party[0].hp = 25;
    render();
    return autoplayGoal();
  });
  assert.equal(tile, 79);
  await startEval(p, `move(${tile})`);
  await p.waitForSelector("#well-use");
  assert.equal(await p.evaluate(() => autoplayPrompt()), false);
  await p.waitForFunction(() => autoplayPrompt());
  await p.waitForSelector("#stage-confirm");
  await p.waitForFunction(() => autoplayPrompt());
  await finish(p);
  assert.equal(await p.evaluate(() => state.map[79].event), null);
  assert.equal(
    await p.evaluate(
      () => state.logs.filter((s) => s.includes("left flowing")).length,
    ),
    0,
  );
  assert.notEqual(await p.evaluate(() => autoplayGoal()), 79);
});

test("autoplay takes an unused fountain before descending even for one missing HP and a longer route", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(blankFloor);
  const goals = await p.evaluate(() => {
    state.map.forEach((c) => {
      c.seen = true;
    });
    const well = pos(9, 1),
      stairsTile = pos(2, 7);
    state.map[well].event = "well";
    state.map[stairsTile].event = "stairs";
    state.floorBossDefeated = true;
    state.exitFound = true;
    state.exitReached = true;
    state.party[0].hp = state.party[0].maxHp - 1;
    render();
    stairs();
    const closed =
      autoplayPrompt() && document.querySelector("#overlay").hidden;
    return { well, goal: autoplayGoal(), closed };
  });
  assert.equal(
    goals.closed,
    false,
    "Autoplay reads the stair sheet before responding",
  );
  await p.waitForFunction(() => {
    autoplayPrompt();
    return document.querySelector("#overlay").hidden;
  });
  assert.equal(goals.goal, goals.well);
  await startEval(p, `move(${goals.well})`);
  await p.waitForSelector("#well-use");
  await p.waitForFunction(() => autoplayPrompt());
  await p.waitForSelector("#stage-confirm");
  await p.waitForFunction(() => autoplayPrompt());
  await finish(p);
  assert.equal(
    await p.evaluate(() => state.party[0].hp),
    await p.evaluate(() => state.party[0].maxHp),
  );
  assert.equal(
    await p.evaluate(() => state.map[autoplayGoal()].event),
    "stairs",
  );
});

test("autofight breaks a sustainable healing-only loop by selecting an available attacker", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party = [makeHero("Alden", "fighter"), makeHero("Mira", "healer")];
    state.party.forEach((h) => {
      h.hp = h.maxHp = 100;
    });
    state.party[0].hp = 35;
    state.party[0].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "attack", tier: 2 }],
      [{ type: "blank", tier: 1 }],
    ];
    state.party[1].reels = [
      [{ type: "heal", tier: 3 }],
      [{ type: "heal", tier: 4 }],
      [{ type: "blank", tier: 1 }],
    ];
    beginEncounter(false, { count: 1 });
    Object.assign(state.enemy, {
      hp: 1000,
      maxHp: 1000,
      countdown: 1,
      frequency: 1,
      damage: 20,
      strikes: 1,
      affix: null,
      passive: null,
      block: 0,
      reels: [
        [{ type: "attack", tier: 1 }],
        [{ type: "blank", tier: 1 }],
        [{ type: "blank", tier: 1 }],
      ],
    });
    Math.random = () => 0;
    render();
    setAutoresolve(true);
  });
  await p.waitForFunction(() => state.party[0].stats.spins >= 1, null, {
    timeout: 12000,
  });
  await p.evaluate(() => setAutoresolve(false));
  await finish(p);
  assert.ok(await p.evaluate(() => state.party[0].stats.damageDealt > 0));
  assert.ok(await p.evaluate(() => state.party[1].stats.spins <= 3));
  assert.ok(await p.evaluate(() => state.enemy.hp < 1000));
});

test("autofight pauses with an explanation when every living wheel is unable to hurt enemies", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party = [makeHero("Mira", "healer")];
    state.party[0].reels = [0, 1, 2].map(() => [{ type: "heal", tier: 1 }]);
    beginEncounter(false, { count: 1 });
    render();
    setAutoresolve(true);
  });
  await p.waitForFunction(() => !state.autoresolve);
  assert.equal(await p.evaluate(() => state.party[0].stats.spins), 0);
  assert.match(await p.locator("#toast").textContent(), /nobody can harm/);
});

test("autoplay interprets public hints while ignoring a hidden tile's undisclosed event and terrain", async (t) => {
  const p = await game(t);
  await p.evaluate(blankFloor);
  const r = await p.evaluate(() => {
    const water = pos(2, 7),
      gold = pos(1, 6);
    state.party[0].hp = 10;
    state.map[water].hint = { kind: "water", text: DISCOVERY_HINTS.well[1] };
    state.map[gold].hint = {
      kind: "glimmer",
      text: DISCOVERY_HINTS.treasure[1],
    };
    const first = autoplayGoal();
    state.map[water].event = "stronghold";
    state.map[water].wall = true;
    state.map[gold].event = "trap";
    const concealed = autoplayGoal();
    state.map[water].hint.text = DISCOVERY_HINTS.river[1];
    const river = autoplayGoal();
    return { water, gold, first, concealed, river };
  });
  assert.equal(r.first, r.water);
  assert.equal(r.concealed, r.water);
  assert.equal(r.river, r.gold);
});

test("trait requirements have a chance to award one eligible companion per shared occurrence", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    render();
    const entries = () =>
      state.party.map((h) => ({ h, data: { healed: h.maxHp } }));
    const random = Math.random;
    try {
      Math.random = () => 0.9;
      const missed = awardTraitOccurrence("well", entries()),
        none = state.party.filter((h) => h.trait).length;
      const draws = [0.1, 0.8];
      Math.random = () => draws.shift() ?? 0;
      const awarded = awardTraitOccurrence("well", entries());
      return {
        missed,
        none,
        awarded,
        recipients: state.party.map((h) => h.trait?.id || null),
      };
    } finally {
      Math.random = random;
    }
  });
  assert.equal(r.missed, false);
  assert.equal(r.none, 0);
  assert.equal(r.awarded, true);
  assert.deepEqual(r.recipients, [null, null, "invigorated"]);
});

test("removed Ranger enhancements refund their costs once and unlock Ranger starts with the class invitation", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const profile = emptyProfile();
    profile.gold = 10;
    profile.owned = ["ranger", "rangerFocus", "rangerHeart", "rangerStart"];
    profile.enabled = ["rangerFocus", "rangerHeart", "rangerStart"];
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    const first = readProfile(),
      second = readProfile();
    newRun();
    chooseStartingClass(false);
    return {
      first: first.gold,
      second: second.gold,
      owned: second.owned,
      enabled: second.enabled,
      choices: document.querySelectorAll('[data-start-job="ranger"]').length,
      removed: ["rangerFocus", "rangerHeart", "rangerStart"].some((id) =>
        Object.hasOwn(CAMP_UNLOCKS, id),
      ),
    };
  });
  assert.deepEqual(r, {
    first: 350,
    second: 350,
    owned: ["ranger"],
    enabled: [],
    choices: 1,
    removed: false,
  });
  await p.reload();
  assert.equal(await p.evaluate(() => readProfile().gold), 350);
});

test("Ranger Execute meter shows patience, release and battle cleanup without adding a hero row", async (t) => {
  const p = await game(t);
  await p.evaluate(async () => {
    state.party = [makeHero("Rowan", "ranger")];
    beginEncounter(false, { count: 1 });
    render();
    const blank = { type: "blank", tier: 1 };
    await planHeroRoll(state.party[0], [
      blank,
      { type: "class", tier: 1, job: "ranger" },
      blank,
    ]);
    advanceRangerPatience(state.party[0], false, true);
  });
  assert.equal(
    await p.locator(".aim-meter").getAttribute("aria-valuenow"),
    "3",
  );
  assert.match(await p.locator(".aim-meter").textContent(), /EXECUTE 3\/6/);
  assert.ok(
    await p
      .locator(".aim-track i")
      .evaluate((el) => parseFloat(el.style.width) > 0),
  );
  await p.evaluate(async () => {
    await planHeroRoll(state.party[0], [
      { type: "attack", tier: 1 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ]);
  });
  assert.equal(
    await p.locator(".aim-meter").getAttribute("aria-valuenow"),
    "0",
  );
  await p.evaluate(() => {
    state.party[0].charge = 6;
    syncHero(0);
    clearBattleStatuses();
  });
  assert.equal(
    await p.locator(".aim-meter").getAttribute("aria-valuenow"),
    "0",
  );
  for (const width of [1920, 1280, 390, 320]) {
    await p.setViewportSize({ width, height: 844 });
    await p.waitForTimeout(100);
    assert.equal(
      await p
        .locator(".aim-meter")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      true,
      "Execute caption fits " + width,
    );
  }
});

test("five additional enemies spawn only on their allowed floors with distinct profiles and artwork", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const ids = [
        "moth",
        "rustmite",
        "sporepilgrim",
        "mirrorhound",
        "ashcolossus",
      ],
      seen = new Set(),
      bad = [];
    for (let depth = 1; depth <= 10; depth++) {
      state.depth = depth;
      for (let n = 0; n < 150; n++) {
        beginEncounter(false, { count: 1 });
        const e = state.enemy;
        if (ids.includes(e.art)) {
          seen.add(e.art);
          const d = ENEMY_PROFILES[e.art];
          if (depth < d.minDepth || depth > d.maxDepth)
            bad.push([depth, e.art]);
        }
      }
    }
    return {
      seen: [...seen].sort(),
      bad,
      hp: ids.map((id) => ENEMY_PROFILES[id].hp),
      art: ids.every((id) => portraitArt(id).includes("species-" + id)),
    };
  });
  assert.deepEqual(r.seen, [
    "ashcolossus",
    "mirrorhound",
    "moth",
    "rustmite",
    "sporepilgrim",
  ]);
  assert.deepEqual(r.bad, []);
  assert.equal(r.art, true);
  assert.equal(new Set(r.hp).size, 5);
});

test("The Unwritten has a modest health and damage increase at every supported depth and variant", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const profile = ENEMY_PROFILES.pursuer,
      results = [];
    try {
      for (let depth = 3; depth <= 10; depth++)
        for (const elite of [false, true])
          for (const pair of [false, true]) {
            profile.hp = 1.28;
            profile.damage = 1.12;
            const next = enemyBalance(depth, {
              species: "pursuer",
              elite,
              pair,
            });
            profile.hp = 1.15;
            profile.damage = 1;
            const before = enemyBalance(depth, {
              species: "pursuer",
              elite,
              pair,
            });
            results.push(
              next.maxHp > before.maxHp &&
                next.damage >= before.damage &&
                next.frequency === before.frequency,
            );
          }
    } finally {
      profile.hp = 1.28;
      profile.damage = 1.12;
    }
    return results;
  });
  assert.ok(r.every(Boolean));
});

test("full screen effects cover wounds, healing, traps, gold and crits and the persisted toggle stops them", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party[0].hp = 20;
    render();
    damageHero(0, 3, "Test enemy");
  });
  assert.equal(
    await p.locator("#screen-edge-fx").getAttribute("data-effect"),
    "damage",
  );
  await p.evaluate(() => healHero(0, 2));
  assert.equal(
    await p.locator("#screen-edge-fx").getAttribute("data-effect"),
    "heal",
  );
  await p.evaluate(() => goldCelebration(20));
  assert.equal(
    await p.locator("#screen-edge-fx").getAttribute("data-effect"),
    "gold",
  );
  await p.evaluate(async () => {
    setPreference("skipCriticals", true);
    await rollCritical(
      "Test",
      [0, 1, 2].map(() => ({ type: "attack", tier: 1 })),
    );
  });
  assert.equal(
    await p.locator("#screen-edge-fx").getAttribute("data-effect"),
    "critical",
  );
  await p.evaluate(() => screenFX("trap"));
  assert.equal(
    await p.locator("#screen-edge-fx").getAttribute("data-effect"),
    "trap",
  );
  await p.evaluate(() => optionsPage("display"));
  await p.locator("#setting-fullScreenEffects").uncheck();
  assert.equal(
    await p.evaluate(
      () => document.querySelector("#screen-edge-fx").getAnimations().length,
    ),
    0,
  );
  await p.evaluate(() => screenFX("heal"));
  assert.equal(
    await p.locator("#screen-edge-fx").evaluate((el) => el.style.opacity),
    "0",
  );
  await p.evaluate(() => newRun());
  assert.equal(await p.evaluate(() => preferences().fullScreenEffects), false);
  await p.reload();
  assert.equal(await p.evaluate(() => preferences().fullScreenEffects), false);
});

test("older Unwritten encounters migrate strength once while preserving wounds", async (t) => {
  const p = await game(t);
  for (const version of [11, 13]) {
    const result = await p.evaluate((version) => {
      newRun();
      state.depth = 5;
      beginEncounter(false, { pursuer: true, count: 1 });
      const e = state.enemy;
      e.maxHp = 46;
      e.hp = 23;
      e.damage = 1;
      state.version = version;
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      const loaded = load();
      const expected = enemyBalance(5, {
        species: "pursuer",
        elite: state.enemy.elite,
      });
      const first = {
        hp: state.enemy.hp,
        maxHp: state.enemy.maxHp,
        damage: state.enemy.damage,
      };
      save();
      load();
      return {
        loaded,
        expected,
        first,
        second: {
          hp: state.enemy.hp,
          maxHp: state.enemy.maxHp,
          damage: state.enemy.damage,
        },
      };
    }, version);
    assert.equal(result.loaded, true);
    assert.equal(result.first.maxHp, result.expected.maxHp);
    assert.equal(result.first.hp, Math.ceil(result.expected.maxHp / 2));
    assert.equal(result.first.damage, result.expected.damage);
    assert.deepEqual(result.second, result.first);
  }
});

test("a failed retired-upgrade refund leaves the original profile intact for a safe retry", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const profile = emptyProfile();
    profile.gold = 5;
    profile.owned = ["ranger", "rangerFocus", "rangerFocus"];
    const raw = JSON.stringify(profile);
    localStorage.setItem(PROFILE_KEY, raw);
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === PROFILE_KEY) throw Error("Storage is full");
      return write.call(this, key, value);
    };
    let failed;
    try {
      failed = campProfile();
    } finally {
      Storage.prototype.setItem = write;
    }
    const untouched = localStorage.getItem(PROFILE_KEY) === raw;
    return {
      error: failed.error,
      untouched,
      retried: readProfile().gold,
      again: readProfile().gold,
    };
  });
  assert.match(r.error, /Storage is full/);
  assert.equal(r.untouched, true);
  assert.equal(r.retried, 115);
  assert.equal(r.again, 115);
});

test("autofight uses a ready ally to recover a stunned attacker and advances the action clock", async (t) => {
  const p = await game(t);
  await fast(p);
  const r = await p.evaluate(async () => {
    state.party.push(makeHero("Mira", "healer"));
    state.party[1].reels = [0, 1, 2].map(() => [{ type: "heal", tier: 1 }]);
    beginEncounter(false, { count: 1 });
    state.party[0].stun = 1;
    state.autoCombat.supportSpins = 2;
    render();
    const living = state.party.map((h, i) => ({ h, i }));
    const selected = autoChooseActor(living).i,
      before = state.enemy.countdown;
    await spin(selected);
    return {
      selected,
      stun: state.party[0].stun,
      before,
      after: state.enemy.countdown,
      next: autoChooseActor(living).i,
    };
  });
  assert.equal(r.selected, 1);
  assert.equal(r.stun, 0);
  assert.equal(r.after, r.before - 1);
  assert.equal(r.next, 0);
});

test("enemy hits strike the shared shield first and only HP overflow also targets the hero", async (t) => {
  const p = await game(t);
  await fast(p);
  await encounter(p);
  const r = await p.evaluate(async () => {
    const e = state.enemy;
    e.reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "blank", tier: 1 }],
      [{ type: "miss", tier: 1 }],
    ];
    e.damage = 10;
    e.strikes = 1;
    const original = beam,
      targets = [];
    beam = (from, to, type) =>
      targets.push({ id: to.closest("#block") ? "block" : to.id, type });
    try {
      state.block = 20;
      const hp = state.party[0].hp;
      await enemyTurn(e);
      const full = {
        targets: targets.splice(0),
        hp: state.party[0].hp,
        before: hp,
        readouts: [...document.querySelectorAll(".combat-number")].map(
          (el) => ({
            target: el.dataset.target,
            blocked: el.classList.contains("blocked"),
            text: el.textContent,
          }),
        ),
      };
      state.block = 2;
      await enemyTurn(e);
      return {
        full,
        partial: { targets, hp: state.party[0].hp, block: state.block },
      };
    } finally {
      beam = original;
    }
  });
  assert.deepEqual(r.full.targets, [{ id: "block", type: "block" }]);
  assert.equal(r.full.hp, r.full.before);
  assert.ok(
    r.full.readouts.some(
      (n) => n.target === "block" && n.blocked && /BLOCKED/.test(n.text),
    ),
  );
  assert.equal(
    r.full.readouts.some((n) => n.target === "portrait-0" && !n.blocked),
    false,
  );
  assert.deepEqual(r.partial.targets, [
    { id: "block", type: "block" },
    { id: "portrait-0", type: "attack" },
  ]);
  assert.ok(r.partial.hp < r.full.hp);
  assert.equal(r.partial.block, 0);
});

test("team block tint grows to twenty while a living Tank caps actual protection at thirty", async (t) => {
  const p = await game(t);
  await encounter(p);
  await p.addStyleTag({ content: ".team-block{transition:none!important}" });
  const r = await p.evaluate(() => {
    const shield = document.querySelector("#block > svg");
    return [0, 5, 20, 100].map((value) => {
      state.block = value;
      renderBlock();
      const el = document.querySelector("#block");
      return {
        amount: state.block,
        text: el.querySelector("strong").textContent,
        ink: getComputedStyle(el).color,
        wash: getComputedStyle(el).backgroundColor,
        strength: el.style.getPropertyValue("--block-strength"),
        stable: shield === el.querySelector("svg"),
      };
    });
  });
  assert.deepEqual(
    r.map((x) => x.amount),
    [0, 5, 20, 30],
  );
  assert.equal(r[3].text, "30");
  assert.notEqual(r[0].ink, r[1].ink);
  assert.notEqual(r[1].ink, r[2].ink);
  assert.equal(r[2].strength, "1");
  assert.equal(r[3].strength, "1");
  assert.ok(r.every((x) => x.stable));
  // Disable the cosmetic transition when measuring its final plateau.
  await p.addStyleTag({ content: ".team-block{transition:none!important}" });
  const colors = await p.evaluate(() =>
    [20, 100].map((n) => {
      state.block = n;
      renderBlock();
      return getComputedStyle(document.querySelector("#block")).color;
    }),
  );
  assert.equal(colors[0], colors[1]);
});

test("hero card clicks and keyboard activation spin once while portrait and editor controls retain their roles", async (t) => {
  const p = await game(t);
  await fast(p);
  await encounter(p);
  await faces(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    render();
  });
  await p.locator("#hero-0 .hero-name").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[0].stats.spins), 1);
  await p.locator("#portrait-1").click();
  assert.equal(await p.evaluate(() => modalKind), "editor");
  await p.locator("#modal [data-close]").first().click();
  await p.locator('#targets [data-target="1"]').click();
  assert.equal(await p.evaluate(() => state.target), 1);
  assert.equal(await p.evaluate(() => state.party[1].stats.spins), 0);
  await p.locator("#hero-0").focus();
  await p.keyboard.press("Enter");
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[0].stats.spins), 2);
  await p.locator("#hero-0 .edit-button").click();
  assert.equal(await p.evaluate(() => modalKind), "editor");
  assert.equal(await p.evaluate(() => state.party[0].stats.spins), 2);
});

test("portrait hover shows current lifetime statistics and respects nested status tooltips", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const h = state.party[0];
    Object.assign(h.stats, {
      kills: 7,
      damageDealt: 112,
      criticals: 3,
      healingReceived: 21,
    });
    h.poison = { turns: 3, damage: 1 };
    render();
  });
  await p.locator("#portrait-0").hover({ position: { x: 40, y: 20 } });
  assert.match(
    await p.locator("#status-tooltip").textContent(),
    /Damage dealt112/,
  );
  assert.match(await p.locator("#status-tooltip").textContent(), /Kills7/);
  assert.match(await p.locator("#status-tooltip").textContent(), /Found/);
  assert.match(
    await p.locator("#status-tooltip").textContent(),
    /Time \/ steps/,
  );
  await p.mouse.move(1, 1);
  await p.evaluate(() => (state.party[0].stats.kills = 8));
  await p.locator("#portrait-0").hover({ position: { x: 40, y: 20 } });
  assert.match(await p.locator("#status-tooltip").textContent(), /Kills8/);
  await p.locator("#portrait-0 .poison-badge").hover();
  assert.match(await p.locator("#status-tooltip").textContent(), /Poison/);
  assert.equal(
    await p
      .locator("#status-tooltip")
      .evaluate((el) => el.classList.contains("hero-stats-tooltip")),
    false,
  );
  await p.setViewportSize({ width: 320, height: 700 });
  await p.locator("#portrait-0").hover({ position: { x: 40, y: 20 } });
  const box = await p.locator("#status-tooltip").boundingBox();
  assert.ok(
    box.x >= 0 &&
      box.x + box.width <= 321 &&
      box.y >= 0 &&
      box.y + box.height <= 701,
    JSON.stringify(box),
  );
});

test("single-target healing redirects only a completely full target to the lowest raw wounded HP", async (t) => {
  const p = await game(t);
  await fast(p);
  await encounter(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    state.party[1].hp = 10;
    state.party[1].maxHp = 100;
    state.party[2].hp = 8;
    state.target = 0;
    render();
  });
  await faces(p, [
    ["heal", 1],
    ["heal", 2],
    ["blank", 1],
  ]);
  await p.evaluate(() => spin(0));
  assert.equal(await p.evaluate(() => state.lastPlayerRoll.healTarget), 2);
  assert.equal(await p.evaluate(() => state.party[1].hp), 10);
  assert.ok(await p.evaluate(() => state.party[2].hp > 8));
  await p.evaluate(() => {
    state.party[0].hp = state.party[0].maxHp - 1;
    state.target = 0;
  });
  await p.evaluate(() => spin(0));
  assert.equal(await p.evaluate(() => state.lastPlayerRoll.healTarget), 0);
  assert.equal(await p.evaluate(() => state.lastPlayerRoll.actualHealing), 1);
});

test("healing items recover another hero when the selected hero is full, but keep a partially wounded selection", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
    state.party[1].hp = 10;
    state.party[2].hp = 8;
    state.target = 0;
    state.bag = { potion: 3 };
    render();
  });
  assert.equal(await p.evaluate(() => canUseItem("potion")), true);
  await p.evaluate(() => useItem("potion"));
  assert.equal(await p.evaluate(() => state.target), 2);
  assert.ok(await p.evaluate(() => state.party[2].hp > 8));
  await p.evaluate(() => {
    state.party[0].hp = state.party[0].maxHp - 1;
    state.target = 0;
  });
  await p.evaluate(() => useItem("potion"));
  assert.equal(await p.evaluate(() => state.target), 0);
  assert.equal(await p.evaluate(() => state.party[0].hp), 50);
  await p.evaluate(() => {
    state.party.forEach((h) => (h.hp = h.maxHp));
  });
  assert.equal(await p.evaluate(() => canUseItem("potion")), false);
  assert.equal(await p.evaluate(() => state.bag.potion), 1);
});

test("options tabs reuse their title and animate it only when the menu is opened", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    window.titlePops = 0;
    window.realPop = popTitle;
    popTitle = (el) => {
      if (el?.id === "modal-title") window.titlePops++;
      return window.realPop(el);
    };
    optionsPage("play");
    window.optionsTitle = document.querySelector("#modal-title");
  });
  for (const tab of ["audio", "display", "future", "play"])
    await p.locator("#tab-" + tab).click();
  assert.equal(await p.evaluate(() => window.titlePops), 1);
  assert.equal(
    await p.evaluate(
      () => window.optionsTitle === document.querySelector("#modal-title"),
    ),
    true,
  );
  await p.locator("#modal [data-close]").last().click();
  await p.locator("#options-tab").click();
  assert.equal(await p.evaluate(() => window.titlePops), 2);
});

test("discovery clues hold their opacity then fade gradually instead of disappearing abruptly", async (t) => {
  const p = await game(t);
  await p.evaluate(blankFloor);
  const r = await p.evaluate(() => {
    const cell = state.map[state.position];
    cell.visited = true;
    cell.hintChecked = false;
    state.map[pos(2, 7)].event = "treasure";
    const rand = Math.random;
    Math.random = () => 0;
    try {
      maybeDiscoveryHint();
    } finally {
      Math.random = rand;
    }
    const el = document.querySelector(".discovery-whisper"),
      animation = el.getAnimations()[0];
    animation.pause();
    const values = [2000, 5000, 8000].map((time) => {
      animation.currentTime = time;
      return Number(getComputedStyle(el).opacity);
    });
    return { values, duration: animation.effect.getTiming().duration };
  });
  assert.equal(r.duration, 9000);
  assert.ok(r.values[0] > 0.98);
  assert.ok(r.values[1] < r.values[0] && r.values[1] > r.values[2]);
  assert.ok(r.values[2] < 0.2);
});

test("species cries cover every enemy and class, trigger at appearance and death, and use the audio controls", async (t) => {
  const p = await game(t);
  await fast(p);
  const r = await p.evaluate(async () => {
    const seen = [],
      cry = GameSound.cry;
    GameSound.cry = (kind, mood) => {
      seen.push([kind, mood]);
      return false;
    };
    try {
      beginEncounter(false, { count: 2 });
      render();
      const types = state.enemies.map((e) => e.art);
      window.entrance = encounterEntrance();
      await new Promise((r) => setTimeout(r, 30));
      document.querySelector("#stage-confirm").click();
      await window.entrance;
      state.enemies.forEach((e) => {
        e.passive = null;
        damageEnemy(e.hp + 100, "Test", e);
      });
      recordDeath(state.party[0], "Test");
      return {
        seen,
        types,
        missing: [
          ...Object.keys(ENEMY_PROFILES),
          "fighter",
          "healer",
          "rogue",
          "mage",
          "ranger",
        ].filter((id) => !CRY_PROFILES[id]),
        distinct: new Set(
          Object.values(CRY_PROFILES).map((p) => JSON.stringify(p)),
        ).size,
        total: Object.keys(CRY_PROFILES).length,
      };
    } finally {
      GameSound.cry = cry;
    }
  });
  assert.deepEqual(r.missing, []);
  assert.equal(r.distinct, r.total);
  for (const type of r.types) {
    assert.ok(r.seen.some((x) => x[0] === type && x[1] === "appear"));
    assert.ok(r.seen.some((x) => x[0] === type && x[1] === "death"));
  }
  assert.ok(r.seen.some((x) => x[0] === "fighter" && x[1] === "death"));
});

test("the layered music and creature calls synthesize audio without gameplay RNG and remain bounded and mutable by volume", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const create = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const gain = create.call(this);
      if (!window.musicAnalyser) {
        window.musicAnalyser = this.createAnalyser();
        gain.connect(window.musicAnalyser);
      }
      return gain;
    };
  });
  await p.locator("#options-tab").click();
  await p.locator("#tab-audio").click();
  await p.locator("#sound-preview").click();
  await p.waitForFunction(() => GameSound.context?.state === "running");
  const r = await p.evaluate(async () => {
    const before = GameSound.stats.musicNotes,
      rand = Math.random;
    let calls = 0;
    Math.random = () => {
      calls++;
      return 0.5;
    };
    try {
      GameSound.cry("rat", "appear");
      GameSound.cry("healer", "death");
      setPreference("sfxVolume", 0);
      setPreference("ambienceVolume", 0);
      await new Promise((r) => setTimeout(r, 1200));
      const notes = GameSound.stats.musicNotes - before;
      const samples = new Float32Array(window.musicAnalyser.fftSize);
      window.musicAnalyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(
        samples.reduce((sum, v) => sum + v * v, 0) / samples.length,
      );
      setPreference("muted", true);
      const muted = GameSound.cry("pursuer");
      return {
        notes,
        rms,
        calls,
        muted,
        cries: GameSound.stats.cries,
        voices: GameSound.stats.peakVoices,
        phrases: MUSIC_SCORE.melody.length,
        chords: MUSIC_SCORE.chords.length,
      };
    } finally {
      Math.random = rand;
    }
  });
  assert.ok(r.notes >= 1);
  assert.ok(
    r.rms > 0.00001,
    "music produces a real audio signal with SFX and ambience silenced",
  );
  assert.equal(r.calls, 0);
  assert.equal(r.muted, false);
  assert.ok(r.cries >= 2);
  assert.ok(r.voices <= 20);
  assert.ok(r.phrases >= 64 && r.chords >= 4);
});

test("final automatic banking reconciles an interrupted run write and extends an older partial tenth-floor deposit once", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.depth = 10;
    state.won = true;
    state.over = true;
    state.gold = 125;
    state.bankedFloors[10] = 25;
    const profile = emptyProfile();
    profile.gold = 25;
    profile.deposits[state.runId + ":10"] = 25;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    const before = JSON.stringify(state);
    const amount = bankVictoryGold(),
      first = campProfile().gold;
    localStorage.setItem(SAVE_KEY, before);
    load();
    save();
    load();
    return {
      amount,
      first,
      after: campProfile().gold,
      carried: state.gold,
      ack: state.bankedFloors[10],
    };
  });
  assert.deepEqual(r, {
    amount: 125,
    first: 150,
    after: 150,
    carried: 0,
    ack: 150,
  });
});

test("victory storage failure retains the reward and offers a retry without any percentage bank choices", async (t) => {
  const p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.depth = 10;
    state.gold = 80;
    state.floorBossDefeated = true;
    window.realStorageWrite = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === PROFILE_KEY) throw Error("Storage is full");
      return window.realStorageWrite.call(this, key, value);
    };
    finishVictory();
    Storage.prototype.setItem = window.realStorageWrite;
  });
  assert.equal(await p.evaluate(() => state.gold), 380);
  assert.equal(await p.locator("[data-bank]").count(), 0);
  assert.equal(await p.evaluate(() => state.victoryBankPending), true);
  await p.locator("[data-retry-victory-bank]").click();
  assert.equal(await p.evaluate(() => state.gold), 0);
  assert.equal(await p.evaluate(() => campProfile().gold), 380);
  assert.equal(await p.locator("[data-retry-victory-bank]").count(), 0);
  assert.equal(await p.locator("[data-run-gold]").textContent(), "0");
});

test("floor and final celebrations launch paper fireworks with a much larger final burst, without gameplay RNG", async (t) => {
  const p = await game(t);
  await fast(p);
  const r = await p.evaluate(async () => {
    const rand = Math.random;
    let calls = 0;
    Math.random = () => {
      calls++;
      return 0.5;
    };
    try {
      showSpotlight("Floor clear", "", "", "floor-clear");
      particles = [];
      celebrationFireworks(document.querySelector("#stage-card"));
      await new Promise((r) => setTimeout(r, 240));
      const floor = particles.filter((p) => p.kind === "firework").length;
      closeSpotlight();
      openModal("Victory", "", "end");
      particles = [];
      celebrationFireworks(document.querySelector("#modal"), true);
      await new Promise((r) => setTimeout(r, 240));
      const final = particles.filter((p) => p.kind === "firework").length;
      return { floor, final, calls };
    } finally {
      Math.random = rand;
    }
  });
  assert.ok(r.floor >= 48);
  assert.ok(r.final > r.floor);
  assert.equal(r.calls, 0);
});
