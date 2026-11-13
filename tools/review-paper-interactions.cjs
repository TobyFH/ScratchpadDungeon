// Focused visual/manual-input fixtures for save 26. Not embedded in the game.
const fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, ".."),
    out = path.join(root, "test-results/paper-interactions-review");
  fs.mkdirSync(out, { recursive: true });
  const html = fs.readFileSync(path.join(root, "index.html")),
    server = http.createServer((q, r) => {
      r.setHeader("Content-Type", "text/html");
      r.end(html);
    });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    }),
    errors = [],
    external = [],
    shots = [];
  try {
    const p = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => {
      if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:"))
        external.push(r.url());
    });
    await p.goto("http://127.0.0.1:" + server.address().port);
    await p.evaluate(() => CompanyIntro.skip(true));
    await p.evaluate(() => {
      const profile = emptyProfile();
      profile.dungeonCleared = true;
      profile.owned = ["bloodbinder", "ranger", "berserker", "jester"];
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      characterLuck = () => 0.99999;
    });
    async function shot(name, fullPage = false) {
      await p.evaluate(async () => {
        await document.fonts.ready;
        requestFitUI();
      });
      await p.waitForTimeout(150);
      await p.screenshot({ path: path.join(out, name + ".png"), fullPage });
      shots.push(name);
    }
    for (const [width, height] of [
      [1920, 1080],
      [1280, 800],
      [390, 844],
    ]) {
      await p.setViewportSize({ width, height });
      await p.evaluate(() => {
        newRun("necromancer");
        closeModal();
        closeSpotlight();
        setPace("skip");
        state.party.push(
          createSummon(state.party[0], { kind: "cantor", seed: 8 }),
          createSummon(state.party[0], { kind: "guard", seed: 14 }),
        );
        beginEncounter(false, { count: 2 });
        finishOpeningRoll();
        state.party[0].hp = 10;
        state.target = 0;
        render();
        particles = [];
      });
      await shot("immune-target-" + width, width < 1260);
    }
    await p.setViewportSize({ width: 1920, height: 1080 });
    await p.evaluate(() => {
      newRun("bloodbinder");
      closeModal();
      setPace("1");
      setPreference("skipCriticals", true);
      state.party.push(makeHero("Wren", "rogue"), makeHero("Alden", "fighter"));
      state.party.forEach((h) => (h.hp = 10));
      state.party[0].level = 9;
      beginEncounter(false, { count: 2 });
      finishOpeningRoll();
      state.enemies.forEach((e) => {
        e.bloodSeeds = { count: 15, sourceId: state.party[0].id };
        e.hp = e.maxHp = 1000;
        e.countdown = 99;
      });
      render();
      window.bloomFX = bloodBloomSignatureFX(
        state.party[0],
        bloodDetonationPlan(state.party[0]),
      );
    });
    await p.waitForSelector('[data-effect="blood-bloom-signature"]');
    await p.evaluate(() => {
      for (const a of liveAnimations)
        if (a.effect?.target?.closest?.(".blood-bloom-signature")) {
          a.pause();
          a.currentTime = 300;
        }
    });
    await shot("blood-bloom-signature");
    await p.evaluate(() => newRun("fighter"));
    await p.evaluate(() => {
      closeModal();
      closeSpotlight();
      setPace("skip");
      state.depth = 5;
      state.map = Array.from({ length: W * H }, (_, i) => ({
        seen: i % W < 5,
        visited: false,
        wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
        terrain: "floor",
        event: null,
        feature: null,
        corpses: [],
      }));
      state.map[0].biome = "crystal";
      state.map[pos(4, 4)].terrain = "crystal";
      state.map[pos(4, 4)].wall = true;
      state.map[pos(4, 4)].seen = false;
      state.position = pos(3, 4);
      render();
    });
    await shot("unrevealed-quartz-field");
    await p.evaluate(() => {
      state.gold = 1500;
      window.bandits = banditEncounter();
    });
    await shot("bandit-choice");
    await p.locator("#bandit-pay").click();
    await p.evaluate(() => window.bandits);
    await p.evaluate(() => {
      window.prank = fairyPrank("cotton");
    });
    await shot("fairy-prank");
    await p.locator("#stage-confirm").click();
    await p.evaluate(() => window.prank);
    // Autoplay's real reading gates must handle both new confirmation kinds.
    await p.evaluate(() => {
      state.party[0].hp = 1;
      state.gold = 1000;
      state.autoplay = true;
      state.autoresolve = true;
      window.autoBandits = banditEncounter();
    });
    await p.waitForFunction(
      () => state.gold === 1000 - (35 + state.depth * 22),
      null,
      { timeout: 12000 },
    );
    await p.evaluate(() => window.autoBandits);
    await p.evaluate(() => {
      window.autoPrank = fairyPrank("pockets");
    });
    await p.waitForFunction(() => $("#spotlight").hidden, null, {
      timeout: 12000,
    });
    await p.evaluate(() => window.autoPrank);
    await p.evaluate(() => {
      state.autoplay = state.autoresolve = false;
    });
    await p.evaluate(() => {
      openUtilityPage("options");
      setPreference("navigationMode", true);
      updateKeyboardBar();
    });
    await p.keyboard.press("Tab");
    await shot("focus-controls-options");
    await p.keyboard.press("Escape");
    const report = {
      shots,
      errors,
      external,
      autoplayBandits: true,
      autoplayPrank: true,
    };
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
    if (errors.length || external.length)
      throw Error("Browser errors or external requests");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
