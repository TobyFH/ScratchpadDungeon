const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, ".."),
    out = path.join(root, "test-results/environment-review");
  fs.mkdirSync(out, { recursive: true });
  const html = fs.readFileSync(path.join(root, "index.html")),
    s = http.createServer((q, r) => {
      r.setHeader("Content-Type", "text/html");
      r.end(html);
    });
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + s.address().port;
  const b = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    }),
    p = await b.newPage(),
    errors = [],
    external = [],
    shots = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (!r.url().startsWith(url) && !r.url().startsWith("data:"))
      external.push(r.url());
  });
  const shot = async (name) => {
    await p.evaluate(async () => {
      await document.fonts.ready;
      fitNotebook();
      fitDialogs();
    });
    await p.screenshot({
      path: path.join(out, name + ".png"),
      animations: "disabled",
    });
    shots.push(name);
  };
  try {
    await p.goto(url);
    for (const [width, height] of [
      [1920, 1080],
      [1280, 800],
      [390, 844],
      [320, 844],
    ]) {
      await p.setViewportSize({ width, height });
      for (const theme of ["overgrown", "lava", "unstable", "shadow", "maze"]) {
        await p.evaluate((theme) => {
          newRun("mage", { specialism: "defence" });
          setPace("skip");
          setPreference("skipCriticals", true);
          closeModal();
          closeSpotlight();
          state.autoplay = false;
          state.depth = 7;
          let seed = 71021;
          Math.random = () =>
            (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
          const wanted = {
            overgrown: "heartwood",
            lava: "crust",
            unstable: "faults",
            shadow: "lanterns",
            maze: "corridors",
          }[theme];
          for (let n = 0; n < 80; n++) {
            state.map = generateFloor(7, 1, 0, [], theme);
            const e = environmentState();
            if (wanted === "heartwood" ? e?.heartwood : e?.[wanted]?.length)
              break;
          }
          state.position = pos(1, 7);
          state.map.forEach((c) => (c.seen = true));
          const e = environmentState();
          if (theme === "shadow")
            for (const lamp of e.lanterns) {
              state.map[lamp.tile].visited = true;
              activateEnvironmentalArrival(lamp.tile);
            }
          if (theme === "unstable")
            e.faults.forEach((f, n) => (f.stage = n ? "cracked" : "unstable"));
          if (theme === "maze") e.corridors.forEach((s) => (s.layout = 1));
          render();
        }, theme);
        if (width <= 760) await p.locator("#map-wrap").scrollIntoViewIfNeeded();
        await shot(theme + "-" + width);
        if (theme === "lava")
          for (const phase of ["solid", "cracking"]) {
            await p.evaluate((phase) => {
              const e = environmentState();
              for (const f of e.crust) {
                f.phase = phase;
                f.remaining = phase === "solid" ? 5 : 1;
                f.tiles.forEach((i) => (state.map[i].wall = false));
              }
              render();
            }, phase);
            if (width <= 760)
              await p.locator("#map-wrap").scrollIntoViewIfNeeded();
            await shot("crust-" + phase + "-" + width);
          }
      }
      await p.evaluate(() => {
        let seed = 171;
        Math.random = () =>
          (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
        for (let n = 0; n < 60; n++) {
          state.map = generateFloor(7, 1, 0, [], "overgrown");
          if (environmentState()?.heartwood) break;
        }
        state.map.forEach((c) => (c.seen = true));
        render();
        window.treeChoice = confrontEnvironmentalBlock(
          environmentState().heartwood.tile,
        );
      });
      await p.locator("#environment-leave").waitFor();
      await shot("heartwood-choice-" + width);
      await p.locator("#environment-leave").click();
      await p.evaluate(() => window.treeChoice);
      await p.evaluate(() => help("heartwood"));
      await shot("guide-heartwood-" + width);
      await p.evaluate(() => closeModal());
    }
    const report = { shots, errors, external };
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2),
    );
    if (errors.length || external.length) throw Error(JSON.stringify(report));
    console.log(
      "Saved " +
        shots.length +
        " environmental captures; no browser errors or external requests.",
    );
  } finally {
    await b.close();
    await new Promise((r) => s.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
