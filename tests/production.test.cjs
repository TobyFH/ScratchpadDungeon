const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises"),
  sync = require("node:fs"),
  path = require("node:path"),
  os = require("node:os"),
  http = require("node:http");
const ExcelJS = require("exceljs"),
  { chromium } = require("playwright");
const lib = require("../tools/balance-lib.cjs"),
  balance = require("../tools/balance.cjs"),
  assets = require("../tools/assets.cjs"),
  { buildHTML } = require("../tools/build.cjs");
const ROOT = path.resolve(__dirname, ".."),
  baseline = require("./fixtures/balance-baseline.json");
let browser, server, url, temp, canonical;
before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "scratchpad-production-"));
  canonical = lib.readJSON("data/balance.json");
  server = http.createServer(async (req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(await fs.readFile(path.join(ROOT, "index.html")));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (sync.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await fs.rm(temp, { recursive: true, force: true });
});
async function page(
  t,
  { width = 1280, height = 800, html, starter = false } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height },
    acceptDownloads: true,
  });
  const p = await context.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  if (html)
    await p.route(url, (route) =>
      route.fulfill({ body: html, contentType: "text/html" }),
    );
  await p.goto(url);
  if (!starter) await p.evaluate(() => newRun());
  await p.waitForTimeout(80);
  t.after(async () => {
    assert.deepEqual(errors, []);
    await context.close();
  });
  return p;
}
async function loadBook() {
  const b = new ExcelJS.Workbook();
  await b.xlsx.readFile(
    path.join(ROOT, "balance/Scratchpad-Dungeon-Balance.xlsx"),
  );
  return b;
}
function cell(book, id) {
  for (const sheet of book.worksheets) {
    let found;
    sheet.eachRow((row) => {
      if (row.getCell(1).value === id) found = row.getCell(4);
    });
    if (found) return found;
  }
  throw Error("Missing " + id);
}
async function saveBook(b, name) {
  const f = path.join(temp, name + ".xlsx");
  await b.xlsx.writeFile(f);
  return f;
}
async function padSetup(p, id = "Xbox 360 Controller") {
  await p.evaluate((id) => {
    window.testPad = {
      id,
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => (window.testPad ? [window.testPad] : []),
    });
  }, id);
}
async function press(p, action) {
  await p.evaluate((action) => {
    const index = Production.input.settings.bindings[action];
    testPad.buttons[index] = { pressed: true, value: 1 };
    Production.input.poll([testPad]);
  }, action);
  await p.waitForTimeout(45);
  await p.evaluate(() => {
    testPad.buttons = testPad.buttons.map(() => ({ pressed: false, value: 0 }));
    Production.input.poll([testPad]);
  });
  await p.waitForTimeout(45);
}
async function focusMenu(p, selector) {
  for (let i = 0; i < 100; i++) {
    if (
      await p.evaluate((sel) => document.activeElement?.matches(sel), selector)
    )
      return;
    await press(p, "nextHero");
  }
  throw Error("Controller cannot reach " + selector);
}

test("canonical balance validates, IDs are stable and runtime defaults match the captured game", async (t) => {
  assert.deepEqual(lib.validate(canonical), []);
  const p = await page(t);
  const actual = await p.evaluate(() => ({
    classes: Object.fromEntries(
      Object.keys(BALANCE.classes).map((job) => {
        const h = makeHero("Test", job);
        return [
          job,
          { maxHp: h.maxHp, points: h.points, reels: h.reels, last: h.last },
        ];
      }),
    ),
    enemyCurves: Array.from({ length: 10 }, (_, d) =>
      [
        {},
        { elite: true },
        { boss: true },
        { pair: true },
        { mimic: true },
        { stronghold: true, elite: true },
      ].map((flags) => enemyBalance(d + 1, flags)),
    ),
    enemyReels: Object.fromEntries(
      Object.keys(BALANCE.enemyReelRefs).map((k) => [k, enemyReels(k)]),
    ),
    power: POWER,
    attackPower: ATTACK_POWER,
    faceCost: FACE_COST,
  }));
  assert.deepEqual(actual.classes, baseline.classes);
  assert.deepEqual(actual.enemyCurves, baseline.enemyCurves);
  assert.deepEqual(actual.power, baseline.power);
  assert.deepEqual(actual.attackPower, baseline.attackPower);
  assert.deepEqual(actual.faceCost, baseline.faceCost);
  for (const [art, reels] of Object.entries(baseline.enemyReels))
    assert.deepEqual(
      actual.enemyReels[art],
      reels.map((r) => r.map((f) => ({ ...f, weight: f.weight ?? 1 }))),
    );
});

