const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
let browser, server, url;
const output = path.resolve(__dirname, "../test-results/battle-polish");
before(async () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"));
  fs.mkdirSync(output, { recursive: true });
  server = http.createServer((_, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${server.address().port}`;
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [], external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    if (!route.request().url().startsWith(url) && !route.request().url().startsWith("data:")) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(url);
  await page.evaluate(async () => {
    newRun("fighter");
    scheduleStunRecovery = () => {};
    characterLuck = () => .99999;
    setPace("skip");
    setPreference("shake", 0);
    await document.fonts.ready;
  });
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  });
  return page;
}
async function fight(page, count = 1) {
  await page.evaluate((count) => {
    closeModal(); closeSpotlight();
    beginEncounter(false, { count });
    finishOpeningRoll();
    state.enemies.forEach((e) => {
      e.hp = e.maxHp = 1000;
      e.countdown = 99;
      e.passive = null;
    });
    setEnemyBlock(0);
    render();
  }, count);
}

test("Display controls and their text stay inside the reserved panel, clear of each other and the footer in every palette/size", async (t) => {
  const p = await game(t);
  for (const [width, height] of [[1920, 1080], [1280, 800], [390, 844], [320, 844]]) {
    await p.setViewportSize({ width, height });
    for (const palette of ["default", "dark", "warm"]) {
      await p.evaluate(async (palette) => {
        setPalette(palette);
        optionsPage("display");
        fitDialogs();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }, palette);
      const r = await p.evaluate(() => {
        const panel = $(".settings-panel"), bounds = panel.getBoundingClientRect(),
          footer = $(".modal-actions").getBoundingClientRect(),
          controls = [...panel.querySelectorAll(".settings-column > label, .setting-actions > button")],
          overlaps = [], outside = [], textOutside = [];
        for (const [i, control] of controls.entries()) {
          const b = control.getBoundingClientRect();
          if (b.top < bounds.top - 1 || b.left < bounds.left - 1 || b.bottom > bounds.bottom + 1 || b.right > bounds.right + 1)
            outside.push(control.textContent);
          for (const other of controls.slice(i + 1)) {
            const c = other.getBoundingClientRect();
            if (Math.min(b.right, c.right) - Math.max(b.left, c.left) > 1 && Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top) > 1)
              overlaps.push([control.textContent, other.textContent]);
          }
          const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.textContent.trim() || node.parentElement.closest("select")) continue;
            const range = document.createRange(); range.selectNodeContents(node);
            for (const text of range.getClientRects())
              if (text.left < b.left - 1 || text.right > b.right + 1 || text.top < b.top - 1 || text.bottom > b.bottom + 1)
                textOutside.push(node.textContent);
          }
        }
        return { outside, overlaps, textOutside, footerGap: footer.top - bounds.bottom,
          scroll: panel.scrollHeight - panel.clientHeight, count: controls.length };
      });
      assert.equal(r.count, 9);
      assert.deepEqual(r.outside, [], `${width}/${palette}: outside panel`);
      assert.deepEqual(r.overlaps, [], `${width}/${palette}: overlaps`);
      assert.deepEqual(r.textOutside, [], `${width}/${palette}: text clipping`);
      assert.ok(r.footerGap >= 5, `${width}/${palette}: footer clearance ${r.footerGap}`);
      assert.ok(r.scroll <= 1, `${width}/${palette}: inner scrolling`);
      await p.screenshot({ path: path.join(output, `display-${width}-${palette}.png`) });
    }
  }
});

test("rearranged Display settings still update actual preferences and persist across pages/reload", async (t) => {
  const p = await game(t);
  await p.evaluate(() => optionsPage("display"));
  for (const [key, value] of [["brightness", "120"], ["shake", "70"], ["portraitMotion", "80"]]) {
    await p.locator(`#setting-${key}`).fill(value);
    await p.locator(`#setting-${key}`).dispatchEvent("input");
    assert.equal(await p.locator(`#value-${key}`).textContent(), value + "%");
  }
  for (const key of ["tileMotion", "ambientEffects", "fullScreenEffects"])
    await p.locator(`#setting-${key}`).uncheck();
  await p.selectOption("#option-palette", "dark");
  await p.locator("#tab-audio").click();
  await p.locator("#tab-display").click();
  await p.reload();
  const r = await p.evaluate(() => ({ p: preferences(), terrain: document.body.classList.contains("tile-motion-enabled") }));
  assert.equal(r.p.brightness, 1.2);
  assert.equal(r.p.shake, .7);
  assert.equal(r.p.portraitMotion, .8);
  assert.equal(r.p.tileMotion, false);
  assert.equal(r.p.ambientEffects, false);
  assert.equal(r.p.fullScreenEffects, false);
  assert.equal(r.terrain, false);
});

