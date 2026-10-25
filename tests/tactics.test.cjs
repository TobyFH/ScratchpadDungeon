const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const { chromium } = require("playwright");
let browser, server, url;
before(async () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"));
  server = http.createServer((q, r) => {
    r.setHeader("Content-Type", "text/html");
    r.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
});
async function game(t) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      characterLuck = () => 0.999999;
    });
  });
  await p.goto(url);
  await p.evaluate(() => {
    newRun("fighter", { specialism: "offence" });
    setPace("skip");
    setPreference("skipCriticals", true);
  });
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, [], "no browser errors");
  });
  return p;
}

test("temperament is only selectable at the start, Mages have no role stat or selector, and old edited builds migrate intact", async (t) => {
  const p = await game(t);
  await p.evaluate(() => chooseStartingClass());
  assert.equal(await p.locator("[data-start-job]").count(), 3);
  assert.equal(await p.locator("#starter-role").count(), 0);
  await p.locator("#starter-specialism").selectOption("defence");
  await p.locator('[data-start-job="mage"]').click();
  assert.deepEqual(
    await p.evaluate(() => ({
      spec: state.party[0].specialism,
      role: "mageRole" in state.party[0],
    })),
    { spec: "defence", role: false },
  );
  await p.evaluate(() => editor(0));
  assert.match(await p.locator(".hero-specialism").textContent(), /Defensive/);
  assert.equal(await p.locator("#mage-role,#starter-specialism").count(), 0);
  const result = await p.evaluate(() => {
    closeModal();
    const h = state.party[0];
    h.hp = 11;
    h.points = 29;
    h.mageRole = "poison";
    h.reels[0][0].tier = 4;
    state.version = 16;
    save();
    const loaded = load();
    return {
      loaded,
      version: state.version,
      hp: state.party[0].hp,
      points: state.party[0].points,
      tier: state.party[0].reels[0][0].tier,
      role: "mageRole" in state.party[0],
    };
  });
  assert.deepEqual(result, {
    loaded: true,
    version: 21,
    hp: 11,
    points: 29,
    tier: 4,
    role: false,
  });
});

test("Mage Resonance follows the rolled marks in the same build and healing Resonance clears the party stuns", async (t) => {
  const p = await game(t);
  const result = await p.evaluate(async () => {
    newRun("mage", { specialism: "defence" });
    setPace("skip");
    setPreference("skipCriticals", true);
    state.party.push(makeHero("Ally", "rogue"));
    beginEncounter(false, { count: 2 });
    state.enemies.forEach((e) => {
      e.hp = e.maxHp = 500;
      e.countdown = 99;
      e.passive = null;
    });
    setEnemyBlock(0);
    state.party[1].stun = 1;
    state.party[1].hp = 5;
    const h = state.party[0],
      seal = { type: "class", tier: 1, job: "mage" };
    h.reels = [
      [{ type: "heal", tier: 1 }],
      [seal],
      [{ type: "heal", tier: 2 }],
    ];
    render();
    await spin(0);
    const heal = {
      stun: state.party[1].stun,
      hp: state.party[1].hp,
      resonance: h.lastResonance,
      role: "mageRole" in h,
    };
    h.reels = [
      [{ type: "magic", tier: 1 }],
      [seal],
      [{ type: "magic", tier: 2 }],
    ];
    state.enemies.forEach((e) => (e.countdown = 99));
    render();
    const before = state.enemies.map((e) => e.hp);
    await spin(0);
    return {
      heal,
      magic: h.lastResonance,
      hits: state.enemies.map((e, i) => before[i] - e.hp),
      ability: state.lastClassAbility.name,
    };
  });
  assert.equal(result.heal.stun, 0);
  assert.ok(result.heal.hp > 5);
  assert.equal(result.heal.resonance, "heal");
  assert.equal(result.heal.role, false);
  assert.equal(result.magic, "magic");
  assert.ok(result.hits.every((n) => n > 0));
  assert.match(result.ability, /RESONANCE/);
});

