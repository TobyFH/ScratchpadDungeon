const { test, before, after } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const { chromium } = require("playwright");
let browser, server, url;
before(async () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"));
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
async function game(t) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(async () => {
    newRun("fighter");
    setPace("skip");
    setPreference("skipCriticals", true);
    closeModal();
    closeSpotlight();
    characterLuck = () => 0.99999;
    await document.fonts.ready;
  });
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, []);
  });
  return p;
}
test("floor one is Caverns, all other eligible biomes have equal odds, and lava starts on floor five", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    let seed = 81923;
    Math.random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const counts = {};
    for (const depth of [1, 2, 4, 5, 10]) {
      const n = {};
      for (let i = 0; i < 18000; i++) {
        const k = chooseFloorBiome(depth);
        n[k] = (n[k] || 0) + 1;
      }
      counts[depth] = n;
    }
    return { counts, early: availableBiomes(2), late: availableBiomes(5) };
  });
  assert.deepEqual(r.counts[1], { cave: 18000 });
  assert.equal(r.early.length, 8);
  assert.ok(!r.early.includes("lava"));
  assert.equal(r.late.length, 9);
  for (const depth of [2, 4, 5, 10]) {
    const values = Object.values(r.counts[depth]),
      expected = 18000 / values.length;
    assert.ok(
      values.every((n) => Math.abs(n - expected) < expected * 0.12),
      JSON.stringify(r.counts[depth]),
    );
  }
});
test("recruitment grows with depth and incomplete parties; floor two guarantees an offer tile until an early wanderer was met", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    let missing = 0,
      seed = 111;
    Math.random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    state.earlyRecruitOffered = false;
    for (let n = 0; n < 450; n++) {
      const map = generateFloor(2, 1, 0, [], Object.keys(BIOMES)[n % 9]);
      if (!map.some((c) => c.event === "recruit")) missing++;
      if (!allTilesCanReachStairs(map)) throw Error("recruit broke path");
    }
    const chances = [1, 2, 3].map((size) =>
      [1, 4, 7, 10].map((d) => recruitChance(size, 0, d)),
    );
    state.earlyRecruitOffered = true;
    save();
    load();
    const restored = state.earlyRecruitOffered;
    newRun("fighter");
    return {
      missing,
      chances,
      due: earlyRecruitDue(2),
      reset: state.earlyRecruitOffered,
      restored,
      other: earlyRecruitDue(3),
    };
  });
  assert.equal(r.missing, 0);
  assert.ok(r.restored && r.due);
  assert.equal(r.reset, false);
  assert.equal(r.other, false);
  for (const c of r.chances) assert.ok(c.every((v, i) => !i || v > c[i - 1]));
  for (let i = 0; i < 4; i++)
    assert.ok(
      r.chances[0][i] > r.chances[1][i] && r.chances[1][i] > r.chances[2][i],
    );
});
test("meeting and declining a floor-one companion satisfies the guarantee and survives reload", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    Math.random = () => 0.99;
    window.offer = recruitEncounter();
  });
  await p.locator("#recruit-decline").click();
  await p.evaluate(() => window.offer);
  const r = await p.evaluate(() => {
    save();
    load();
    return {
      offered: state.earlyRecruitOffered,
      due: earlyRecruitDue(2),
      party: state.party.length,
    };
  });
  assert.deepEqual(r, { offered: true, due: false, party: 1 });
});
test("tough foes lose endurance and repeated defensive faces while early attacks gain pressure and final multi-strikes remain", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const old = [28, 36, 47, 60, 76, 94, 116, 140, 168, 205];
    const rows = FLOOR_BALANCE.map((row, i) => ({
      hp: row.bossHp,
      old: old[i],
      pressure: enemyHitPressure(i + 1),
    }));
    const reels = enemyReels("slime", 10, { boss: true });
    const armour = enemyArmour(
      { boss: true, passive: { key: "carapace" } },
      10,
    );
    return {
      rows,
      reels,
      armour,
      wind: enemySecondWindRate({ boss: true }),
      strong: enemyBalance(7, {
        elite: true,
        stronghold: true,
        species: "pageeater",
      }).maxHp,
      final: enemyBalance(10, { boss: true }),
    };
  });
  for (const [i, row] of r.rows.entries()) {
    assert.ok(row.hp < row.old && row.hp >= row.old * 0.8);
    assert.equal(row.pressure > 1, i < 7);
  }
  for (const reel of r.reels) {
    for (const type of ["block", "heal", "stun"])
      assert.ok(reel.filter((f) => f.type === type).length <= 1);
    assert.ok(
      reel.filter((f) => f.type === "attack").every((f) => f.tier === 4),
    );
    assert.ok(
      reel
        .filter((f) => ["block", "heal"].includes(f.type))
        .every((f) => f.tier <= 2),
    );
  }
  assert.equal(r.armour, 1);
  assert.equal(r.wind, 0.18);
  assert.equal(r.final.strikes, 3);
  assert.ok(r.strong < 130);
});
test("stimulant overflow advances every two extra doses, retains three turns and migrates residual doses idempotently", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    applyStimulant(h, 3);
    applyStimulant(h, 2);
    const stacked = { ...h.stimulant };
    for (let i = 0; i < 30; i++) applyStimulant(h, 4);
    const cap = { ...h.stimulant },
      damage = stimulantDamageBonus(h),
      defence = stimulantDefenceBonus(h);
    h.stimulant = { turns: 3, power: 4, overflow: 2, appliedAt: 0 };
    normaliseStimulant(h);
    const migrated = { ...h.stimulant };
    normaliseStimulant(h);
    return { stacked, cap, damage, defence, migrated, again: h.stimulant };
  });
  assert.equal(r.stacked.power, 4);
  assert.equal(r.cap.power, 8);
  assert.equal(r.cap.turns, 3);
  assert.equal(r.damage, 5);
  assert.equal(r.defence, 2);
  assert.equal(r.migrated.power, 5);
  assert.equal(r.migrated.overflow, 0);
  assert.deepEqual(r.migrated, r.again);
});
test("late Mage healing and healing Resonance grow without increasing raw rank powers or changing self-heal targeting", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const h = makeHero("Mira", "mage", null, [], { specialism: "defence" });
    state.party = [h];
    h.level = 10;
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    h.initiative = null;
    const a = await planHeroRoll(h, [
      { type: "heal", tier: 4 },
      { type: "class", tier: 1, job: "mage" },
      { type: "heal", tier: 4 },
    ]);
    return {
      early: classHealingPower({ job: "mage", level: 4 }, 24),
      late: classHealingPower(h, 24),
      max: classHealingPower({ job: "mage", level: 30 }, 24),
      raw: calculate([{ type: "heal", tier: 4 }]).heal,
      plan: a,
      role: mageResonance(h, [
        { type: "selfheal", tier: 4 },
        { type: "class", tier: 1 },
      ]),
    };
  });
  assert.equal(r.early, 24);
  assert.equal(r.late, 31);
  assert.equal(r.max, 34);
  assert.equal(r.raw, 8);
  assert.ok(r.plan.heal >= 22 && r.plan.teamHeal >= 13, JSON.stringify(r));
  assert.equal(r.role, "heal");
});
test("temperaments add only relevant landed effects and stack with visible trait bonuses", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      base = {
        attack: 2,
        magic: 1,
        heal: 3,
        selfHeal: 2,
        teamHeal: 4,
        block: 4,
        poison: 2,
        stun: 1,
      };
    const off = temperamentEffects({ specialism: "offence" }, { ...base }),
      def = temperamentEffects({ specialism: "defence" }, { ...base }),
      empty = temperamentEffects(
        { specialism: "offence" },
        { attack: 0, poison: 0 },
      );
    h.trait = { id: "heroic" };
    h.specialism = "offence";
    const plan = await planHeroRoll(h, [
      { type: "attack", tier: 1 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ]);
    return {
      off,
      def,
      empty,
      plan,
      trait: traitBonus(h, "attack"),
      help: SPECIALISMS.offence.description,
      bookish: HERO_TRAITS.bookish.effects.xp,
    };
  });
  assert.equal(r.off.attack, 3);
  assert.equal(r.off.magic, 2);
  assert.equal(r.off.poison, 3);
  assert.equal(r.off.heal, 3);
  assert.equal(r.def.attack, 2);
  assert.equal(r.def.heal, 4);
  assert.equal(r.def.block, 5);
  assert.equal(r.def.stun, 2);
  assert.deepEqual(r.empty, { attack: 0, poison: 0 });
  assert.equal(r.trait, 2);
  assert.equal(r.plan.attack, 4);
  assert.match(r.help, /\+1/);
  assert.equal(r.bookish, 0.08);
});
async function nest(p, contents) {
  await p.evaluate((contents) => {
    const c = state.map[state.position];
    c.event = c.feature = "nest";
    c.nestContents = contents;
    window.nestTask = resolveExpansionTile(c);
  }, contents);
  await p.locator("#biome-leave").waitFor();
}
test("nests persist one exclusive reward; declining cannot reroll contents or summon a mother", async (t) => {
  const p = await game(t);
  for (const contents of ["gold", "egg"]) {
    await nest(p, contents);
    assert.equal(
      await p.locator("#nest-loot").count(),
      contents === "gold" ? 1 : 0,
    );
    assert.equal(
      await p.locator("#nest-egg").count(),
      contents === "egg" ? 1 : 0,
    );
    await p.locator("#biome-leave").click();
    await p.evaluate(() => window.nestTask);
    assert.equal(
      await p.evaluate(() => state.map[state.position].nestContents),
      contents,
    );
    assert.equal(await p.evaluate(() => !!state.enemy), false);
  }
  assert.ok(
    await p.evaluate(() => lootFaces("nest").every((f) => f.type === "coin")),
  );
});
test("both nest contents use the same fifty-fifty mother check after a genuine claim", async (t) => {
  const p = await game(t);
  for (const contents of ["gold", "egg"])
    for (const luck of [0.499, 0.5]) {
      await p.evaluate((luck) => {
        state.bag = {};
        window.mothers = 0;
        expansionBattle = async () => {
          mothers++;
        };
        treasureRoll = async (source) => {
          state.lastNestSource = source;
        };
        Math.random = () => luck;
      }, luck);
      await nest(p, contents);
      await p.locator(contents === "gold" ? "#nest-loot" : "#nest-egg").click();
      await p.evaluate(() => window.nestTask);
      const r = await p.evaluate(() => ({
        mothers,
        egg: state.bag.nestEgg || 0,
        source: state.lastNestSource,
      }));
      assert.equal(r.mothers, luck < 0.5 ? 1 : 0);
      if (contents === "egg") assert.equal(r.egg, 1);
      else assert.equal(r.source, "nest");
    }
});
test("leaving an egg at a full satchel preserves it and cannot wake the mother", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.bag = { potion: 1, bomb: 1, ward: 1 };
    window.mothers = 0;
    expansionBattle = async () => {
      mothers++;
    };
    Math.random = () => 0;
  });
  await nest(p, "egg");
  assert.match(await p.locator("#nest-egg").innerText(), /BAG FULL/);
  await p.locator("#nest-egg").click();
  await p.locator("#item-leave").click();
  await p.evaluate(() => window.nestTask);
  const r = await p.evaluate(() => ({
    mothers,
    event: state.map[state.position].event,
    contents: state.map[state.position].nestContents,
    egg: state.bag.nestEgg || 0,
  }));
  assert.deepEqual(r, { mothers: 0, event: "nest", contents: "egg", egg: 0 });
});
test("returned companions are slightly more frequent, remain one-shot and never resurrect the hero", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.graveyard = [{ id: "lost", name: "Wren", depth: 1, hp: 0 }];
    Math.random = () => 0.11;
    const chosen = chooseReturnedHero(2),
      again = chooseReturnedHero(3);
    return {
      id: chosen?.id,
      again,
      hp: state.graveyard[0].hp,
      chance: ENCOUNTER_TUNING.returnedHeroChance,
      shop: WORLD_BALANCE.shopChance,
    };
  });
  assert.equal(r.id, "lost");
  assert.equal(r.again, null);
  assert.equal(r.hp, 0);
  assert.equal(r.chance, 0.12);
  assert.equal(r.shop, 0.46);
});

