// Actual current UI handlers, with intentional fixtures for visual review.
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
const { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, ".."),
    out = path.join(root, "test-results/curve-tuning");
  fs.mkdirSync(out, { recursive: true });
  const html = fs.readFileSync(path.join(root, "index.html")),
    s = http.createServer((_, r) => {
      r.setHeader("Content-Type", "text/html");
      r.end(html);
    });
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + s.address().port;
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
      if (!r.url().startsWith(url) && !r.url().startsWith("data:"))
        external.push(r.url());
    });
    await p.goto(url);
    const shot = async (name) => {
      await p.evaluate(async () => {
        await document.fonts.ready;
        fitNotebook();
        fitDialogs();
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
      });
      await p.screenshot({
        path: path.join(out, name + ".png"),
        animations: "disabled",
      });
      shots.push(name);
    };
    for (const [width, height] of [
      [1920, 1080],
      [1280, 800],
      [390, 844],
      [320, 844],
    ]) {
      await p.setViewportSize({ width, height });
      for (const job of [
        "fighter",
        "rogue",
        "mage",
        "ranger",
        "berserker",
        "jester",
      ]) {
        await p.evaluate((job) => {
          newRun(job, { specialism: job === "mage" ? "defence" : "offence" });
          setPace("skip");
          state.autoplay = false;
          state.autoresolve = false;
          state.party[0].points = 80;
          editor(0);
        }, job);
        await shot("workshop-" + job + "-" + width);
      }
    }
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
      [320, 844],
    ]) {
      await p.setViewportSize({ width, height });
      for (const contents of ["gold", "egg"]) {
        await p.evaluate((contents) => {
          newRun("mage", { specialism: "defence" });
          setPace("skip");
          state.depth = 6;
          state.bag = { potion: 1, ward: 1, bomb: 1 };
          const c = state.map[state.position];
          c.event = c.feature = "nest";
          c.nestContents = contents;
          window.previewNest = resolveExpansionTile(c);
        }, contents);
        await p.locator("#biome-leave").waitFor();
        await shot("nest-" + contents + "-" + width);
      }
    }
    await p.evaluate(() => {
      newRun("mage", { specialism: "defence" });
      setPace("skip");
      help("classes");
    });
    await shot("guide-classes-320");
    await p.evaluate(() => help("buffs"));
    await shot("guide-stimulants-320");
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.evaluate(() => {
      newRun("mage", { specialism: "defence" });
      setPace("skip");
      state.party.push(
        makeHero("Bram", "fighter", null, [], { specialism: "defence" }),
        makeHero("Wren", "rogue", null, [], { specialism: "offence" }),
      );
      state.depth = 7;
      beginEncounter(true, { stairBoss: true });
      finishOpeningRoll();
      render();
      applyStimulant(state.party[2], 3);
      for (let i = 0; i < 4; i++) applyStimulant(state.party[2], 4);
      render();
    });
    await shot("balanced-party-guardian-1280");
    const report = { shots, errors, external };
    fs.writeFileSync(
      path.join(out, "visual-report.json"),
      JSON.stringify(report, null, 2),
    );
    if (errors.length || external.length) throw Error(JSON.stringify(report));
    console.log(
      "Saved " +
        shots.length +
        " current tuning captures without browser errors or external assets.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => s.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