test("generated HTML is deterministic, current, offline and embeds the validated manifest", async (t) => {
  assert.equal(
    await fs.readFile(path.join(ROOT, "index.html"), "utf8"),
    await buildHTML(),
  );
  const p = await page(t);
  assert.equal(
    await p.evaluate(() =>
      __PRODUCTION_DATA__.assets.every((a) => a.url.startsWith("data:")),
    ),
    true,
  );
  assert.deepEqual(await p.evaluate(() => Production.errors), []);
  assert.equal(
    await p.evaluate(
      () =>
        HTML_BACKUP.includes("asset-licence-notices") &&
        HTML_BACKUP.includes("SIL OPEN FONT LICENSE"),
    ),
    true,
  );
  assert.match(
    await p
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content"),
    /connect-src 'none'/,
  );
});

test("the shipped workbook round-trips every balance input and has live calculated statistics", async () => {
  assert.deepEqual(
    await balance.readWorkbook(
      path.join(ROOT, "balance/Scratchpad-Dungeon-Balance.xlsx"),
    ),
    canonical,
  );
  const b = await loadBook();
  assert.ok(b.getWorksheet("Statistics").rowCount >= 100);
  assert.ok(b.getWorksheet("Roll Analysis").rowCount > 500);
  assert.ok(b.getWorksheet("Statistics").getCell("D2").value.formula);
  assert.equal(
    cell(b, "/classes/fighter/maxHp").value,
    baseline.classes.fighter.maxHp,
  );
});

test("spreadsheet changes reach the built game: stats, reels, items, abilities and world generation", async (t) => {
  const b = await loadBook();
  cell(b, "/classes/fighter/maxHp").value = 51;
  cell(b, "/items/potion/heal").value = 19;
  cell(b, "/abilities/healer/blockBase").value = 7;
  cell(b, "/world/events/trap").value = 3;
  cell(b, "/classes/fighter/reels/0/0/weight").value = 12;
  const f = await saveBook(b, "valid-edits"),
    candidate = await balance.readWorkbook(f);
  const p = await page(t, { html: await buildHTML({ balance: candidate }) });
  assert.deepEqual(
    await p.evaluate(() => ({
      hp: state.party[0].maxHp,
      potion: ITEM_DEFS.potion.heal,
      caption: ITEM_DEFS.potion.description,
      block: BALANCE.abilities.healer.blockBase,
      traps: state.map.filter((c) => c.event === "trap").length,
      weight: state.party[0].reels[0][0].weight,
    })),
    {
      hp: 51,
      potion: 19,
      caption: "Restore 19 HP to the selected living hero.",
      block: 7,
      traps: 3,
      weight: 12,
    },
  );
});

for (const [name, id, value, pattern] of [
  [
    "missing asset",
    "/enemies/enemy.ink-rat/art",
    "missing-art",
    /missing portrait asset/,
  ],
  [
    "wrong reel context",
    "/classes/fighter/reels/0/0/type",
    "coin",
    /unknown symbol/,
  ],
  ["fractional tier", "/loot/coins/0/tier", 1.5, /expected integer/],
  [
    "formula",
    "/classes/fighter/maxHp",
    { formula: "1+1", result: 2 },
    /formulas/,
  ],
  ["range", "/classes/fighter/maxHp", -1, /expected integer/],
  ["unsafe text", "/items/potion/name", "<script>", /invalid text/],
  [
    "broken reference",
    "/enemies/enemy.ink-rat/reelSet",
    "missing.reel",
    /unknown reel set/,
  ],
  ["identity", "/classes/fighter/id", "class.changed", /read-only/],
  [
    "class seal",
    "/classes/fighter/reels/0/0/type",
    "class",
    /middle reel only/,
  ],
])
  test(
    "workbook rejects " + name + " without modifying source or build",
    async () => {
      const beforeJSON = await fs.readFile(
          path.join(ROOT, "data/balance.json"),
        ),
        beforeHTML = await fs.readFile(path.join(ROOT, "index.html"));
      const b = await loadBook();
      cell(b, id).value = value;
      const file = await saveBook(b, name.replaceAll(" ", "-"));
      await assert.rejects(balance.readWorkbook(file), pattern);
      assert.deepEqual(
        await fs.readFile(path.join(ROOT, "data/balance.json")),
        beforeJSON,
      );
      assert.deepEqual(
        await fs.readFile(path.join(ROOT, "index.html")),
        beforeHTML,
      );
    },
  );

