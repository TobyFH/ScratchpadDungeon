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
      let button = document.querySelector(
        "#stage-confirm:not(:disabled),#recruit-accept:not(:disabled),#recruit-decline:not(:disabled)",
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
      beginEncounter();
      state.enemy.hp = state.enemy.maxHp = hp;
      state.enemy.countdown = countdown;
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
  assert.equal(await p.locator("#animation-speed option").count(), 4);
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
    "An unwelcome scribble",
  );
  await p.waitForTimeout(1200);
  assert.equal(await p.locator("#entrance-art").isVisible(), true);
  assert.equal(await p.evaluate(() => busy), true);
  await p.locator("#animation-speed").selectOption("2");
  await p.locator("#stage-confirm").click();
  await p.waitForSelector(".encounter-ghost");
  await finish(p);
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
  assert.equal(await p.evaluate(() => state.enemy.hp), 994);
  await faces(p, [
    ["attack", 1],
    ["attack", 1],
    ["attack", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await p.waitForSelector("#critical-result strong");
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
    info.hp - Math.ceil(9 * info.m),
  );
});

test("pace supports 1×, 2×, 5×, and Skip; Skip retains particles and impact shakes", async (t) => {
  let p = await game(t);
  for (let speed of ["2", "5", "skip", "1"]) {
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
  assert.equal(await p.evaluate(() => state.enemy.hp), 991);
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

test("beacon reveals only eight neighbours and does not activate their events", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  let r = await p.evaluate(async () => {
    state.map.forEach((c) => {
      c.seen = false;
      c.event = null;
      c.feature = null;
    });
    state.position = pos(5, 4);
    state.map[state.position].seen = true;
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
  assert.deepEqual(r.seen, r.expected);
  assert.equal(r.enemy, null);
});

test("healing well requires a click, partially revives the team, and emits green healing icons even in Skip", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    state.party[0].hp = 1;
    state.party[1].hp = 0;
    state.map[79].event = "well";
    render();
  });
  await p.locator('[data-tile="79"]').click();
  await p.waitForSelector("#stage-confirm");
  assert.deepEqual(
    await p.evaluate(() => state.party.map((h) => h.hp)),
    [1, 0],
  );
  await p.locator("#stage-confirm").click();
  await p.waitForFunction(
    () => document.querySelectorAll(".healing-glyph").length >= 8,
  );
  assert.deepEqual(
    await p.evaluate(() => state.party.map((h) => h.hp)),
    [15, 10],
  );
  assert.ok(
    await p.evaluate(() =>
      [...liveAnimations].some(
        (a) => a.juice && a.effect.target.id === "portrait-1",
      ),
    ),
  );
  await finish(p);
});

test("floor-one enemies attack every two actions and scale to faster multi-strikes", async (t) => {
  let p = await game(t);
  let scaling = await p.evaluate(() => {
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
      start: a.frequency,
      hp: a.hp,
      dmg: a.damage,
      speed: b.frequency < a.frequency,
      strikes: b.strikes > a.strikes,
      health: b.hp > a.hp,
    };
  });
  assert.equal(scaling.start, 2);
  assert.ok(scaling.hp > 30);
  assert.ok(scaling.dmg >= 6);
  assert.ok(scaling.speed && scaling.strikes && scaling.health);
});