test("Berserker Fury comes from HP wounds and Blood Price, scales damage, has a visible bar, and every editing path enforces its restricted wheel", async (t) => {
  const p = await game(t);
  const result = await p.evaluate(async () => {
    newRun("berserker", { specialism: "offence" });
    setPace("skip");
    setPreference("skipCriticals", true);
    beginEncounter();
    state.enemy.hp = state.enemy.maxHp = 600;
    state.enemy.countdown = 99;
    state.enemy.passive = null;
    setEnemyBlock(0);
    const h = state.party[0];
    h.initiative = null;
    state.block = 4;
    damageHero(0, 6, "Test wound");
    const wound = { hp: h.hp, fury: h.fury };
    h.points = 40;
    const illegal = ["magic", "poison", "block", "stun"].map((type) =>
      applyFaceEdit(h, 0, 0, "swap", type),
    );
    h.reels = [
      [{ type: "selfharm", tier: 2 }],
      [{ type: "class", tier: 1, job: "berserker" }],
      [{ type: "attack", tier: 2 }],
    ];
    render();
    await spin(0);
    const charged = {
      hp: h.hp,
      fury: h.fury,
      bonus: furyBonus(h),
      damage: state.lastPlayerRoll.totals.attack,
    };
    const bar = document.querySelector(".fury-meter")?.textContent;
    clearBattleStatuses();
    return { wound, charged, illegal, bar, cleared: h.fury };
  });
  assert.equal(result.wound.hp, 36);
  assert.equal(result.wound.fury, 3);
  assert.ok(result.illegal.every((x) => x === false));
  assert.equal(
    result.charged.hp,
    38,
    "Bloodrush and Fury lifesteal offset the Blood Price wound",
  );
  assert.equal(result.charged.fury, 18);
  assert.equal(result.charged.bonus, 4);
  assert.equal(
    result.charged.damage,
    9,
    "rank-II blade + Bloodrush + pre-roll Fury, without a temperament damage modifier",
  );
  assert.match(result.bar, /FURY 18\/24/);
  assert.equal(result.cleared, 0);
});

test("early damage rises per floor, the middle-floor Unwritten is stronger, and its loot reels guarantee an improved supply", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const early = [1, 2, 3, 4].map(
      (d) => enemyBalance(d, { species: "skull" }).damage,
    );
    const foes = [4, 5, 6, 7].map((d) => ({
      normal: enemyBalance(d, { species: "skull" }),
      chaser: enemyBalance(d, { species: "pursuer" }),
    }));
    state.depth = 4;
    const faces = lootFaces("unwritten"),
      items = faces.filter((f) => ITEM_DEFS[f.type]);
    return {
      early,
      foes,
      items: items.map((f) => ({
        quality: ITEM_DEFS[f.type].quality || 0,
        equipment: !!ITEM_DEFS[f.type].equipment,
        scalable: SUPPLY_FAMILIES.includes(ITEM_DEFS[f.type].family),
      })),
      weights: WORLD_BALANCE,
      marketDescription: CAMP_UNLOCKS.markets.description,
    };
  });
  assert.ok(r.early.every((n, i) => i === 0 || n > r.early[i - 1]));
  assert.ok(
    r.foes.every(
      (x) =>
        x.chaser.maxHp > x.normal.maxHp * 1.5 &&
        x.chaser.damage > x.normal.damage,
    ),
  );
  assert.ok(r.items.length > 5);
  assert.match(r.marketDescription, /66%.*40%/);
  assert.ok(r.items.every((i) => !i.scalable || i.quality >= 3));
  assert.ok(
    r.weights.shopChance > 0.3 &&
      r.weights.riverChance > 0.35 &&
      r.weights.relicWeight > 18,
  );
});

test("poison has at most three remaining turns and repeated doses increase actual tick damage instead of an oversized duration", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    beginEncounter();
    const e = state.enemy;
    e.hp = e.maxHp = 200;
    e.passive = null;
    setEnemyBlock(0);
    state.actionSerial = 1;
    applyPoison(e, 1, state.party[0]);
    const first = { ...e.poison };
    for (let i = 0; i < 5; i++) applyPoison(e, 1, state.party[0]);
    const stacked = { ...e.poison };
    state.actionSerial = 2;
    await tickPoison();
    return { first, stacked, lost: 200 - e.hp, remaining: e.poison.turns };
  });
  assert.equal(r.first.damage, 1);
  assert.ok(r.stacked.turns <= 3);
  assert.ok(r.stacked.damage > 1);
  assert.equal(r.lost, r.stacked.damage);
  assert.equal(r.remaining, 2);
});