test("workbook rejects missing, duplicate and obsolete fields", async () => {
  for (const mode of ["missing", "duplicate", "obsolete"]) {
    const b = await loadBook(),
      c = cell(b, "/classes/fighter/maxHp"),
      ws = c.worksheet;
    if (mode === "missing") ws.spliceRows(c.row, 1);
    if (mode === "duplicate") ws.addRow(ws.getRow(c.row).values);
    if (mode === "obsolete")
      b.getWorksheet("Readme").getCell("B13").value = "old-schema";
    await assert.rejects(
      balance.readWorkbook(await saveBook(b, mode)),
      /Missing field|duplicate|schema is obsolete/,
    );
  }
});

test("archive preflight rejects non-XLSX data before expanding sheets", async () => {
  const f = path.join(temp, "invalid.xlsx");
  await fs.writeFile(f, "not a zip archive");
  await assert.rejects(balance.readWorkbook(f), /Invalid XLSX archive/);
});

test("asset audit detects missing, mismatched and unlisted files and preserves originals", async () => {
  const manifest = lib.readJSON("data/assets.json"),
    result = assets.validate(manifest);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.unused, []);
  const missing = structuredClone(manifest);
  missing.assets[0].path = "assets/missing.svg";
  assert.match(assets.validate(missing).errors.join(), /missing/);
  const wrong = structuredClone(manifest);
  wrong.assets[0].type = "music";
  assert.match(assets.validate(wrong).errors.join(), /content does not match/);
  const extra = path.join(ROOT, "assets/unlisted-production-test.svg");
  try {
    await fs.writeFile(extra, "<svg></svg>");
    assert.ok(
      assets
        .validate(manifest)
        .unused.includes("assets/unlisted-production-test.svg"),
    );
  } finally {
    await fs.rm(extra, { force: true });
  }
});

test("unsafe SVG and traversal replacements are rejected; basic hand-drawn SVG remains valid", () => {
  assert.throws(() => assets.safePath("assets/../../secrets"), /inside assets/);
  assert.throws(
    () =>
      assets.inspect(
        "unsafe.svg",
        Buffer.from("<svg><script>alert(1)</script></svg>"),
      ),
    /unsafe/,
  );
  assert.throws(
    () =>
      assets.inspect(
        "external.svg",
        Buffer.from('<svg><image href="https://example.com/a.png"/></svg>'),
      ),
    /unsafe/,
  );
  assert.equal(
    assets.inspect(
      "safe.svg",
      Buffer.from('<svg viewBox="0 0 32 32"><path d="M0 0h10"/></svg>'),
    ),
    "image/svg+xml",
  );
});

test("manifest replacement resolves through every art wrapper while retaining default dynamic injury art", async (t) => {
  const p = await page(t);
  assert.deepEqual(
    await p.evaluate(() => {
      const a = Production.assets.get("portrait.fighter"),
        old = a.replacementStatus;
      const hurt = portraitArt("fighter", { hp: 1, maxHp: 44 });
      a.replacementStatus = "replacement";
      const replacement = portraitArt("fighter", { hp: 1, maxHp: 44 });
      a.replacementStatus = old;
      return {
        hurt: hurt.includes("injury-marks"),
        replacement: replacement.includes('data-asset="portrait.fighter"'),
        url: replacement.includes("data:image/svg+xml;base64,"),
      };
    }),
    { hurt: true, replacement: true, url: true },
  );
  assert.deepEqual(
    await p.evaluate(() => {
      for (const name of ["spikes", "arrow", "boulder"]) trapArt(name);
      for (const e of Object.values(BALANCE.enemies)) {
        portraitArt(e.art);
        corpseArt(e.art);
      }
      return Production.errors;
    }),
    [],
  );
});