test("old floor-two saves gain the missing recruit once without moving walls or spending gameplay randomness", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.depth = 2;
    state.earlyRecruitOffered = false;
    state.map = generateFloor(2);
    state.map.forEach((c) => {
      if (c.event === "recruit") {
        c.event = null;
        c.feature = null;
      }
    });
    const walls = state.map.map((c) => c.wall);
    save();
    let calls = 0;
    const old = Math.random;
    Math.random = () => {
      calls++;
      return 0.5;
    };
    load();
    const first = state.map.findIndex((c) => c.event === "recruit");
    save();
    load();
    Math.random = old;
    return {
      calls,
      first,
      second: state.map.findIndex((c) => c.event === "recruit"),
      count: state.map.filter((c) => c.event === "recruit").length,
      walls:
        JSON.stringify(walls) === JSON.stringify(state.map.map((c) => c.wall)),
    };
  });
  assert.equal(r.calls, 0);
  assert.ok(r.first >= 0 && r.walls);
  assert.equal(r.first, r.second);
  assert.equal(r.count, 1);
});
test("a real empty-nest treasure roll pays gold through its own confirmed coin-only scene", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    runMachine = async () => [
      { type: "coin", tier: 1 },
      { type: "coin", tier: 2 },
      { type: "coin", tier: 1 },
    ];
    rollCritical = async () => 1;
    window.coins = treasureRoll("nest");
  });
  await p.locator("#stage-confirm").waitFor();
  assert.match(
    await p.locator("#stage-title").innerText(),
    /Coins in the nest/i,
  );
  const r = await p.evaluate(() => ({
    source: state.lastLoot.source,
    gold: state.lastLoot.gold,
    bag: Object.keys(state.bag).length,
    pending: state.pendingItems.length,
  }));
  assert.equal(r.source, "nest");
  assert.equal(r.gold, 23);
  assert.equal(r.bag, 0);
  assert.equal(r.pending, 0);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.coins);
});