test("strong stuns can pierce shields, stun and magic can expose Vulnerable, and healing clears stun with a block-sensitive chance", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const rng = Math.random;
    Math.random = () => 0;
    beginEncounter();
    setEnemyBlock(2);
    stunEnemy(1);
    const weak = { block: enemyBlock(), stun: state.enemy.stun };
    setEnemyBlock(2);
    stunEnemy(4);
    const strong = {
      block: enemyBlock(),
      stun: state.enemy.stun,
      vulnerable: !!state.enemy.vulnerable,
    };
    const e = state.enemy;
    state.actionSerial++;
    const hit = vulnerableDamage(e, 8);
    const consumed = !e.vulnerable;
    Math.random = () => 0.5;
    const h = state.party[0];
    h.stun = 1;
    state.block = 0;
    const light = clearStuns(h, 10);
    h.stun = 1;
    state.block = 20;
    const heavy = clearStuns(h, 10);
    const bigger = clearStuns(h, 60);
    Math.random = rng;
    return { weak, strong, hit, consumed, light, heavy, bigger };
  });
  assert.deepEqual(r.weak, { block: 0, stun: 0 });
  assert.deepEqual(r.strong, { block: 0, stun: 1, vulnerable: true });
  assert.equal(r.hit, 10);
  assert.equal(r.consumed, true);
  assert.equal(r.light, true);
  assert.equal(r.heavy, false);
  assert.equal(r.bigger, true);
});

test("initiative boosts only the first party roll and is forfeited when a different hero acts first", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    state.party.push(makeHero("Other", "rogue"));
    beginEncounter();
    state.enemy.hp = state.enemy.maxHp = 500;
    state.enemy.countdown = 99;
    state.enemy.passive = null;
    setEnemyBlock(0);
    const h = state.party[0];
    state.opening = { firstRoll: true, pending: true, resolved: true };
    state.party.forEach((h) => (h.initiative = null));
    h.initiative = { multiplier: 1.25 };
    h.reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "attack", tier: 2 }],
      [{ type: "blank", tier: 1 }],
    ];
    render();
    await spin(0);
    const bonus = state.lastPlayerRoll.totals.attack;
    const expired = !h.initiative && !state.opening.firstRoll;
    state.enemy.countdown = 99;
    render();
    await spin(0);
    return { bonus, ordinary: state.lastPlayerRoll.totals.attack, expired };
  });
  assert.equal(r.bonus, 8);
  assert.equal(r.ordinary, 6);
  assert.equal(r.expired, true);
});

test("partial surprise prevents only surprised opening actors; full surprise gives enemies a real first turn", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    state.party.push(makeHero("Ready", "rogue"));
    beginEncounter();
    state.enemy.hp = state.enemy.maxHp = 500;
    state.enemy.countdown = 99;
    state.enemy.passive = null;
    setEnemyBlock(0);
    state.party.forEach((h) => {
      h.initiative = null;
      h.stun = 0;
      h.hp = h.maxHp = 100;
    });
    state.opening = {
      firstRoll: true,
      pending: true,
      resolved: true,
      surprise: true,
    };
    state.party[0].surprised = true;
    state.party[1].surprised = false;
    state.party[1].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "blank", tier: 1 }],
      [{ type: "blank", tier: 1 }],
    ];
    render();
    await spin(0);
    const blocked = state.party[0].stats.spins === 0;
    await spin(1);
    const freed = state.party.every((h) => !h.surprised);
    state.opening = {
      firstRoll: true,
      pending: true,
      resolved: false,
      surprise: true,
    };
    state.party.forEach((h) => (h.surprised = true));
    state.enemy.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1 }]);
    state.enemy.strikes = 2;
    state.enemy.damage = 4;
    state.block = 0;
    const before = state.party.reduce((n, h) => n + h.hp, 0);
    await resolveBattleOpening();
    return {
      blocked,
      freed,
      lost: before - state.party.reduce((n, h) => n + h.hp, 0),
      first: state.opening.firstRoll,
    };
  });
  assert.equal(r.blocked, true);
  assert.equal(r.freed, true);
  assert.ok(r.lost > 0);
  assert.equal(r.first, false);
});