test("audio unlocks, mixes independent volumes, limits its voice pool and persists settings", async (t) => {
  const p = await page(t);
  await p.locator("#animation-speed").click();
  assert.equal(await p.evaluate(() => Production.audio.unlock()), true);
  await p.evaluate(async () => {
    Production.audio.update({ master: 0.4, sfx: 0.3, music: 0.2 });
    await Production.audio.setScene("battle");
    Production.assets.get("sfx.damage").cooldownMs = 0;
    await Promise.all(
      Array.from({ length: 40 }, () => Production.audio.play("sfx.damage")),
    );
  });
  const status = await p.evaluate(() => Production.audio.status);
  assert.equal(status.poolSize, 16);
  assert.equal(status.activeVoices, 16);
  await p.evaluate(async () => {
    for (const scene of ["field", "battle", "field", "battle"])
      await Production.audio.setScene(scene);
  });
  assert.ok(await p.evaluate(() => Production.audio.status.musicVoices <= 2));
  assert.equal(status.music, "music.battle");
  await p.reload();
  assert.deepEqual(await p.evaluate(() => Production.audio.settings), {
    master: 0.4,
    sfx: 0.3,
    music: 0.2,
    muted: false,
  });
});

test("a controller opens a fresh game, chooses a class and navigates options without mouse or keyboard", async (t) => {
  const p = await page(t, { starter: true });
  await padSetup(p);
  await press(p, "down");
  await focusMenu(p, '[data-start-job="rogue"]');
  await press(p, "confirm");
  await p.waitForFunction(() => !state.awaitingStarter);
  assert.equal(await p.evaluate(() => state.party[0].job), "rogue");
  await press(p, "options");
  await focusMenu(p, '[data-options-page="audio"]');
  await press(p, "confirm");
  await focusMenu(p, '[data-volume="master"]');
  const before = await p.locator('[data-volume="master"]').inputValue();
  await press(p, "left");
  assert.ok(
    Number(await p.locator('[data-volume="master"]').inputValue()) <
      Number(before),
  );
  await press(p, "cancel");
  assert.equal(await p.locator("#overlay").isHidden(), true);
  assert.equal(await p.evaluate(() => Production.input.device), "gamepad");
});

test("controller deadzone, prompt switching, rebinding and disconnect behave correctly", async (t) => {
  const p = await page(t);
  await padSetup(p, "Sony DualSense");
  await press(p, "map");
  assert.equal(
    await p.evaluate(() => Production.input.glyphFamily),
    "playstation",
  );
  const initial = await p.evaluate(() => document.activeElement.dataset.tile);
  await p.evaluate(() => (testPad.axes[0] = 0.1));
  await p.waitForTimeout(100);
  assert.equal(
    await p.evaluate(() => document.activeElement.dataset.tile),
    initial,
  );
  await p.evaluate(() => (testPad.axes[0] = 0.9));
  await p.waitForTimeout(60);
  assert.notEqual(
    await p.evaluate(() => document.activeElement.dataset.tile),
    initial,
  );
  await p.evaluate(() => {
    testPad.axes[0] = 0;
    Production.input.bind("confirm", 2);
  });
  assert.equal(
    await p.evaluate(() => Production.input.settings.bindings.spin),
    0,
  );
  assert.match(await p.locator("#keyboard-bar").innerText(), /□/);
  await p.evaluate(() => (testPad = null));
  await p.waitForTimeout(50);
  assert.equal(await p.evaluate(() => Production.input.device), "keyboard");
});

