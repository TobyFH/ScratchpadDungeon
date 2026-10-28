// Focused live-browser fixtures for the interaction and living-terrain update.
const fs = require("fs"),
  http = require("http"),
  path = require("path"),
  { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, ".."),
    out = path.join(root, "test-results/clarity-review");
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
      newRun("jester");
      setPace("skip");
      setPreference("shake", 0);
      characterLuck = () => 0.999999;
      await document.fonts.ready;
    });
    async function shot(name) {
      await p.evaluate(() => {
        fitNotebook();
        fitDialogs();
      });
      await p.waitForTimeout(120);
      await p.screenshot({
        path: path.join(out, name + ".png"),
        fullPage: false,
        animations: "disabled",
      });
      if (name === "all-loot-320" || name === "tier-four-workshop-390")
        console.log(
          name,
          await p.evaluate(() => {
            const el =
              document.querySelector(
                "#spotlight:not([hidden]) .scene-layout",
              ) || document.querySelector(".modal-flow");
            const machine = document.querySelector("#machine-treasure");
            return {
              zoom: el?.style.zoom,
              offsetH: el?.offsetHeight,
              scrollH: el?.scrollHeight,
              width: el?.offsetWidth,
              scrollW: el?.scrollWidth,
              client: el?.parentElement.clientWidth,
              machine: machine
                ? {
                    w: machine.getBoundingClientRect().width,
                    h: machine.getBoundingClientRect().height,
                    style: getComputedStyle(machine).gridTemplateRows,
                  }
                : null,
              font: [
                ...document.querySelectorAll(
                  ".loot-find-tile b,.loot-find-tile p,.face-effect",
                ),
              ].map((n) => ({
                text: n.textContent,
                font: getComputedStyle(n).fontSize,
                scale: n.getBoundingClientRect().height / n.offsetHeight,
              })),
            };
          }),
        );
      shots.push(name);
    }
    await p.evaluate(() => {
      state.party.push(makeHero("Alden", "fighter"), makeHero("Mira", "mage"));
      beginEncounter(false, { count: 2 });
      finishOpeningRoll();
      state.enemies.forEach((e) => {
        e.hp = e.maxHp = 1000;
        e.countdown = 20;
      });
      state.party[0].stun = 1;
      state.party[1].initiative = { multiplier: 1.25 };
      state.opening.firstRoll = true;
      state.party[2].surprised = true;
      render();
    });
    await shot("locked-reels-1920");
    await p.setViewportSize({ width: 1280, height: 800 });
    await shot("locked-reels-1280");
    await p.evaluate(() => {
      state.party.forEach((h) => (h.stun = 0));
      finishOpeningRoll();
      render();
      state.party[0].points = 99;
      editor(0);
      editorSelection.reel = 1;
      editorSelection.face = state.party[0].reels[1].findIndex(
        (f) => f.type === "mystery",
      );
      editor(0);
    });
    await shot("permanent-mystery-1280");
    await p.setViewportSize({ width: 390, height: 844 });
    await shot("permanent-mystery-390");
    await p.locator('[data-workshop-view="crits"]').click();
    await shot("critical-odds-390");
    await p.evaluate(() => {
      editorSelection.reel = 0;
      editorSelection.face = 0;
      state.party[0].reels[0][0] = { type: "attack", tier: 4, weight: 1 };
      editorView = "edit";
      editor(0);
    });
    await shot("tier-four-workshop-390");
    await p.setViewportSize({ width: 1920, height: 1080 });
    await shot("tier-four-workshop-1920");
    await p.evaluate(() => {
      closeModal();
      state.bag = { ironSignet: 1, starLens: 1, potion: 1 };
      state.party[1].equipment = "bulwarkBadge";
      inspectHeroEquipment(1);
    });
    await shot("equipment-alternatives-1920");
    await p.evaluate(() => {
      closeModal();
      shopCell = { shop: { potion: 1, ironSignet: 1, heal: 1, reveal: 1 } };
      state.gold = 500;
      drawShop();
    });
    await shot("shop-categories-1920");
    await p.setViewportSize({ width: 390, height: 844 });
    await shot("shop-categories-390");
    await p.evaluate(() => {
      closeModal();
      showSpotlight(
        "The satchel is full",
        "Choose what to carry.",
        `<div class="bag-grid">${bagCards(true)}</div>`,
        "bag-overflow",
      );
      eventChoice([
        { id: "stage-confirm", label: "Leave the find", value: true },
      ]);
    });
    await shot("aligned-bag-390");
    await p.evaluate(() => {
      closeSpotlight();
      showSpotlight(
        "Spoils of battle",
        "Four finds.",
        `<div class="trap-art">${icon("skull")}</div>${drawMachine("treasure", [
          { type: "coin", tier: 1 },
          { type: "coin", tier: 2 },
          { type: "coin", tier: 3 },
        ])}${criticalSpace()}<div id="treasure-result" class="stage-result">120 gold</div><div id="artefact-loot"></div>`,
        "treasure",
      );
      lootFindCarousel(
        ["potion", "ironSignet", "starLens", "aegis"].map(
          (type) =>
            `<div class="item-find">${icon(ITEM_DEFS[type].icon)}<div><b>${ITEM_DEFS[type].name} ×1</b><p>${ITEM_DEFS[type].description}</p></div></div>`,
        ),
      );
      eventChoice([
        { id: "stage-confirm", label: "Collect all finds", value: true },
      ]);
    });
    await shot("all-loot-390");
    await p.setViewportSize({ width: 320, height: 844 });
    await shot("all-loot-320");
    await p.setViewportSize({ width: 1920, height: 1080 });
    await shot("all-loot-1920");
    await p.evaluate(() => {
      const finds = [
        {
          id: "long",
          name: "Fang of the Margin · IV",
          key: "attack",
          power: 12,
        },
        { id: "pennant", name: "Iron Pennant · IV", key: "block", power: 8 },
        { id: "stone", name: "Revive Stone · IV", key: "revive", power: 1 },
      ];
      state.artefacts = finds;
      lootFindCarousel([
        ...finds.map(
          (a) =>
            `<div class="artefact-card">${icon("artefact")}<div><b>${a.name}</b><p>${artefactText(a)}</p>${artefactButton(a)}</div></div>`,
        ),
        `<div class="item-find">${icon("ration")}<div><b>Trail ration ×1</b><p>Supplies.</p></div></div>`,
      ]);
    });
    await shot("all-artefacts-1920");
    await p.setViewportSize({ width: 320, height: 844 });
    await shot("all-artefacts-320");
    await p.setViewportSize({ width: 1920, height: 1080 });

    for (const theme of ["ice", "crystal", "shadow", "unstable"]) {
      await p.evaluate((theme) => {
        closeSpotlight();
        closeModal();
        state.enemy = null;
        state.enemies = [];
        busy = false;
        state.depth = 8;
        state.map = generateFloor(8);
        state.map.forEach((c) => {
          if (
            ["ice", "mushroom", "overgrown", "mudslide", "stalactite"].includes(
              c.terrain,
            )
          )
            c.terrain = "floor";
          if (["crystal", "lava"].includes(c.terrain)) {
            c.wall = false;
            c.terrain = "floor";
          }
        });
        assignFloorBiome(state.map, 8, { force: theme });
        decorateLivingFloor(state.map, 8);
        state.map.forEach((c, i) => {
          c.seen = true;
          if (!c.wall && i !== state.position) {
            c.visited = true;
            if (theme === "shadow" && i % 3 === 0) c.shadowCovered = true;
          }
        });
        render();
      }, theme);
      await shot(theme + "-1920");
      await p.setViewportSize({ width: 1280, height: 800 });
      await shot(theme + "-1280");
      await p.setViewportSize({ width: 1920, height: 1080 });
    }
    await p.evaluate(() => {
      help("mystery");
    });
    await p.setViewportSize({ width: 320, height: 844 });
    await shot("mystery-guide-320");
    await p.evaluate(() => help("living"));
    await shot("living-guide-320");
    await p.evaluate(() => help("shadow"));
    await shot("shadow-guide-320");
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify({ shots, errors, external }, null, 2),
    );
    if (errors.length || external.length)
      throw Error(JSON.stringify({ errors, external }));
    console.log(
      `Saved ${shots.length} focused captures without browser errors or external requests.`,
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