test("weighted class reels keep tank heals rare, healer attacks rare, and rogue heals absent", async (t) => {
  let p = await game(t);
  let odds = await p.evaluate(() =>
    Object.fromEntries(
      ["fighter", "healer", "rogue"].map((job) => {
        let r = makeHero("Test", job).reels[0],
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
  assert.ok(odds.fighter.heal < 0.04);
  assert.ok(odds.healer.heal > 0.7);
  assert.ok(odds.healer.attack < 0.08);
  assert.equal(odds.rogue.heal, 0);
  assert.ok(odds.rogue.attack > 0.7);
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
  assert.equal(await p.evaluate(() => state.party[0].xp), 10);
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
        r
          .filter((s) => ["potion", "bomb", "ward"].includes(s.type))
          .reduce((n, s) => n + s.weight, 0) / sum,
      artefact: r.find((s) => s.type === "artefact").weight / sum,
    };
  });
  assert.ok(chances.items < 0.025);
  assert.ok(chances.artefact <= 0.004);
  await startEval(
    p,
    "(async()=>{let old=Math.random;Math.random=()=>0;try{await treasureRoll()}finally{Math.random=old}})()",
  );
  await p.waitForSelector("#stage-confirm");
  let counts = await p.evaluate(() => ({
    gold: state.lastLoot.gold,
    coins: particles.filter((p) => p.kind === "coin").length,
  }));
  assert.equal(counts.coins, Math.min(140, counts.gold));
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
    /Healer|Rogue|Tank/,
  );
  assert.equal(await p.locator("#stage-card .stage-art svg").count(), 1);
  assert.ok((await p.locator(".encounter-quote").textContent()).length > 10);
  await p.locator("#recruit-decline").click();
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
  assert.equal(await p.locator("#recruit-accept").count(), 0);
  await p.locator("#recruit-decline").click();
  assert.equal(await p.evaluate(() => state.party.length), 3);
});

test("shop spawns at roughly 30% per floor and adventurers are substantially rarer", async (t) => {
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
  assert.ok(rates.shops > 0.25 && rates.shops < 0.35, JSON.stringify(rates));
  assert.ok(
    rates.recruits > 0.1 && rates.recruits < 0.22,
    JSON.stringify(rates),
  );
});

test("shop purchases deduct gold, enforce stock and funds, heal the team, and reveal stairs", async (t) => {
  let p = await game(t);
  await fast(p);
  await p.evaluate(() => {
    state.gold = 300;
    state.party.push(makeHero("Mira", "healer"));
    state.party[0].hp = 1;
    state.party[1].hp = 0;
    render();
  });
  await startEval(
    p,
    "shopEncounter({shop:{potion:1,bomb:1,ward:1,heal:1,reveal:1}})",
  );
  await p.waitForSelector('[data-buy="potion"]');
  let cost = await p.evaluate(() => shopPrices().potion);
  await p.locator('[data-buy="potion"]').click();
  assert.equal(await p.evaluate(() => state.gold), 300 - cost);
  assert.equal(await p.evaluate(() => state.potions), 1);
  assert.equal(await p.locator('[data-buy="potion"]').isDisabled(), true);
  await p.locator('[data-buy="heal"]').click();
  assert.deepEqual(
    await p.evaluate(() => state.party.map((h) => h.hp)),
    [44, 32],
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
    Math.random = () => 0.999;
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
  assert.equal(await p.evaluate(() => state.enemy.hp), 986);
  assert.equal(await p.evaluate(() => passive("heal")), 0);
  await p.evaluate(() => {
    equipArtefact("c");
    state.block = 80;
    beginEncounter();
    render();
  });
  assert.equal(await p.evaluate(() => state.block), 9);
});

test("speech is class/species appropriate in battle and casual chatter pauses during fights", async (t) => {
  let p = await game(t);
  await p.evaluate(() => idleChatter());
  assert.equal(await p.locator(".speech-bubble").count(), 1);
  await encounter(p);
  assert.equal(await p.evaluate(() => idleChatter()), false);
  await p.evaluate(() => sayEnemy("attack"));
  assert.ok(
    (await p.locator('.speech-bubble[data-speaker="enemy-art"]').textContent())
      .length > 1,
  );
  await p.evaluate(() => {
    state.party[0].hp = 8;
    damageHero(0, 1, "Test");
  });
  assert.ok(
    (await p.locator('.speech-bubble[data-speaker="portrait-0"]').textContent())
      .length > 1,
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

test("stairs permit only optional descent and floor ten requires its final guardian to win", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(() => {
    state.exitFound = true;
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
    state.map = generateFloor(10);
    state.exitFound = true;
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
  await p.locator("#exit-found").click();
  await p.locator("#descend").click();
  assert.equal(await p.evaluate(() => state.won && state.over), true);
  assert.equal(
    await p.locator("#modal-title").textContent(),
    "You wrote the ending.",
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
          for (let j of neighbors(n))
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
    1,
  );
});

test("targeted healing, battle items, enemy machines, and XP on defeat obey the new rules", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await encounter(p, { countdown: 1 });
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    state.party[0].hp = 10;
    state.party[1].hp = 0;
    state.potions = 1;
    state.wards = 1;
    state.bombs = 1;
    state.enemy.reels = [1, 2, 3].map((tier) => [{ type: "attack", tier }]);
    state.enemy.damage = 3;
    render();
  });
  await p.locator('[data-target="1"]').click();
  await faces(p, [
    ["heal", 1],
    ["heal", 2],
    ["block", 1],
  ]);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.ok((await p.evaluate(() => state.party[1].hp)) > 0);
  assert.equal(await p.evaluate(() => state.party[0].xp), 0);
  await p.locator("#ward").click();
  assert.equal(await p.evaluate(() => state.wards), 0);
  await p.locator("#bomb").click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.bombs), 0);
  await p.evaluate(() => {
    state.party.forEach((h) => (h.hp = 0));
    checkDefeat();
    render();
  });
  assert.equal(await p.evaluate(() => state.party[0].xp), 0);
  assert.equal(await p.evaluate(() => state.block), 0);
  assert.equal(
    await p.locator("#modal-title").textContent(),
    "The light goes out.",
  );
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
  assert.equal(await p.evaluate(() => state.party[0].maxHp), 50);
  assert.equal((await p.evaluate(() => state.party[0].points)) >= 8, true);
  await p.locator('[data-edit="0"]').click();
  let points = await p.evaluate(() => state.party[0].points);
  await p.locator('[data-upgrade="0,0,0"]').click();
  assert.equal(await p.evaluate(() => state.party[0].points), points - 3);
  assert.equal(await p.evaluate(() => state.party[0].reels[0][0].tier), 2);
});