test("enemy stun reels share hero lock presentation, update in place and clear on recovery/death in solo and paired fights", async (t) => {
  const p = await game(t);
  for (const count of [1, 2]) {
    await fight(p, count);
    const r = await p.evaluate(() => {
      const e = state.enemies.at(-1);
      state.party.push(makeHero("Ivo", "mage"));
      state.party[0].stun = 1;
      render();
      stunEnemy(4, e);
      syncEnemy(e);
      const root = enemyArtEl(e).closest(".enemy-box"),
        shell = root.querySelector(".machine-shell"),
        face = shell.querySelector(".machine-face"),
        heroFace = $("#hero-0 .machine-face"),
        before = shell.getBoundingClientRect(),
        locked = { count: shell.querySelectorAll(".reel-unavailable.stun").length,
          text: shell.querySelector(".reel-unavailable").textContent,
          opacity: getComputedStyle(face).opacity, heroOpacity: getComputedStyle(heroFace).opacity,
          filter: getComputedStyle(face).filter, heroFilter: getComputedStyle(heroFace).filter,
          other: state.enemies.length === 2 ? $("#enemy .reel-unavailable") !== null : false };
      syncEnemy(e); syncStatusFX();
      locked.afterSync = shell.querySelectorAll(".reel-unavailable").length;
      tryBreakStun(e, { missedAction: true });
      const recovered = { count: shell.querySelectorAll(".reel-unavailable").length,
        opacity: getComputedStyle(face).opacity,
        sameFace: face === root.querySelector(".machine-face"),
        sameSize: before.height === shell.getBoundingClientRect().height,
        ward: e.stunWard };
      e.stun = 1; syncEnemy(e);
      const rerendered = drawMachine(enemyMachine(e), e.last, { enemy: true, disabled: true });
      e.hp = 0; syncEnemy(e);
      const dead = shell.querySelectorAll(".reel-unavailable").length;
      e.hp = 1000; e.stun = 1; syncEnemy(e);
      return { locked, recovered, dead, rerendered };
    });
    assert.equal(r.locked.count, 1);
    assert.equal(r.locked.afterSync, 1);
    assert.match(r.locked.text, /STUNNED/);
    assert.equal(r.locked.opacity, r.locked.heroOpacity);
    assert.equal(r.locked.filter, r.locked.heroFilter);
    assert.equal(r.locked.other, false);
    assert.equal(r.recovered.count, 0);
    assert.equal(r.recovered.opacity, "1");
    assert.equal(r.recovered.sameFace, true);
    assert.equal(r.recovered.sameSize, true);
    assert.equal(r.recovered.ward, 2);
    assert.equal(r.dead, 0);
    assert.match(r.rerendered, /reel-unavailable stun/);
    // Paired mobile machines have much smaller windows than hero machines.
    // The shared symbol and its explicit label must both fit, not just the veil.
    for (const width of [1280, 390, 320]) {
      await p.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
      const overflow = await p.locator(".enemy-box .reel-unavailable").evaluateAll((locks) =>
        locks.flatMap((lock) => {
          const b = lock.getBoundingClientRect();
          return [...lock.children].filter((child) => {
            const c = child.getBoundingClientRect();
            return c.left < b.left - 1 || c.right > b.right + 1 || c.top < b.top - 1 || c.bottom > b.bottom + 1;
          }).map((child) => child.tagName);
        }));
      assert.deepEqual(overflow, [], `${count} enemies at ${width}: stun contents fit`);
    }
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.screenshot({ path: path.join(output, `stunned-enemies-${count}.png`) });
  }
});