test("enemy intent names its real chosen target and the attack follows that focus", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    state.party.push(makeHero("Focus", "rogue"));
    beginEncounter();
    const e = state.enemy;
    e.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1 }]);
    e.damage = 3;
    e.strikes = 1;
    e.intent = { goal: "finish", targetId: state.party[1].id };
    state.block = 0;
    const text = enemyIntent(e);
    await enemyTurn(e);
    return {
      text,
      target: state.lastEnemyRoll.heroId,
      expected: state.party[1].id,
    };
  });
  assert.match(r.text, /finish Focus/);
  assert.equal(r.target, r.expected);
});

test("lava lights exactly its orthogonal neighbourhood without activating discoveries and never blocks the stair route", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const i = pos(5, 4);
    state.map.forEach((c) => {
      c.seen = false;
      c.room = null;
      c.event = null;
      c.feature = null;
      c.terrain = "floor";
      c.wall = false;
    });
    state.map[i].terrain = "lava";
    state.map[i].wall = true;
    state.map[i + 1].event = "treasure";
    markSeen(i - 1);
    const seen = state.map.flatMap((c, j) => (c.seen ? [j] : []));
    let lava = 0;
    for (let n = 0; n < 120; n++) {
      const map = generateFloor(6, 1, 0, []),
        end = map.findIndex((c) => c.event === "stairs");
      if (!mapDistances(map).has(end)) throw Error("blocked stairs");
      lava += map.filter((c) => c.terrain === "lava").length;
    }
    return {
      seen,
      expected: [i, ...neighbors(i)].sort((a, b) => a - b),
      event: state.map[i + 1].event,
      lava,
      early: generateFloor(2, 1, 0, []).some((c) => c.terrain === "lava"),
    };
  });
  assert.deepEqual(
    r.seen.sort((a, b) => a - b),
    r.expected,
  );
  assert.equal(r.event, "treasure");
  assert.ok(r.lava > 5);
  assert.equal(r.early, false);
});

test("full-bag shop warning precedes payment and cancellation preserves gold and stock; generic equipment works for every class", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.gold = 100;
    state.bag = { ward: 1, bomb: 1, bandage: 1 };
    window.shopPromise = shopEncounter({ shop: { potion: 1, heal: 1 } });
  });
  await p.locator('[data-buy="potion"]').click();
  await p.waitForSelector("#shop-cancel");
  assert.equal(await p.evaluate(() => state.gold), 100);
  assert.match(
    await p.locator("#stage-card").textContent(),
    /No gold has been spent/,
  );
  await p.locator("#shop-cancel").click();
  assert.equal(await p.evaluate(() => state.gold), 100);
  assert.equal(await p.locator('[data-buy="potion"]').isEnabled(), true);
  const r = await p.evaluate(async () => {
    closeModal();
    const result = [];
    for (const job of heroJobs(["ranger"])) {
      state.party = [makeHero(job, job)];
      result.push(await equipCharacter("leatherWraps", 0, { free: true }));
    }
    state.party = [makeHero("Mage", "mage")];
    return {
      result,
      restricted: await equipCharacter("ironSignet", 0, { free: true }),
    };
  });
  assert.ok(r.result.every(Boolean));
  assert.equal(r.restricted, false);
});