test("faster returning shadow applies to existing deadlines, pauses for menus and combat, and preserves discoveries", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.map[0].biome = "shadow";
    state.map[0].shadowClock = 0;
    for (const c of state.map) {
      c.visited = false;
      c.shadowCovered = false;
    }
    const i = pos(4, 4),
      c = state.map[i];
    Object.assign(c, {
      wall: false,
      seen: true,
      visited: true,
      event: "well",
      feature: "well",
      activated: false,
      shadowDue: 38,
    });
    for (let n = 0; n < 10; n++) advanceShadowTime(2);
    const before = {
      clock: state.map[0].shadowClock,
      covered: c.shadowCovered,
    };
    help();
    advanceShadowTime(2);
    const menuClock = state.map[0].shadowClock;
    closeModal();
    state.enemy = { hp: 1 };
    advanceShadowTime(2);
    const battleClock = state.map[0].shadowClock;
    state.enemy = null;
    advanceShadowTime(2);
    const after = {
      clock: state.map[0].shadowClock,
      covered: c.shadowCovered,
      event: c.event,
      activated: c.activated,
      known: c.seen,
    };
    state.map[0].biome = "cave";
    advanceShadowTime(2);
    return {
      before,
      menuClock,
      battleClock,
      after,
      otherBiomeClock: state.map[0].shadowClock,
    };
  });
  assert.ok(Math.abs(r.before.clock - 36) < 1e-8);
  assert.equal(r.before.covered, false);
  assert.equal(r.menuClock, r.before.clock);
  assert.equal(r.battleClock, r.before.clock);
  assert.ok(Math.abs(r.after.clock - 39.6) < 1e-8);
  assert.deepEqual(
    { ...r.after, clock: 0 },
    {
      clock: 0,
      covered: true,
      event: "well",
      activated: false,
      known: true,
    },
  );
  assert.equal(r.otherBiomeClock, r.after.clock);
});
