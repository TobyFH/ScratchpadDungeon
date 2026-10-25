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

test("physical and spell tiers are exactly 1–4, with shared readable healing/block powers and unchanged matches", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    return Object.keys(CLASS_BALANCE).map((job) => {
      const h = makeHero("Test", job);
      return {
        job,
        tiers: [1, 2, 3, 4].map((tier) => ({
          attack: calculate([{ type: "attack", tier }]).attack,
          spell: calculate([{ type: "magic", tier }]).magic,
          heal: calculate([{ type: "heal", tier }]).heal,
          block: calculate([{ type: "block", tier }]).block,
          description: faceDescription({ type: "attack", tier }, h),
          magicDescription: faceDescription({ type: "magic", tier }, h),
        })),
        pair: matchCount([
          { type: "attack", tier: 1 },
          { type: "class", tier: 1 },
          { type: "attack", tier: 1 },
        ]),
        mixed: matchCount([
          { type: "attack", tier: 1 },
          { type: "attack", tier: 2 },
          { type: "attack", tier: 1 },
        ]),
      };
    });
  });
  for (const h of r) {
    h.tiers.forEach((x, i) => {
      assert.equal(x.attack, i + 1);
      assert.equal(x.spell, i + 1);
      assert.equal(x.heal, (i + 1) * 2);
      assert.equal(x.block, (i + 1) * 2);
      assert.match(x.description, new RegExp(`Deal ${i + 1} physical damage`));
      assert.match(x.magicDescription, /spell damage/);
    });
    assert.equal(h.pair, 3);
    assert.equal(h.mixed, 2);
  }
});

test("real hero and Flurry critical dispatch uses class pools; well and loot pools remain independent", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const symbols = Array.from({ length: 3 }, () => ({
        type: "attack",
        tier: 1,
      })),
      rows = [];
    for (const job of Object.keys(CLASS_BALANCE)) {
      const h = makeHero(job, job);
      state.party = [h];
      Math.random = () => 0.999999;
      rows.push({
        job,
        pool: criticalPool(h),
        actual: await heroCriticalMultiplier(h, symbols, calculate(symbols)),
        top: Math.max(...criticalPool(h)),
        mean: meanCritical(h),
      });
    }
    return {
      rows,
      enemy: criticalPool(null, { enemy: true }),
      well: criticalPool(null, { context: "well" }),
      loot: criticalPool(null),
      noMatch: await heroCriticalMultiplier(
        state.party[0],
        [
          { type: "attack", tier: 1 },
          { type: "heal", tier: 1 },
          { type: "blank", tier: 1 },
        ],
        {},
      ),
    };
  });
  for (const row of r.rows) {
    assert.equal(row.actual, row.top);
    assert.ok(row.mean > 1);
  }
  assert.ok(
    r.rows.find((x) => x.job === "rogue").mean >
      r.rows.find((x) => x.job === "fighter").mean,
  );
  assert.deepEqual(r.enemy, [1.25, 1.25, 1.5, 1.5]);
  assert.deepEqual(r.well, [1.25, 1.25, 1.5, 1.75]);
  assert.deepEqual(r.loot, [2, 2.5, 3, 4]);
  assert.equal(r.noMatch, 1);
});

test("all floor budgets rise monotonically and the final guardian has top-tier attacks and three strikes", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.runRules = [];
    return {
      rows: Array.from({ length: 10 }, (_, i) => ({
        ordinary: enemyBalance(i + 1, { species: "skull" }),
        boss: enemyBalance(i + 1, { boss: true, species: "skull" }),
      })),
      final: enemyReels("smudger", 10, { boss: true }),
      types: Object.keys(ENEMY_PROFILES),
      early: enemyBalance(1, { boss: true }),
    };
  });
  for (let i = 1; i < 10; i++)
    for (const kind of ["ordinary", "boss"]) {
      assert.ok(r.rows[i][kind].maxHp >= r.rows[i - 1][kind].maxHp);
      assert.ok(r.rows[i][kind].damage >= r.rows[i - 1][kind].damage);
    }
  assert.equal(r.rows[9].boss.strikes, 3);
  assert.ok(
    r.final
      .flat()
      .filter((f) => ["attack", "magic"].includes(f.type))
      .every((f) => f.tier === 4),
  );
  assert.ok(r.early.damage * 1.5 < 26 / 2);
});