test("controller selects map destinations, heroes, enemies, reels and inventory actions", async (t) => {
  const p = await page(t);
  await p.evaluate(() => {
    setPace("skip");
    state.lastMinorEventStep = 99999;
    state.pursuerSpawned = true;
    state.map.forEach((c, i) => {
      c.wall = i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1);
      c.seen = true;
      c.event = null;
      c.activated = true;
      c.terrain = c.wall ? "stone" : "floor";
    });
    render();
  });
  await padSetup(p);
  const from = await p.evaluate(() => state.position);
  await press(p, "map");
  await press(p, "up");
  await press(p, "confirm");
  await p.waitForFunction((from) => state.position !== from && !busy, from);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"));
    beginEncounter(false, { count: 2 });
    for (const e of state.enemies) {
      e.hp = e.maxHp = 999;
      e.countdown = 99;
    }
    state.party[1].reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "attack", tier: 2 }],
      [{ type: "block", tier: 1 }],
    ];
    render();
  });
  await press(p, "nextHero");
  assert.equal(await p.evaluate(() => state.target), 1);
  const enemy = await p.evaluate(() => state.enemy.id);
  await press(p, "nextTarget");
  assert.notEqual(await p.evaluate(() => state.enemy.id), enemy);
  await press(p, "spin");
  await p.waitForFunction(() => !busy && state.actionSerial > 0);
  assert.equal(await p.evaluate(() => state.party[1].stats.spins), 1);
  await p.evaluate(() => {
    state.enemy = null;
    state.enemies = [];
    state.bag = { potion: 1 };
    state.party[1].hp = 1;
    render();
  });
  await press(p, "inventory");
  await focusMenu(p, '[data-use-item="potion"]');
  await press(p, "confirm");
  await p.waitForFunction(() => !state.bag.potion);
  assert.ok(await p.evaluate(() => state.party[1].hp > 1));
});

test("pause freezes action delays and map age; controller can resume through nested settings", async (t) => {
  const p = await page(t);
  await padSetup(p);
  await p.evaluate(() => {
    window.delayDone = false;
    window.startExplore = state.exploreTime;
  });
  await press(p, "pause");
  await p.evaluate(() => {
    Production.input.delay(80).then(() => (window.delayDone = true));
  });
  await p.waitForTimeout(200);
  assert.equal(await p.evaluate(() => delayDone), false);
  const start = await p.evaluate(() => state.exploreTime);
  await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => state.exploreTime), start);
  await focusMenu(p, "#pause-options");
  await press(p, "confirm");
  await focusMenu(p, '[data-pause-panel="controller"]');
  await press(p, "confirm");
  assert.equal(await p.locator("#production-pause [data-binding]").count(), 16);
  await press(p, "cancel");
  await press(p, "cancel");
  await p.waitForFunction(() => delayDone);
  assert.equal(await p.locator("#production-pause").count(), 0);
});

test("on-screen keyboard is controller operable wherever a text input is introduced", async (t) => {
  const p = await page(t);
  await padSetup(p);
  await p.evaluate(() => {
    openModal(
      "Name",
      '<input type="text" id="test-name"><button data-close>Done</button>',
      "test",
    );
    Production.input.focus(document.querySelector("#test-name"));
  });
  await press(p, "confirm");
  await press(p, "confirm");
  await focusMenu(p, "#virtual-done");
  await press(p, "confirm");
  assert.equal(await p.locator("#test-name").inputValue(), "A");
  assert.equal(await p.locator("#production-keyboard").count(), 0);
});

for (const [width, height] of [
  [1920, 1080],
  [1280, 800],
  [1280, 720],
])
  test(`notebook fits ${width}×${height}, with all panels visible and controller-sized handles`, async (t) => {
    const p = await page(t, { width, height });
    await p.evaluate(() => {
      state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
      beginEncounter(false, { count: 2 });
      state.exitFound = true;
      render();
      fitNotebook();
    });
    await p.waitForTimeout(150);
    const m = await p.evaluate(() => {
      const rect = (s) => document.querySelector(s).getBoundingClientRect(),
        book = rect("#book");
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        book: book.bottom,
        progress: rect(".expedition-boxes").bottom,
        inventory: rect(".inventory").bottom,
        bar: rect("#keyboard-bar").top,
        handle: rect('[data-spin="0"]').width,
        party: rect("#hero-2 .hero-controls").bottom,
        targets: rect("#targets").top,
        deck: document.body.dataset.deck,
      };
    });
    assert.ok(m.width <= width && m.height <= height + 1, JSON.stringify(m));
    assert.ok(
      m.progress <= m.book + 1 && m.inventory <= m.bar,
      JSON.stringify(m),
    );
    assert.ok(m.handle >= 44, JSON.stringify(m));
    assert.ok(m.party < m.targets, JSON.stringify(m));
    if (width === 1280) assert.equal(m.deck, "true");
    await p.screenshot({
      path: path.join(ROOT, `test-results/production-${width}-${height}.png`),
    });
  });

