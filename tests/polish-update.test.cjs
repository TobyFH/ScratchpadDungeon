const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  { chromium } = require("playwright");
let browser, server, url;
const out = path.resolve(__dirname, "../test-results/polish");
before(async () => {
  fs.mkdirSync(out, { recursive: true });
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"));
  server = http.createServer((q, r) => {
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
  await new Promise((r) => server.close(r));
});
async function game(t, width = 1920, height = 1080) {
  const p = await browser.newPage({ viewport: { width, height } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.skip(true));
  await p.evaluate(() => {
    newRun("fighter");
    closeModal();
    closeSpotlight();
    setPace("skip");
    setPreference("skipCriticals", true);
    setPreference("shake", 0);
    characterLuck = () => 0.99999;
    state.runRules = [];
    setAutoplay(false);
    setAutoresolve(false);
  });
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, []);
  });
  return p;
}
test("Necromancer is earned only by a tenth-floor victory, never purchased, and legacy victory deposits recover the unlock", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    localStorage.removeItem(PROFILE_KEY);
    chooseStartingClass(false);
    const locked = !!document.querySelector(
      '[data-achievement-class="necromancer"]:disabled',
    );
    const rich = emptyProfile();
    rich.gold = 999999;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(rich));
    campPage("classes", 1);
    const purchasable = !!document.querySelector(
      '[data-camp-buy="necromancer"]',
    );
    const buy = purchaseUnlock("necromancer");
    state.won = true;
    state.depth = 9;
    const early = recordDungeonVictory();
    state.depth = 10;
    const earned = recordDungeonVictory();
    newRun("rogue");
    chooseStartingClass(false);
    const available = !!document.querySelector(
      '[data-start-job="necromancer"]',
    );
    const recruits = heroJobs([
      "ranger",
      "berserker",
      "bloodbinder",
      "jester",
      "necromancer",
    ]);
    const old = emptyProfile();
    old.deposits["old-win:10"] = 100;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(old));
    return {
      locked,
      purchasable,
      buy,
      early,
      earned,
      available,
      recruits,
      legacy: necromancerUnlocked(),
    };
  });
  assert.ok(r.locked && r.earned && r.available && r.legacy);
  assert.ok(!r.buy && !r.early && !r.purchasable);
  assert.ok(!r.recruits.includes("necromancer"));
});
test("a living adventurer fears the Necromancer and always enters combat through two explicit confirmations", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    newRun("necromancer");
    closeModal();
    window.offer = recruitEncounter();
  });
  await p.locator("#stage-confirm").waitFor();
  assert.match(
    await p.locator("#stage-card").innerText(),
    /frightened|Fear|recoils/,
  );
  assert.equal(await p.locator("#recruit-accept").count(), 0);
  await p.locator("#stage-confirm").click();
  await p.waitForFunction(() => !!state.enemy);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => offer);
  assert.equal(await p.evaluate(() => state.party.length), 1);
  assert.equal(await p.evaluate(() => state.party[0].job), "necromancer");
});
test("Rogue healing faces migrate to paid poison faces and all manual and automatic edit paths refuse healing", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = makeHero("Wren", "rogue");
      h.reels[0][0] = {
        type: "selfheal",
        tier: 3,
        weight: 1,
        investments: { 2: 5, 3: 9 },
      };
      h.last[0] = { type: "heal", tier: 2 };
      normaliseHeroBuild(h);
      const migrated = {
        face: structuredClone(h.reels[0][0]),
        last: { ...h.last[0] },
      };
      h.points = 100;
      const refused = applyFaceEdit(h, 0, 1, "swap", "heal");
      state.party = [h];
      autoUpgradeHero(h);
      return {
        refused,
        types: editableTypes(h),
        ...migrated,
        bad: h.reels.flat().some((f) => ["heal", "selfheal"].includes(f.type)),
      };
    });
  assert.equal(r.refused, false);
  assert.ok(
    !r.types.includes("heal") && !r.types.includes("selfheal") && !r.bad,
  );
  assert.equal(r.last.type, "poison");
  assert.deepEqual(r.face.investments, { 2: 5, 3: 9 });
});
test("mid-late Bloodbinder recovery and Seeds improve modestly, without changing per-Seed damage/healing or early play", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() =>
      [1, 5, 9, 13].map((level) => {
        const h = makeHero("Vesper", "bloodbinder");
        h.level = level;
        h.hp = 20;
        const plan = bloodSeedPlan({}, 4, h, [{ type: "bloodseed", tier: 4 }]);
        return {
          level,
          added: plan.added,
          cost: plan.hpCost,
          heal: classHealingPower(h, 10),
          unit: BLOOD_BINDING.seedHealing,
        };
      }),
    );
  assert.deepEqual(
    r.map((x) => x.added),
    [4, 5, 6, 6],
  );
  assert.ok(r.every((x) => x.cost === 2 && x.unit === 1));
  assert.equal(r[0].heal, 10);
  assert.equal(r[3].heal, 12);
});
test("stronger temperaments only change present effects and enemy floors 2–5 gain bounded pressure", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => ({
      off: temperamentEffects(
        { specialism: "offence" },
        { attack: 1, magic: 1, poison: 1, heal: 0 },
      ),
      def: temperamentEffects(
        { specialism: "defence" },
        { heal: 1, block: 1, stun: 1, attack: 0 },
      ),
      early: [1, 2, 3, 4, 5, 6].map((d) => ({
        hp: enemyBalance(d).maxHp,
        pressure: enemyHitPressure(d),
      })),
    }));
  assert.deepEqual(r.off, { attack: 3, magic: 3, poison: 3, heal: 0 });
  assert.deepEqual(r.def, { heal: 3, block: 3, stun: 3, attack: 0 });
  assert.equal(r.early[0].hp, 13);
  assert.equal(r.early[5].hp, 43);
  assert.ok(r.early.slice(1, 5).every((x) => x.pressure >= 1.18));
});
test("temples stay enclosed and reachable, protect spawn and occur in about seventy percent of complete runs", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const random = Math.random;
    let seed = 1977,
      runs = 0,
      temples = 0;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    try {
      const open = Array.from({ length: W * H }, (_, i) => ({
        wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
        terrain: "floor",
      }));
      const spawnProtected = !templePlacementSafe(
        open,
        pos(2, 6),
        pos(1, 7),
        pos(9, 1),
      );
      for (let run = 0; run < 300; run++) {
        let found = false;
        for (let depth = 1; depth <= 10; depth++) {
          const map = generateFloor(depth),
            center = map.findIndex((c) => c.event === "stronghold");
          if (center < 0) continue;
          found = true;
          temples++;
          const distances = mapDistances(map),
            stair = map.findIndex((c) => c.event === "stairs");
          if (
            !distances.has(center) ||
            !distances.has(stair) ||
            neighbors(center, true).filter((i) => map[i].wall).length < 6
          )
            throw Error("Broken temple enclosure or approach");
        }
        runs += found;
      }
      return { spawnProtected, runs, temples };
    } finally {
      Math.random = random;
    }
  });
  assert.ok(r.spawnProtected);
  assert.ok(r.runs > 177 && r.runs < 246, JSON.stringify(r));
  assert.ok(r.temples >= r.runs);
});
test("selecting a foe retains its portrait, status nodes and the exact passive animation", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    beginEncounter(false, { count: 2 });
    finishOpeningRoll();
    closeSpotlight();
    render();
    const e = state.enemies[1],
      art = enemyArtEl(e).querySelector(":scope > svg"),
      anim = art.getAnimations()[0];
    if (anim) anim.currentTime = 1200;
    selectEnemy(e.id);
    selectEnemy(e.id);
    return {
      same: art === enemyArtEl(e).querySelector(":scope > svg"),
      sameAnim: !anim || art.getAnimations().includes(anim),
      time: anim?.currentTime || 1200,
      selected: state.enemy === e,
    };
  });
  assert.ok(r.same && r.sameAnim && r.selected);
  assert.ok(r.time >= 1199);
});
test("speech and battle callouts stay below event and utility sheets", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    speech($("#portrait-0"), "Hold the line!");
    combatCallout($("#portrait-0"), "FLURRY!", "ability");
    showSpotlight(
      "Battle won",
      "A reward awaits.",
      "<p>Treasure</p>",
      "treasure",
    );
    const z = (s) => Number(getComputedStyle($(s)).zIndex);
    const event = z("#spotlight"),
      speechZ = z(".speech-bubble"),
      callout = z(".combat-callout");
    openModal("Options", "<p>Settings</p>", "options");
    return {
      event,
      speechZ,
      callout,
      menu: z("#overlay"),
      eyebrow: !!$("#modal .eyebrow"),
    };
  });
  assert.ok(r.speechZ < r.event && r.callout < r.event && r.event <= r.menu);
  assert.equal(r.eyebrow, false);
});
test("event criticals flash the original machine gold and emit feedback matching gold, healing and danger even when reels are skipped", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const reports = [];
    for (const [context, type, mark] of [
      ["treasure", "coin", "coin"],
      ["well", "heal", "heal"],
      ["trap", "trap", "trap"],
    ]) {
      showSpotlight(
        "Event",
        "Roll",
        drawMachine("test-event", [
          { type, tier: 1 },
          { type, tier: 1 },
          { type, tier: 1 },
        ]) + criticalSpace(),
        context,
      );
      await rollCritical(
        "Event",
        [0, 1, 2].map(() => ({ type, tier: 1 })),
        false,
        { context, details: [{ icon: mark, label: "Value", value: 10 }] },
      );
      reports.push($("#machine-test-event").dataset.criticalOutcome);
      closeSpotlight();
    }
    return reports;
  });
  assert.deepEqual(r, ["gold", "heal", "trap"]);
});
test("new equipment has enforced single/multiple class scopes and concrete bonuses; extra supplies and intermediate grades retain stable IDs", async (t) => {
  const p = await game(t),
    r = await p.evaluate(async () => {
      const h = makeHero("V", "bloodbinder");
      h.level = 9;
      h.equipment = "bloodNeedle";
      const seeds = bloodSeedBonus(h);
      const scope = equipmentScope(ITEM_DEFS.crimsonPhial);
      const allowed = ["mage", "bloodbinder", "rogue"].map((job) =>
        canEquipGear({ job }, EQUIPMENT_DEFS.crimsonPhial),
      );
      const grades = [1, 2, 4, 5, 7, 8, 10].map((d) =>
        lootItemForDepth("potion", d),
      );
      const power = ITEM_DEFS.potion_field.heal;
      const special = lootItemForDepth("sootBomb", 10);
      state.party[0].poison = { turns: 2, damage: 1 };
      state.party[0].stun = 1;
      await useItem("clearingSalts", { free: true });
      return {
        seeds,
        scope,
        allowed,
        grades,
        power,
        special,
        clean: !state.party[0].poison && !state.party[0].stun,
      };
    });
  assert.equal(r.seeds, 4);
  assert.deepEqual(r.allowed, [true, true, false]);
  assert.match(r.scope, /Bloodbinder.*Mage.*ONLY/);
  assert.deepEqual(r.grades, [
    "potion",
    "potion_field",
    "potion_2",
    "potion_tempered",
    "potion_3",
    "potion_veteran",
    "potion_4",
  ]);
  assert.equal(r.special, "sootBomb");
  assert.equal(r.power, 20);
  assert.ok(r.clean);
});
test("valuable finds stamp down without changing the loot grid or using gameplay randomness", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    setPace("1");
    showSpotlight(
      "Rare finds",
      "Your spoils.",
      '<div id="artefact-loot"></div>',
      "treasure",
    );
    window.fxRandomCalls = 0;
    window.savedGameplayRandom = Math.random;
    Math.random = () => {
      fxRandomCalls++;
      return 0.5;
    };
    lootFindCarousel([
      `<div class="item-find">${icon("potion")}<div><b>Crimson Phial ×1</b><p>Details</p></div></div>`,
      `<div class="item-find">${icon("potion")}<div><b>Healing tonic ×1</b><p>Details</p></div></div>`,
    ]);
  });
  await p.waitForFunction(
    () => document.querySelector(".loot-find-tile").getAnimations().length > 0,
  );
  const r = await p.evaluate(() => {
    const n = $(".loot-find-tile"),
      a = n.getAnimations()[0];
    return {
      rare: n.dataset.rarity,
      frames: a.effect.getKeyframes().map((f) => f.transform),
      random: fxRandomCalls,
    };
  });
  assert.equal(r.rare, "rare");
  assert.ok(r.frames.some((f) => f.includes("1.9")));
  assert.equal(r.random, 0);
  await p.waitForFunction(
    () => $("#artefact-loot").dataset.presenting === "false",
  );
  await p.evaluate(() => {
    Math.random = savedGameplayRandom;
  });
  await p.screenshot({ path: path.join(out, "rare-loot.png") });
});
test("point controls remain active during travel and opening a workshop stops safely after the current step", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    setPace("1");
    state.party[0].points = 40;
    state.map.forEach((c, i) =>
      Object.assign(c, {
        wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
        seen: true,
        event: null,
        feature: null,
        terrain: "floor",
        env: null,
      }),
    );
    state.pursuerSpawned = true;
    state.lastMinorEventStep = 99999;
    state.position = pos(1, 7);
    render();
    window.walk = move(pos(8, 7));
  });
  await p.waitForFunction(() => !!travel);
  const point = p.locator('.edit-button[data-edit="0"]');
  assert.equal(await point.isDisabled(), false);
  await point.click();
  await p.waitForFunction(() => modalKind === "editor" && !busy);
  assert.ok(await p.evaluate(() => state.position !== pos(8, 7)));
  await p.evaluate(() => walk);
  assert.equal(await p.locator(".equal-face-note").count(), 0);
  assert.doesNotMatch(
    await p.locator("#modal").innerText(),
    /Fixed temperament|Edits save immediately|Scratchpad \/ field notes/,
  );
  await p.locator('[data-editor-reel="1"]').click();
  assert.equal(await p.locator(".permanent-class-face").count(), 1);
});
test("all hero moods and enemy species have short characterful speech banks without generic beast dialogue", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      let random = 0,
        old = Math.random;
      Math.random = () => {
        random++;
        return 0.5;
      };
      const lines = Object.entries(HERO_LINES).flatMap(([job, moods]) =>
        Object.entries(moods).map(([mood, bank]) => ({
          job,
          mood,
          n: bank.length,
          text: bank.join(" "),
        })),
      );
      const cries = Object.keys(ENEMY_PROFILES).map((art) =>
        creatureSpeech({ art, name: "test" }, "attack"),
      );
      Math.random = old;
      return { lines, cries, random };
    });
  assert.ok(r.lines.length >= 48 && r.lines.every((x) => x.n >= 4));
  assert.doesNotMatch(
    r.lines.map((x) => x.text).join(" "),
    /light the margins|I miss chairs/i,
  );
  assert.equal(r.random, 0);
  assert.ok(r.cries.every((x) => typeof x === "string" && x.length > 0));
});
test("room descriptions cover active and spent discoveries without changing gameplay randomness", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const old = Math.random;
      Math.random = () => {
        throw Error("copy consumed gameplay RNG");
      };
      try {
        return (
          Object.entries(ROOM_FLAVOUR).every(
            ([key, bank]) => bank.length >= 3,
          ) &&
          new Set(
            [0, 1, 2].map((doodle) => {
              Object.assign(state.map[state.position], {
                event: "treasure",
                feature: "treasure",
                doodle,
                lastVisitedStep: 0,
              });
              return roomDescription();
            }),
          ).size === 3
        );
      } finally {
        Math.random = old;
      }
    });
  assert.equal(r, true);
});
test("all music fades last twenty percent longer and fresh effects default to both without overriding saved preferences", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => ({
      fades: MUSIC_FADES,
      default: DEFAULT_PREFERENCES.combatEffects,
      saved: normalisePreferences({ combatEffects: "beams" }).combatEffects,
    }));
  assert.deepEqual(r.fades, {
    out: 0.54,
    in: 0.78,
    first: 0.42,
    duck: 0.078,
    restore: 0.36,
  });
  assert.equal(r.default, "both");
  assert.equal(r.saved, "beams");
});
for (const [width, height] of [
  [1920, 1080],
  [1280, 800],
  [390, 844],
  [320, 844],
])
  test(`paired combat, healing targets, workshop and future options fit at ${width}`, async (t) => {
    const p = await game(t, width, height);
    await p.evaluate(() => {
      state.party.push(makeHero("Orin", "mage"), makeHero("Wren", "rogue"));
      beginEncounter(false, { count: 2 });
      finishOpeningRoll();
      closeSpotlight();
      state.enemies[0].name = "Fragment of the Glasswing oracle";
      state.enemies[0].passive = { key: "secondWind" };
      render();
      fitNotebook(true);
    });
    const r = await p.evaluate(() => ({
      outside: document.documentElement.scrollWidth > innerWidth,
      boxes: [...document.querySelectorAll(".enemy-box")].map((n) => ({
        stats: n.querySelector(".enemy-stats").getBoundingClientRect().bottom,
        machine: n.querySelector(".machine-shell").getBoundingClientRect().top,
      })),
      target: $("#targets").getBoundingClientRect().toJSON(),
      ribbon: $("#result-ribbon").getBoundingClientRect().toJSON(),
    }));
    assert.equal(r.outside, false);
    assert.ok(
      r.boxes.every((x) => x.stats <= x.machine + 1),
      JSON.stringify(r),
    );
    assert.ok(r.target.bottom <= r.ribbon.top + 2);
    await p.screenshot({
      path: path.join(out, `combat-${width}.png`),
      fullPage: width < 760,
    });
    await p.evaluate(() => editor(0));
    assert.equal(await p.locator(".eyebrow").count(), 0);
    await p.screenshot({ path: path.join(out, `workshop-${width}.png`) });
    await p.evaluate(() => {
      closeModal();
      openUtilityPage("options");
      optionsPage("future");
    });
    for (const group of ["video", "controls", "access"]) {
      await p.selectOption("#future-group", group);
      const fit = await p.evaluate(() => {
        const box = $(".modal-flow").getBoundingClientRect(),
          parent = $(".modal-body").getBoundingClientRect();
        return box.bottom <= parent.bottom + 2 && box.right <= parent.right + 2;
      });
      assert.ok(fit, group + " " + width);
      await p.screenshot({
        path: path.join(out, `future-${group}-${width}.png`),
      });
    }
    assert.equal(await p.locator("#option-download").count(), 0);
    await p.selectOption("#setting-textScale", "130");
    assert.equal(await p.evaluate(() => preferences().textScale), "130");
  });