test("workshop explains faces and actions, Fury and shared enemy shields fit, and tier-IV marks remain inside every reel window", async (t) => {
  const p = await game(t);
  for (const width of [1920, 1280, 390, 320]) {
    await p.setViewportSize({ width, height: width >= 1280 ? 800 : 844 });
    await p.evaluate(() => {
      newRun("berserker");
      setPace("skip");
      beginEncounter(false, { count: 2 });
      state.enemies.forEach((e, i) => {
        e.passive = { key: i ? "secondWind" : "carapace", used: false };
      });
      state.party[0].points = 40;
      state.party[0].last = [
        { type: "attack", tier: 4 },
        { type: "heal", tier: 4 },
        { type: "selfharm", tier: 4 },
      ];
      render();
    });
    await p.evaluate(() => requestFitUI());
    const faces = await p
      .locator("#machine-hero-0 .slot-window")
      .evaluateAll((nodes) =>
        nodes.map((el) => {
          const a = el.getBoundingClientRect();
          return [...el.querySelectorAll(".tier-symbol svg")].every((n) => {
            const b = n.getBoundingClientRect();
            return (
              b.left >= a.left - 1 &&
              b.right <= a.right + 1 &&
              b.top >= a.top - 1 &&
              b.bottom <= a.bottom + 1
            );
          });
        }),
      );
    assert.ok(faces.every(Boolean), "rank IV fits " + width);
    assert.equal(
      await p.locator(".enemy-team-block").count(),
      1,
      "one shield for both enemies",
    );
    const position = await p
      .locator("#enemy-team-block")
      .evaluate(
        (el) =>
          el.getBoundingClientRect().bottom <=
          document.querySelector("#enemy .enemy-art").getBoundingClientRect()
            .top +
            1,
      );
    assert.equal(
      position,
      true,
      "shared shield above the paired roster " + width,
    );
    const captionFit = await p
      .locator("#enemy .machine-shell")
      .evaluate((el) => {
        const title = el
            .querySelector(".machine-title")
            .getBoundingClientRect(),
          face = el.querySelector(".machine-face").getBoundingClientRect(),
          a = el.querySelector(".enemy-action-state").getBoundingClientRect(),
          b = el.querySelector(".enemy-trait").getBoundingClientRect();
        return title.bottom <= face.top + 1 && a.right <= b.left + 1;
      });
    assert.equal(
      captionFit,
      true,
      "intent and passive do not overlap " + width,
    );
    await p.evaluate(() => editor(0));
    assert.match(await p.locator("#modal").textContent(), /When it lands:/);
    assert.match(await p.locator("#modal").textContent(), /chance/);
    const fit = await p.locator("#modal").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        right: r.right,
        bottom: r.bottom,
        left: r.left,
        top: r.top,
        scroll: el.scrollHeight <= el.clientHeight + 2,
      };
    });
    assert.ok(
      fit.left >= -1 &&
        fit.right <= width + 1 &&
        fit.top >= 0 &&
        fit.bottom <= (width >= 1280 ? 800 : 844) + 1,
      JSON.stringify(fit),
    );
    assert.equal(fit.scroll, true);
  }
});

test("opening chances increase with party size and surprise is restricted to newly uncovered encounters", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const rng = Math.random;
    let seed = 37;
    Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    beginEncounter();
    const h = state.party[0];
    let solo = 0,
      team = 0,
      knownSurprise = 0,
      fresh = 0;
    for (let n = 0; n < 500; n++) {
      state.party = [h];
      setupBattleOpening({ fresh: false });
      solo += state.party.some((h) => h.initiative);
      knownSurprise += state.party.some((h) => h.surprised);
    }
    const allies = [h, makeHero("Two", "mage"), makeHero("Three", "berserker")];
    for (let n = 0; n < 500; n++) {
      state.party = allies;
      setupBattleOpening({ fresh: false });
      team += state.party.some((h) => h.initiative);
      setupBattleOpening({ fresh: true });
      fresh += state.party.some((h) => h.surprised);
    }
    Math.random = rng;
    return { solo, team, knownSurprise, fresh };
  });
  assert.ok(r.solo > 50 && r.solo < 140, JSON.stringify(r));
  assert.ok(r.team > r.solo + 40, JSON.stringify(r));
  assert.equal(r.knownSurprise, 0);
  assert.ok(r.fresh > 45 && r.fresh < 150, JSON.stringify(r));
});

test("dual openings announce both elite foes but reveal the second with its own entrance, and passive triggers get callouts", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    setPace("1");
    beginEncounter(false, { count: 2 });
    state.enemies[0].elite = true;
    state.enemies[0].boss = true;
    state.enemies[0].passive = { key: "secondWind", used: false };
    state.enemies[1].elite = true;
    render();
    window.dualPhases = [];
    new MutationObserver(() => {
      if (document.querySelector(".awaiting-second"))
        dualPhases.push("waiting");
      if (document.querySelector(".arriving-second"))
        dualPhases.push("arriving");
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    window.intro = encounterEntrance();
  });
  await p.waitForSelector("#stage-confirm:not(:disabled)");
  assert.equal(await p.locator(".entrance-member").count(), 2);
  assert.match(await p.locator(".encounter-tags").textContent(), /DUAL BATTLE/);
  assert.match(await p.locator(".encounter-tags").textContent(), /BOSS/);
  assert.match(await p.locator(".encounter-tags").textContent(), /Second wind/);
  assert.deepEqual(
    await p.evaluate(() => [
      dualPhases.includes("waiting"),
      dualPhases.includes("arriving"),
    ]),
    [true, true],
  );
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.intro);
  await p.evaluate(() => {
    const e = state.enemies[0];
    e.hp = 31;
    e.maxHp = 100;
    e.passive = { key: "secondWind", used: false };
    setEnemyBlock(0);
    damageEnemy(5, "Fixture", e);
  });
  assert.ok(
    (await p
      .locator(".combat-callout")
      .filter({ hasText: "SECOND WIND" })
      .count()) > 0,
  );
});