test("notebook tabs retain their orientation and only grow on hover", async (t) => {
  const p = await page(t, { width: 1920, height: 1080 });
  const before = await p
    .locator("#options-tab")
    .evaluate((e) => getComputedStyle(e).transform);
  await p.locator("#options-tab").hover();
  await p.waitForTimeout(250);
  const after = await p
    .locator("#options-tab")
    .evaluate((e) => getComputedStyle(e).transform);
  const values = (s) => s.match(/-?[\d.]+/g).map(Number);
  assert.ok(values(before)[0] < 0 && values(after)[0] < 0);
  assert.ok(Math.abs(values(after)[0]) > Math.abs(values(before)[0]));
});

test("seeded maps and encounters match the previous release across all floor depths", async (t) => {
  const p = await page(t),
    expected = require("./fixtures/world-baseline.json");
  const actual = await p.evaluate(() => {
    newRun();
    return Array.from({ length: 30 }, (_, i) => {
      let seed = 31 + i * 97;
      Math.random = () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
      const depth = (i % 10) + 1;
      state.depth = depth;
      const map = generateFloor(depth, 1, i % 4).map((c) => ({
        wall: c.wall,
        terrain: c.terrain,
        event: c.event,
        room: c.room ?? null,
        doodle: c.doodle,
        feature: c.feature ?? null,
      }));
      beginEncounter(false);
      const enemies = state.enemies.map((e) => ({
        name: e.name,
        art: e.art,
        maxHp: e.maxHp,
        damage: e.damage,
        frequency: e.frequency,
        strikes: e.strikes,
        affix: e.affix,
        reels: e.reels.map((r) =>
          r.map((f) => ({ ...f, weight: f.weight ?? 1 })),
        ),
      }));
      return { seed: 31 + i * 97, depth, missed: i % 4, map, enemies };
    });
  });
  assert.deepEqual(actual, expected);
});