test("class affinities price shields, physical combos and spells differently without changing their stated base values", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const heroes = Object.fromEntries(
      Object.keys(CLASS_BALANCE).map((j) => [
        j,
        makeHero(j, j, null, [], { specialism: "defence" }),
      ]),
    );
    return {
      tankShield: classFacePrice(heroes.fighter, "block", 10),
      tankAttack: classFacePrice(heroes.fighter, "attack", 10),
      rogueAttack: classFacePrice(heroes.rogue, "attack", 10),
      mageSpell: classFacePrice(heroes.mage, "magic", 10),
      mageAttack: classFacePrice(heroes.mage, "attack", 10),
      primary: primaryFace(heroes.fighter),
      damage: Object.values(heroes).map((h) => heroDamagePower(h, 4)),
      palettes: Object.values(heroes).map((h) => ({
        job: h.job,
        damage: h.reels
          .flat()
          .some((f) => ["attack", "magic"].includes(f.type)),
        seal: h.reels.flat().filter((f) => f.type === "class").length,
      })),
    };
  });
  assert.ok(r.tankShield < r.tankAttack);
  assert.ok(r.rogueAttack < r.tankAttack);
  assert.ok(r.mageSpell < r.mageAttack);
  assert.equal(r.primary, "block");
  assert.deepEqual(r.damage, [4, 4, 4, 4, 4, 4]);
  for (const row of r.palettes) {
    assert.ok(row.damage, row.job);
    assert.equal(row.seal, 1);
  }
});

test("lesson ranks create a substantial numeric progression advantage without changing owned ranks or run snapshots", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() =>
    [0, 3, 5].map((rank) => {
      const rules = rank ? Object.keys(CAMP_LESSONS).map((k) => k + rank) : [];
      state.runRules = rules;
      const h = makeHero("Wall", "fighter", null, rules),
        base = campRollBonus({ attack: 10, magic: 10 });
      return {
        rank,
        hp: h.maxHp,
        attack: base.attack,
        spell: base.magic,
        healing: offeredHealing(h, 2),
        guard: lessonBonus("warding"),
        xp: lessonBonus("experience"),
      };
    }),
  );
  assert.deepEqual(
    r.map((x) => x.hp),
    [50, 88, 113],
  );
  assert.deepEqual(
    r.map((x) => x.attack),
    [10, 19, 25],
  );
  assert.deepEqual(
    r.map((x) => x.healing),
    [2, 8, 12],
  );
  assert.deepEqual(
    r.map((x) => x.guard),
    [0, 6, 10],
  );
  assert.deepEqual(
    r.map((x) => x.xp),
    [0, 30, 50],
  );
});

test("species keep distinct health, damage and cadence as well as their existing symbol distributions", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.runRules = [];
    return Object.fromEntries(
      ["rat", "slime", "skull", "demon"].map((s) => [
        s,
        enemyBalance(4, { species: s }),
      ]),
    );
  });
  assert.ok(r.rat.frequency < r.slime.frequency);
  assert.ok(r.slime.maxHp > r.rat.maxHp);
  assert.ok(r.demon.damage > r.slime.damage);
});

test("autofight breaks a support loop with the strongest available offence instead of reselecting the healing-heavy caster", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const mage = makeHero("Mender", "mage"),
      rogue = makeHero("Blade", "rogue");
    mage.reels = [0, 1, 2].map(() => [
      { type: "heal", tier: 4 },
      { type: "magic", tier: 1 },
      { type: "heal", tier: 4 },
    ]);
    rogue.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 4 }]);
    state.party = [mage, rogue];
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    state.party.forEach((h) => (h.hp = Math.floor(h.maxHp / 2)));
    state.autoCombat = { supportSpins: 3, staleSpins: 5 };
    const chosen = autoChooseActor(state.party.map((h, i) => ({ h, i })));
    return { chosen: chosen.h.job, offence: state.party.map(autoOffenceScore) };
  });
  assert.equal(r.chosen, "rogue");
  assert.ok(r.offence[1] > r.offence[0]);
});

test("enemy hover descriptions distinguish combined hit strength from a hero mark’s flat damage", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    beginEncounter(false, { count: 1 });
    const e = state.enemy;
    return {
      enemy: faceDescription({ type: "attack", tier: 2 }, e),
      hero: faceDescription({ type: "attack", tier: 2 }, state.party[0]),
      heal: faceDescription({ type: "heal", tier: 3 }, e),
    };
  });
  assert.match(r.enemy, /Contributes 2 physical power/);
  assert.match(r.enemy, /one combined enemy hit/);
  assert.match(r.hero, /Deal 2 physical damage/);
  assert.match(r.heal, /Restore 3 enemy HP/);
});

test("Defensive Tank and Mage starts retain useful solo damage before spending their first point", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.runRules = [];
    state.enemy = null;
    state.enemies = [];
    return ["fighter", "mage"].map((job) => {
      const h = makeHero(job, job, null, [], { specialism: "defence" });
      state.party = [h];
      return { job, damage: expectedHeroEffects(h).damage };
    });
  });
  for (const x of r) assert.ok(x.damage >= 1, JSON.stringify(x));
});
