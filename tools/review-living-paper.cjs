// Targeted captures: active characters, fixed treasure cards, spring-box and terrain.
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, ".."),
    out = path.join(root, "test-results/living-paper-review");
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((q, r) => {
    r.setHeader("Content-Type", "text/html");
    r.end(fs.readFileSync(path.join(root, "index.html")));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const p = await browser.newPage({
        viewport: { width: 1920, height: 1080 },
      }),
      errors = [],
      external = [],
      shots = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => {
      if (!/^(http:\/\/127\.0\.0\.1:|data:)/.test(r.url()))
        external.push(r.url());
    });
    await p.goto("http://127.0.0.1:" + server.address().port);
    await p.evaluate(async () => {
      newRun("ranger");
      setPace("skip");
      setPreference("shake", 0);
      characterLuck = () => 0.99999;
      await document.fonts.ready;
      state.party.push(makeHero("Ivo", "mage"), makeHero("Quill", "jester"));
      beginEncounter(false, { count: 2 });
      finishOpeningRoll();
      state.enemies[0].art = "ghost";
      state.enemies[0].name = state.enemies[0].baseName = "Margin wraith";
      state.enemies[1].art = "shalecrab";
      state.enemies[1].name = state.enemies[1].baseName = "Shale-back scuttler";
      state.enemies.forEach((e) => {
        e.hp = e.maxHp = 205;
        e.countdown = 20;
      });
      state.party[0].level = 10;
      state.party[0].hp = state.party[0].maxHp = 84;
      state.party[0].charge = 6;
      state.party[0].stimulant = { turns: 3, power: 3 };
      state.party[1].level = 10;
      state.party[1].hp = state.party[1].maxHp = 82;
      state.party[1].poison = { turns: 3, damage: 1 };
      state.party[2].anticipation = 5;
      state.artefacts = [
        {
          id: "long",
          name: "Iron Pennant · IV",
          key: "block",
          power: 14,
          depth: 10,
        },
      ];
      state.equippedArtefact = "long";
      render();
    });
    const shot = async (name) => {
      await p.evaluate(() => {
        fitNotebook();
        fitDialogs();
      });
      await p.waitForTimeout(150);
      await p.evaluate(() => window.scrollTo(0, window.scrollY));
      await p.screenshot({
        path: path.join(out, name + ".png"),
        fullPage: false,
      });
      shots.push(name);
    };
    await shot("party-life-1920");
    await p.setViewportSize({ width: 1280, height: 800 });
    await shot("party-life-1280");
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator("#artefact-slot").scrollIntoViewIfNeeded();
    await shot("long-treasure-390");
    await p.setViewportSize({ width: 320, height: 844 });
    await p.locator("#artefact-slot").scrollIntoViewIfNeeded();
    await shot("long-treasure-320");
    for (const palette of ["dark", "warm"]) {
      await p.setViewportSize({ width: 1280, height: 800 });
      await p.evaluate((palette) => {
        state.palette = palette;
        render();
      }, palette);
      await shot("party-life-" + palette + "-1280");
    }
    await p.setViewportSize({ width: 1920, height: 1080 });
    await p.evaluate(() => {
      state.palette = "default";
      render();
      setPace("1");
      window.spring = jackInTheBoxFX(state.party[2], state.enemies[0]);
    });
    await p.waitForFunction(
      () =>
        Number(document.querySelector(".jack-in-the-box")?.dataset.progress) >
        0.5,
    );
    await p.evaluate(() => {
      utilityOpen = true;
    });
    await shot("jack-in-the-box-1920");
    await p.evaluate(async () => {
      utilityOpen = false;
      await window.spring;
    });
    const matrix = await p.evaluate(() =>
      [1, 4, 7, 10].map((level) => {
        const h = { job: "ranger", level, charge: 6 },
          budget = floorBalance(level);
        return {
          level,
          bossHp: budget.bossHp,
          sealPower: rangerSealPower(h),
          fullHP: executionBonus(
            h,
            { hp: budget.bossHp, maxHp: budget.bossHp },
            6,
            true,
          ),
          halfHP: executionBonus(
            h,
            { hp: budget.bossHp / 2, maxHp: budget.bossHp },
            6,
            true,
          ),
          maximumHealthyCombo:
            (8 + rangerSealPower(h)) * 4 +
            executionBonus(
              h,
              { hp: budget.bossHp, maxHp: budget.bossHp },
              6,
              true,
            ),
          mageHealIV: classHealingPower({ job: "mage", level }, 8),
          wellBase: fountainBaseRate(level),
          wellRoll: fountainRollRate(level),
        };
      }),
    );
    // The terrain pass supplies this optional fixture without coupling other review scenes to it.
    if (
      await p.evaluate(() => Object.hasOwn(DEFAULT_PREFERENCES, "tileMotion"))
    ) {
      await p.evaluate(() => {
        setPace("skip");
        state.enemy = null;
        state.enemies = [];
        state.depth = 8;
        state.map.forEach((c, i) => {
          c.seen = true;
          c.wall = true;
          c.terrain = "stone";
          c.event = null;
          c.feature = null;
        });
        for (let x = 2; x < 9; x++) {
          Object.assign(state.map[pos(x, 3)], { terrain: "river", wall: true });
          Object.assign(state.map[pos(x, 4)], { terrain: "lava", wall: true });
        }
        state.map[0].biome = "lava";
        state.map[state.position].wall = false;
        state.map[state.position].terrain = "floor";
        render();
      });
      for (const [w, h] of [
        [1920, 1080],
        [1280, 800],
      ]) {
        await p.setViewportSize({ width: w, height: h });
        await shot("living-terrain-" + w);
      }
      await p.evaluate(() => setPreference("tileMotion", false));
      await shot("terrain-motion-off-1280");
    }
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify({ shots, matrix, errors, external }, null, 2),
    );
    if (errors.length || external.length)
      throw Error(JSON.stringify({ errors, external }));
    console.log(
      `Saved ${shots.length} living-paper captures; no browser errors or external requests.`,
    );
    console.log(JSON.stringify(matrix));
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