test("valid CLI import updates one canonical source, creates a backup and rebuilds offline HTML", async () => {
  const dir = await fs.mkdtemp(path.join(ROOT, "test-results/import-project-"));
  try {
    for (const name of ["tools", "data", "src", "assets"])
      await fs.cp(path.join(ROOT, name), path.join(dir, name), {
        recursive: true,
      });
    for (const name of ["package.json", "index.html"])
      await fs.copyFile(path.join(ROOT, name), path.join(dir, name));
    const b = await loadBook();
    cell(b, "/classes/fighter/maxHp").value = 52;
    const file = await saveBook(b, "cli-import");
    const { spawnSync } = require("node:child_process"),
      result = spawnSync(
        process.execPath,
        [path.join(dir, "tools/balance.cjs"), "import", file],
        { cwd: dir, encoding: "utf8", timeout: 30000 },
      );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      JSON.parse(await fs.readFile(path.join(dir, "data/balance.json"))).classes
        .fighter.maxHp,
      52,
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(dir, "data/balance.json")))
        .revision,
      canonical.revision + 1,
    );
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(dir, "data/balance.json.backup"))),
      canonical,
    );
    assert.match(
      await fs.readFile(path.join(dir, "index.html"), "utf8"),
      /"maxHp":52/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("controller operates reel editing, class equipment and shop purchases", async (t) => {
  const p = await page(t);
  await padSetup(p);
  await p.evaluate(() => {
    state.party[0].points = 30;
    editor(0);
  });
  await focusMenu(p, '[data-upgrade="0,0,0"]');
  await press(p, "confirm");
  assert.equal(await p.evaluate(() => state.party[0].reels[0][0].tier), 2);
  await press(p, "cancel");
  await p.evaluate(() => {
    state.bag = { ironSignet: 1 };
    render();
  });
  await press(p, "inventory");
  await focusMenu(p, '[data-use-item="ironSignet"]');
  await press(p, "confirm");
  await focusMenu(p, '[data-gear-choice="0"]');
  await press(p, "confirm");
  await p.waitForFunction(() => state.party[0].equipment === "ironSignet");
  await p.evaluate(() => {
    closeModal();
    state.gold = 999;
    shopEncounter(state.map[state.position]);
  });
  await focusMenu(p, '[data-buy="potion"]');
  await press(p, "confirm");
  assert.equal(await p.evaluate(() => state.bag.potion), 1);
  await press(p, "cancel");
  assert.equal(await p.locator("#overlay").isHidden(), true);
});

test("asset replacement CLI retains originals and replacement history with valid checksums", async () => {
  const dir = await fs.mkdtemp(path.join(ROOT, "test-results/asset-project-"));
  try {
    for (const name of ["tools", "data", "assets", "src"])
      await fs.cp(path.join(ROOT, name), path.join(dir, name), {
        recursive: true,
      });
    const { spawnSync } = require("node:child_process");
    let first;
    for (const radius of [5, 9]) {
      const replacement = path.join(dir, "replacement.svg");
      await fs.writeFile(
        replacement,
        `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="${radius}"/></svg>`,
      );
      const result = spawnSync(
        process.execPath,
        [
          path.join(dir, "tools/assets.cjs"),
          "replace",
          "--id",
          "icon.sword",
          "--file",
          replacement,
          "--licence",
          "CC0-1.0; test fixture",
        ],
        { cwd: dir, encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
      const manifest = JSON.parse(
          await fs.readFile(path.join(dir, "data/assets.json")),
        ),
        entry = manifest.assets.find((a) => a.id === "icon.sword");
      assert.equal(entry.replacementStatus, "replacement");
      assert.ok(sync.existsSync(path.join(dir, entry.originalPath)));
      if (first) {
        assert.notEqual(entry.path, first);
        assert.ok(entry.previousPaths.includes(first));
      }
      first = entry.path;
      const audit = spawnSync(
        process.execPath,
        [path.join(dir, "tools/assets.cjs"), "audit"],
        { cwd: dir, encoding: "utf8" },
      );
      assert.equal(audit.status, 0, audit.stdout + audit.stderr);
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("asset audit reports retained unused manifest entries without deleting them", () => {
  const unused = assets.unusedEntries();
  assert.ok(unused.some((a) => a.id === "icon.seed"));
  assert.ok(unused.some((a) => a.id === "icon.camp"));
  assert.ok(!unused.some((a) => a.id === "sfx.ui-confirm"));
});

for (const height of [800, 720])
  test(`Deck menus retain readable text and progress controls at 1280×${height}`, async (t) => {
    const p = await page(t, { height });
    const bounds = await p.evaluate(() => {
      let button = document.querySelector("#memorial").getBoundingClientRect(),
        box = document
          .querySelector(".expedition-boxes")
          .getBoundingClientRect();
      return { button: button.bottom, box: box.bottom };
    });
    assert.ok(bounds.button <= bounds.box + 1, JSON.stringify(bounds));
    for (const scene of ["editor", "controller", "guide"]) {
      await p.evaluate((scene) => {
        closeModal();
        if (scene === "editor") editor(0);
        else if (scene === "guide") help();
        else {
          optionsPage();
          document.querySelector('[data-options-page="controller"]').click();
        }
      }, scene);
      await p.waitForTimeout(100);
      const min = await p.evaluate(() => {
        let min = Infinity;
        for (const el of document
          .querySelector("#modal")
          .querySelectorAll("p,small,button,label,select")) {
          if (!el.getClientRects().length || el.closest("[hidden]")) continue;
          let size = parseFloat(getComputedStyle(el).fontSize),
            parent = el;
          while (parent) {
            size *= Number(getComputedStyle(parent).zoom) || 1;
            parent = parent.parentElement;
          }
          min = Math.min(min, size);
        }
        return min;
      });
      assert.ok(min >= 12, scene + " has " + min + " px text");
    }
  });