test("Venom Edge and Spellweave callouts agree with their exact mixed-roll bonuses", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const mark = (type) => ({ type, tier: 1 }),
      combo = (job, types) => complementaryEffects({ job }, types.map(mark));
    return {
      rogue: combo("rogue", ["attack", "poison", "stun"]),
      roguePure: combo("rogue", ["attack", "attack", "attack"]),
      mageHeal: combo("mage", ["magic", "heal", "block"]),
      mageBlock: combo("mage", ["poison", "block", "miss"]),
      mageRally: combo("mage", ["magic", "rally", "miss"]),
      magePure: combo("mage", ["magic", "magic", "magic"]),
    };
  });
  assert.deepEqual(r.rogue, { attack: 1 });
  assert.deepEqual(r.roguePure, {});
  assert.deepEqual(r.mageHeal, { magic: 1, heal: 1 });
  assert.deepEqual(r.mageBlock, { magic: 1, block: 1 });
  assert.deepEqual(r.mageRally, { magic: 1 });
  assert.deepEqual(r.magePure, {});
});

test("battle music produces bass/drums on the live music bus without RNG, stays pooled and obeys mute", async (t) => {
  const p = await game(t);
  await fight(p);
  await p.evaluate(() => {
    const create = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const gain = create.call(this);
      if (!window.polishAnalyser) {
        window.polishAnalyser = this.createAnalyser();
        polishAnalyser.fftSize = 8192;
        gain.connect(polishAnalyser);
      }
      return gain;
    };
    setPreference("musicVolume", .7);
    setPreference("sfxVolume", 0);
    setPreference("ambienceVolume", 0);
  });
  await p.mouse.click(8, 8);
  await p.evaluate(() => GameSound.unlock());
  await p.waitForFunction(() => GameSound.stats.musicParts.sub > 0 && GameSound.stats.musicParts.snare > 0);
  const r = await p.evaluate(async () => {
    const random = Math.random;
    let calls = 0, energy = 0, peak = 0;
    Math.random = () => { calls++; return .5; };
    try {
      for (let i = 0; i < 8; i++) {
        await new Promise((resolve) => setTimeout(resolve, 120));
        const spectrum = new Float32Array(polishAnalyser.frequencyBinCount);
        polishAnalyser.getFloatFrequencyData(spectrum);
        for (let bin = Math.ceil(30 * polishAnalyser.fftSize / GameSound.context.sampleRate);
          bin < 150 * polishAnalyser.fftSize / GameSound.context.sampleRate; bin++)
          energy += 10 ** (spectrum[bin] / 10);
        const samples = new Float32Array(polishAnalyser.fftSize);
        polishAnalyser.getFloatTimeDomainData(samples);
        peak = Math.max(peak, ...samples.map(Math.abs));
      }
      const parts = { ...GameSound.stats.musicParts };
      setPreference("musicVolume", 0);
      await new Promise((resolve) => setTimeout(resolve, 450));
      const quiet = new Float32Array(polishAnalyser.fftSize);
      polishAnalyser.getFloatTimeDomainData(quiet);
      const musicOffRms = Math.sqrt(quiet.reduce((s, n) => s + n * n, 0) / quiet.length);
      setPreference("musicVolume", .7);
      await new Promise((resolve) => setTimeout(resolve, 450));
      setPreference("muted", true);
      await new Promise((resolve) => setTimeout(resolve, 450));
      const samples = new Float32Array(polishAnalyser.fftSize);
      polishAnalyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((s, n) => s + n * n, 0) / samples.length);
      return { calls, energy, peak, rms, musicOffRms, parts, voices: GameSound.stats.peakVoices,
        battleTempo: BATTLE_MUSIC_SCORE.stepSeconds, explorationTempo: MUSIC_SCORE.stepSeconds };
    } finally { Math.random = random; }
  });
  assert.equal(r.calls, 0);
  assert.ok(r.energy > .00001, "real low-frequency output at 30–150 Hz");
  assert.ok(r.peak > .0001 && r.peak < .99, "audible, unclipped signal");
  assert.ok(r.rms < .00001, "music obeys master mute");
  assert.ok(r.musicOffRms < .00001, "the music slider silences the actual signal");
  for (const part of ["bass", "kick", "snare", "sub", "melody"])
    assert.ok(r.parts[part] > 0, part);
  assert.ok(r.voices <= 20);
  assert.ok(r.battleTempo < .29);
  assert.equal(r.explorationTempo, .42);
  fs.writeFileSync(path.join(output, "music-validation.json"), JSON.stringify(r, null, 2));
});