test("new travel events offer a real choice, warn before a paid full-bag trade and roll risk/reward before confirmation", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.gold = 100;
    state.bag = { ward: 1, bomb: 1, bandage: 1 };
    window.randomBefore = Math.random;
    Math.random = () => 0;
    window.trip = choiceTravelEvent("cartographer");
  });
  await p.waitForSelector("#stage-confirm");
  assert.match(await p.locator("#stage-card").textContent(), /BAG FULL/);
  assert.equal(await p.evaluate(() => state.gold), 100);
  await p.locator("#travel-leave").click();
  await p.evaluate(() => window.trip);
  assert.equal(await p.evaluate(() => state.gold), 100);
  await p.evaluate(() => {
    window.trip = choiceTravelEvent("altar");
  });
  await p.locator("#stage-confirm").click();
  await p.waitForSelector("#travel-result");
  await p.waitForSelector("#stage-confirm");
  assert.match(await p.locator("#travel-result").textContent(), /gold/);
  assert.equal(await p.evaluate(() => state.gold), 100);
  await p.locator("#stage-confirm").click();
  await p.evaluate(async () => {
    await window.trip;
    Math.random = randomBefore;
  });
  assert.ok(await p.evaluate(() => state.gold > 100));
});

test("critical readouts pulse from the original value to a large final number with an enabled fast-forward", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    setPace("1");
    setPreference("skipCriticals", false);
    window.crit = rollCritical(
      "Test",
      [0, 1, 2].map(() => ({ type: "attack", tier: 1 })),
      false,
      { details: [{ label: "Damage power", icon: "sword", value: 12 }] },
    );
  });
  await p.waitForSelector("#machine-critical");
  await p.locator("#stage-skip").click();
  await p.waitForSelector(".critical-locked .critical-payoff strong");
  await p.waitForTimeout(450);
  assert.ok(
    Number(await p.locator(".critical-payoff strong").textContent()) >= 24,
  );
  assert.equal(await p.locator("#critical-math").count(), 0);
  assert.ok(
    await p
      .locator(".critical-payoff strong")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 56),
  );
  assert.equal(await p.locator("#stage-skip").isEnabled(), true);
  await p.locator("#stage-skip").click();
  await p.evaluate(() => window.crit);
  const mixed = await p.evaluate(() => {
    const result = document.createElement("div");
    result.innerHTML = criticalPayoff(
      [
        { icon: "sword", value: 5 },
        { icon: "magic", value: 5 },
      ],
      2.5,
    );
    return {
      total: result.querySelector("strong").textContent,
      math: result.querySelector("small").textContent,
    };
  });
  assert.equal(mixed.total, "26", "mixed effects retain independent rounding");
  assert.match(mixed.math, /CRITICAL DAMAGE/);
});

test("a pending surprise opening resumes after reload without rerolling its restrictions or trapping the party", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    beginEncounter(false, { count: 1 });
    const e = state.enemy;
    e.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1 }]);
    e.damage = 3;
    e.strikes = 1;
    e.passive = null;
    state.party[0].hp = state.party[0].maxHp = 100;
    state.party[0].surprised = true;
    state.party[0].initiative = null;
    state.opening = {
      firstRoll: true,
      pending: true,
      resolved: false,
      surprise: true,
    };
    save();
  });
  await p.reload();
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.evaluate(() => state.party[0].surprised), true);
  await p.locator("#stage-confirm").click();
  await p.waitForFunction(() => !busy);
  assert.ok(await p.evaluate(() => state.party[0].hp < 100));
  assert.equal(await p.evaluate(() => openingEligible(state.party[0])), true);
});