test("full ten-floor expedition can progress through fog, loot confirmations, battles and final descent", async (t) => {
  let p = await game(t, { auto: true });
  await fast(p);
  await p.evaluate(() => {
    state.party[0].hp = state.party[0].maxHp = 10000;
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
    } else if (s.exit && (s.depth < 10 || s.boss)) {
      await p.locator("#exit-found").click();
    } else
      await p.evaluate(async () => {
        let goal =
            state.depth === 10 && state.exitFound && !state.floorBossDefeated
              ? pos(9, 2)
              : pos(9, 1),
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
  let snapshot = await p.evaluate(() => JSON.stringify(state));
  await p.reload();
  assert.equal(await p.evaluate(() => JSON.stringify(state)), snapshot);
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
  assert.equal(await p.evaluate(() => state.version), 3);
  assert.equal(await p.evaluate(() => state.speed), "skip");
  assert.equal(await p.evaluate(() => state.relic), undefined);
  assert.doesNotMatch(await p.locator("body").textContent(), /Sunseed/);
});

test("downloaded HTML remains self-contained and playable offline with mandatory confirmations", async (t) => {
  let p = await game(t);
  let next = p.waitForEvent("download");
  await p.locator("#download").click();
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
  assert.equal(await offline.locator(".tile").count(), 99);
  await fast(offline);
  await offline.locator('[data-tile="79"]').click();
  await offline.waitForSelector("#stage-confirm");
  await offline.locator("#stage-confirm").click();
  await finish(offline);
  assert.ok((await offline.evaluate(() => state.gold)) > 0);
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
});

test("recovering from stun guarantees a real action before another stun can stick", async (t) => {
  let p = await game(t);
  await fast(p);
  await encounter(p, { countdown: 1 });
  await faces(p);
  await p.evaluate(() => {
    state.party[0].stun = 1;
    state.enemy.frequency = 1;
    state.enemy.reels = [
      [{ type: "stun", tier: 1 }],
      [{ type: "block", tier: 1 }],
      [{ type: "miss", tier: 1 }],
    ];
    render();
  });
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.equal(await p.evaluate(() => state.party[0].stun), 0);
  assert.equal(await p.evaluate(() => state.party[0].stunGrace), 1);
  let hp = await p.evaluate(() => state.enemy.hp);
  await p.locator('[data-spin="0"]').click();
  await finish(p);
  assert.ok((await p.evaluate(() => state.enemy.hp)) < hp);
  assert.equal(await p.evaluate(() => state.party[0].stun), 1);
});
