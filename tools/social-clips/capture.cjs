// Isolated marketing fixtures. Production HTML and combat implementations are unchanged.
const fs = require("fs"),
  path = require("path"),
  http = require("http"),
  { chromium } = require("playwright");
const root = path.resolve(__dirname, "../.."),
  out = path.join(root, "test-results/social-clips");
(async () => {
  const html = fs.readFileSync(path.join(root, "index.html"));
  const server = http.createServer((q, r) => {
    r.setHeader("Content-Type", "text/html");
    r.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const name of process.argv[2]
      ? [process.argv[2]]
      : ["jackpot", "gamble", "dungeon"]) {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: {
          dir: path.join(out, "source"),
          size: { width: 1920, height: 1080 },
        },
      });
      const p = await context.newPage(),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto("http://127.0.0.1:" + server.address().port);
      await p.evaluate(() => CompanyIntro.skip(true));
      await p.evaluate((name) => {
        newRun(name === "gamble" ? "fighter" : "rogue");
        closeModal();
        closeSpotlight();
        setPace("2");
        setPreference("musicVolume", 0);
        setPreference("shake", 1);
        characterLuck = () => 0.99999;
        state.autoplay = state.autoresolve = false;
        if (name !== "dungeon") {
          state.depth = name === "jackpot" ? 4 : 1;
          const h = state.party[0];
          h.level = name === "jackpot" ? 6 : 3;
          h.maxHp = h.maxHp + (h.level - 1) * 6;
          h.hp = name === "gamble" ? 3 : h.maxHp;
          h.reels = h.reels.map((reel, r) =>
            reel.map((f) =>
              f.type === "class"
                ? f
                : {
                    type: name === "gamble" ? "selfheal" : "attack",
                    tier: 3,
                    weight: 1,
                  },
            ),
          );
          beginEncounter(false, { count: 1 });
          finishOpeningRoll();
          closeSpotlight();
          state.opening = null;
          state.enemy.countdown = name === "gamble" ? 1 : 3;
          render();
        } else {
          state.depth = 4;
          state.lastMinorEventStep = 100000;
          state.banditSchedule = [];
          state.pursuerSpawned = true;
          state.map = generateFloor(4, 1, 0, [], "mushroom");
          state.position = pos(4, 4);
          for (const i of [
            pos(4, 4),
            pos(5, 4),
            pos(6, 4),
            pos(7, 4),
          ])
            Object.assign(state.map[i], {
              wall: false,
              terrain: "floor",
              event: null,
              activated: true,
              seen: i === pos(4, 4),
            });
          Object.assign(state.map[pos(5, 4)], {
            event: "beacon",
            activated: false,
          });
          Object.assign(state.map[pos(7, 4)], {
            event: "treasure",
            activated: false,
          });
          render();
        }
      }, name);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(700);
      const start = Date.now();
      const cues = { name, start: (Date.now() - start) / 1000, videoOffset: 0 }; // Absolute video offset is filled below from navigation elapsed.
      // Save the video-clock origin before acting. browser video includes startup.
      const videoStart = await p.evaluate(() => performance.now() / 1000);
      cues.videoOffset = videoStart;
      if (name !== "dungeon") {
        await p.waitForTimeout(900);
        await p.evaluate(() => {
          const old = Math.random;
          Math.random = () => 0;
          window.captureAction = spin(0).finally(() => (Math.random = old));
        });
        await p.waitForTimeout(9000);
        if (await p.locator("#stage-confirm").isVisible())
          await p.locator("#stage-confirm").click();
        await p.waitForTimeout(4000);
      } else {
        for (const x of [5, 6, 7]) {
          await p.evaluate((x) => {
            window.captureMove = move(pos(x, 4));
          }, x);
          await p.waitForTimeout(x === 7 ? 6500 : 1100);
          if(x===5 && await p.locator("#stage-confirm").isVisible()){await p.locator("#stage-confirm").click(); await p.waitForTimeout(1000);}
        }
        if (await p.locator("#stage-confirm").isVisible())
          await p.locator("#stage-confirm").click();
        await p.waitForTimeout(2500);
      }
      cues.duration = (Date.now() - start) / 1000;
      cues.errors = errors;
      cues.last = await p.evaluate(() => ({
        roll: state.lastPlayerRoll,
        gold: state.gold,
        position: state.position,
      }));
      await p.screenshot({ path: path.join(out, "source", name + "-end.png") });
      const video = p.video();
      await context.close();
      await video.saveAs(path.join(out, "source", name + ".webm"));
      fs.writeFileSync(
        path.join(out, "source", name + ".json"),
        JSON.stringify(cues, null, 2),
      );
      console.log(name, cues.duration, errors);
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