test("generic equipment can be used from the real bag and Autoplay can resolve the new optional travel choices without manual clicks", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.bag = { leatherWraps: 1 };
    render();
  });
  assert.equal(
    await p.locator('[data-use-item="leatherWraps"]').isEnabled(),
    true,
  );
  await p.locator('[data-use-item="leatherWraps"]').click();
  assert.equal(await p.locator('[data-gear-choice="0"]').isEnabled(), true);
  await p.locator('[data-gear-choice="0"]').click();
  await p.waitForFunction(() => state.party[0].equipment === "leatherWraps");
  await p.evaluate(() => {
    state.gold = 0;
    state.autoplay = true;
    busy = true;
    window.autoTrip = choiceTravelEvent("cartographer");
  });
  await p.evaluate(() => window.autoTrip);
  assert.equal(await p.locator("#spotlight").isHidden(), true);
  await p.evaluate(() => {
    state.party[0].hp = 1;
    window.autoTrip = choiceTravelEvent("altar");
  });
  await p.evaluate(() => window.autoTrip);
  assert.equal(await p.locator("#spotlight").isHidden(), true);
  await p.evaluate(() => {
    setAutoplay(false);
    busy = false;
  });
});

test("Blood Price criticals multiply extra Fury without increasing their self-damage cost", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("berserker", { specialism: "offence" });
    setPace("skip");
    setPreference("skipCriticals", true);
    beginEncounter();
    state.enemy.countdown = 99;
    state.party[0].initiative = null;
    state.party[0].reels = [0, 1, 2].map(() => [{ type: "selfharm", tier: 1 }]);
    render();
    await spin(0);
    return {
      hp: state.party[0].hp,
      fury: state.party[0].fury,
      cost: state.lastPlayerRoll.totals.selfharm,
      bonus: state.lastPlayerRoll.totals.bloodFury,
      details: state.lastCritical.finalEffects,
    };
  });
  assert.equal(r.hp, 32);
  assert.equal(r.cost, 6);
  assert.equal(r.fury, 24);
  assert.ok(r.bonus >= 18);
  assert.ok(r.details.some((d) => d.label === "Extra Fury" && d.value >= 18));
});

test("field guide topics remain readable without scrolling on desktop, Deck and narrow phones and can be changed by keyboard", async (t) => {
  const p = await game(t);
  await p.evaluate(() => help());
  const count = await p.locator("#guide-topic option").count();
  assert.equal(count, 16);
  for (const width of [1920, 1280, 390, 320]) {
    await p.setViewportSize({
      width,
      height: width === 1920 ? 1080 : width === 1280 ? 800 : 844,
    });
    for (let i = 0; i < count; i++) {
      await p.locator("#guide-topic").selectOption(String(i));
      const layout = await p.evaluate(() => {
        const flow = document.querySelector(".modal-flow"),
          text = document.querySelector(".guide-grid li"),
          content = flow.getBoundingClientRect(),
          bounds = flow.parentElement.getBoundingClientRect();
        return {
          font:
            parseFloat(getComputedStyle(text).fontSize) *
            Number(flow.style.zoom || 1),
          fits:
            content.bottom <= bounds.bottom + 1 &&
            content.left >= bounds.left - 1 &&
            content.right <= bounds.right + 1,
          topic: document.querySelector(".guide-page-count").textContent,
        };
      });
      assert.ok(
        layout.font >= (width >= 1280 ? 14 : 12),
        JSON.stringify({ width, ...layout }),
      );
      assert.ok(layout.fits, JSON.stringify({ width, ...layout }));
    }
  }
  await p.locator("#guide-topic").selectOption("0");
  assert.equal(await p.locator("#guide-previous").isDisabled(), true);
  await p.locator("#guide-next").focus();
  await p.keyboard.press("Enter");
  assert.equal(await p.locator("#guide-topic").inputValue(), "1");
  await p.locator("#guide-previous").focus();
  await p.keyboard.press("Enter");
  assert.equal(await p.locator("#guide-topic").inputValue(), "0");
  await p.locator("#guide-topic").selectOption(String(count - 1));
  assert.equal(await p.locator("#guide-next").isDisabled(), true);
});
